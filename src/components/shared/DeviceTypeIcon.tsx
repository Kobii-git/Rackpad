import {
  Server,
  Network,
  Shield,
  HardDrive,
  Cable,
  Power,
  Battery,
  Monitor,
  Boxes,
  Wifi,
} from "lucide-react";
import type { DeviceType } from "@/lib/types";

const map = {
  switch: Network,
  router: Network,
  firewall: Shield,
  server: Server,
  ap: Wifi,
  endpoint: Monitor,
  vm: Boxes,
  patch_panel: Cable,
  storage: HardDrive,
  pdu: Power,
  ups: Battery,
  kvm: Monitor,
  other: Boxes,
} satisfies Record<DeviceType, typeof Server>;

interface Props {
  type: DeviceType;
  className?: string;
}

export function DeviceTypeIcon({ type, className }: Props) {
  const Icon = map[type] ?? Boxes;
  return <Icon className={className} />;
}
