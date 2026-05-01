import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Separator } from '@/components/ui/Separator'
import { cn } from '@/lib/utils'
import { createDevice, updateDevice, useStore } from '@/lib/store'
import type { Device, DeviceStatus, DeviceType, RackFace } from '@/lib/types'

const DEVICE_TYPES: DeviceType[] = [
  'switch',
  'router',
  'firewall',
  'server',
  'storage',
  'patch_panel',
  'pdu',
  'ups',
  'kvm',
  'other',
]

const STATUS_OPTIONS: DeviceStatus[] = ['online', 'offline', 'warning', 'maintenance', 'unknown']

interface FormState {
  hostname: string
  displayName: string
  deviceType: DeviceType
  manufacturer: string
  model: string
  serial: string
  managementIp: string
  status: DeviceStatus
  rackId: string
  startU: string
  heightU: string
  face: RackFace
  tags: string
  notes: string
}

function blankForm(defaults?: Partial<FormState>): FormState {
  return {
    hostname: '',
    displayName: '',
    deviceType: 'server',
    manufacturer: '',
    model: '',
    serial: '',
    managementIp: '',
    status: 'unknown',
    rackId: '',
    startU: '',
    heightU: '1',
    face: 'front',
    tags: '',
    notes: '',
    ...defaults,
  }
}

function deviceToForm(device: Device): FormState {
  return {
    hostname: device.hostname,
    displayName: device.displayName ?? '',
    deviceType: device.deviceType,
    manufacturer: device.manufacturer ?? '',
    model: device.model ?? '',
    serial: device.serial ?? '',
    managementIp: device.managementIp ?? '',
    status: device.status,
    rackId: device.rackId ?? '',
    startU: device.startU != null ? String(device.startU) : '',
    heightU: device.heightU != null ? String(device.heightU) : '1',
    face: device.face ?? 'front',
    tags: (device.tags ?? []).join(', '),
    notes: device.notes ?? '',
  }
}

interface DeviceDrawerProps {
  device?: Device
  defaultRackId?: string
  open: boolean
  onClose: () => void
  onSaved?: (device: Device) => void
}

