# FlowPress Agent Guide

## Mission

Maintain and deploy the unified CJ NET FlowPress system without interrupting the working shop service prematurely.

The system intentionally uses one repository with two roles:

- `frontend`: the v2 customer interface hosted by Vercel for customers using mobile data or another internet connection.
- `backend`: the same v2 interface plus the upload API on the new 1 TB Windows shop PC. It serves `send.cjnet` locally and stores every public and offline upload directly in the same customer folders.

There is no Syncthing dependency and no v1 print queue in this design.

## Read First

Before installing, changing networking, or performing a cutover, read:

- `README.md`
- `docs/NEW_PC_AND_MIKROTIK_MIGRATION.md`
- `.env.example`

If the actual network differs from the guide, stop and report the discovered values. Never guess a MAC address, interface, DHCP server name, hotspot profile, domain, or storage drive.

## Required Architecture

```text
Internet customer
  -> Vercel frontend
  -> HTTPS public upload API
  -> new shop PC backend
  -> <UPLOADS_DIR>\<Customer Name>\<file>

Offline customer
  -> CJNET SEND WI-FI
  -> MikroTik portal -> SEND FILES
  -> http://send.cjnet
  -> new shop PC backend
  -> the same <UPLOADS_DIR>\<Customer Name>\<file>
```

Vercel must never be treated as permanent upload storage. The public frontend must use `NEXT_PUBLIC_BACKEND_BASE_URL` to reach the new PC. The backend must use an absolute `UPLOADS_DIR` outside the repository.

## Safety Rules

- Do not stop or modify the old PC until the new public and offline routes have passed the complete acceptance test.
- Back up and export the MikroTik configuration before changing DHCP, Hotspot IP Binding, Walled Garden, DNS, or portal files.
- Do not reuse `api.cloudavera.tech`; it currently routes to Nextcloud. Use a dedicated hostname such as `upload-api.cloudavera.tech`.
- Do not expose TCP port 3000 directly to the public internet. Use an existing reverse proxy or secure outbound tunnel with HTTPS.
- Do not commit `.env.local`, credentials, customer files, `_meta`, build output, or upload directories.
- Do not place `UPLOADS_DIR` inside the Git checkout.
- Do not grant the SMB share to `Everyone`. Use a named staff account and keep SMB inaccessible from the customer Wi-Fi.
- Do not use destructive copy flags such as `robocopy /MIR` during migration.
- Never delete the old upload folder during cutover. Retain it as rollback data until the owner confirms the migration is complete.
- Never run `setup-local-host.ps1` as a daily startup command. It is only for installation, upgrades, and repair.

## New PC Defaults

Preferred locations:

```text
Application: C:\FlowPress\app
Uploads on a D: data drive: D:\FlowPressData\uploads
Uploads when the 1 TB drive is C:: C:\FlowPressData\uploads
Local URL: http://send.cjnet
Application port: 3000
Local proxy port: 80
Reserved MikroTik IP: 192.168.88.249
```

The reserved IP is a target, not an assumption. Confirm that it is still free and intended for FlowPress before assigning it.

## Installation Procedure

1. Record the new PC adapter name, permanent MAC address, IPv4 address, and storage drive.
2. Back up MikroTik and the old FlowPress configuration.
3. Clone the requested branch into `C:\FlowPress\app`.
4. Open an Administrator PowerShell window.
5. Run:

```bat
tools\setup-local-host.bat "D:\FlowPressData\uploads" "https://cjnet.cloudavera.tech"
```

6. Inspect `.env.local` without printing secrets. Confirm:

```dotenv
APP_ROLE=backend
UPLOADS_DIR=D:\FlowPressData\uploads
ALLOWED_ORIGINS=https://cjnet.cloudavera.tech
NEXT_PUBLIC_BACKEND_BASE_URL=
```

7. Verify `http://127.0.0.1:3000/api/health` before changing the network.
8. Upload a synthetic test PDF and confirm it appears in the configured customer folder.
9. Follow the staged MikroTik cutover in the migration guide.

## Vercel Configuration

The Vercel project uses:

```dotenv
APP_ROLE=frontend
NEXT_PUBLIC_BACKEND_BASE_URL=https://upload-api.cloudavera.tech
NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT=20
NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB=100
NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB=500
```

Do not set `UPLOADS_DIR` on Vercel. Test with a preview deployment before moving `cjnet.cloudavera.tech` from the old project.

## Validation Commands

Run after code or configuration changes:

```powershell
npm install
npm run lint
npm run build
npm audit --omit=dev
npm run cleanup:uploads -- --dry-run
```

On the new backend, also verify:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
Get-NetTCPConnection -LocalPort 3000 -State Listen
Get-Process node
```

Acceptance requires all of the following:

1. A public upload using mobile data reaches the new PC folder.
2. An offline upload through CJNET SEND WI-FI reaches the same folder.
3. `CLICK TO CONNECT` provides normal internet access.
4. `SEND FILES` works before internet login.
5. A disallowed browser origin cannot call the upload API.
6. FlowPress starts again after reboot and Windows sign-in.
7. The old PC remains available for rollback until explicit approval to retire it.

## Code Conventions

- Keep the UI mobile-first, direct, and non-technical.
- Preserve readable customer folders and original filenames with duplicate suffixes.
- Validate security boundaries on the server, not only in the browser.
- Keep local/offline behavior independent of Vercel and the internet.
- Use `apply_patch` for hand-edited files and avoid overwriting unrelated local changes.
- Run lint and a production build before committing.
- Update `README.md` and the migration guide whenever deployment behavior changes.

## Incident Guidance

If public upload fails but local upload works, check the public API hostname, tunnel/reverse proxy, TLS, and `ALLOWED_ORIGINS`. Do not change MikroTik first.

If local upload fails but `127.0.0.1:3000` works, check local DNS, the Caddy proxy, Windows Firewall, Walled Garden, and Hotspot IP Binding.

If both routes fail, check `/api/health`, the Node process, `.env.local`, storage permissions, disk usage, and startup state.

If a migration test fails, restore the MikroTik backup or reconnect the old host and old adapter. Do not improvise destructive repairs during shop hours.
