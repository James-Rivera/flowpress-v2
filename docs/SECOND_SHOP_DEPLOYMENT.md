# Sto. Tomas and Tanauan Deployment

FlowPress uses the same `main` branch for every physical CJ NET shop. Each upgraded shop receives its own environment settings, backend PC, storage directory, and public upload route. Do not maintain separate Git branches for the shops.

## Current Rollout

| Shop | Status | Customer sending |
| --- | --- | --- |
| Sto. Tomas | Current FlowPress deployment | Public internet only |
| Tanauan | Not yet upgraded | Keep its existing system unchanged |

Sto. Tomas does not use `send.cjnet`, a MikroTik upload portal, Caddy, or local customer Wi-Fi sending. Its FlowPress PC still runs the backend on `127.0.0.1:3000` so the secure public tunnel can save uploads directly to that PC.

## Sto. Tomas Domains

No additional domain is required when the existing domains already route to the Sto. Tomas deployment:

| Purpose | Domain |
| --- | --- |
| Customer frontend | `https://cjnet.cloudavera.tech` |
| Public upload API | `https://upload-api.cloudavera.tech` |

Keep those domains for Sto. Tomas. When Tanauan is upgraded, give it separate routes, for example `https://tanauan.cjnet.cloudavera.tech` and `https://upload-api-tanauan.cloudavera.tech`, so files cannot be sent to the wrong shop.

## Sto. Tomas Environment

The current Vercel project should use:

```dotenv
APP_ROLE=frontend
NEXT_PUBLIC_SHOP_NAME=CJ NET - Sto. Tomas Branch
NEXT_PUBLIC_BACKEND_BASE_URL=https://upload-api.cloudavera.tech
NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT=20
NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB=100
NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB=100
```

The Sto. Tomas backend PC should use:

```dotenv
APP_ROLE=backend
NEXT_PUBLIC_SHOP_NAME=CJ NET - Sto. Tomas Branch
UPLOADS_DIR=D:\FlowPressData\uploads
NEXT_PUBLIC_BACKEND_BASE_URL=
ALLOWED_ORIGINS=https://cjnet.cloudavera.tech
```

Use `C:\FlowPressData\uploads` when the data drive is `C:`. If the existing backend URL and allowed origin already match these values, only `NEXT_PUBLIC_SHOP_NAME` needs to be added. Restart and rebuild FlowPress after changing a `NEXT_PUBLIC_` value because it is compiled into the customer interface.

## Public-Only Sto. Tomas Setup

For a new or rebuilt Sto. Tomas PC, clone `main` and run the installer from an Administrator terminal with `public-only` as the fourth argument:

```powershell
git clone --branch main --single-branch https://github.com/James-Rivera/flowpress-v2.git C:\FlowPress\app
cd C:\FlowPress\app
tools\setup-local-host.bat "D:\FlowPressData\uploads" "https://cjnet.cloudavera.tech" "CJ NET - Sto. Tomas Branch" "public-only"
```

Public-only mode:

- installs and starts the FlowPress backend
- configures the Sto. Tomas shop label and exact CORS origin
- schedules upload cleanup
- skips Caddy installation
- skips the port 80 firewall rule
- skips the `send.cjnet` local proxy task

Connect the Sto. Tomas secure tunnel to:

```text
https://upload-api.cloudavera.tech
  -> Sto. Tomas secure tunnel
  -> http://127.0.0.1:3000
```

Do not expose TCP port 3000 directly to the internet.

## Sto. Tomas Acceptance Test

1. `https://cjnet.cloudavera.tech/upload` visibly shows `CJ NET - Sto. Tomas Branch`.
2. `https://upload-api.cloudavera.tech/api/health` reports `backend` and available storage.
3. A synthetic public upload reaches only the Sto. Tomas customer folder.
4. FlowPress returns after the Sto. Tomas PC restarts and the user signs in.
5. An origin not listed in `ALLOWED_ORIGINS` receives a CORS rejection.
6. No `send.cjnet` or customer Wi-Fi upload route is advertised for Sto. Tomas.

## Tanauan Later

Do not change Tanauan's current environment, router, portal, storage, or public routes during the Sto. Tomas rollout. When the Tanauan upgrade starts:

1. Prepare its new PC and storage independently.
2. Decide whether Tanauan needs public-only or public-and-local sending.
3. Create a dedicated Tanauan backend hostname and customer frontend domain.
4. Set `NEXT_PUBLIC_SHOP_NAME=CJ NET - Tanauan Branch` on its frontend and backend.
5. Test both shops to confirm each upload reaches only its intended PC.

## Upload Timing Diagnostics

Successful backend uploads log a line similar to:

```text
[flowpress-local] upload complete {"fileCount":1,"totalBytes":12345,"parseMs":12.3,"validateMs":0.4,"capacityMs":1.2,"saveMs":8.5,"totalMs":22.4}
```

Use the largest duration to locate a slowdown:

- `parseMs`: request delivery, tunnel buffering, and multipart parsing
- `validateMs`: file signature checks
- `capacityMs`: storage availability and disk-capacity checks
- `saveMs`: Windows disk write, rename, metadata write, and possible antivirus scanning

The browser reaches 100% before these server-side steps finish, so the final checking-and-saving phase can remain visible briefly even for a small file.
