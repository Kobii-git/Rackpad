const PORT_KINDS = ['rj45', 'sfp', 'sfp_plus', 'qsfp', 'fiber', 'power', 'console', 'usb'] as const
export type PortTemplateKind = (typeof PORT_KINDS)[number]

export interface PortTemplate {
  id: string
  name: string
  deviceTypes: string[]
  description: string
  ports: Array<{
    name: string
    kind: PortTemplateKind
    speed?: string
    face?: 'front' | 'rear'
  }>
}

function rangeNames(prefix: string, count: number, kind: PortTemplateKind, speed?: string) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix}${index + 1}`,
    kind,
    speed,
    face: 'front' as const,
  }))
}

function mapWithPositions(
  ports: Array<{ name: string; kind: PortTemplateKind; speed?: string; face?: 'front' | 'rear' }>,
) {
  return ports.map((port, index) => ({
    ...port,
    face: port.face ?? 'front',
    position: index + 1,
  }))
}

export const PORT_TEMPLATES: PortTemplate[] = [
  {
    id: 'switch-24g-4sfp+',
    name: '24x1G + 4x10G SFP+',
    deviceTypes: ['switch'],
    description: 'Common 24-port access switch with 4 SFP+ uplinks.',
    ports: mapWithPositions([
      ...rangeNames('', 24, 'rj45', '1G'),
      ...rangeNames('SFP+', 4, 'sfp_plus', '10G'),
    ]),
  },
  {
    id: 'switch-48g-4sfp+',
    name: '48x1G + 4x10G SFP+',
    deviceTypes: ['switch'],
    description: 'Common 48-port access switch with 4 SFP+ uplinks.',
    ports: mapWithPositions([
      ...rangeNames('', 48, 'rj45', '1G'),
      ...rangeNames('SFP+', 4, 'sfp_plus', '10G'),
    ]),
  },
  {
    id: 'switch-28sfp+',
    name: '28x10G SFP+',
    deviceTypes: ['switch'],
    description: 'Aggregation switch with 28 SFP+ ports.',
    ports: mapWithPositions(rangeNames('SFP+', 28, 'sfp_plus', '10G')),
  },
  {
    id: 'firewall-6x1g',
    name: '6x1G firewall',
    deviceTypes: ['firewall', 'router'],
    description: 'Firewall or router with six 1G copper ports.',
    ports: mapWithPositions(
      Array.from({ length: 6 }, (_, index) => ({
        name: `igb${index}`,
        kind: 'rj45' as const,
        speed: '1G',
      })),
    ),
  },
  {
    id: 'server-4x1g-2x10g',
    name: '4x1G + 2x10G server',
    deviceTypes: ['server', 'storage'],
    description: 'Server with four 1G ports and two 10G uplinks.',
    ports: mapWithPositions([
      ...Array.from({ length: 4 }, (_, index) => ({
        name: `eno${index + 1}`,
        kind: 'rj45' as const,
        speed: '1G',
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        name: `enp1s0f${index}`,
        kind: 'sfp_plus' as const,
        speed: '10G',
      })),
    ]),
  },
  {
    id: 'server-2x1g-2x10g',
    name: '2x1G + 2x10G server',
    deviceTypes: ['server', 'storage'],
    description: 'Compact server with two 1G ports and two 10G uplinks.',
    ports: mapWithPositions([
      ...Array.from({ length: 2 }, (_, index) => ({
        name: `eno${index + 1}`,
        kind: 'rj45' as const,
        speed: '1G',
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        name: `enp1s0f${index}`,
        kind: 'sfp_plus' as const,
        speed: '10G',
      })),
    ]),
  },
  {
    id: 'patch-panel-24',
    name: '24-port patch panel',
    deviceTypes: ['patch_panel'],
    description: 'Twenty-four copper patch panel ports.',
    ports: mapWithPositions(rangeNames('', 24, 'rj45', '1G')),
  },
  {
    id: 'pdu-8',
    name: '8-outlet PDU',
    deviceTypes: ['pdu', 'ups'],
    description: 'Eight power outlets on the rear face.',
    ports: mapWithPositions(
      Array.from({ length: 8 }, (_, index) => ({
        name: `Outlet ${index + 1}`,
        kind: 'power' as const,
        face: 'rear' as const,
      })),
    ),
  },
]

export function getPortTemplate(templateId: string) {
  return PORT_TEMPLATES.find((template) => template.id === templateId) ?? null
}

export function createPortsFromTemplate(deviceId: string, templateId: string) {
  const template = getPortTemplate(templateId)
  if (!template) return []

  return template.ports.map((port, index) => ({
    id: `p_${deviceId}_${index + 1}`,
    deviceId,
    name: port.name,
    position: index + 1,
    kind: port.kind,
    speed: port.speed ?? null,
    linkState: 'down',
    vlanId: null,
    description: null,
    face: port.face ?? 'front',
  }))
}
