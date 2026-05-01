# Rackpad Installation Guide

This guide gives you two ways to install Rackpad:

1. Docker on a Linux server
2. Native Node.js install on a Linux server

Docker is the recommended path for first testing because it handles the Node runtime and keeps the SQLite database in a persistent volume.

## Before you start

- Use a Linux server or VM.
- Make sure port `3000` is open on your firewall if you want to reach Rackpad from another machine.
- Rackpad currently has no authentication, so do not expose it directly to the public internet.

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

### Step 2: Copy the Rackpad project to the server

Clone the repo or copy the project folder to the server, then move into it:

```bash
cd /opt
sudo mkdir -p rackpad
sudo chown "$USER":"$USER" rackpad
cd rackpad
```

### Step 3: Create your environment file

Copy the example file:

```bash
cp .env.example .env
```

Open `.env` and set at least:

```bash
RACKPAD_PORT=3000
```

You only need `GITHUB_REPO_OWNER` and `RACKPAD_TAG` if you plan to pull a published image instead of building locally.

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

### Step 6: Understand where data is stored

Rackpad stores SQLite data in the Docker named volume `rackpad_data`.

To see the volume:

```bash
docker volume ls
```

### Step 7: Stop or update the app later

Stop it:

```bash
docker compose down
```

Update it after new code changes:

```bash
docker compose up --build -d
```

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

### Step 3: Copy the Rackpad project to the server

Put the repo somewhere like `/opt/rackpad` and move into it:

```bash
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
HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/opt/rackpad/rackpad.db npm start
```

Open:

```text
http://SERVER_IP:3000
```

### Step 7: Run Rackpad as a systemd service

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

## First login and testing checklist

After Rackpad loads in the browser, test these flows:

1. Add a device from the devices page.
2. Edit that device and assign a management IP that fits an existing subnet.
3. Open IPAM and confirm the assignment appears there.
4. Open ports and edit a port description or VLAN.
5. Open cables and create a link between two free ports.
6. Open VLANs and allocate a new VLAN.
7. Delete a test cable or test device and confirm the state updates correctly.

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

## Recommended for now

For your first deployment test, use Docker on a Linux server and keep Rackpad on a private LAN or behind a VPN until authentication is added.
