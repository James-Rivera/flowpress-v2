# New PC, Vercel, and MikroTik Migration Runbook

This runbook migrates FlowPress to a new 1 TB Windows PC while keeping one shared upload destination for the public Vercel route and the offline MikroTik route.

## Final Design

```text
PUBLIC / INTERNET
https://cjnet.cloudavera.tech
  -> Vercel FlowPress v2 frontend
  -> https://upload-api.cloudavera.tech/api/upload
  -> secure tunnel or reverse proxy
  -> new Windows PC on port 3000
  -> D:\FlowPressData\uploads

OFFLINE / NO MOBILE DATA
CJNET SEND WI-FI
  -> MikroTik login page
  -> SEND FILES
  -> http://send.cjnet
  -> new Windows PC through Caddy on port 80
  -> D:\FlowPressData\uploads
```

The two routes use the same backend storage. Vercel only serves the public interface.

## Known Current Installation

At the time this guide was created:

- The old local v2 application runs from `C:\Users\cjnet\flowpress-local`.
- It listens on `localhost:3000`.
- It is configured to store uploads under `C:\flowpress-local\uploads`.
- Windows starts it through the user's Startup folder using `FlowPressLocal.cmd`.
- The old public v1 frontend is hosted by Vercel at `https://cjnet.cloudavera.tech`.
- That frontend currently references `https://api.cloudavera.tech`, which routes to Nextcloud and must not be reused for the new upload API.

Recheck these facts before migration. They may change.

## Values to Record

Fill this table before making any MikroTik changes:

| Setting | Value |
|---|---|
| New PC name | |
| New PC storage drive | `C:` or `D:` |
| New PC customer-network adapter | |
| New permanent MAC address | |
| New PC temporary DHCP address | |
| Final reserved address | `192.168.88.249` unless intentionally changed |
| MikroTik DHCP server name | |
| MikroTik hotspot profile | |
| MikroTik hotspot HTML directory | |
| Public frontend origin | `https://cjnet.cloudavera.tech` |
| New public API origin | `https://upload-api.cloudavera.tech` |

Do not continue until the permanent MAC address and actual MikroTik objects have been identified.

## Phase 1: Prepare Without Downtime

Keep the old PC running during this phase.

### 1. Download the repository

Open PowerShell on the new PC:

```powershell
New-Item -ItemType Directory -Force -Path C:\FlowPress
git clone --branch feature/public-local-unified --single-branch https://github.com/James-Rivera/flowpress-v2.git C:\FlowPress\app
Set-Location C:\FlowPress\app
```

After the pull request is merged, future installations should clone `main` instead.

### 2. Identify the new MAC address

Connect the adapter that will face the MikroTik customer network, then run:

```powershell
Get-NetAdapter | Sort-Object Name | Format-Table Name, InterfaceDescription, Status, MacAddress, LinkSpeed
Get-NetIPConfiguration | Format-List InterfaceAlias, InterfaceDescription, IPv4Address, IPv4DefaultGateway
```

Record the MAC address from the correct adapter. Do not use the Ethernet/printer-network MAC when the MikroTik connection uses Wi-Fi or a USB dongle.

If Windows offers **Random hardware addresses** for CJNET SEND WI-FI, turn it off before recording the MAC. A randomized address will break the reservation after reconnecting.

If the same physical USB dongle is moved from the old PC, its permanent MAC normally moves with it. This guide assumes a new MAC will be used, so verify instead of relying on that behavior.

### 3. Install FlowPress on the new PC

Open PowerShell as Administrator:

```powershell
Set-Location C:\FlowPress\app
.\tools\setup-local-host.bat "D:\FlowPressData\uploads" "https://cjnet.cloudavera.tech"
```

If the 1 TB storage is `C:`, use:

```powershell
.\tools\setup-local-host.bat "C:\FlowPressData\uploads" "https://cjnet.cloudavera.tech"
```

The installer configures the backend, builds the standalone app, creates local firewall rules, starts FlowPress and Caddy at Windows logon, and schedules cleanup.

Verify before touching MikroTik:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Expected fields:

```json
{
  "status": "ok",
  "role": "backend",
  "storage": "available"
}
```

