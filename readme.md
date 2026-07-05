# Librelink Extended Gauge

[![HACS](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/default)
[![GitHub Release](https://img.shields.io/github/release/yourusername/librelink-extended-gauge.svg)](https://github.com/yourusername/librelink-extended-gauge/releases)

## 📊 About

A custom Home Assistant card that combines the default gauge with trend arrow, delta values, and sensor expiration information. Designed specifically for LibreLink CGM data.

**Features:**
- ⚡ Automatic detection of all LibreLink sensors
- 🌍 Multi-language support (English,Slovak)
- 🎯 Configurable delta display (1min, 5min, 15min)
- ⏰ Sensor expiration countdown
- 🎨 Clean, minimal design

## 📦 Installation

### HACS (Recommended)
1. Add as a custom repository in HACS:
   - HACS → ⋮ → Custom repositories
   - URL: `https://github.com/dodog/librelink-extended-gauge`
   - Category: Lovelace
2. Click Install

### Manual Installation
1. Download `librelink-extended-gauge.js`
2. Copy to `/config/www/`
3. Add as resource:
   - Settings → Dashboards → Resources
   - URL: `/local/librelink-extended-gauge.js`
   - Type: JavaScript Module

## 🚀 Usage

### Basic Configuration

```
type: custom:librelink-extended-gauge
entity: sensor.john_doe_glucose_measurement
language: sk
```
### Full Configuration
```
type: custom:librelink-extended-gauge
entity: sensor.john_doe_glucose_measurement
language: en                    # sk or en (default: sk)
show_trend_arrow: true          # Show trend arrow (↑, ↓, →)
show_trend_text: true           # Show trend text (STABLE, Falling, Rising)
show_delta: true                # Show main delta
show_timestamp: true            # Show last measurement time
show_expiration: true           # Show sensor expiration
delta_type: 5                   # 1, 5, or 15 (default: 5)
show_delta_1min: false          # Show 1min delta as secondary
show_delta_5min: false          # Show 5min delta as secondary
show_delta_15min: false         # Show 15min delta as secondary
```
### ⚙️ Configuration Options
```
Option	|Type	|Default	|Description
entity	string	Required	Main glucose sensor
language	string	sk	sk or en
show_trend_arrow	boolean	true	Show/hide trend arrow
show_trend_text	boolean	true	Show/hide trend text
show_delta	boolean	true	Show/hide main delta
show_timestamp	boolean	true	Show/hide last measurement time
show_expiration	boolean	true	Show/hide sensor expiration
delta_type	number	5	Main delta: 1, 5, or 15
show_delta_1min	boolean	false	Show 1min delta as secondary
show_delta_5min	boolean	false	Show 5min delta as secondary
show_delta_15min	boolean	false	Show 15min delta as secondary
```
### 🎯 Examples
Show 15min as main, 5min as secondary
```
type: custom:librelink-extended-gauge
entity: sensor.john_doe_glucose_measurement
delta_type: 15
show_delta_5min: true
```
Show only delta and timestamp (minimal)
```
type: custom:librelink-extended-gauge
entity: sensor.john_doe_glucose_measurement
show_trend_arrow: false
show_trend_text: false
show_expiration: false
```
English language with all features
```
type: custom:librelink-extended-gauge
entity: sensor.john_doe_glucose_measurement
language: en
show_trend_arrow: true
show_trend_text: true
show_delta_1min: true
show_delta_15min: true
```
## 📸 Screenshots
<img width="528" height="362" alt="librelink-extended-gauge-screenshot" src="https://github.com/user-attachments/assets/c0592ba8-4706-4e42-bd6e-d5a92eb29575" />


##   🔧 Requirements
Home Assistant 2024.6.0 or higher

card_mod installed

[LibreLink integration](https://github.com/dodog/librelink)

## 🤝 Contributing
Contributions are welcome! Please open an issue or submit a PR.

## 📝 License
This project is licensed under the GNU General Public License v3.0.

## 🙏 Credits
Inspired by the default Home Assistant gauge card

Built for the LibreLink Home Assistant integration
