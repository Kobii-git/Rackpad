param(
  [string]$OutputPath = ".\rackpad-hyperv-inventory.json",
  [switch]$IncludeHostAdapters
)

$ErrorActionPreference = "Stop"

function Get-PropertyValue {
  param(
    [Parameter(Mandatory = $true)]$Object,
    [Parameter(Mandatory = $true)][string]$Name,
    $Default = $null
  )

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $Default
  }
  return $property.Value
}

function Convert-BytesToGb {
  param($Bytes)
  if ($null -eq $Bytes) {
    return $null
  }
  return [math]::Round(([double]$Bytes / 1GB), 2)
}

function Convert-VlanList {
  param($Value)
  if ($null -eq $Value) {
    return @()
  }
  if ($Value -is [array]) {
    return @($Value | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" })
  }
  $text = "$Value".Trim()
  if ($text -eq "" -or $text -eq "0") {
    return @()
  }
  return @($text -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
}

function Read-AdapterVlan {
  param($Adapter)
  try {
    $vlan = Get-VMNetworkAdapterVlan -VMNetworkAdapter $Adapter
  } catch {
    return @{
      mode = "unknown"
      accessVlanId = $null
      nativeVlanId = $null
      allowedVlanIds = @()
      raw = $_.Exception.Message
    }
  }

  $mode = Get-PropertyValue $vlan "OperationMode" "unknown"
  return @{
    mode = "$mode"
    accessVlanId = Get-PropertyValue $vlan "AccessVlanId"
    nativeVlanId = Get-PropertyValue $vlan "NativeVlanId"
    allowedVlanIds = Convert-VlanList (Get-PropertyValue $vlan "AllowedVlanIdList")
    primaryVlanId = Get-PropertyValue $vlan "PrimaryVlanId"
    secondaryVlanIdList = Convert-VlanList (Get-PropertyValue $vlan "SecondaryVlanIdList")
  }
}

function Read-VhdInfo {
  param($Disk)
  $vhd = $null
  if ($Disk.Path) {
    try {
      $vhd = Get-VHD -Path $Disk.Path
    } catch {
      $vhd = $null
    }
  }

  return @{
    path = $Disk.Path
    controllerType = "$($Disk.ControllerType)"
    controllerNumber = $Disk.ControllerNumber
    controllerLocation = $Disk.ControllerLocation
    diskNumber = Get-PropertyValue $Disk "DiskNumber"
    sizeBytes = if ($vhd) { $vhd.Size } else { $null }
    sizeGb = if ($vhd) { Convert-BytesToGb $vhd.Size } else { $null }
    fileSizeBytes = if ($vhd) { $vhd.FileSize } else { $null }
    vhdType = if ($vhd) { "$($vhd.VhdType)" } else { $null }
  }
}

function Sum-DiskSizeGb {
  param($Disks)
  $total = 0
  foreach ($disk in @($Disks)) {
    $value = $disk["sizeGb"]
    if ($null -ne $value) {
      $total += [double]$value
    }
  }
  return [math]::Round($total, 2)
}

function Get-MapValue {
  param(
    [Parameter(Mandatory = $true)]$Map,
    [Parameter(Mandatory = $true)][string[]]$Names
  )

  foreach ($name in $Names) {
    if ($Map.ContainsKey($name)) {
      $value = $Map[$name]
      if ($null -ne $value -and "$value".Trim() -ne "") {
        return "$value".Trim()
      }
    }
  }
  return $null
}

function Join-VersionParts {
  param($Map)

  $parts = @(
    Get-MapValue $Map @("OSMajorVersion")
    Get-MapValue $Map @("OSMinorVersion")
    Get-MapValue $Map @("OSBuildNumber")
  ) | Where-Object { $null -ne $_ -and "$_".Trim() -ne "" }

  if ($parts.Count -gt 0) {
    return ($parts -join ".")
  }
  return $null
}

function Read-GuestKvp {
  param([Parameter(Mandatory = $true)][string]$VmId)

  $result = [ordered]@{
    kvpAvailable = $false
    osName = $null
    osVersion = $null
    osBuildNumber = $null
    computerName = $null
    fullyQualifiedDomainName = $null
    integrationServicesVersion = $null
    error = $null
  }

  try {
    $vmSystem = Get-CimInstance -Namespace "root\virtualization\v2" -ClassName "Msvm_ComputerSystem" -ErrorAction Stop |
      Where-Object { $_.Name -eq $VmId } |
      Select-Object -First 1

    if (-not $vmSystem) {
      $result["error"] = "Hyper-V CIM record not found."
      return $result
    }

    $kvp = Get-CimAssociatedInstance -InputObject $vmSystem -Association "Msvm_SystemDevice" -ResultClassName "Msvm_KvpExchangeComponent" -ErrorAction Stop |
      Select-Object -First 1

    if (-not $kvp) {
      $result["error"] = "Hyper-V KVP exchange component not found."
      return $result
    }

    $map = @{}
    foreach ($item in @($kvp.GuestIntrinsicExchangeItems)) {
      if (-not $item) {
        continue
      }

      try {
        [xml]$xml = $item
        $nameProp = @($xml.INSTANCE.PROPERTY | Where-Object { $_.NAME -eq "Name" } | Select-Object -First 1)[0]
        $dataProp = @($xml.INSTANCE.PROPERTY | Where-Object { $_.NAME -eq "Data" } | Select-Object -First 1)[0]
        $name = if ($nameProp) { "$($nameProp.VALUE)".Trim() } else { "" }
        $data = if ($dataProp) { "$($dataProp.VALUE)".Trim() } else { "" }
        if ($name -ne "") {
          $map[$name] = $data
        }
      } catch {
        # Ignore malformed KVP entries; the remaining entries are still useful.
      }
    }

    $result["kvpAvailable"] = $map.Count -gt 0
    $result["osName"] = Get-MapValue $map @("OSName", "OS Name")
    $result["osVersion"] = Get-MapValue $map @("OSVersion")
    if (-not $result["osVersion"]) {
      $result["osVersion"] = Join-VersionParts $map
    }
    $result["osBuildNumber"] = Get-MapValue $map @("OSBuildNumber", "BuildNumber")
    $result["computerName"] = Get-MapValue $map @("ComputerName", "HostName")
    $result["fullyQualifiedDomainName"] = Get-MapValue $map @("FullyQualifiedDomainName", "FQDN")
    $result["integrationServicesVersion"] = Get-MapValue $map @("IntegrationServicesVersion")

    if ($map.Count -eq 0) {
      $result["error"] = "Guest KVP returned no intrinsic data."
    }
  } catch {
    $result["error"] = $_.Exception.Message
  }

  return $result
}

if (-not (Get-Module -ListAvailable -Name Hyper-V)) {
  throw "The Hyper-V PowerShell module is not installed or not available in this session."
}

Import-Module Hyper-V

$computerSystem = Get-CimInstance Win32_ComputerSystem
$operatingSystem = Get-CimInstance Win32_OperatingSystem
$processors = @(Get-CimInstance Win32_Processor)
$computerName = $env:COMPUTERNAME

$switches = @(Get-VMSwitch | ForEach-Object {
  @{
    id = "$($_.Id)"
    name = $_.Name
    kind = "$($_.SwitchType)"
    notes = $_.Notes
    netAdapterInterfaceDescription = Get-PropertyValue $_ "NetAdapterInterfaceDescription"
    netAdapterName = Get-PropertyValue $_ "NetAdapterName"
    allowManagementOS = Get-PropertyValue $_ "AllowManagementOS"
    bandwidthReservationMode = "$($_.BandwidthReservationMode)"
  }
})

$hostAdapters = @()
if ($IncludeHostAdapters) {
  try {
    $hostAdapters = @(Get-NetAdapter | ForEach-Object {
      $adapter = $_
      $ipConfig = @(Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue)
      @{
        name = $adapter.Name
        interfaceDescription = $adapter.InterfaceDescription
        macAddress = $adapter.MacAddress
        status = "$($adapter.Status)"
        linkSpeed = "$($adapter.LinkSpeed)"
        ipAddresses = @($ipConfig | ForEach-Object { $_.IPAddress })
      }
    })
  } catch {
    $hostAdapters = @()
  }
}

$vms = @(Get-VM | Sort-Object Name | ForEach-Object {
  $vm = $_
  $processor = $null
  $memory = $null
  try { $processor = Get-VMProcessor -VM $vm } catch { $processor = $null }
  try { $memory = Get-VMMemory -VM $vm } catch { $memory = $null }
  $guest = Read-GuestKvp -VmId "$($vm.Id)"

  $disks = @(Get-VMHardDiskDrive -VM $vm | ForEach-Object { Read-VhdInfo $_ })
  $networkAdapters = @(Get-VMNetworkAdapter -VM $vm | ForEach-Object {
    $adapter = $_
    $vlan = Read-AdapterVlan $adapter
    @{
      id = "$($adapter.Id)"
      name = $adapter.Name
      switchName = $adapter.SwitchName
      macAddress = $adapter.MacAddress
      status = "$($adapter.Status)"
      connected = [bool]$adapter.Connected
      isLegacy = [bool](Get-PropertyValue $adapter "IsLegacy")
      ipAddresses = @($adapter.IPAddresses | Where-Object { $_ -match "^\d{1,3}(\.\d{1,3}){3}$" })
      vlan = $vlan
      dhcpGuard = "$($adapter.DhcpGuard)"
      routerGuard = "$($adapter.RouterGuard)"
      portMirroringMode = "$($adapter.PortMirroringMode)"
      minimumBandwidthWeight = Get-PropertyValue $adapter "MinimumBandwidthWeight"
      maximumBandwidth = Get-PropertyValue $adapter "MaximumBandwidth"
    }
  })

  @{
    id = "$($vm.Id)"
    name = $vm.Name
    state = "$($vm.State)"
    generation = $vm.Generation
    version = "$($vm.Version)"
    uptimeSeconds = if ($vm.Uptime) { [int64]$vm.Uptime.TotalSeconds } else { 0 }
    processorCount = if ($processor) { $processor.Count } else { $null }
    memoryAssignedBytes = $vm.MemoryAssigned
    memoryAssignedGb = Convert-BytesToGb $vm.MemoryAssigned
    memoryStartupBytes = if ($memory) { $memory.Startup } else { $null }
    memoryStartupGb = if ($memory) { Convert-BytesToGb $memory.Startup } else { $null }
    dynamicMemoryEnabled = if ($memory) { [bool]$memory.DynamicMemoryEnabled } else { $false }
    memoryMinimumBytes = if ($memory) { $memory.Minimum } else { $null }
    memoryMaximumBytes = if ($memory) { $memory.Maximum } else { $null }
    storageGb = Sum-DiskSizeGb $disks
    disks = $disks
    networkAdapters = $networkAdapters
    guest = $guest
    notes = $vm.Notes
  }
})

$payload = [ordered]@{
  schema = "rackpad.hyperv.inventory.v1"
  collectedAt = (Get-Date).ToUniversalTime().ToString("o")
  host = @{
    computerName = $computerName
    fqdn = [System.Net.Dns]::GetHostEntry($computerName).HostName
    manufacturer = $computerSystem.Manufacturer
    model = $computerSystem.Model
    logicalProcessors = ($processors | Measure-Object -Property NumberOfLogicalProcessors -Sum).Sum
    memoryGb = Convert-BytesToGb $computerSystem.TotalPhysicalMemory
    osCaption = $operatingSystem.Caption
    osVersion = $operatingSystem.Version
  }
  switches = $switches
  hostAdapters = $hostAdapters
  vms = $vms
}

$json = $payload | ConvertTo-Json -Depth 12
$resolvedPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$json | Set-Content -Path $resolvedPath -Encoding UTF8

Write-Host "Rackpad Hyper-V inventory written to $resolvedPath"