### 4. Copy existing uploads safely

Do not use `/MIR`, `/PURGE`, or any command that deletes destination files.

If a restricted share is available on the new PC, run from the old PC:

```powershell
robocopy "C:\flowpress-local\uploads" "\\NEW-PC\FlowPressUploads" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2
```

Replace `NEW-PC` with the actual computer name. An external drive is also acceptable. Perform an initial copy now and a final incremental copy during cutover.

## Phase 2: Back Up MikroTik

Use WinBox/WebFig or a MikroTik terminal. Run during a maintenance window.

Create both a binary backup and a readable export:

```routeros
/system backup save name=before-flowpress-new-pc
/export hide-sensitive file=before-flowpress-new-pc
```

In **Files**, download both generated files to a separate computer. Also download the current hotspot directory, especially:

- `login.html`
- `alogin.html`
- `status.html`
- `logout.html`
- `error.html`
- `logo.svg`

Check which hotspot directory is active:

```routeros
/ip hotspot profile print detail
```

Use the configured `html-directory` or `html-directory-override`; do not assume it is named `hotspot`.

## Phase 3: Register the New MAC Address

### 1. Let the new PC receive a temporary address

Connect the new adapter to CJNET SEND WI-FI while the old server is still active. Let it receive a normal temporary DHCP address.

Find it in WinBox/WebFig:

```text
IP -> DHCP Server -> Leases
```

Match the lease using the recorded permanent MAC address and new PC hostname. Do not select a lease based only on the displayed IP.

Terminal inspection:

```routeros
/ip dhcp-server lease print detail
```

### 2. Cut over the reserved address

Avoid an IP conflict:

1. Finish all tests using the temporary new-PC address.
2. Stop FlowPress on the old PC or disconnect its MikroTik adapter.
3. Confirm `192.168.88.249` no longer responds from the old host.
4. Edit the existing FlowPress DHCP reservation and replace the old MAC with the new permanent MAC.
5. Keep the reserved address as `192.168.88.249` so local DNS and printed material do not need to change.

In WinBox/WebFig:

```text
IP -> DHCP Server -> Leases
```

- Locate the old static FlowPress lease.
- Open it.
- Change `MAC Address` to the new PC's recorded MAC.
- Confirm `Address` is `192.168.88.249`.
- Add a clear comment such as `FlowPress new PC`.
- Disable or remove any duplicate dynamic lease for the same new MAC.

If no old reservation exists, select the new dynamic lease, choose **Make Static**, then set its address to `192.168.88.249` after the old host is disconnected.

Reconnect the new adapter or renew its lease:

```powershell
ipconfig /release
ipconfig /renew
ipconfig
```

Confirm the correct adapter now owns `192.168.88.249`.

## Phase 4: Update Hotspot IP Binding

The FlowPress server must bypass normal hotspot authentication.

Inspect current bindings:

```routeros
/ip hotspot ip-binding print detail
```

In WinBox/WebFig:

```text
IP -> Hotspot -> IP Bindings
```

Edit the existing FlowPress entry:

- `MAC Address`: new permanent MAC
- `Address`: `192.168.88.249`
- `Type`: `bypassed`
- `Comment`: `FlowPress new PC`

Do not leave two active bindings for the old and new MAC unless this is a temporary, intentional rollback window.

Equivalent creation command when no entry exists:

```routeros
/ip hotspot ip-binding add address=192.168.88.249 mac-address=AA:BB:CC:DD:EE:FF type=bypassed comment="FlowPress new PC"
```

Replace the sample MAC. Never paste `AA:BB:CC:DD:EE:FF` literally.

## Phase 5: Verify Local DNS and Walled Garden

### Local DNS

Inspect the record:

```routeros
/ip dns static print detail where name="send.cjnet"
```

The record should resolve to:

```text
send.cjnet -> 192.168.88.249
```

If the IP remains `.249`, no DNS address change is required. If the final IP changes intentionally, update the record and every dependent rule.

### Walled Garden

Customers must reach the local upload page before internet login.

Inspect existing rules:

```routeros
/ip hotspot walled-garden ip print detail
```

Required access:

```text
Destination: 192.168.88.249
Protocol: TCP
Port: 80
Action: accept
```

