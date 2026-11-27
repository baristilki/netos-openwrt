# NetOS user guide

[Türkçe](KULLANIM.md) · **English** · [README](../README.en.md)

Step-by-step instructions for the most common tasks after installation. Menu names are given as they appear
when the dashboard is switched to English (TR/EN switch in the top bar).
Dashboard address: `http://192.168.1.1/netos/` (use your router's IP if it differs).

- [1. First start and router password](#1-first-start-and-router-password)
- [2. Adding a second internet line](#2-adding-a-second-internet-line)
- [3. Sending a device through a specific line](#3-sending-a-device-through-a-specific-line)
- [4. Guest Wi-Fi](#4-guest-wi-fi)
- [5. Managing devices: name, static IP, speed limit, block](#5-managing-devices-name-static-ip-speed-limit-block)
- [6. Parental controls](#6-parental-controls)
- [7. Ad blocking and app traffic (AdGuard Home)](#7-ad-blocking-and-app-traffic-adguard-home)
- [8. Outage report](#8-outage-report)
- [9. Lower ping (SQM) and gaming priority](#9-lower-ping-sqm-and-gaming-priority)
- [10. Port forwarding](#10-port-forwarding)
- [11. Remote access from your phone: VPN and Cloudflare Tunnel](#11-remote-access-from-your-phone-vpn-and-cloudflare-tunnel)
- [12. Telegram notifications](#12-telegram-notifications)
- [13. Backup and updates](#13-backup-and-updates)
- [Troubleshooting](#troubleshooting)

---

## 1. First start and router password
1. Open the dashboard, user `root`, password = your router password (may be empty on a fresh install).
2. The **setup wizard** opens once by itself: password → time zone → internet lines → updates.
3. If the router has no password, **set one**: anyone on your network could otherwise open the dashboard,
   LuCI and SSH. The same password is used for LuCI and SSH.
4. If you closed the wizard, set it later on **System > Dashboard password**.

> The **bell** in the top bar lists open problems (no router password, a line down, new device, slow port…).
> Alerts appear at the top of the page only once; after that they stay in the bell.

## 2. Adding a second internet line
You need a second modem and a **free** Ethernet port on the router.
1. Plug the second modem into the free port. Check on **Home > Ports** that the cable shows as plugged in.
2. On the **Internet** page open the **Second internet line** card (or choose "Two internet lines" in the wizard).
3. Pick the port and the connection type:
   - Modem in router mode (most common): **Modem in router mode (automatic IP)**
   - Modem in bridge mode: **PPPoE** + the username/password from your ISP (VLAN if needed)
4. Choose how the lines work together:
   - **Failover**: if the main line drops, internet switches to the other one automatically.
   - **Use both**: traffic is shared across both lines.
5. **Add line** → after a few seconds both lines should show "Online" on the **Internet** page.
   If you don't confirm the change within 2 minutes, the old settings come back automatically.

You can change the mode later in **Internet > Multi-WAN mode**. (Under the hood: the `mwan3` package; the dashboard installs it if needed.)

## 3. Sending a device through a specific line
Example: the PlayStation always uses line A, the living-room TV always uses line B.
1. **Devices** → click the device → **Internet line** section (only shown when there are two lines).
2. Options:
   - **Automatic**: follows the general multi-line setting.
   - **Prefer X (fall back to the other line)**: normally uses X; if X drops, it switches to the other line.
   - **Only X**: always uses X; if X drops, this device has no internet either.
3. **Save**. The device list shows a "Line: X" or "Only: X" badge.

Good to know: the rule is tied to the device's **IP address**, so a **static IP** is reserved for it automatically.
The rule applies to new connections; turn the device's Wi-Fi off and on to see it immediately.

## 4. Guest Wi-Fi
When Huawei Wi-Fi is connected (**Integrations > Huawei**), the **Wi-Fi** page shows a **Guest Wi-Fi** card.
1. Enter a network name, choose **Encrypted (recommended)** and a password of at least 8 characters.
2. **Stays on for**: 4 hours / 1 day / Unlimited. When the time runs out, Huawei turns the guest network off by itself;
   the remaining time is shown on the card and **+30 min** extends it.
3. Optionally limit the total guest speed with **Speed limit > Limit** (e.g. 20 Mbit/s).
4. **Save**, then switch it on. With **Share via QR**, guests scan the code with their phone camera to join.

Guests can't see your home devices (computers, cameras, NAS).

## 5. Managing devices: name, static IP, speed limit, block
**Devices** → click a device:
- **Name and type**: a friendly name and icon in the list.
- **Static IP address**: "Reserve an IP for this device" → enter the IP → Save. The device gets it after reconnecting its Wi-Fi.
- **Speed limit**: download/upload in Mbit/s (empty = unlimited). Shortcuts: 5, 10, 25, 50, 100.
- **Block internet access**: cuts the device's internet immediately.
- **Gaming priority**, **notify when home / away**, **Forget device**.

## 6. Parental controls
**Devices** → the child's device:
1. **Schedule**: choose days and a time range (e.g. weekdays 23:00–07:00) → no internet during those hours.
2. With AdGuard Home installed, the same panel has **Content filter** (İçerik filtresi): adult-site blocking, safe search,
   and blocking services such as YouTube / TikTok / games for this device only.

## 7. Ad blocking and app traffic (AdGuard Home)
1. **Integrations > AdGuard Home** → one-click install, choose an admin password.
   (If AdGuard is already installed, enter its username/password to connect it.)
2. On the **Ad blocking** page turn protection on/off and pick apps to block for the whole network.
3. **Statistics > Apps** card: how much each device spent on YouTube, Netflix, Steam, TikTok…
   (today / 7 / 30 days, device filter). Services are recognized from AdGuard's DNS log.
   Without AdGuard, only a rough port-based guess is shown ("Web (other)", "DNS"…).

## 8. Outage report
At the bottom of the **Internet** page, **Outage report · last 30 days** shows per line: number of outages,
total and longest duration, and availability. **Copy report** gives you a text (with outage start times)
you can send to your ISP.

## 9. Lower ping (SQM) and gaming priority
1. **Speed & Ping** → run a **Speed test** under load; the result may offer "Apply suggested values".
2. In the **Ping reduction — SQM** card set the limits to ~90% of the measured speed.
3. Turn on your console/PC in the **Gaming priority** list (SQM mode must be "Gaming priority").

## 10. Port forwarding
**Port forwarding** → **Add rule** (Kural ekle) → a ready template (Minecraft, camera, games…) or manually:
external port, device, internal port, protocol → Save. The dashboard warns about conflicts and CGNAT
(lines that can't be reached from outside).

## 11. Remote access from your phone: VPN and Cloudflare Tunnel
- **VPN (WireGuard)**: **VPN** page → set up the server → **Add device** → scan the QR code with the WireGuard app
  on your phone. The QR code is shown only once.
- **Cloudflare Tunnel** (no open ports, works behind CGNAT too): **Integrations > Cloudflare Tunnel**,
  paste a token or use an API token for automatic setup (including Access e-mail protection).

## 12. Telegram notifications
**System > Notifications (Telegram)**: enter the bot token and Chat ID → **Test message**.
Options: line down/up, new device, home/away, system alerts, auto-block new devices.

## 13. Backup and updates
- **System > Backup**: download / restore a settings backup.
- **System > Update**: installs the latest GitHub release with one click; settings and device records are kept.
  With "Auto-update" on, it installs updates by itself at night.

---

## Troubleshooting
| Symptom | Fix |
|---|---|
| Second line shows "offline" but the modem has internet | NetOS automatically switches reverse-path filtering (`rp_filter`) to loose mode for multi-line setups. Manually: `ssh root@192.168.1.1 "sysctl -w net.ipv4.conf.all.rp_filter=2"` |
| Device speeds / speed limits don't work | Flow offloading is on. Use **Turn off (recommended)** in the alert or **System > Advanced** |
| Static IP or line rule has no effect | Turn the device's Wi-Fi off and on so it picks up the new IP |
| A port drops often ("# drops") | Check the cable and the device on the other end; if that computer goes to sleep, this is normal |
| Port linked at 1G instead of 2.5G | Use at least a Cat5e cable (Cat6 recommended for 2.5G) and make sure the other device's port is 2.5G |
| Dashboard won't open | If LuCI works: `ssh root@192.168.1.1 "/etc/init.d/rpcd restart; /etc/init.d/uhttpd restart"` |
