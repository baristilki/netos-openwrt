# NetOS — a simple home-network dashboard for OpenWrt

[Türkçe](README.md) · **English** · [User guide](docs/USAGE.md)

A lightweight, Keenetic-style management dashboard (Turkish and English UI). Installs on any OpenWrt 22.03+ router
without compiling extra packages.

It doesn't touch LuCI; it installs next to it: `http://<router-ip>/netos/`
(LuCI keeps working at `http://<router-ip>/cgi-bin/luci/`.)

## Features

### Overview
- Home: internet status and live speed graph, all Wi-Fi networks (on/off), home and guest networks,
  physical ports, online devices, system status
- Notification bell: no router password, a line down, new device, slow port, flow offloading… all in one place;
  alerts appear at the top of the page only once
- First-run wizard: router password, time zone, one or two internet lines, automatic updates
- Turkish / English UI, dark / light mode, phone-friendly layout

### Internet
- PPPoE / DHCP / static IP, VLAN, MTU, DNS; automatic rollback within 2 min if a change isn't confirmed
- Multiple lines (mwan3): add a second line, failover or load balancing, per-line status and ping
- Connection history (line down / up) and a 30-day **outage report** (count, total and longest duration,
  availability; copyable as evidence for your ISP)
- Speed test (per line), daily scheduled speed test, ping and packet-loss history
- SQM (bufferbloat prevention) and gaming priority, apply suggested values with one click

### Devices
- Online / offline, Wi-Fi signal, live ↓/↑ speed, names and device types
- Static IP, per-device speed limit, internet block, priority
- Parental controls: per-device day/time schedule (e.g. weekdays 23:00–07:00 no internet);
  with AdGuard: per-device adult-content filter, safe search, blocking services like YouTube/TikTok
- New-device alert (optional auto-block), home / away notifications
- **Per-device internet line** (with two lines): "prefer line A, fall back to the other" or "only line B"
- Per-device live connections, daily traffic statistics (30-100 days)
- **Per-app traffic**: how much each device spent on YouTube, Netflix, Steam, TikTok…
  (today / 7 / 30 days, device filter). Services are recognized from AdGuard Home's DNS log;
  without AdGuard, a rough port-based guess is used. No extra packages needed (conntrack + ucode).

### Network and security
- Physical ports: cable plugged in, link speed (1 / 2.5 Gbit…), drop count, live traffic,
  low speed / half-duplex warning
- Local network: router IP, DHCP range, lease time, DNS (3-min rollback when the IP changes)
- Port forwarding (templates, conflict check), UPnP, DMZ; CGNAT / behind-another-modem warning
- Firewall: reply to ping from the internet, flow offloading on/off
- Login attempt limit (NetOS/LuCI/SSH: 5 failures → 5-15-60 min lock), automatic logout
- **Warning-free HTTPS**: your own certificate authority, limited to local addresses, auto-renewed
- **Install as an app** (iPhone, Android, Windows): full screen with its own icon and name
- WireGuard VPN server (QR code per device), Cloudflare Tunnel (remote access without open ports)
- Ad blocking (AdGuard Home, one-click install)
- Network scanner: IP scan, device-type guess, open ports, Wake-on-LAN, CSV

### Wi-Fi
- OpenWrt Wi-Fi: on/off, network name, password; share via QR code
- Huawei WiFi AX2 / WS5200: on/off, network name, password, channel, channel analysis
- **Guest Wi-Fi** (Huawei guest network): on/off, name, encrypted/open, 4 hours / 1 day / unlimited,
  remaining time and +30 min, total guest speed limit, share via QR
- TP-Link Archer BE230 (experimental)

### System
- Telegram notifications (lines, new devices, presence, system alerts)
- Temperature / disk / memory alerts, scheduled reboot, system log
- Download / restore a settings backup, time zone
- One-click update from GitHub, optional nightly auto-update

### Roadmap
Features ready-made routers such as Keenetic have and NetOS doesn't yet (by priority):
- IPv6 settings (enable when the ISP provides it, hand out to devices)
- VPN client: send selected devices through an external VPN
- Wi-Fi schedule (e.g. Wi-Fi off 01:00–07:00; via Huawei)
- IPsec / OpenVPN / L2TP VPN server (WireGuard only for now)
- Mobile app (for now the dashboard is phone-friendly; remote access via Cloudflare Tunnel)

Hardware-dependent: mesh Wi-Fi system, USB (file sharing, printer, 4G backup line),
802.11r fast roaming and OpenWrt Wi-Fi channel analysis — not possible if the router has no Wi-Fi or USB of its own.

## Requirements
- OpenWrt 22.03+ (fw4 / nftables). Targets 23.05 and 24.10.
- `uhttpd-mod-ubus`, `rpcd`, `iwinfo`, `jsonfilter` (all present if LuCI is installed)

## Installation (from Windows PowerShell)
Replace `192.168.1.1` if your router's IP is different.

1. Remove any old copy:
   ```powershell
   ssh root@192.168.1.1 "rm -rf /tmp/netpanel"
   ```
2. Send the files (`-O` is required, OpenWrt has no SFTP):
   ```powershell
   scp -O -r .\router root@192.168.1.1:/tmp/netpanel
   ```
