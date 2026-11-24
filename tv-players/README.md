# JTS Signage — Multi-Brand Dedicated TV Player Suite (No Chrome Required)

Har brand ki TV par bina Chrome khole directly fullscreen signage player chalane ke liye ye dedicated packages ready hain. Sabhi TVs ek baar **6-digit pairing code** se bind hoti hain aur agle har power-on par automatically fullscreen ads chalati hain (Video + Image + Offline Cache + Live Sync + Orientation/Volume Control).

---

## 1. Android TV / Google TV / Android Box (Sony, Mi / Xiaomi, TCL, OnePlus, Vu, Hisense, Kodak, Amazon Fire TV)

- **Ready Package**: `dist/JTS-Signage-TV.apk`
- **Features**:
  - TV ON / Bijli aate hi auto-start (`BOOT_COMPLETED` / `QUICKBOOT_POWERON`).
  - Fullscreen immersive mode + screen wake-lock (kabhi sleep nahi hogi).
  - Single Back press block (accidentally exit nahi hoga); TV remote **Menu**, **5x Back**, ya top-left 5 taps se Settings overlay khulta hai.
  - Native WebView `setMediaPlaybackRequiresUserGesture(false)` (bina click kiye audio + video chalti hai).

### Install Kaise Karein
- **Pendrive / USB Se (Sabse Aasaan)**:
  1. `JTS-Signage-TV.apk` USB pendrive me copy karke TV me lagayein.
  2. TV ke File Manager / FX Explorer se APK open karke Install karein (*Unknown Sources* allow karein).
  3. App open karte hi **6-digit pairing code** dikhega → Admin Panel me **Devices → Pair TV Code** me daal dein.
- **ADB Se (Developer / Bulk Setup)**:
  ```powershell
  adb connect <TV_IP>:5555
  adb install -r "tv-players\dist\JTS-Signage-TV.apk"
  ```

---

## 2. Samsung Smart TV (Tizen OS / Samsung SSSP)

- **Ready Package**: `dist/JTS-Signage-Samsung-Tizen.wgt`
- **Features**:
  - `config.xml` configured for `tv-samsung` profile, auto-landscape, `tizen.power.request("SCREEN", "SCREEN_NORMAL")`, zero sleep, external backend access (`*`).
- **Deploy Kaise Karein**:
  - Samsung Tizen Studio Certificate se `.wgt` sign karke TV par install karein, ya commercial SSSP / MagicINFO URL launcher me `JTS-Signage-Samsung-Tizen.wgt` upload karein:
    ```bash
    tizen package -t wgt -s <YOUR_SAMSUNG_CERT> -- tv-players/samsung-tizen/stage
    tizen install -n JTS-Signage-Samsung-Tizen.wgt -t <TV_DEVICE_ID>
    ```

---

## 3. LG Smart TV (webOS / LG SuperSign)

- **Staged App Folder**: `dist/lg-webos-app/` (contains `appinfo.json`, icons, aur `player-core`)
- **Features**:
  - Full 1920x1080 webOS app, `disableBackHistoryAPI: true`, zero browser bar.
- **Deploy Kaise Karein** (LG webOS TV CLI installed PC se):
  ```bash
  ares-package "tv-players/dist/lg-webos-app" -o "tv-players/dist"
  ares-install --device <LG_TV_NAME> "tv-players/dist/com.jts.signage_1.0.0_all.ipk"
  ares-launch --device <LG_TV_NAME> com.jts.signage
  ```

---

## 4. Kisi Bhi Brand / Non-Smart TV Ke Liye (Samsung, LG, Sony, Micromax, LED Video Wall) — HDMI Kiosk Box

Agar TV non-smart hai ya alag-alag older brands ke TV hain, to koi bhi **Windows Mini-PC / Android TV Box / Raspberry Pi** HDMI se lagayein:
- **Android Box**: Upar wala `dist/JTS-Signage-TV.apk` use karein.
- **Windows / Linux / Raspberry Pi HDMI Kiosk (`desktop-kiosk/`)**:
  - OS start hote hi auto-launch, fullscreen kiosk mode, display sleep disabled, no-gesture autoplay enabled.
  - Run / Build Commands:
    ```powershell
    cd tv-players/desktop-kiosk
    npm install
    npm start          # Direct Kiosk run
    npm run dist:win   # Windows Setup .exe banane ke liye
    npm run dist:linux # Raspberry Pi / Linux AppImage & .deb banane ke liye
    ```

---

## Server URL Setup (LAN / Cloud)

- Default Server URL: `https://vms-backend-ctea.onrender.com`
- Agar aap Local Office / LAN Server (`http://<PC_IP>:5000`) use kar rahe hain:
  1. App me **Server Settings** button dabaiye (ya remote se **Menu** / **Back 5x** / **Ctrl+Shift+S** / top-left 5 taps).
  2. Apna Backend Server URL daal kar **Save & Reconnect** dabaiye.

---

## Rebuild All Packages
```powershell
powershell -ExecutionPolicy Bypass -File "tv-players\build-all.ps1"
```
