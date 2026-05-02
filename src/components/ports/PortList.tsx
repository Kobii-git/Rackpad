import type { ReactNode } from "react";
import type { Device, Port, PortLink, VirtualSwitch, Vlan } from "@/lib/types";
import { cn, portTypeColor, portTypeLabel } from "@/lib/utils";
import { StatusDot } from "@/components/shared/StatusDot";
import { Mono } from "@/components/shared/Mono";
import { ArrowRight } from "lucide-react";

interface PortListProps {
  ports: Port[];
  links: Record<string, PortLink>;
  portsById: Record<string, Port>;
  devicesById: Record<string, Device>;
  vlansById?: Record<string, Vlan>;
  virtualSwitchesById?: Record<string, VirtualSwitch>;
  onSelectPort?: (portId: string) => void;
  selectedPortId?: string;
}

export function PortList({
  ports,
  links,
  portsById,
  devicesById,
  vlansById = {},
  virtualSwitchesById = {},
  onSelectPort,
  selectedPortId,
}: PortListProps) {
  return (
    <div className="rk-table-shell">
      <table className="rk-table">
        <thead>
          <tr>
            <Th className="w-1">•</Th>
            <Th>Port</Th>
            <Th>Type</Th>
            <Th>Speed</Th>
            <Th>Mode</Th>
            <Th>Linked to</Th>
            <Th>Cable</Th>
          </tr>
        </thead>
        <tbody>
          {ports.map((port) => {
            const link = links[port.id];
            let otherDevice: Device | undefined;
            let otherPort: Port | undefined;
            if (link) {
              const otherId =
                link.fromPortId === port.id ? link.toPortId : link.fromPortId;
              otherPort = portsById[otherId];
              if (otherPort) otherDevice = devicesById[otherPort.deviceId];
            }

            return (
              <tr
                key={port.id}
                data-selected={selectedPortId === port.id}
                onClick={() => onSelectPort?.(port.id)}
                className={cn(onSelectPort ? "cursor-pointer" : "")}
              >
                <Td>
                  <StatusDot link={port.linkState} />
                </Td>
                <Td>
                  <Mono className="text-[var(--text-primary)]">
                    {port.name}
                  </Mono>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-1.5 rounded-[2px]"
                      style={{ backgroundColor: portTypeColor[port.kind] }}
                    />
                    <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                      {portTypeLabel[port.kind]}
                    </span>
                  </span>
                </Td>
                <Td>
                  <Mono className="text-[var(--text-tertiary)]">
                    {port.speed ?? "n/a"}
                  </Mono>
                </Td>
                <Td>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {formatPortModeSummary(
                      port,
                      vlansById,
                      virtualSwitchesById,
                    )}
                  </div>
                </Td>
                <Td>
                  {otherDevice && otherPort ? (
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <ArrowRight className="size-3 text-[var(--accent-secondary)]" />
                      <span>{otherDevice.hostname}</span>
                      <span className="text-[var(--text-muted)]">:</span>
                      <Mono className="text-[var(--accent-secondary)]">
                        {otherPort.name}
                      </Mono>
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </Td>
                <Td>
                  {link ? (
                    <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                      {link.cableType || "cable"}
                      {link.cableLength ? ` | ${link.cableLength}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">—</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <th className={cn(className)}>{children}</th>;
}

function Td({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <td className={cn(className)}>{children}</td>;
}

function formatPortModeSummary(
  port: Port,
  vlansById: Record<string, Vlan>,
  virtualSwitchesById: Record<string, VirtualSwitch>,
) {
  const virtualSwitchSuffix = port.virtualSwitchId
    ? ` | bridge ${virtualSwitchesById[port.virtualSwitchId]?.name ?? port.virtualSwitchId}`
    : "";
  if (port.mode === "trunk") {
    const tagged = (port.allowedVlanIds ?? []).map((vlanId) =>
      formatCompactVlanLabel(vlanId, vlansById),
    );
    const nativeLabel = port.vlanId
      ? `native ${formatCompactVlanLabel(port.vlanId, vlansById)}`
      : "no native";

    const summary = tagged.length > 0
      ? `trunk | ${nativeLabel} | tagged ${tagged.join(", ")}`
      : `trunk | ${nativeLabel}`;
    return `${summary}${virtualSwitchSuffix}`;
  }

  const base = port.vlanId
    ? `access | VLAN ${formatCompactVlanLabel(port.vlanId, vlansById)}`
    : "access | unassigned";

  return `${base}${virtualSwitchSuffix}`;
}
function formatCompactVlanLabel(
  vlanId: string,
  vlansById: Record<string, Vlan>,
) {
  const vlan = vlansById[vlanId];
  return vlan ? String(vlan.vlanId) : vlanId;
}
