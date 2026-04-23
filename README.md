# FlowPress Local

Local-first pilot for a single CJ NET branch.

This app is intentionally separate from the current `flowpress` repo so the legacy homelab deployment stays untouched while the branch pilot is being built and tested.

## What This Pilot Does

- shows a simple customer send hub
- keeps `Upload from this phone` as the primary path
- keeps `Messenger` and `Gmail` as convenience fallbacks
- stores uploads locally on the branch host PC
- lets staff open files from a shared SMB folder
- keeps working when the internet is down, as long as the branch LAN and host PC are up

## What This Pilot Does Not Do

- no customer tracking page
- no admin dashboard
- no remote backend dependency
- no blob storage
- no full print queue workflow

## Routes

- `/` send hub
- `/upload` upload form
- `/success` success screen
- `/api/upload` local upload API

## Storage Layout

Visible file layout:

```text
<uploads-root>\
|-- Alice Dela Cruz\
|   |-- resume.pdf
|   `-- valid-id.png
|-- Bob Ramos\
|   |-- thesis.docx
|   `-- thesis (2).docx
`-- _meta\
    |-- 1770000000000.json
    `-- 1770000005000.json
```

Rules:

- customer folder name comes from the submitted customer name
- saved file name starts from the original file name
- duplicate names get ` (2)`, ` (3)`, and so on
- `_meta` stores lightweight upload manifests for troubleshooting only

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Set `UPLOADS_DIR` to the folder you want to share with staff, for example `C:\flowpress-local\uploads`.
3. Install dependencies:

```powershell
npm install
```

4. Start the app:

```powershell
npm run dev
```

5. Open `http://localhost:3000`.

For a branch-hosted rollout, run the app on the main shop PC and give that PC a stable LAN IP.

## Hosting Model

This is best treated as a small **local branch server**, not a desktop-only app.

How it works:

- the main shop PC runs FlowPress Local in the background
- the app listens on the branch LAN, for example `http://192.168.88.10:3000`
- the MikroTik `Send a File` hotspot button links directly to that LAN address through Walled Garden access
- the printed QR code points to the same LAN address
- customer phones open the web UI from the branch PC
- staff browse uploaded files from the shared SMB folder

That gives you software-like deployment while still keeping the phone experience simple.

## One-Command Host Setup

For the branch host PC, you can now run:

```bat
tools\setup-local-host.bat
```

Or with a custom uploads folder:

```bat
tools\setup-local-host.bat "D:\CJNET\uploads"
```

What it does:

- installs Node.js LTS if missing
- installs Caddy if missing
- installs app dependencies
- builds the production app
- writes `UPLOADS_DIR` into `.env.local`
- optionally creates the SMB share
- creates Windows Scheduled Tasks for `FlowPressLocal` and `FlowPressLocalProxy`
- starts FlowPress Local and the local `send.cjnet` proxy automatically at Windows logon

This is the closest software-style setup path for the pilot right now.

## Startup Behavior

The host setup registers a scheduled task that runs the app in the background at logon.

That means:

- the branch PC behaves like the local server
- staff do not need to open PowerShell manually every day
- if the PC reboots, the app comes back automatically after sign-in
- `send.cjnet` can also come back automatically after sign-in through the local proxy task
- future branches can reuse the same setup script with only path and IP changes

## Daily Operation (Non-Technical)

Normal days should require **zero commands**.

- Turn on / restart the host PC (Server 3).
- After Windows sign-in, FlowPress Local should start automatically in the background.
- Customers use Wi-Fi + captive portal, then the FlowPress page opens.
- If local DNS and Caddy are enabled, customers can also use `http://send.cjnet`.

If FlowPress is not running for some reason, start it manually:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-flowpress-local.ps1
```

Do **not** run `setup-local-host.ps1` daily. That script is for installation, updates, and repairs.

If the local domain proxy is not running for some reason, start it manually:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-send-cjnet.ps1
```

## Updates (When Code Changes)

Use this when:

- you changed code (UI or behavior)
- you changed `.env.local`
- you need to rebuild/re-sync production files

Open PowerShell and go to the project folder:

```powershell
cd C:\Users\cjnet\flowpress-local
```

If FlowPress Local is already running, stop the current `node` process first:

```powershell
Stop-Process -Name node -Force
```

