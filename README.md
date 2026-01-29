ESPcar — ECAR Project
=====================

Overview
--------
This project contains an ESP32 firmware and a small Web BLE controller for an RC car.

Quick file map
--------------
- `src/main.cpp` — ESP32 firmware. Initializes BLE server, defines `SERVICE_UUID` and `CHAR_CMD_UUID`, configures motor and LED pins, and handles commands (currently polled in `loop()` from `cmdChar->getValue()`). Edit here to change pins, motor logic, BLE behavior or UUIDs.

- `src/app.js` — Web client logic. Contains BLE connect (`connect()`), `send()` implementation, UI event handlers, and command mapping (e.g., `F`, `B`, `L`, `R`, `U`, `V`, `W`, etc.). Edit to change command protocol, sending frequency, or UI behavior.

- `src/web_BLE_new.html` — HTML UI skeleton (if you renamed to `web_BLE.html`, use that). Modifying layout, IDs for buttons/sliders, or adding elements is done here.

- `src/styles.css` — All styling for the web UI. Edit here for colors, layout and responsive rules.

- `.vscode/settings.json` — Workspace settings (Live Server browser override).

- `platformio.ini` — PlatformIO build config. Edit `upload_port` to pin a COM port or change board/framework settings.

How to build & upload firmware
------------------------------
- Build + upload (replace `COM3` with your CP210x port if different):

```bash
platformio run -t upload --upload-port COM3
```

- Open serial monitor:

```bash
platformio device monitor -p COM3 -b 115200
```

Web app (run and debug)
-----------------------
Requirements: Chrome or Edge (Web Bluetooth is not supported in Firefox/Safari).

1. Serve files from `src/` via a local server (must be `localhost` or HTTPS):

- Python (recommended):

```bash
cd d:\ESPcar\ECAR\src
python -m http.server 8000
# open in Chrome: http://127.0.0.1:8000/web_BLE_new.html
```

- Or use Live Server in VS Code but ensure it opens Chrome/Edge.

2. Open Chrome DevTools → Console to see logs (BLE writes, connection messages).
3. Use PlatformIO Serial Monitor to read firmware logs (`BLE Ready!`, `📨 Received:` etc.).

Common edits (what to change and where)
--------------------------------------
- Change BLE UUIDs: update both `src/main.cpp` (`SERVICE_UUID`, `CHAR_CMD_UUID`) and `src/app.js` (`SERVICE_UUID`, `CHAR_UUID`). They must match exactly.
- Change motor / LED pins: edit `ENA`, `IN1`, `IN2`, `ENB`, `IN3`, `IN4`, `LED_F`, `LED_B` in `src/main.cpp`.
- Change command encoding: update `send()` in `src/app.js` and the command parsing in `src/main.cpp` to match (currently single-byte ASCII commands or 2-byte for speed).
- Fix upload port permanently: add `upload_port = COM3` under the appropriate `[env:...]` in `platformio.ini`.

Debugging tips
--------------
- If BLE cannot be used in the browser: check that you're using Chrome/Edge and the site is served from `localhost` or HTTPS. The console contains a compatibility check on page load.
- Chrome Console clues:
  - `✅ BLE write (no response) ->` means the browser wrote to the characteristic.
  - `❌ BLE write failed:` indicates an error; copy the message.
  - Properties printed after connection show if the characteristic supports `write`/`writeWithoutResponse`.

- Firmware / Serial Monitor clues:
  - `BLE Ready!` — server started and advertising.
  - `✅ Callbacks set` — callback was registered.
  - `📨 Received: F` — ESP got a command (when polled or via callback).

Notes about BLE behavior
------------------------
- Web BLE writes are often `writeWithoutResponse` (WRITE_NR). Some BLE stacks may not trigger `onWrite` callbacks reliably for WRITE_NR; the firmware polls `cmdChar->getValue()` every loop iteration to ensure commands are seen.
- If the PC is connected to other Bluetooth devices (headset, phone), the adapter may be busy; disable other devices for stable testing.

Recommended development workflow
-------------------------------
1. Make firmware changes in `src/main.cpp` and upload with PlatformIO.
2. Run Serial Monitor to confirm `BLE Ready!` and other debug prints.
3. Start local server and open `web_BLE_new.html` in Chrome.
4. Open DevTools Console and watch BLE logs while you press UI controls.
5. Iterate.

If you want me to also:
- B) Add inline comments inside `src/main.cpp` and `src/app.js` with short editing tips, or
- C) Rename `web_BLE_new.html` to `web_BLE.html` and remove the old file

Reply with B or C (or both) and I will apply the changes.
