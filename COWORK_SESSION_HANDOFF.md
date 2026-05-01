# Cowork Session Handoff - Rackpad
*Updated end of session 8. Pick up here next session.*

## What changed this session

### Authentication and roles

- `server/db.ts`
  - added `users`, `userSessions`, and `deviceMonitors` tables
- `server/lib/auth.ts`
  - added password hashing, session handling, and auth role helpers
- `server/routes/auth.ts`
  - added bootstrap, login, logout, and current-session endpoints
- `server/routes/users.ts`
  - added admin-only user CRUD
- `server/app.ts`
  - added global auth enforcement
  - added central viewer read-only enforcement for non-read API calls
- `src/components/shared/AuthScreen.tsx`
  - added first-run bootstrap and login screen
- `src/components/layout/AppShell.tsx`
  - now initializes auth before loading inventory data
- `src/components/layout/TopBar.tsx`
  - now shows signed-in user info and logout
- `src/components/layout/Sidebar.tsx`
  - now shows the auth session state and admin-only users navigation
- `src/pages/UsersPage.tsx`
  - added user management UI for admin accounts

### Device ports, monitoring, and validation

- `server/lib/validation.ts`
  - centralized backend request validation
- `server/lib/port-templates.ts`
  - added built-in port templates
- `server/lib/rack-placement.ts`
  - added overlap and rack-boundary validation
- `server/lib/monitoring.ts`
  - added TCP and HTTP/HTTPS health checks
  - updates device status and last seen on checks
- `server/routes/devices.ts`
  - device create and update now support port templates
  - rack placement is validated on write
- `server/routes/ports.ts`
  - added port template listing
  - added manual port create and delete
- `server/routes/monitoring.ts`
  - added monitor get, save, and run endpoints
- `src/components/shared/DeviceDrawer.tsx`
  - added port-template selection for new devices and empty devices
- `src/pages/PortView.tsx`
  - added manual port create and delete
- `src/pages/DeviceDetail.tsx`
  - added monitoring configuration and run-now workflow

### Rack, IPAM, and VLAN CRUD in the frontend

- `src/pages/RackViewPage.tsx`
  - added rack create, edit, and delete UI
- `src/pages/IpamView.tsx`
  - added subnet CRUD
  - added DHCP scope CRUD
  - added IP zone CRUD
- `src/pages/DevicesList.tsx`
  - now respects the auth role for add-device actions
- `src/pages/VlansView.tsx`
  - added VLAN range create, edit, and delete UI
  - now respects the auth role for VLAN mutation actions
- `src/pages/Dashboard.tsx`
  - now hides allocation actions for viewer accounts

### Admin operations, build polish, and deploy/docs updates

- `server/routes/admin.ts`
  - added admin-only JSON backup export for full Rackpad data snapshots
- `src/pages/UsersPage.tsx`
  - added admin operations card for backup download
- `src/App.tsx`
  - route screens now lazy-load through `Suspense`
- `vite.config.ts`
  - now injects the app version from `package.json`
  - splits large vendor chunks during build
- `src/lib/version.ts`
  - added a single frontend version source
- `src/components/layout/Sidebar.tsx`
  - version badge now follows the real release version

- `server/tests/app.test.ts`
  - added backend tests for bootstrap/auth, viewer write blocking, templates, rack overlap, monitoring, and admin export
- `package.json`
  - added `test:server`
  - bumped version to `0.4.0`
- `Dockerfile`
  - health check now uses `/api/health`
- `docker-compose.yml`
  - health check now uses `/api/health`
  - added `MONITOR_INTERVAL_MS`
  - default image tag now points at `v0.4.0`
- `.env.example`
  - bumped release tag to `v0.4.0`
  - added `MONITOR_INTERVAL_MS`
- `README.md`
  - now includes VLAN range CRUD and admin backup export
- `INSTALL.md`
  - updated to install `v0.4.0`
  - first-run checklist now includes backup export verification
- `CHANGELOG.md`
  - added `0.4.0`

## Verification

### Passed

- `npm run build`
  - passes
- `npm run lint`
  - passes

### Wired but still blocked on this Windows machine

- `npm run test:server`
  - test suite exists and is hooked into the repo
  - currently blocked locally for the same reason as runtime: missing native `better-sqlite3` binding on this Windows Node 24 environment

### Still blocked on this Windows machine

- `npm start`
  - still fails locally under Node `24.15.0`
  - reason: missing native `better-sqlite3` binding on this Windows environment

## Outstanding gaps

These are the main items still not at "done done":

- authorization depth
  - viewer read-only is enforced centrally
  - admin now owns user management and backup export
  - editor/admin distinction is still otherwise light for day-to-day inventory actions
- restore/import tooling
  - backup export exists
  - restore/import flow is not built yet
- automated verification
  - backend tests are written, but they need a working `better-sqlite3` runtime to execute on this machine
- runtime validation
  - `npm start` and `npm run test:server` still need Linux/Docker or a local Node 22 environment with a working `better-sqlite3` binding

## Recommended next step

### Best next validation

Deploy `v0.4.0` to Linux or Docker and test the full first-run flow:

1. bootstrap the admin account
2. create a rack
3. create a device with a port template
4. create a subnet, DHCP scope, and IP zone
5. assign a management IP
6. configure a device monitor
7. create a viewer account and confirm it is read-only
8. export a backup from the users page

### Best next product follow-up after deploy

- add restore/import for the exported backup format if you want recovery workflows
- tighten editor vs admin authorization if desired
- run the backend tests on Linux or Docker and capture the results
- consider publish automation for version tags and container images

## To resume next session

Say: **"Read COWORK_SESSION_HANDOFF.md in C:\\Claude\\Rackpad and continue"**
