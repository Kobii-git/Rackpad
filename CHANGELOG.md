# Changelog

All notable Rackpad changes should be recorded here.

Rackpad uses semantic versioning and Git tags in the form `vX.Y.Z`.

## [0.8.0] - 2026-05-02

### Added

- A dedicated `Compute` workspace for virtualization hosts and VMs, including per-host guest listings and an unassigned-VM queue.
- Fast VM creation flows that can start from the compute workspace globally or directly from a specific host card.
- Duplicate awareness in the discovery inbox so scanned devices can be compared against existing inventory by management IP and hostname before import.
- Discovery summary cards and filter shortcuts for `new`, `duplicates`, `imported`, and `dismissed` records.

### Changed

- The sidebar now includes a direct `Compute` workspace alongside the existing WiFi and Discovery views.
- Discovery rows now show whether a scanned host already appears to exist in inventory, instead of treating every reachable host as a clean new record.
- The discovery inspector now links duplicate candidates so you can review existing devices before importing anything new.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- This release improves operator workflow rather than the underlying discovery probe itself; discovery is still ICMP plus reverse-DNS enrichment, not SNMP or agent-based inventory.

## [0.7.0] - 2026-05-02

### Added

- Device placement modes for `rack`, `room`, `wireless`, and `virtual` inventory so the app can model loose room tech, AP-linked clients, and hosted VMs alongside rack-mounted gear.
- Parent-child device relationships, including AP-to-client links for wireless inventory and host-to-VM links for virtual workloads.
- A dedicated `WiFi` workspace with AP summaries, wireless client counts, and an unassigned-clients section.
- A new discovery inbox with ICMP subnet scanning, reverse-DNS enrichment, review/edit controls, and one-click import into the normal device inventory flow.
- Discovery records in backup export and restore so staged findings survive migrations and test resets.

### Changed

- Device creation and edit flows now expose placement directly and only ask for rack coordinates when the device is actually rack-mounted.
- Device details now show placement context and child relationships so APs and hosts can act as inventory anchors instead of flat standalone records.
- Device lists now describe placement honestly, including loose-room devices, hosted VMs, and wireless clients attached to APs.
- The main sidebar now includes direct navigation to the new WiFi and Discovery workspaces.

### Schema

- Added `placement` and `parentDeviceId` columns to `devices`, plus an index for parent-device lookups.
- Added a new `discoveredDevices` table with per-lab uniqueness on IP address and status indexing for discovery workflows.
- Bumped the SQLite schema version to `4`.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- Discovery scans are intentionally limited to `/24` or smaller IPv4 ranges for now.
- Reverse-DNS and ICMP scan results are best-effort enrichment from the Rackpad server or container; imported devices are still meant to be reviewed before you trust them as final inventory.

## [0.6.3] - 2026-05-02

### Added

- ICMP device monitoring so Rackpad can test plain host reachability without depending on a specific application port being open.
- A clickable port inspector on the device detail page, including port state, speed, face, VLAN, description, and linked cable peer details.
- A dedicated Notes tab on the device detail page so device documentation is easier to read without reopening the edit drawer.

### Changed

- The dashboard now shows aggregate network capacity derived from documented port speeds and link states, instead of a fake traffic chart that looked like live telemetry.
- New monitor setups now default to ICMP when a device has a management IP, which is a better default for homelab reachability checks than assuming TCP port 22.
- The monitoring UI now explains the difference between ICMP reachability, TCP service checks, and HTTP/HTTPS health probes.
- The runtime Docker image now installs `iputils-ping` so ICMP checks work inside the Linux container.

### Fixed

- Device-detail ports are no longer a dead end; clicking a port now surfaces its configuration instead of forcing a context switch to the main ports workspace.
- The app no longer implies that aggregate throughput is measured traffic when Rackpad does not yet collect real telemetry.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- TCP checks still test a specific service from the Rackpad server or container; use ICMP when you only want to know whether the host itself is reachable.

## [0.6.2] - 2026-05-02

### Fixed

- Multi-arch Docker builds now run the full dev-dependency install on the build platform instead of under emulated target architectures, which avoids the flaky `tsx` / `esbuild` `ETXTBSY` failure seen in GitHub Actions during `npm ci`.
- Docker npm cache mounts now use `sharing=locked` so concurrent cache access is less likely to corrupt or race during BuildKit installs.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- This patch is aimed at the GitHub Docker publish pipeline and published image reliability rather than app behavior.

## [0.6.1] - 2026-05-02

### Added

- Real lab management with backend CRUD, a lab switcher in the sidebar, and a dedicated labs page.
- A `Loose / room tech` section in the racks workspace so unracked devices have a first-class home.

