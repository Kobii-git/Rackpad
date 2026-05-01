# Changelog

All notable Rackpad changes should be recorded here.

Rackpad uses semantic versioning and Git tags in the form `vX.Y.Z`.

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
