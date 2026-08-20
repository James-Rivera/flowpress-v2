# Second Shop Deployment

Use the same `main` branch for every physical CJ NET shop. A separate Git branch would eventually drift and is not needed because FlowPress already supports per-deployment environment settings.

Each shop must have its own backend PC, upload directory, public backend route, frontend deployment settings, and exact CORS allowlist. This prevents a customer at one shop from accidentally sending files to another shop.

## Recommended Names

Choose a short location slug such as `downtown` or `north`. Replace the examples below with the real shop name and slug.

| Purpose | Shop 1 | Shop 2 example |
| --- | --- | --- |
| Customer frontend | `https://cjnet.cloudavera.tech` | `https://north.cjnet.cloudavera.tech` |
| Public upload API | `https://upload-api.cloudavera.tech` | `https://upload-api-north.cloudavera.tech` |
| Local customer URL | `http://send.cjnet` | `http://send.cjnet` |
| Customer-facing label | Current shop name | `CJ NET - North Branch` |

The second public upload API hostname is required because it must route to the second shop PC. A second custom frontend domain is strongly recommended but not technically required: Vercel provides a generated URL that can be used during testing. Keep `send.cjnet` at both shops because each name resolves only inside its own local network.

## 1. Prepare the Second Shop PC

Clone the current production code from `main` into the second shop PC:

```powershell
git clone --branch main --single-branch https://github.com/James-Rivera/flowpress-v2.git C:\FlowPress\app
cd C:\FlowPress\app
```

Run the installer from an Administrator terminal. Pass the second shop's customer-facing frontend origin and visible shop name:

```bat
tools\setup-local-host.bat "D:\FlowPressData\uploads" "https://north.cjnet.cloudavera.tech" "CJ NET - North Branch"
```

Use `C:\FlowPressData\uploads` when the data drive is `C:`. Confirm that the resulting `.env.local` contains:

```dotenv
APP_ROLE=backend
NEXT_PUBLIC_SHOP_NAME=CJ NET - North Branch
UPLOADS_DIR=D:\FlowPressData\uploads
NEXT_PUBLIC_BACKEND_BASE_URL=
ALLOWED_ORIGINS=https://north.cjnet.cloudavera.tech
```

Do not copy Shop 1 customer uploads, `.env.local`, tunnel credentials, scheduled-task credentials, or MikroTik backups onto the Shop 2 PC.

## 2. Configure the Second Public Backend

Create a dedicated secure tunnel or reverse-proxy route:

```text
https://upload-api-north.cloudavera.tech
  -> Shop 2 secure tunnel
  -> http://127.0.0.1:3000
```

Do not expose TCP port 3000 directly to the internet. Preserve the real client IP and forwarded host/protocol headers, and allow request bodies up to the configured public upload limit.

Verify the route:

```powershell
Invoke-RestMethod https://upload-api-north.cloudavera.tech/api/health
```

The response must report `role` as `backend` and `storage` as `available` on the Shop 2 PC.

## 3. Create the Second Vercel Frontend

Create a second Vercel project from the same GitHub repository and deploy the `main` branch. Set these Production environment variables:

```dotenv
APP_ROLE=frontend
NEXT_PUBLIC_SHOP_NAME=CJ NET - North Branch
NEXT_PUBLIC_BACKEND_BASE_URL=https://upload-api-north.cloudavera.tech
NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT=20
NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB=100
NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB=100
```

Do not set `UPLOADS_DIR` on Vercel. Use the generated Vercel URL for the first test. If that preview origin needs to upload, temporarily add its exact origin to the Shop 2 backend's comma-separated `ALLOWED_ORIGINS`; never use `*`.

After testing, attach the stable customer domain, for example:

```text
north.cjnet.cloudavera.tech
```

Then keep only the required stable origins in the Shop 2 backend allowlist and restart FlowPress so the environment change takes effect.

## 4. Configure the Second Local Network

Repeat the MikroTik preparation and acceptance process at Shop 2 using that shop's actual router objects, permanent PC MAC address, and reserved LAN address. Do not reuse Shop 1 MAC addresses, IP reservations, exported configuration, or tunnel credentials.

It is safe for both shops to use:

```text
http://send.cjnet
```

because each MikroTik DNS entry points the name to its own local FlowPress PC.

## 5. Acceptance Test

Complete every check before giving the Shop 2 URL to customers:

1. The upload page visibly shows the correct Shop 2 name.
2. A synthetic public upload reaches only the Shop 2 customer folder.
3. A synthetic `send.cjnet` upload reaches the same Shop 2 folder with mobile data disabled.
4. Shop 1 still uploads only to the Shop 1 PC.
5. The Shop 2 app and local proxy return after a PC restart and Windows sign-in.
6. An origin not listed in Shop 2 `ALLOWED_ORIGINS` receives a CORS rejection.

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

The browser reaches 100% before these server-side steps finish, so the final UI phase can remain visible briefly even for a small file.
