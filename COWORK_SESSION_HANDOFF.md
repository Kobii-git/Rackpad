# Cowork Session Handoff - Rackpad
*Updated end of session 6. Pick up here next session.*

## What changed this session

### Core device and IPAM lifecycle

- `src/lib/api.ts`
  - added delete and patch helpers for devices, VLANs, and IP assignments
- `src/lib/store.ts`
  - rebuilt the store around real lifecycle operations instead of just fetch + allocate
  - device create/update now keeps management IP assignments in sync
  - added `deleteDevice()`
  - added `unassignIp()`
  - added `deleteVlan()`
  - added safer audit logging that does not break the main action if audit write fails

### UI improvements

- `src/pages/DevicesList.tsx`
  - added a real `Add device` action with `DeviceDrawer`
- `src/pages/DeviceDetail.tsx`
  - replaced placeholder actions with real refresh/delete behavior
  - added per-IP unassign actions
- `src/pages/IpamView.tsx`
  - rewrote the page so all assignment types render cleanly
  - added per-IP unassign actions
- `src/pages/VlansView.tsx`
  - added VLAN delete actions
- `src/pages/PortView.tsx`
  - rewritten into a real inspector-driven port management screen
  - supports editing port name, speed, face, link state, VLAN, and description
- `src/pages/CableView.tsx`
  - rewritten into a real cable management screen
  - supports create, edit metadata, filter, inspect, and delete flows
- `src/lib/store.ts`
  - added `updatePort()`, `createCable()`, `updateCable()`, and `deleteCable()`

### Backend integrity and production runtime

- `server/db.ts`
  - added unique indexes for `(labId, vlanId)` and `(subnetId, ipAddress)`
- `server/routes/devices.ts`
  - deleting a device now also deletes its attached IP assignments before removing the device
- `server/routes/ipam.ts`
  - IP assignment patch now allows `subnetId`
  - deleting an IP assignment clears matching `devices.managementIp`
- `server/index.ts`
  - production logger now uses native Fastify logging instead of pretty transport
- `server/routes/cables.ts`
  - create route now rejects self-links, missing ports, and already-linked endpoints

### Deploy path updates

- `package.json`
  - `build` now builds frontend and backend
  - `start` now runs the compiled server from `dist-server/index.js`
- `Dockerfile`
  - replaced the old nginx-only image with a full Node 22 multi-stage build
  - runtime now serves both the API and built frontend
  - SQLite is persisted under `/data/rackpad.db`
  - runtime now drops to a non-root `rackpad` user
- `docker-compose.yml`
  - updated to run the real full-stack container
  - added persistent volume `rackpad_data`
  - healthcheck now hits the API
- `rackpad.service`
  - now starts the compiled backend with `/usr/bin/node /opt/rackpad/dist-server/index.js`
  - uses `/var/lib/rackpad/rackpad.db` and tighter systemd hardening
- `.env.example`
  - updated default external port to `3000`
- `README.md`
  - fully rewritten to match the real app and deploy flow
- `INSTALL.md`
  - added a step-by-step Docker install and native Linux install guide
- `eslint.config.mjs`
  - added a minimal flat config so `npm run lint` no longer errors at startup

## Verification

### Passed

- `npm run build`
  - passes
- `npm run lint`
  - passes
- TypeScript client compile
  - passed before Vite build
- TypeScript server compile
  - passed as part of `npm run build`

### Still blocked on this Windows machine

- `npm start`
  - still fails locally under Node `24.15.0`
  - reason: missing native `better-sqlite3` binding on this Windows environment

This is still the same local runtime blocker as before, but it should not be the expected deploy path now that Docker and Linux testing are wired up.

## Recommended next step

### Best next validation

Run the Linux or Docker deployment path:

```bash
docker compose up --build -d
```

or on a Linux host:

```bash
npm install
npm run build
PORT=3000 HOST=0.0.0.0 DATABASE_PATH=./rackpad.db npm start
```

### If more product work is needed after deploy

The next likely product steps are not basic CRUD anymore. The best follow-on work is:

- add authentication before wider exposure
- add runtime schema validation on write routes
- add more advanced IPAM and cable operations if needed after real usage

## To resume next session

Say: **"Read COWORK_SESSION_HANDOFF.md in C:\\Claude\\Rackpad and continue"**