### Fixed

- `Add rack` now opens a reliable modal editor instead of dropping into a broken inline state.
- Rack, VLAN range, and subnet creation now use the active lab instead of a stale hard-coded `lab_home` value.
- VLAN-linked subnet creation from the VLAN page now works correctly in restored or newly created labs.
- The IPAM empty-state `Add subnet` flow no longer falls through to a blank page when there are no subnets yet.
- Devices without a rack now display as `Unracked` instead of appearing to have missing placement data.

### Notes

- `npm run build` passes.
- `npm run lint` passes.

## [0.6.0] - 2026-05-01

### Added

- Admin backup restore endpoint and in-app restore flow from the users page.
- Full custom port-template management in the ports page, including create, edit, delete, and clone-from-device actions.
- Database-backed storage for custom port templates so templates survive restart, export, and restore.
- Regression tests for backup restore, custom port templates, VLAN range validation, and IP assignment integrity checks.

### Changed

- Backup export now includes custom port templates, and restore rebuilds users, racks, devices, ports, cables, VLANs, IPAM objects, monitors, audit history, and templates in one pass.
- TCP monitoring now treats `ECONNREFUSED` as host reachable while keeping true network-unreachable errors such as `EHOSTUNREACH` and `ENETUNREACH` offline with clearer server-side messaging.
- Device activity history can now fetch more audit entries on demand instead of being capped by the initial app load.
- Initial app loading now tolerates partial API failures and keeps the data that did load instead of failing all-or-nothing.
- Device creation now filters port templates by device type and clears incompatible template selections when the device type changes.

### Fixed

- `PATCH /api/vlans/ranges/:id` now rejects inverted effective ranges where `startVlan > endVlan`.
- `PATCH /api/ip-zones/:id` now rejects empty `startIp` and `endIp` values with HTTP `400`.
- `PATCH /api/ip-assignments/:id` now rejects empty `ipAddress` values and rejects assignments that do not belong to the selected subnet.
- IP assignment create and patch flows now both enforce subnet membership instead of allowing cross-subnet mismatches.
- Audit-log writes now use the authenticated request user directly instead of relying on a fallback username path.
- Session bootstrap state is cached and refreshed after bootstrap and restore, instead of re-running the bootstrap query on every request.
- Expired API sessions are now purged on startup and on a daily cleanup interval.
- Remaining route-level `Date.now()` identifiers were replaced with `createId(...)`-based IDs for safer concurrent writes.
- `type: "none"` monitor updates now explicitly disable the monitor instead of leaving stale enabled state behind.
- Port delete cleanup no longer does redundant linked-port follow-up work when dropping cable state.

### Schema

- Added schema-version tracking and transactional migrations so new releases can evolve the SQLite database more safely.
- Added the `portTemplates` table for custom templates, plus JSON serialization for template device types and port definitions.
- Added foreign-key indexes for the main device, port, cable, IPAM, and monitoring relationships to improve lookup and delete performance.
- Added a per-lab unique index on VLAN range names so duplicate range names cannot be created inside the same lab.

### Notes

- Backups remain sensitive because they include user records and password hashes; treat exported JSON as a secret.
- `npm run build` passes.
- `npm run lint` passes.
- `npm run test:server` is still blocked on this Windows Node `24.15.0` machine because `better-sqlite3` has no working native binding here.

## [0.5.0] - 2026-05-01

### Added

- First-run bootstrap choice to start with demo data or a clean empty lab.

### Changed

- VLAN UI now speaks more explicitly in terms of VLAN ID ranges.
- VLAN cards now show all linked IP ranges and can create a linked subnet directly from the VLAN page.
- IPAM UI now labels the subnet-to-VLAN relationship more clearly as a linked VLAN.
- Device monitoring now explains that checks run from the Rackpad server or container, not the browser.
- New monitor setups now prefill from a device management IP when one exists.
- Saving an enabled monitor now runs an immediate check so device status does not stay `unknown` until the next interval.
- Compose and example environment defaults now use the lowercase `kobii-git` image owner to avoid Docker reference-format errors.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- `npm run test:server` still needs Linux/Node 22 or Docker to load the `better-sqlite3` native binding.

## [0.4.2] - 2026-05-01

### Fixed

- Restored clean committed copies of `server/index.ts`, `server/routes/audit.ts`, `tsconfig.server.json`, `.gitignore`, `README.md`, and `COWORK_SESSION_HANDOFF.md` after file truncation and NUL-padding corruption.
- Re-synced release metadata so the app version, install guide, compose defaults, and example environment file all point at the same deployable tag.