export function DeviceDrawer({ device, defaultRackId, open, onClose, onSaved }: DeviceDrawerProps) {
  const racks = useStore((s) => s.racks)
  const isEdit = !!device
  const [form, setForm] = useState<FormState>(() =>
    device ? deviceToForm(device) : blankForm({ rackId: defaultRackId ?? '' }),
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(device ? deviceToForm(device) : blankForm({ rackId: defaultRackId ?? '' }))
      setError('')
    }
  }, [defaultRackId, device, open])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.hostname.trim()) {
      setError('Hostname is required.')
      return
    }

    setSaving(true)
    try {
      const tags = form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)

      const payload = {
        hostname: form.hostname.trim(),
        displayName: form.displayName.trim() || undefined,
        deviceType: form.deviceType,
        manufacturer: form.manufacturer.trim() || undefined,
        model: form.model.trim() || undefined,
        serial: form.serial.trim() || undefined,
        managementIp: form.managementIp.trim() || undefined,
        status: form.status,
        rackId: hasRackPlacement ? form.rackId : undefined,
        startU: hasRackPlacement && form.startU ? parseInt(form.startU, 10) : undefined,
        heightU: hasRackPlacement ? (form.heightU ? parseInt(form.heightU, 10) : 1) : undefined,
        face: hasRackPlacement ? form.face : undefined,
        tags: tags.length > 0 ? tags : undefined,
        notes: form.notes.trim() || undefined,
      }

      const saved = isEdit && device
        ? await updateDevice(device.id, payload)
        : await createDevice(payload)

      if (saved) {
        onSaved?.(saved)
        onClose()
      } else {
        setError('Failed to save device. Please try again.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save device. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const hasRackPlacement = !!form.rackId

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={onClose}
          />

          <motion.aside
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 z-40 flex h-full w-[440px] flex-col border-l border-[var(--color-line-strong)] bg-[var(--color-bg-2)]"
            style={{ boxShadow: '-16px 0 48px rgb(0 0 0 / 0.4)' }}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
                  {isEdit ? 'Edit' : 'New'}
                </div>
                <h2 className="text-sm font-semibold tracking-tight text-[var(--color-fg)]">
                  {isEdit ? device.hostname : 'Add device'}
                </h2>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X />
              </Button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
                <Section label="Identity">
                  <Field label="Hostname *">
                    <Input
                      value={form.hostname}
                      onChange={(e) => set('hostname', e.target.value)}
                      placeholder="e.g. core-sw-01"
                      autoFocus
                    />
                  </Field>
                  <Field label="Display name">
                    <Input
                      value={form.displayName}
                      onChange={(e) => set('displayName', e.target.value)}
                      placeholder="e.g. Core Switch"
                    />
                  </Field>
                  <Field label="Device type">
                    <Select value={form.deviceType} onChange={(value) => set('deviceType', value as DeviceType)}>
                      {DEVICE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type.replace('_', ' ')}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Status">
                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => set('status', status)}
                          className={cn(
                            'rounded-[var(--radius-xs)] border px-2 py-1 font-mono text-[10px] uppercase tracking-wider capitalize transition-colors',
                            form.status === status
                              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-strong)]'
                              : 'border-[var(--color-line)] text-[var(--color-fg-muted)] hover:border-[var(--color-line-strong)]',
                          )}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </Field>
                </Section>

                <Separator />

                <Section label="Hardware">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Manufacturer">
                      <Input
                        value={form.manufacturer}
                        onChange={(e) => set('manufacturer', e.target.value)}
                        placeholder="e.g. Cisco"
                      />
                    </Field>
                    <Field label="Model">
                      <Input
                        value={form.model}
                        onChange={(e) => set('model', e.target.value)}
                        placeholder="e.g. C9300-48P"
                      />
                    </Field>
                  </div>
                  <Field label="Serial number">
                    <Input
                      value={form.serial}
                      onChange={(e) => set('serial', e.target.value)}
                      placeholder="e.g. FOC2134X0AB"
                    />
                  </Field>
                  <Field label="Management IP">
                    <Input
                      value={form.managementIp}
                      onChange={(e) => set('managementIp', e.target.value)}
                      placeholder="e.g. 10.0.10.12"
                    />
                  </Field>
                </Section>

                <Separator />

                <Section label="Rack placement">
                  <Field label="Rack">
                    <Select value={form.rackId} onChange={(value) => set('rackId', value)}>
                      <option value="">-- unracked --</option>
                      {racks.map((rack) => (
                        <option key={rack.id} value={rack.id}>
                          {rack.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {hasRackPlacement && (
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Start U">
                        <Input
                          type="number"
                          min={1}
                          max={48}
                          value={form.startU}
                          onChange={(e) => set('startU', e.target.value)}
                          placeholder="e.g. 12"
                        />
                      </Field>
                      <Field label="Height (U)">
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={form.heightU}
                          onChange={(e) => set('heightU', e.target.value)}
                          placeholder="1"
                        />
                      </Field>
                      <Field label="Face">
                        <Select value={form.face} onChange={(value) => set('face', value as RackFace)}>
                          <option value="front">Front</option>
                          <option value="rear">Rear</option>
                        </Select>
                      </Field>
                    </div>
                  )}
                </Section>

                <Separator />

                <Section label="Metadata">
                  <Field label="Tags (comma-separated)">
                    <Input
                      value={form.tags}
                      onChange={(e) => set('tags', e.target.value)}
                      placeholder="e.g. core, managed, poe"
                    />
                  </Field>
                  <Field label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(e) => set('notes', e.target.value)}
                      placeholder="Any additional notes..."
                      rows={3}
                      className={cn(
                        'w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2.5 py-2 text-sm font-sans',
                        'text-[var(--color-fg)] placeholder:text-[var(--color-fg-faint)]',
                        'focus-visible:border-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-soft)]',
                      )}
                    />
                  </Field>
                </Section>
              </div>

              <div className="border-t border-[var(--color-line)] px-5 py-3">
                {error && <p className="mb-2 text-xs text-[var(--color-err)]">{error}</p>}
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="default" size="sm" disabled={saving}>
                    <Save className="size-3.5" />
                    {isEdit ? 'Save changes' : 'Add device'}
                  </Button>
                </div>
              </div>
            </form>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-fg-subtle)]">
        {label}
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-bg)] px-2 text-sm font-sans',
        'text-[var(--color-fg)] capitalize',
        'focus-visible:border-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent-soft)]',
      )}
    >
      {children}
    </select>
  )
}