3. Install:
   ```powershell
   ssh root@192.168.1.1 "sh /tmp/netpanel/install.sh"
   ```
4. Open in a browser: `http://192.168.1.1/netos/` — log in as root with the router password.

Step-by-step instructions for what comes next: [User guide](docs/USAGE.md).

## Integrations
Turn on what you need under NetOS → Integrations; disabled ones stay hidden in the UI.

| Integration | What it does | Status |
|---|---|---|
| Huawei WiFi AX2 / WS5200 | Wi-Fi on/off, network name, password, channel, channel analysis, guest network | Ready (verified on AX2 + OpenWrt 25.12) |
| AdGuard Home | One-click install; network-wide ad blocking, per-device YouTube/TikTok blocking, safe search | Ready |
| WireGuard VPN | VPN server, QR code per device | Ready |
| Cloudflare Tunnel | Remote access without open ports, automatic DNS + Access setup | Ready |
| Network scanner | IP scan (custom range), device-type guess, open ports, web UI, Wake-on-LAN, CSV | Ready |
| TP-Link Archer BE230 | Band on/off, network name, password (encrypted Archer API) | Experimental — not verified on a real device |

### Huawei
IP `192.168.1.2`, user `admin`, Huawei password → Save.
- The password is stored only on the router (`/etc/config/netpanel`, root-only) and never sent back to the browser.
- After a wrong password it doesn't retry until a new one is entered, so the Huawei doesn't lock you out.
- Needs `curl` and `openssl-util`; `install.sh` installs them if missing.
- Manual test: `ssh root@192.168.1.1 "/usr/libexec/netpanel/huawei.sh status"`

### Network scanner
Sends one ping to every local address; devices that ignore ping are still found via ARP.
The optional port / web-UI check only looks at whether a connection opens. Results can be downloaded as CSV.

### Adding a new integration
1. Router side: `router/files/usr/libexec/netpanel/<name>.sh` (a script that prints JSON),
   a new method in `usr/libexec/rpcd/netpanel` + permission in `acl.d/netpanel.json`.
2. Data layer: a function in `www/netos/api.js` + a demo (mock) response.
3. UI: an entry in the `INTEGRATIONS` list and a settings card in `www/netos/app.js`.

## Updates
NetOS → System → Update: checks the latest release on GitHub and installs it with one click (settings and device records are kept).
With "Auto-update" on, it installs updates by itself around 04:30 every night; otherwise it notifies you on Telegram.

### Publishing a new version (developers)
1. Bump `router/VERSION` and `APP_VERSION` in `router/files/www/netos/app.js` (e.g. `1.2.1`).
2. Commit + push, then publish the release:
   ```powershell
   gh release create v1.2.1 --title "NetOS 1.2.1" --notes "- Change 1`n- Change 2"
   ```
Routers read the `releases/latest` tag; it must look like `vX.Y.Z`. Routers can't see releases while the repo is private.

## Flow offloading warning
If "Software/Hardware flow offloading" is on in the firewall, established connections bypass nftables:
speed limits and live per-device speeds don't work. To turn it off:
```powershell
ssh root@192.168.1.1 "uci set firewall.@defaults[0].flow_offloading=0; uci set firewall.@defaults[0].flow_offloading_hw=0; uci commit firewall; fw4 reload"
```
(On a mini PC the CPU is strong enough to reach gigabit speeds with offloading off.)

## Known limitations
- Speed limits use "policing" (excess packets are dropped); simpler and lighter than SQM, but not as smooth
  for gaming / video calls.
- The download limit applies to IPv4. If IPv6 is active, a device can exceed it over IPv6.
  The upload limit and blocking work by MAC (IPv4+IPv6).
- A static IP takes effect when the device renews DHCP (Wi-Fi off/on).
- Per-app traffic and per-device line rules currently cover IPv4 only.

## Uninstall
```powershell
ssh root@192.168.1.1 "sh /tmp/netpanel/uninstall.sh"
```
(send the files again with steps 1-2 first)

## Layout
```
router/
  install.sh, uninstall.sh
  files/
    usr/libexec/rpcd/netpanel      ubus object: clients, status, set_client, forget_client, set_wifi…
    usr/libexec/netpanel/          helper scripts (wanctl.sh, huawei.sh, apps.uc, collect.sh…)
    usr/share/netpanel/common.sh   shared shell helpers
    usr/sbin/netpanel-apply        nft table "inet netpanel" (limits/blocks/counters)
    usr/share/rpcd/acl.d/netpanel.json
    etc/init.d/netpanel            loads rules at boot
    etc/hotplug.d/dhcp/90-netpanel refreshes rules when an IP changes
    etc/config/netpanel            device records (name, limits, block…)
    www/netos/                     UI (api.js = data layer, app.js/style.css/index.html = view)
```
Preview without a router: open `router/files/www/netos/index.html` in a browser
(demo data loads automatically; any password works).

## Contributing and license
Contribution guide: [CONTRIBUTING.md](CONTRIBUTING.md). NetOS is released under [GPL-2.0](LICENSE), like OpenWrt.
