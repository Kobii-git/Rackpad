# Hyper-V Import

Rackpad can stage a Hyper-V host inventory from a JSON file generated on the
Hyper-V server. The importer is review-first: it shows the host, virtual
switches, VMs, virtual NICs, VLAN data, IPs, CPU, memory, disks, and notes
before anything is written. When Hyper-V integration services expose guest KVP
data, the collector also stages guest OS, OS version, computer name, FQDN, and
power state.

Nothing is imported until you review the wizard and click `Import selected`.

## What Rackpad Can Import

- Hyper-V host as a server device.
- VM device records with parent-host links.
- VM power state mapped to Rackpad health.
- Guest OS, OS version, guest computer name, and FQDN where Hyper-V KVP exposes it.
- CPU, memory, storage, VM generation, config version, and disk notes.
- Virtual switches as compute bridge records.
- VM network adapters as virtual ports.
- Access VLAN, trunk native VLAN, and tagged/allowed VLAN metadata.
- Management IPs and additional IPAM assignments when matching Rackpad subnets exist.
- Host adapters when `-IncludeHostAdapters` is used.

## 1. Collect Inventory On The Hyper-V Host

Open PowerShell as Administrator on the Hyper-V host:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\collect-hyperv.ps1 -OutputPath .\rackpad-hyperv-inventory.json -IncludeHostAdapters
```

If you copied only the script to the host, run it from that folder:

```powershell
.\collect-hyperv.ps1 -OutputPath .\rackpad-hyperv-inventory.json -IncludeHostAdapters
```

The collector uses local Hyper-V PowerShell cmdlets only. It does not send data
anywhere.

Expected output:

```text
Rackpad Hyper-V inventory written to C:\...\rackpad-hyperv-inventory.json
```

The JSON file is safe to inspect before upload, but it may contain internal host
names, IP addresses, MAC addresses, switch names, and VM notes.

## 2. Import In Rackpad

1. Open `Imports` in Rackpad.
2. Upload `rackpad-hyperv-inventory.json`.
3. Choose the categories to import:
   - Host record
   - VMs
   - CPU, RAM, and disks
   - Guest OS and integration-service details
   - IPs
   - Virtual switches
   - Virtual ports
   - VLANs
4. Review every VM and fill in anything Hyper-V could not report.
5. Click `Import selected`.

## Review Wizard Checklist

Before importing, check:

- The Hyper-V host name matches the Rackpad server record you want to create or update.
- VM hostnames are clean and unique.
- Guest OS fields are correct. Linux guests may appear as `Linux (kernel x.y.z)` when Hyper-V reports only a kernel version.
- Primary IPs are in Rackpad IPAM subnets if you want assignments created automatically.
- Any IP conflict badges are intentional. Rackpad skips conflicting primary IPs instead of overwriting existing IPAM assignments.
- Access/trunk VLANs look right, especially firewalls and multi-NIC VMs.
- The selected category toggles match what you want imported this pass.

## Recommended Import Order

For a clean first import:

1. Create or import VLAN ranges and IPAM subnets first if you already know them.
2. Run the Hyper-V collector with `-IncludeHostAdapters`.
3. Import the host, virtual switches, VMs, specs, ports, VLANs, and IPs.
4. Open `Compute` to review host/VM relationships and bridges.
5. Open `Ports` to review virtual NICs and VLAN mode.
6. Open `IPAM` to review created assignments.

You can rerun the collector later and re-import. Existing devices are matched by
hostname/display name and updated rather than duplicated.

## Notes And Limits

- Guest IPs require Hyper-V integration services or guest services that expose
  IP addresses to the host.
- Guest OS details use Hyper-V KVP/integration services. Some powered-off VMs,
  older guest tools, or locked-down guests may not report OS data; fill those
  fields manually in the importer wizard before importing.
- Some Linux guests expose only a kernel version through Hyper-V KVP. Rackpad
  stages those as `Linux (kernel x.y.z)` so they can still be filtered and
  tagged as Linux before import.
- VM power state is staged from Hyper-V and maps to Rackpad health: `Running`
  becomes online, `Off` becomes offline, and `Paused`/`Saved` become
  maintenance.
- IPs are only written into IPAM when they fall inside an existing Rackpad
  subnet. If a subnet is missing, create it first or keep the IP in the staged
  notes.
- VLAN ranges such as `1-4094` are recorded in port notes but are not expanded
  into thousands of VLAN records. Discrete VLAN IDs are imported.
- Existing devices are matched by hostname/display name and updated rather than
  duplicated.

## Troubleshooting

### PowerShell says the Hyper-V module is missing

Run the script on the Hyper-V host itself, from an elevated PowerShell session.
The collector requires the local Hyper-V PowerShell module.

### Powered-off VMs have no guest OS

That is expected. Powered-off guests usually do not expose KVP/integration data.
You can still import the VM and fill in OS details manually in the wizard.

### Linux guests show only a kernel version

Some Linux integration services expose `6.8.0`, `6.11.0`, or similar but not the
distro name. Rackpad stages those as Linux and lets you edit the OS name before
import.

### IPs are missing

Hyper-V can only report IPs exposed by the guest integration services. If IPs
are missing, fill in the primary IP manually in the wizard, or import the VM
first and add IPAM assignments later.
