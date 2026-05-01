# Rackpad

Rackpad is a self-hosted homelab inventory app for racks, devices, ports, cables, VLANs, and IP address management.

Current release: `v0.2.0`

It is a full-stack app now:
- React + Vite frontend
- Fastify API
- SQLite persistence through `better-sqlite3`
- Docker support for a single-container test deployment

## What works

- Rack inventory and device browsing
- Add, edit, and delete devices
- Edit port metadata from the ports screen
- Create, edit, and delete cables from the cables screen
- Management IP synchronization between device records and IPAM
- Next-free IP allocation and IP release
- VLAN allocation and VLAN deletion
- Audit log writes for the main device/IPAM/VLAN flows
- Production build of the frontend and backend
- Docker packaging for the frontend + API together

## Current focus

Rackpad is ready for Linux server and Docker testing, especially around the device and IPAM workflows.

The remaining rough edges are mostly product-surface gaps rather than build/deploy gaps:
- no auth yet
- no live monitoring

## Versioning

Rackpad uses semantic versioning and Git tags in the form `vX.Y.Z`.

- The app version lives in [package.json](./package.json).
- Release notes live in [CHANGELOG.md](./CHANGELOG.md).
- Install and deploy examples should pin a version instead of assuming `main`.

Every future shipped change should update the version and add a matching changelog entry describing what changed.

## Requirements

- Node 22 LTS
- npm

The repo includes `.nvmrc`, so if you use `nvm`:

```bash
nvm use
```

## Development

Install dependencies:

```bash
npm install
```

Run the full dev stack:

```bash
npm run dev:all
```

This starts:
- frontend on `http://localhost:5173`
- API on `http://localhost:3000`

The Vite dev server proxies `/api` to the Fastify backend.

## Production build

Build both the frontend and backend:

```bash
npm run build
```

Start the compiled app:

```bash
npm start
```

By default the server listens on `0.0.0.0:3000`.

Environment variables:

```bash
HOST=0.0.0.0
PORT=3000
DATABASE_PATH=./rackpad.db
NODE_ENV=production
```

## Docker

Build and run locally:

```bash
docker compose up --build -d
```

The compose stack:
- exposes Rackpad on `${RACKPAD_PORT:-3000}`
- stores SQLite data in the named volume `rackpad_data`
- serves the compiled frontend and API from the same container

To stop it:

```bash
docker compose down
```

To stop it and remove the database volume:

```bash
docker compose down -v
```

Full step-by-step setup instructions are in [INSTALL.md](./INSTALL.md).
Version-by-version release notes are in [CHANGELOG.md](./CHANGELOG.md).

## Linux test deploy

For a simple non-Docker Linux test deploy:

```bash
npm install
npm run build
PORT=3000 HOST=0.0.0.0 DATABASE_PATH=./rackpad.db npm start
```

If `better-sqlite3` needs to compile during `npm install`, install build tools first:

```bash
sudo apt-get update
sudo apt-get install -y python3 make g++
```

## Windows note

On this Windows machine, the app builds cleanly but the local runtime is still blocked under Node 24 because `better-sqlite3` does not have a matching native binding installed.

The intended local fix is:
- switch to Node 22
- rerun `npm install`

Docker and Linux deployment are the preferred validation paths from here.

## Project layout

```text
rackpad/
|- server/                 Fastify API, SQLite schema, seed data, routes
|- src/
|  |- components/          UI and feature components
|  |- lib/                 typed API client, store, types, helpers
|  |- pages/               route-level screens
|- dist/                   built frontend
|- dist-server/            built backend
|- Dockerfile              production container build
|- docker-compose.yml      local container orchestration
```
