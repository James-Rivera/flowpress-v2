# FlowPress

FlowPress is CJ NET's direct file-sending system. It keeps the customer-tested v2 interface and customer-folder workflow while supporting the public/private deployment pattern proven by the original FlowPress application.

## Architecture

One repository supports two deployment roles:

```text
Customer with internet
  -> public FlowPress frontend (Vercel)
  -> public backend hostname / secure tunnel
  -> FlowPress backend on the 1 TB shop PC
  -> C:\FlowPressData\uploads\<Customer Name>\<file>

Customer without internet
  -> CJNET SEND WI-FI
  -> MikroTik portal -> SEND FILES
  -> http://send.cjnet
  -> the same FlowPress backend on the shop PC
  -> the same upload folder
```

There is no Syncthing dependency and no print queue. Staff work directly from the upload folder on the shop PC. An SMB share is optional and must be restricted to a staff account.

For the complete new-PC cutover, new MAC address, MikroTik backup, DHCP reservation, Hotspot IP Binding, Walled Garden, portal replacement, Vercel deployment, testing, and rollback procedure, follow [`docs/NEW_PC_AND_MIKROTIK_MIGRATION.md`](docs/NEW_PC_AND_MIKROTIK_MIGRATION.md). AI agents operating on the new PC must also follow [`AGENTS.md`](AGENTS.md).

For an additional physical shop location, follow [`docs/SECOND_SHOP_DEPLOYMENT.md`](docs/SECOND_SHOP_DEPLOYMENT.md). Use the same `main` branch and separate deployment settings for each shop.

## Deployment Roles

### Backend: new 1 TB shop PC

The backend serves the local UI, accepts both public and local uploads, and owns the filesystem.

```dotenv
APP_ROLE=backend
NEXT_PUBLIC_SHOP_NAME=CJ NET - Shop Name
UPLOADS_DIR=C:\FlowPressData\uploads
ALLOWED_ORIGINS=https://upload.example.com
NEXT_PUBLIC_BACKEND_BASE_URL=
```

The backend must be reachable publicly through HTTPS without forwarding port 3000 directly from the router. Use the existing homelab reverse-proxy approach or a secure outbound tunnel. Local clients reach the same backend through `http://send.cjnet`.

### Frontend: Vercel

The frontend serves the v2 customer interface but never writes to Vercel's temporary filesystem.

```dotenv
APP_ROLE=frontend
NEXT_PUBLIC_SHOP_NAME=CJ NET - Shop Name
NEXT_PUBLIC_BACKEND_BASE_URL=https://api-upload.example.com
```

Add the exact Vercel frontend origin to the backend's `ALLOWED_ORIGINS`. Do not use `*`.

## New Shop PC Setup

Copy or clone this repository onto the new PC, open an Administrator terminal in the project, and run:

```bat
tools\setup-local-host.bat "C:\FlowPressData\uploads" "https://upload.example.com" "CJ NET - Shop Name"
```

If the 1 TB data disk is `D:`, use:

```bat
tools\setup-local-host.bat "D:\FlowPressData\uploads" "https://upload.example.com" "CJ NET - Shop Name"
```

The setup performs these actions:

- installs Node.js LTS and Caddy when missing
- builds the standalone Next.js application
- configures the backend role and external upload directory
- permits ports 80 and 3000 from local subnets only
- starts FlowPress and the `send.cjnet` proxy at Windows logon
- schedules upload cleanup every day at 2:00 AM

The upload directory must be outside the Git repository. Production startup rejects missing, relative, or in-repository paths.

## MikroTik Portal

The bundled portal at `mikrotik/hotspot/login.html` presents two actions:

- `CLICK TO CONNECT`: logs into the normal internet profile
- `SEND FILES`: opens `http://send.cjnet` without requiring internet access

Keep the existing offline architecture:

- reserve a stable MikroTik address for the shop PC
- resolve `send.cjnet` to that address
- bypass the FlowPress host in Hotspot IP Binding
- allow the host on TCP port 80 in Walled Garden
- move the same USB Wi-Fi dongle when migrating hosts when practical

## Upload Layout

```text
C:\FlowPressData\uploads
|-- Alice Dela Cruz
|   |-- resume.pdf
|   `-- valid-id.png
|-- Bob Ramos
|   `-- thesis.docx
`-- _meta
    `-- <timestamp>.json
```

Duplicate filenames receive ` (2)`, ` (3)`, and so on. Files are staged under `.incoming` and only moved into the customer folder after the whole request has been written successfully.

## Safeguards

The backend enforces:

- allowed Office, PDF, JPG, JPEG, and PNG extensions
- per-file, file-count, and total-batch limits
- 80-character customer-name limit and Windows-safe paths
- configured browser-origin allowlist
- per-client hourly upload limit
- request-size rejection before multipart parsing when content length is present
- minimum free-space and maximum disk-usage checks
- rollback of partially completed batches
- a health endpoint at `/api/health`

Relevant environment variables:

```dotenv
UPLOAD_MAX_FILE_COUNT=20
UPLOAD_MAX_FILE_SIZE_MB=100
UPLOAD_MAX_BATCH_SIZE_MB=500
UPLOAD_RATE_LIMIT_PER_HOUR=60
UPLOAD_MAX_CONCURRENT=2
UPLOAD_MIN_FREE_SPACE_MB=5120
UPLOAD_RETENTION_HOURS=720
UPLOAD_MAX_DISK_USAGE_PERCENT=85
```

The in-process rate limiter is appropriate for the single shop-PC backend. If the backend is later scaled to multiple processes or hosts, replace it with a shared rate-limit store.

## Cleanup

The host installer schedules cleanup daily. The default retention is 720 hours (30 days). Preview the cleanup without deleting anything:

```powershell
npm run cleanup:uploads -- --dry-run
```

Run it immediately when required:

```powershell
npm run cleanup:uploads
```

Cleanup refuses to operate unless `UPLOADS_DIR` is an absolute path outside the application directory.

## Optional Staff Share

Staff working on the host PC can open `C:\FlowPressData\uploads` directly. To share it with another staff PC, run as Administrator:

```powershell
.\tools\setup-local-share.ps1 -UploadsPath "C:\FlowPressData\uploads" -StaffAccount "FLOWPRESS-PC\staff"
```

The helper does not grant `Everyone` access. Customers never need SMB access.

## Verification

```powershell
npm install
npm run lint
npm run build
```

After deployment, verify:

1. `http://127.0.0.1:3000/api/health` reports backend storage as available.
2. `http://send.cjnet` opens from CJNET SEND WI-FI with mobile data disabled.
3. `CLICK TO CONNECT` provides normal internet access.
4. `SEND FILES` works before hotspot internet login.
5. A public upload reaches the same customer folder on the new PC.
6. FlowPress returns after a PC restart and Windows sign-in.
