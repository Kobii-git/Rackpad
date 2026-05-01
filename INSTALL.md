# Rackpad Installation Guide

This guide gives you two ways to install Rackpad:

1. Docker on a Linux server
2. Native Node.js install on a Linux server

Docker is the recommended path for first testing because it handles the Node runtime and keeps the SQLite database in a persistent volume.

Current version in this guide: `v0.5.0`

## Before you start

- Use a Linux server or VM.
- Make sure port `3000` is open on your firewall if you want to reach Rackpad from another machine.
- Rackpad now requires authentication, but you should still keep it on a private LAN or behind a VPN for early testing.

## Option 1: Docker install

### Step 1: Install Docker and Compose

On Ubuntu or Debian:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

Optional: allow your user to run Docker without `sudo`.

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

### Step 2: Clone Rackpad from GitHub

```bash
cd /opt
git clone --branch v0.5.0 --depth 1 https://github.com/Kobii-git/Rackpad.git
cd Rackpad
```

### Step 3: Create your environment file

```bash
cp .env.example .env
```

At minimum, set:

```bash
RACKPAD_PORT=3000
```

Optional monitoring cadence override:

```bash
MONITOR_INTERVAL_MS=300000
```

### Step 4: Build and start Rackpad

```bash
docker compose up --build -d
```

### Step 5: Confirm the container is healthy

```bash
docker compose ps
docker compose logs -f
```

Open Rackpad in your browser:

```text
http://SERVER_IP:3000
```

Replace `SERVER_IP` with your server's real IP address or hostname.

### Step 6: Complete first-run setup

On first launch:

1. Open the Rackpad URL.
2. Create the initial admin account.
3. Sign in with that account.
4. Start documenting racks, devices, VLANs, and IPAM.

### Step 7: Understand where data is stored

Rackpad stores SQLite data in the Docker named volume `rackpad_data`.

To see the volume:

```bash
docker volume ls
```

### Step 8: Stop or update the app later

Stop it:

```bash
docker compose down
```

Update it after new code changes:

```bash
git fetch --tags
git checkout v0.5.0
docker compose up --build -d
```

When a newer release exists, replace `v0.5.0` with the newer version tag.

Remove the app and database completely:

```bash
docker compose down -v
```

## Option 2: Native Linux install

Use this path if you want Rackpad to run directly on the server without Docker.

### Step 1: Install build tools

On Ubuntu or Debian:

```bash
sudo apt-get update
sudo apt-get install -y curl build-essential python3
```

These packages help `better-sqlite3` install cleanly if a prebuilt binary is not available.

### Step 2: Install Node 22 system-wide

Rackpad expects Node 22 LTS.

On Ubuntu or Debian:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

This matches the included `rackpad.service`, which starts Rackpad with `/usr/bin/node`.

### Step 3: Clone Rackpad from GitHub

```bash
cd /opt
git clone --branch v0.5.0 --depth 1 https://github.com/Kobii-git/Rackpad.git rackpad
cd /opt/rackpad
```

### Step 4: Install dependencies

```bash
npm install
```

### Step 5: Build the app

```bash
npm run build
```

### Step 6: Start Rackpad manually

```bash
HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/opt/rackpad/rackpad.db MONITOR_INTERVAL_MS=300000 npm start
```

Open:

```text
http://SERVER_IP:3000
```

### Step 7: Create the first admin account

The very first browser visit will show the bootstrap screen instead of the dashboard.

Create:

- username
- display name
- password

That account becomes the first `admin`.

### Step 8: Run Rackpad as a systemd service

Create a service user:

```bash
sudo useradd --system --home /opt/rackpad --shell /usr/sbin/nologin rackpad
```

Copy the service file:

```bash
sudo cp rackpad.service /etc/systemd/system/rackpad.service
sudo systemctl daemon-reload
sudo systemctl enable --now rackpad
```

Check status:

```bash
sudo systemctl status rackpad
sudo journalctl -u rackpad -f
```

The service uses:

- app path: `/opt/rackpad`
- database path: `/var/lib/rackpad/rackpad.db`
- listen address: `0.0.0.0:3000`

If you install Rackpad somewhere else, edit `WorkingDirectory` and `ExecStart` in `rackpad.service` before enabling it.

## First-run testing checklist

After Rackpad loads in the browser and you have signed in, test these flows:

1. Create a rack.
2. Add a device to that rack with a port template.
3. Open ports and confirm the generated ports exist.
4. Add or edit a management IP that fits an existing subnet.
5. Open IPAM and confirm the assignment appears there.
6. Create or edit a DHCP scope and an IP zone.
7. Create a cable between two free ports.
8. Create a non-admin user account.
9. Open a device and configure a health check, then run it manually.
10. Open `Users` as an admin and download a JSON backup.

## Troubleshooting

### `better-sqlite3` fails during `npm install`

Make sure you are using Node 22 and that the build tools are installed:

```bash
node -v
sudo apt-get install -y build-essential python3
```

Then run:

```bash
npm install
```

### Docker container starts but the page does not load

Check the logs:

```bash
docker compose logs -f
```

Then confirm the service is listening:

```bash
docker compose ps
```

### Port 3000 is not reachable

Check your firewall or cloud security group rules and make sure TCP `3000` is allowed from your LAN or test machine.

### The browser keeps returning to the login screen

Make sure:

- the container time is correct
- the browser can store local data
- you are not mixing multiple old app builds on the same hostname/path

### The app shows no data after login

If you are testing against an older database from a previous build, remove the test DB or volume and start fresh:

```bash
docker compose down -v
docker compose up --build -d
```

Only do this if you are okay deleting the stored test data.

## Recommended for now

For your first deployment test, use Docker on a Linux server and keep Rackpad on a private LAN or behind a VPN.

## Release notes

See [CHANGELOG.md](./CHANGELOG.md) for the version history and notes about what changed in each release.