Then rebuild and refresh the local host:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\setup-local-host.ps1
```

Important Windows note:

- If a standalone host is currently running, `next build` can fail with `EBUSY` because Windows locks `.next\standalone`.
- Fix: stop the running FlowPress `node` process first, then rerun setup.
- `Stop-Process -Name node -Force` will also close any `npm run dev` session that is open on this PC.

## CSS / "Unstyled Page" Fix

If the page suddenly looks unstyled (HTML renders but no layout/colors):

- it usually means the standalone server is missing the compiled static assets under `/_next/static/`
- use `setup-local-host.ps1` (not `npm run build`) because the setup script syncs:
  - `.next/static` -> `.next/standalone/.next/static`
  - `public` -> `.next/standalone/public`

## Current Pilot Topology (Month 0)

During the pilot we keep the existing "two networks" setup:

- ISP router LAN: `192.168.1.0/24` (Server 1 & 2, printers)
- MikroTik hotspot LAN: `192.168.88.0/24` (customers)
- Server 3 is dual-connected:
  - Ethernet to ISP router (printers + Server 1/2 access)
  - USB Wi-Fi dongle to MikroTik (customer upload access)

Customer URL for the pilot:

```text
http://192.168.88.249:3000/
```

MikroTik requirements for Server 3 during pilot:

- DHCP lease is static/reserved for Server 3 on MikroTik (`192.168.88.249`)
- Hotspot `IP Binding` for Server 3 is `bypassed` (no timeout, no upload/browse profiles)

## MikroTik Hotspot Access

For the pilot, `Send a File` should open:

```text
http://send.cjnet
```

Current local routing behind that friendly address:

- `send.cjnet` -> port `80` on Server 3 through Caddy
- Caddy -> reverse proxy to `127.0.0.1:3000`

Do not rely on hotspot `dst` redirect for this upload path. Use:

- a direct link in `mikrotik/hotspot/login.html`
- a MikroTik Walled Garden rule that allows `192.168.88.249:80` before internet login
- optionally keep `192.168.88.249:3000` allowed temporarily while migrating/testing

Update the hotspot page in:

- `mikrotik/hotspot/login.html`

## SMB Notes (Staff Only)

Customers never need SMB.

SMB is only for staff PCs to browse uploaded files.

If you want to create the SMB share and firewall rule, run setup from an **Administrator** PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\setup-local-host.ps1 -CreateSmbShare
```

## One-Month Plan (Month 1) - Move MikroTik Into ISP Subnet

After the pilot proves stable (around 1 month), the goal is to remove the fragile "USB dongle" dependency and simplify routing:

- Move MikroTik to live in the same subnet as the ISP router (`192.168.1.0/24`)
- Keep Server 3 wired only (Ethernet), still able to reach printers/Server 1/2
- Customers on MikroTik Wi-Fi can reach FlowPress directly at Server 3's wired IP (example: `http://192.168.1.230:3000/`)

Important warning:

- This change can affect existing hotspot behavior (DHCP pools, NAT, interface bindings).
- Do it in a maintenance window and back up/export MikroTik configuration first.
- Recommended approach: treat it as a separate network project after the app pilot is validated.

## SMB Share Setup

Recommended shared folder:

```text
C:\flowpress-local\uploads
```

If you want a helper script, run PowerShell as Administrator and use:

```powershell
.\tools\setup-local-share.ps1 -UploadsPath "C:\flowpress-local\uploads" -ShareName "FlowPressUploads"
```

Staff can then open:

```text
\\SHOP-PC\FlowPressUploads
```

Adjust the host name to the actual branch PC name.

## MikroTik Flow

Customer hotspot options should stay simple:

- `Send a File`
- `Browse Internet`

`Send a File` should open the local app root on the branch LAN directly, for example:

```text
http://send.cjnet
```

`Browse Internet` keeps the normal internet profile.

Example hotspot template lives in [mikrotik/hotspot/login.html](./mikrotik/hotspot/login.html).

Important:

- reserve a stable DHCP address for the host PC in MikroTik
- use that fixed address in both the QR code and hotspot direct link
- add a Walled Garden or Walled Garden IP rule for the FlowPress host on port `80`
- allow TCP port `80` in Windows Firewall on the host PC
- if the port changes, update both the QR code and the hotspot template

## QR Code

Print a QR code that points to the same local address used by the hotspot:

```text
http://send.cjnet
```

That gives customers one consistent entry point whether they scan the code or tap `Send a File`.

## Pilot Notes

- This repo is for the upgraded branch only.
- The other branch can continue using the legacy FlowPress setup.
- Messenger and Gmail are convenience links only; local upload remains the reliable in-shop path.
- If this pilot works well, the same repo plus `setup-local-host.bat` can become the branch installer base.
