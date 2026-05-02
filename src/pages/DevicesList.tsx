import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { DeviceDrawer } from "@/components/shared/DeviceDrawer";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mono } from "@/components/shared/Mono";
import { StatusDot } from "@/components/shared/StatusDot";
import { DeviceTypeIcon } from "@/components/shared/DeviceTypeIcon";
import { canEditInventory, useStore } from "@/lib/store";
import type { Device, DeviceType, Port, Rack } from "@/lib/types";
import { ChevronRight, Filter, Plus } from "lucide-react";
import { statusLabel } from "@/lib/utils";

const TYPES: DeviceType[] = [
  "switch",
  "router",
  "firewall",
  "server",
  "ap",
  "endpoint",
  "vm",
  "storage",
  "patch_panel",
  "pdu",
  "ups",
];

export default function DevicesList() {
  const currentUser = useStore((s) => s.currentUser);
  const devices = useStore((s) => s.devices);
  const racks = useStore((s) => s.racks);
  const ports = useStore((s) => s.ports);
  const canEdit = canEditInventory(currentUser);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<DeviceType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rackById = useMemo(() => {
    return racks.reduce<Record<string, Rack>>((acc, rack) => {
      acc[rack.id] = rack;
      return acc;
    }, {});
  }, [racks]);

  const deviceById = useMemo(() => {
    return devices.reduce<Record<string, Device>>((acc, device) => {
      acc[device.id] = device;
      return acc;
    }, {});
  }, [devices]);

  const portsByDeviceId = useMemo(() => {
    return ports.reduce<Record<string, Port[]>>((acc, port) => {
      (acc[port.deviceId] ??= []).push(port);
      return acc;
    }, {});
  }, [ports]);

  const filtered = useMemo(() => {
    return devices
      .filter((device) => {
        if (type && device.deviceType !== type) return false;
        if (!query) return true;
        const haystack = [
          device.hostname,
          device.displayName,
          device.manufacturer,
          device.model,
          device.managementIp,
          device.deviceType,
          ...(device.tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
      .sort((a, b) => a.hostname.localeCompare(b.hostname));
  }, [devices, query, type]);

  const typeCounts = useMemo(() => {
    return devices.reduce<Record<string, number>>((acc, device) => {
      acc[device.deviceType] = (acc[device.deviceType] ?? 0) + 1;
      return acc;
    }, {});
  }, [devices]);

  return (
    <>
      <TopBar
        subtitle="Inventory"
        title="Devices"
        meta={
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
            {devices.length} total
          </span>
        }
        actions={
          canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus className="size-3.5" />
              Add device
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setType(null)}
            className={`rounded-[var(--radius-xs)] border px-2.5 py-1 transition-colors ${
              type === null
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-strong)]"
                : "border-[var(--color-line)] text-[var(--color-fg-muted)] hover:border-[var(--color-line-strong)]"
            }`}
          >
            <span className="font-mono text-[10px] uppercase tracking-wider">
              All
            </span>
            <Mono className="ml-2 text-[10px]">{devices.length}</Mono>
          </button>
          {TYPES.map((entry) => {
            const count = typeCounts[entry] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={entry}
                onClick={() => setType(entry)}
                className={`inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] border px-2.5 py-1 transition-colors ${
                  type === entry
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-strong)]"
                    : "border-[var(--color-line)] text-[var(--color-fg-muted)] hover:border-[var(--color-line-strong)]"
                }`}
              >
                <DeviceTypeIcon type={entry} className="size-3" />
                <span className="font-mono text-[10px] uppercase tracking-wider capitalize">
                  {entry.replace("_", " ")}
                </span>
                <Mono className="text-[10px]">{count}</Mono>
              </button>
            );
          })}
        </div>

        <div className="relative max-w-md">
          <Filter className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-fg-faint)]" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search hostname, model, IP, tag..."
            className="pl-7"
          />
        </div>

        <Card>
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] bg-[var(--color-bg-2)]">
                  <Th />
                  <Th>Hostname</Th>
                  <Th>Type</Th>
                  <Th>Model</Th>
                  <Th>Mgmt IP</Th>
                  <Th>Placement</Th>
                  <Th>Ports</Th>
                  <Th>Status</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((device) => {
                  const devicePorts = portsByDeviceId[device.id] ?? [];
                  const linked = devicePorts.filter(
                    (port) => port.linkState === "up",
                  ).length;
                  const rack = device.rackId
                    ? rackById[device.rackId]
                    : undefined;
                  const parentDevice = device.parentDeviceId
                    ? deviceById[device.parentDeviceId]
                    : undefined;
                  return (
                    <tr
                      key={device.id}
                      className="group border-b border-[var(--color-line)] transition-colors last:border-b-0 hover:bg-[var(--color-surface)]"
                    >
                      <Td className="w-px">
                        <DeviceTypeIcon
                          type={device.deviceType}
                          className="size-4 text-[var(--color-fg-muted)] transition-colors group-hover:text-[var(--color-accent)]"
                        />
                      </Td>
                      <Td>
                        <Link
                          to={`/devices/${device.id}`}
                          className="font-medium text-[var(--color-fg)] hover:text-[var(--color-accent)]"
                        >
                          {device.hostname}
                        </Link>
                      </Td>
                      <Td>
                        <span className="text-xs capitalize text-[var(--color-fg-muted)]">
                          {device.deviceType.replace("_", " ")}
                        </span>
                      </Td>
                      <Td>
                        <Mono className="text-[11px] text-[var(--color-fg-subtle)]">
                          {device.manufacturer
                            ? `${device.manufacturer} ${device.model}`
                            : (device.model ?? "-")}
                        </Mono>
                      </Td>
                      <Td>
                        <Mono className="text-[var(--color-fg)]">
                          {device.managementIp ?? "-"}
                        </Mono>
                      </Td>
                      <Td>
                        {device.placement === "virtual" ? (
                          <span className="text-xs">
                            <span className="text-[var(--color-fg-muted)]">
                              Virtual
                            </span>
                            {parentDevice && (
                              <>
                                <span className="mx-1 text-[var(--color-fg-faint)]">
                                  |
                                </span>
                                <span className="text-[var(--color-fg-subtle)]">
                                  {parentDevice.hostname}
                                </span>
                              </>
                            )}
                          </span>
                        ) : device.placement === "wireless" ? (
                          <span className="text-xs">
                            <span className="text-[var(--color-fg-muted)]">
                              WiFi
                            </span>
                            {parentDevice && (
                              <>
                                <span className="mx-1 text-[var(--color-fg-faint)]">
                                  |
                                </span>
                                <span className="text-[var(--color-fg-subtle)]">
                                  {parentDevice.hostname}
                                </span>
                              </>
                            )}
                          </span>
                        ) : rack && device.startU ? (
                          <span className="text-xs">
                            <span className="text-[var(--color-fg-muted)]">
                              {rack.name}
                            </span>
                            <span className="mx-1 text-[var(--color-fg-faint)]">
                              |
                            </span>
                            <Mono className="text-[var(--color-fg-muted)]">
                              U{device.startU}
                              {(device.heightU ?? 1) > 1
                                ? `-${device.startU + (device.heightU ?? 1) - 1}`
                                : ""}
                            </Mono>
                          </span>
                        ) : (
                          <span className="text-[var(--color-fg-faint)]">
                            {device.placement === "rack"
                              ? "Pending placement"
                              : "Loose / room"}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {devicePorts.length > 0 ? (
                          <Mono className="text-[var(--color-fg-muted)]">
                            {linked}/{devicePorts.length}
                          </Mono>
                        ) : (
                          <span className="text-[var(--color-fg-faint)]">
                            -
                          </span>
                        )}
                      </Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5">
                          <StatusDot status={device.status} />
                          <span className="text-[11px] text-[var(--color-fg-muted)]">
                            {statusLabel[device.status]}
                          </span>
                        </span>
                      </Td>
                      <Td className="w-px">
                        <ChevronRight className="size-3.5 text-[var(--color-fg-faint)] opacity-0 transition-opacity group-hover:opacity-100" />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-[var(--color-fg-subtle)]">
                No devices match your filter.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {canEdit && (
        <DeviceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}

function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="px-3 py-1.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>
  );
}
