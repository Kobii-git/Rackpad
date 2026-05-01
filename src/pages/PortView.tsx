import { useEffect, useMemo, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { PortGrid } from '@/components/ports/PortGrid'
import { PortList } from '@/components/ports/PortList'
import { Card, CardBody, CardHeader, CardHeading, CardLabel, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Mono } from '@/components/shared/Mono'
import { StatusDot } from '@/components/shared/StatusDot'
import { DeviceTypeIcon } from '@/components/shared/DeviceTypeIcon'
import {
  canEditInventory,
  createPortRecord,
  deletePortRecord,
  updatePort,
  useStore,
} from '@/lib/store'
import type { Device, Port, PortLink } from '@/lib/types'
import { ArrowRight, Plus, Save, Trash2 } from 'lucide-react'

const PORT_BEARING: Device['deviceType'][] = [
  'switch',
  'router',
  'firewall',
  'patch_panel',
  'server',
  'storage',
]

const LINK_STATES: Port['linkState'][] = ['up', 'down', 'disabled', 'unknown']
const PORT_KINDS: Port['kind'][] = ['rj45', 'sfp', 'sfp_plus', 'qsfp', 'fiber', 'power', 'console', 'usb']

interface PortFormState {
  name: string
  kind: Port['kind']
  speed: string
  linkState: Port['linkState']
  vlanId: string
  description: string
  face: NonNullable<Port['face']>
}

function portToForm(port: Port): PortFormState {
  return {
    name: port.name,
    kind: port.kind,
    speed: port.speed ?? '',
    linkState: port.linkState,
    vlanId: port.vlanId ?? '',
    description: port.description ?? '',
    face: port.face ?? 'front',
  }
}

const EMPTY_PORT_FORM: PortFormState = {
  name: '',
  kind: 'rj45',
  speed: '',
  linkState: 'down',
  vlanId: '',
  description: '',
  face: 'front',
}

export default function PortView() {
  const currentUser = useStore((s) => s.currentUser)
  const devices = useStore((s) => s.devices)
  const ports = useStore((s) => s.ports)
  const portLinks = useStore((s) => s.portLinks)
  const vlans = useStore((s) => s.vlans)
  const canEdit = canEditInventory(currentUser)
  const portBearingDevices = devices.filter((device) => PORT_BEARING.includes(device.deviceType))
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [selectedPortId, setSelectedPortId] = useState<string | undefined>()
  const [form, setForm] = useState<PortFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!portBearingDevices.length) return
    if (!selectedDeviceId || !portBearingDevices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(portBearingDevices[0].id)
      setSelectedPortId(undefined)
    }
  }, [portBearingDevices, selectedDeviceId])

  const deviceById = useMemo(() => {
    return devices.reduce<Record<string, Device>>((acc, device) => {
      acc[device.id] = device
      return acc
    }, {})
  }, [devices])

  const portsByDeviceId = useMemo(() => {
    return ports.reduce<Record<string, Port[]>>((acc, port) => {
      ;(acc[port.deviceId] ??= []).push(port)
      return acc
    }, {})
  }, [ports])

  const portById = useMemo(() => {
    return ports.reduce<Record<string, Port>>((acc, port) => {
      acc[port.id] = port
      return acc
    }, {})
  }, [ports])

  const linkByPortId = useMemo(() => {
    return portLinks.reduce<Record<string, PortLink>>((acc, link) => {
      acc[link.fromPortId] = link
      acc[link.toPortId] = link
      return acc
    }, {})
  }, [portLinks])

  const device = deviceById[selectedDeviceId]
  const devicePorts = portsByDeviceId[selectedDeviceId] ?? []

  useEffect(() => {
    if (!devicePorts.length) {
      setSelectedPortId(undefined)
      return
    }
    if (!selectedPortId || !devicePorts.some((port) => port.id === selectedPortId)) {
      setSelectedPortId(devicePorts[0].id)
    }
  }, [devicePorts, selectedPortId])

  const selectedPort = !creating && selectedPortId ? portById[selectedPortId] : undefined
  const selectedLink = selectedPort ? linkByPortId[selectedPort.id] : undefined
  const peerPortId = selectedPort && selectedLink
    ? (selectedLink.fromPortId === selectedPort.id ? selectedLink.toPortId : selectedLink.fromPortId)
    : undefined
  const peerPort = peerPortId ? portById[peerPortId] : undefined
  const peerDevice = peerPort ? deviceById[peerPort.deviceId] : undefined

  useEffect(() => {
    if (creating) {
      setForm(EMPTY_PORT_FORM)
      setError('')
      return
    }
    setForm(selectedPort ? portToForm(selectedPort) : null)
    setError('')
  }, [creating, selectedPort])

  const isVisualGrid =
    device &&
    (device.deviceType === 'switch' || device.deviceType === 'patch_panel' || device.deviceType === 'router')

  const linkedCount = devicePorts.filter((port) => port.linkState === 'up').length
  const totalCableCount = portLinks.length

  async function handleSave() {
    if (!device || !form) return

    setSaving(true)
    setError('')
    try {
      if (creating) {
        const created = await createPortRecord({
          deviceId: device.id,
          name: form.name.trim(),
          kind: form.kind,
          speed: form.speed.trim() || undefined,
          linkState: form.linkState,
          vlanId: form.vlanId || undefined,
          description: form.description.trim() || undefined,
          face: form.face,
          position: (devicePorts.at(-1)?.position ?? 0) + 1,
        })
        setCreating(false)
        setSelectedPortId(created.id)
      } else if (selectedPort) {
        await updatePort(selectedPort.id, {
          name: form.name.trim(),
          kind: form.kind,
          speed: form.speed.trim() || undefined,
          linkState: form.linkState,
          vlanId: form.vlanId || undefined,
          description: form.description.trim() || undefined,
          face: form.face,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update port.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedPort) return
    if (!window.confirm(`Delete port ${selectedPort.name}?`)) return

    setDeleting(true)
    setError('')
    try {
      await deletePortRecord(selectedPort.id)
      setSelectedPortId(undefined)
    } catch (err) {