When no matching rule exists:

```routeros
/ip hotspot walled-garden ip add action=accept dst-address=192.168.88.249 protocol=tcp dst-port=80 comment="FlowPress local"
```

Port 3000 may be allowed temporarily for diagnosis, but the final offline route should use Caddy on port 80 through `http://send.cjnet`.

## Phase 6: Replace the MikroTik Portal

The new `mikrotik/hotspot/login.html` provides:

- `CLICK TO CONNECT`: submits the existing `browse` hotspot login and opens normal internet access.
- `SEND FILES`: opens `http://send.cjnet` without requiring internet.

Before replacing files, confirm the existing hotspot user still matches the template:

```routeros
/ip hotspot user print detail where name="browse"
```

The current template uses username `browse` and password `123`. If the actual router differs, update the local template before uploading; do not silently change the router's working credentials.

In WinBox/WebFig:

1. Open **Files**.
2. Open the active hotspot HTML directory identified earlier.
3. Rename or download the current `login.html` as a backup.
4. Upload the contents of `C:\FlowPress\app\mikrotik\hotspot` into that same directory.
5. Confirm `logo.svg` is present beside `login.html`.
6. Disconnect and reconnect a test phone to force the captive portal to reopen.

Do not upload the parent `mikrotik` folder itself. Upload the files inside `mikrotik\hotspot` to the router's active hotspot HTML directory.

## Phase 7: Configure the Public Backend

Create a dedicated public hostname:

```text
upload-api.cloudavera.tech
```

Route it through the existing secure reverse proxy or outbound tunnel to:

```text
http://127.0.0.1:3000
```

Requirements:

- HTTPS must be valid.
- Do not forward router port 3000 directly to the internet.
- Preserve `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, and the real client IP header.
- Allow upload request bodies up to the configured limit.
- The backend `.env.local` must contain `ALLOWED_ORIGINS=https://cjnet.cloudavera.tech`.

Verify publicly:

```powershell
Invoke-RestMethod https://upload-api.cloudavera.tech/api/health
```

## Phase 8: Deploy the Public Vercel Frontend

Create a separate Vercel project from `James-Rivera/flowpress-v2` first. Do not replace the working custom domain until preview testing passes.

Set these Vercel environment variables for Production and Preview as appropriate:

```dotenv
APP_ROLE=frontend
NEXT_PUBLIC_BACKEND_BASE_URL=https://upload-api.cloudavera.tech
NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT=20
NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB=100
NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB=500
```

Do not set `UPLOADS_DIR` on Vercel.

Deploy and test the temporary Vercel URL. After it successfully uploads to the new PC, move the custom domain:

```text
cjnet.cloudavera.tech
```

from the old v1 Vercel project to the new v2 project.

## Phase 9: Acceptance Tests

### Offline test

1. Disable mobile data on a test phone.
2. Connect to CJNET SEND WI-FI.
3. Confirm the portal shows `CLICK TO CONNECT` and `SEND FILES`.
4. Tap `SEND FILES` before internet login.
5. Upload a synthetic PDF.
6. Confirm it appears under the expected customer folder on the new PC.

### Internet test

1. Disconnect the phone from CJNET Wi-Fi.
2. Use mobile data.
3. Open `https://cjnet.cloudavera.tech`.
4. Upload a different synthetic PDF.
5. Confirm it appears in the same upload root on the new PC.

### Internet-connect test

1. Reconnect to CJNET SEND WI-FI.
2. Tap `CLICK TO CONNECT`.
3. Confirm ordinary web browsing works.

### Restart test

1. Restart the new PC.
2. Sign in to Windows.
3. Confirm FlowPress and Caddy return automatically.
4. Repeat one offline upload.

## Cutover and Rollback

Only retire the old PC after all acceptance tests pass.

For rollback:

1. Disconnect the new PC's MikroTik adapter.
2. Restore the old MAC in the DHCP reservation and Hotspot IP Binding, or restore the saved MikroTik backup.
3. Reconnect the old PC/adapter.
4. Restore the backed-up `login.html` if necessary.
5. Confirm the old local upload path works.

Keep the old files and MikroTik backups until the owner explicitly approves their removal.
