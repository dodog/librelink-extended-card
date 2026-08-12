# Librelink Extended Card

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![GitHub Release](https://img.shields.io/github/release/dodog/librelink-extended-card.svg)](https://github.com/dodo/librelink-extended-card/releases)

## 📊 About

A custom [Home Assistant](https://www.home-assistant.io/) Lovelace card for displaying glucose data from the [LibreLinkUp integration](https://github.com/dodog/librelink), with a large glucose reading, trend arrow, delta, sensor expiration.

**Features:**
- ⚡ Automatic detection of LibreLink sensors
- 🌍 Multi-language support (English, German, Spanish, French, Slovak, Polish)
- 🎯 Configurable delta display (1min, 5min, 15min)
- ⏰ Sensor expiration countdown
- 🕥 Time since last measurement, color-coded by staleness
- ✏️ Built-in **visual editor** — configure entirely through the dashboard UI, no YAML required
- 💻 Automatic **mmol/L or mg/dL** support, detected from your sensor's unit
- 🤞 Tap and hold actions (more-info, navigate, url, call-service, toggle)
- 🎨 Clean, minimal design

## 📦 Installation

### HACS (Recommended)

1. Add as a custom repository in [HACS](https://hacs.xyz/):
   - HACS → Click on 3 dots top right ⋮ → Custom repositories
   - URL: `https://github.com/dodog/librelink-extended-card`
   - Type: Dashboard
2. Click Install
3. Find the "Librelink Extended Card" and click "Download"

### Manual Installation
1. Download `librelink-extended-card.js`
2. Copy to `/config/www/`
3. Add as resource:
   - Settings → Dashboards → Resources
   - URL: `/local/librelink-extended-card.js`
   - Type: JavaScript Module

## 🚀 Usage

### Visual editor (recommended)

- **Edit Dashboard → Add Card → search "Librelink Extended Card"**, or
- Click **Edit** on an existing card.

All options below are available as fields in the editor, including tap/hold actions with HA's standard action picker.

The card derives the shared `<your_name>` prefix automatically from the main entity you configure, so you only need to set one `entity:` value. If a related sensor isn't found under that prefix, the card also checks for it without the prefix (e.g. `sensor.delta_5min`) as a fallback.
- `sensor.name_surname_measurement` (required — this is the entity you point the card at)

### Basic Manual Configuration

```
type: custom:librelink-extended-card
entity: sensor.name_surname_measurement
```
That's the minimum needed — everything else is optional and has a sensible default.

### Full Configuration
```
type: custom:librelink-extended-card
entity: sensor.name_surname_measurement
show_measurement: true          # Shows glucose measurement (optional) 
language: en                    # en (or sk, de, fr, es) - optional
show_trend_arrow: true          # Show trend arrow (↑, ↓, →)
show_trend_text: true           # Show trend text (STABLE, Falling, Rising)
show_delta: true                # Show main delta
show_timestamp: true            # Show last measurement time
show_expiration: true           # Show sensor expiration
delta_type: 5                   # 1, 5, or 15 (default: 5)
show_delta_1min: false          # Show 1min delta as secondary
show_delta_5min: false          # Show 5min delta as secondary
show_delta_15min: false         # Show 15min delta as secondary
show_time_in_range: false       # Show the 24h Time in Range (optional)
unit: mmol/L                    # Auto-detected from the entity's unit_of_measurement (optional)
decimals: 1                     # Number of decimal places (optional, auto-detected from the entity)
tap_action:                     # (optional, standard HA action config:
hold_action: { action: none }   # (optional, same options as tap_action)
```
### ⚙️ Configuration Options


| Option              | Type    | Default                     | Description                                                                                                                          |
| -------------------- | ------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------|
| `entity`             | string  | **required**                 | Your glucose measurement sensor, e.g. `sensor.john_glucose_measurement`                                                              |
| `unit`               | string  | auto (from sensor)           | Force the display unit: `mmol/L` or `mg/dL`. Leave unset to auto-detect from the entity's `unit_of_measurement`                       |
| `language`           | string  | auto (matches Home Assistant)| Override the UI text language: `en`, `sk`, `de`, `fr`, `es`. Leave unset to follow HA's own language setting                          |
| `decimals`           | number  | auto (entity precision)      | Force a fixed number of decimal places. Leave unset to follow each entity's own "Display Precision" setting                          |
| `delta_type`         | number  | `5`                           | Which delta window (`1`, `5`, or `15` minutes) is shown as the main delta                                                             |
| `show_measurement`   | boolean | `true`                        | Show the large glucose value                                                                                                          |
| `show_unit`          | boolean | `true`                        | Show the unit label (mmol/L / mg/dL) next to the measurement                                                                          |
| `show_trend_arrow`   | boolean | `true`                        | Show the trend arrow                                                                                                                  |
| `show_trend_text`    | boolean | `true`                        | Show the trend description text                                                                                                       |
| `show_delta`         | boolean | `true`                        | Show the main delta (per `delta_type`)                                                                                                |
| `show_timestamp`     | boolean | `true`                        | Show time since last measurement                                                                                                      |
| `show_expiration`    | boolean | `true`                        | Show sensor/transmitter expiration countdown                                                                                          |
| `show_delta_1min`    | boolean | `false`                       | Also show the 1‑minute delta as a secondary line                                                                                      |
| `show_delta_5min`    | boolean | `false`                       | Also show the 5‑minute delta as a secondary line                                                                                      |
| `show_delta_15min`   | boolean | `false`                       | Also show the 15‑minute delta as a secondary line                                                                                     |
| `show_time_in_range`   | boolean | `false`                       | Show Time in Range in 24 hours                                                                                                       |
| `tap_action`         | object  | `{ action: more-info }`       | Standard HA action config: `more-info`, `navigate`, `url`, `call-service`, `toggle`, `none`                                           |
| `hold_action`        | object  | `{ action: none }`            | Same options as `tap_action`, triggered on long-press                                                                                 |

## Status colors

| Element   | Color  | Condition (converted to mmol/L for the comparison)      |
| --------- | ------ | ---------------------------------------------------------|
| Reading   | Red    | Below 3.9 mmol/L (≈ 70 mg/dL)                             |
| Reading   | Yellow | 10 mmol/L (≈ 180 mg/dL) or above                          |
| Reading   | Green  | In range                                                  |
| Delta     | Red    | Change greater than 1 mmol/L (≈ 18 mg/dL) since last reading |
| Delta     | Yellow | Change greater than 0.3 mmol/L (≈ 5 mg/dL)                |
| Delta     | Green  | Stable                                                    |
| Timestamp | Red    | No update in over 10 minutes                              |
| Timestamp | Yellow | No update in 5–10 minutes                                 |
| Timestamp | Green  | Recently updated                                          |

These thresholds aren't currently configurable — if you'd like that as an option, please open an issue.



### 🎯 Example

```
type: custom:librelink-extended-card
entity: sensor.name_surname_measurement
delta_type: 5
show_measurement: true
show_unit: true
show_trend_arrow: true
show_trend_text: true
show_delta: true
show_timestamp: true
show_expiration: true
show_delta_1min: false
show_delta_5min: false
show_delta_15min: false
show_delta_15min: false
tap_action:
  action: more-info
hold_action:
  action: none

```
## 📸 Screenshots
<img width="535" height="302" alt="librelink-extended-card-screenshot" src="https://raw.githubusercontent.com/dodog/librelink-extended-card/refs/heads/main/screenshot.png" />


##   🔧 Requirements
Home Assistant 2024.6.0 or higher

[card_mod](https://github.com/thomasloven/lovelace-card-mod) installed

[LibreLink integration](https://github.com/dodog/librelink) installed
## Troubleshooting

**The card shows an error/status message instead of data.** 
- This usually means the underlying LibreLinkUp sensors haven't updated recently, or the entity's expiration timestamp has passed — check the integration itself first.

**Decimals/unit look wrong.** 
- Check the entity's own "Display Precision" and unit under **Settings → Devices & Services → Entities → (your sensor)**; the card follows those unless you override them with `decimals:`/`unit:` in the config.


## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a PR.

## 📝 License
This project is licensed under the GNU General Public License v3.0.

## 🙏 Credits

Built for the [LibreLink Home Assistant integration](https://github.com/dodog/librelink)
