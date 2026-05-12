# Visualizer

The Visualizer workspace gives Rackpad a relationship-first view of your lab. It
uses existing devices, racks, ports, cables, and placement data to show how gear
is physically and logically connected.

Open Rackpad -> `Visualizer`.

## What It Shows

- Rack-mounted equipment grouped by rack.
- Loose / room tech that is not mounted in a rack.
- Devices with linked ports and cables.
- Cable paths between endpoints.
- Selected cable and device context.

The visualizer is generated from inventory you have already documented. Add
devices, ports, rack placement, and cables first for the best result.

## How To Use It

1. Add racks and devices in `Racks` or `Devices`.
2. Create or apply port templates in `Ports`.
3. Patch cables in `Cables`.
4. Open `Visualizer`.
5. Select a cable or endpoint to inspect the relationship path.
6. Use the view to spot undocumented links, loose room gear, and rack context.

## Best Data To Add First

- Rack placement for rack-mounted gear.
- `Loose / room tech` placement for devices sitting near, on, or beside racks.
- Port names that match real labels, for example `eno1`, `SFP+7`, or `LAN1`.
- Cable type, length, and color.
- VLAN mode on ports when trunks or access VLANs matter.
- Virtual switch / bridge membership for hypervisor hosts and VMs.

## Current Limits

- The visualizer is a relationship map, not a full rack elevation replacement.
- Cable paths are generated from Rackpad records, not live switch telemetry.
- It does not scan the network or infer cables automatically.
- It is most useful after ports and cables are documented.

## Useful Pairings

- Use `Ports` to edit the exact port metadata shown in the visualizer.
- Use `Cables` to create or correct endpoint links.
- Use `Compute` to document virtual switches and VM NIC membership.
- Use `Reports` to export the same inventory as a printable or spreadsheet view.