### Notes

- `v0.4.2` is the first post-recovery tag intended for GitHub and Docker deployment after the truncation issue was cleaned up.
- `npm run build` passes.
- `npm run lint` passes.
- `npm run test:server` still needs Linux/Node 22 or Docker to load the `better-sqlite3` native binding.

## [0.4.1] - 2026-05-01

Pre-deployment static review of all 41 source files. Six bugs found and fixed;
no regressions introduced. First release intended for Docker/Linux deployment.

Commit: `d103f8e`

### Fixed

- Dockerfile runtime stage now copies `package.json` so the admin backup export correctly reports the app version instead of `0.0.0`.
- `PATCH /api/users/:id` no longer accepts `null` for `username` or `displayName`, returning HTTP 400 instead of a NOT NULL constraint 500.
- `PATCH /api/subnets/:id` now rejects a null or empty `cidr` with HTTP 400 instead of a NOT NULL constraint 500.
- `PATCH /api/dhcp-scopes/:id` now rejects null `startIp` or `endIp` with HTTP 400 instead of a NOT NULL constraint 500.
- Error handler now catches `FOREIGN KEY constraint failed` (returns HTTP 422) and `NOT NULL constraint failed` (returns HTTP 400) rather than falling through to a generic 500.
- `GET /api/dhcp-scopes` now returns results in a consistent `ORDER BY subnetId, name` order.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- `npm run test:server` requires Linux/Node 22 or Docker to load the `better-sqlite3` native binding; still blocked on this Windows Node 24 machine.
- Recommended deploy path: `docker compose up --build -d` - verify backup export shows `appVersion: "0.4.1"` as a smoke test.
- Minor observations noted but not changed: `needsBootstrap()` runs a `SELECT COUNT(*)` on every API request (negligible for homelab traffic); ID generation style is inconsistent across routes (cosmetic only); `PORT_KINDS` is duplicated between `ports.ts` and `port-templates.ts` (they match).

## [0.4.0] - 2026-05-01

### Added

- VLAN range create, edit, and delete controls in the frontend.
- Admin-only backup export endpoint at `/api/admin/export`.
- Admin operations UI for downloading a full JSON backup from the users screen.
- Backend test coverage for the admin export workflow and admin-only enforcement.

### Changed

- Frontend routes now lazy-load to reduce the size of the initial app bundle.
- Vite now injects the app version from `package.json` and splits major vendor chunks during build.
- The sidebar version badge now stays in sync with the release version automatically.
- Docker and install defaults now point at `v0.4.0`.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- `npm run test:server` still needs Linux/Node 22 or any environment where `better-sqlite3` can load successfully.

## [0.3.0] - 2026-05-01

### Added

- Authentication bootstrap, login, logout, and persisted API sessions.
- User accounts with `admin`, `editor`, and `viewer` roles.
- Read-only backend enforcement for viewer accounts.
- Port-template support when creating new devices.
- Manual port creation and deletion from the ports screen.
- Rack CRUD in the frontend.
- IPAM CRUD in the frontend for subnets, DHCP scopes, and IP zones.
- Per-device health-check configuration for `tcp`, `http`, and `https` checks.
- Backend tests covering bootstrap/auth, viewer write blocking, device templates, rack overlap validation, and monitoring validation.

### Changed

- Device detail now includes monitoring controls and live monitor runs.
- The app shell now boots through auth before loading inventory data.
- Docker and container health checks now use `/api/health` instead of a protected API route.
- Install and README docs now describe the real first-run bootstrap flow.
- Release version is now `0.3.0`.

### Notes

- `npm run build` passes.
- `npm run lint` passes.
- `npm run test:server` is wired in, but it still cannot run on this Windows Node 24 machine until `better-sqlite3` can load successfully.

## [0.2.0] - 2026-05-01

### Added

- Fastify + SQLite backend with routes for racks, devices, ports, cables, VLANs, IPAM, and audit history.
- API-backed frontend store and bootstrapping flow for loading live data.
- Real device lifecycle actions: create, edit, delete, management IP sync, and IP release.
- Real port and cable management screens, including cable create, edit, inspect, and delete flows.
- Docker deployment, systemd service file, Linux install guide, and Node 22 runtime pinning.

### Changed

- Installation instructions now pull versioned source directly from GitHub instead of assuming a copied local folder.
- Docker defaults now point at the `Kobii-git/Rackpad` repository and the `v0.2.0` release tag.
- Release process expectation is now explicit: future shipped changes should include a version bump and changelog entry.

### Notes

- This was the first versioned GitHub-ready release for Docker and Linux testing.
