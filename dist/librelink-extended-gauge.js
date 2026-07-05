/**
 * Librelink Extended Gauge Card for Home Assistant
 * 
 * This card combines the default HA gauge with trend arrow, delta, and timestamp.
 * Designed for LibreLink integration with automatic sensor detection.
 * 
 * Installation:
 * 1. Save this file to /config/www/librelink-extended-gauge.js
 * 2. Add as resource: Settings → Dashboards → Resources → /local/librelink-extended-gauge.js
 * 3. Clear browser cache
 * 
 * Usage:
 * type: custom:librelink-extended-gauge
 * entity: sensor.your_glucose_sensor
 * language: sk (or en) - optional, defaults to sk
 * show_trend_arrow: true (optional, defaults to true)
 * show_trend_text: true (optional, defaults to true)
 * show_delta: true (optional, defaults to true)
 * show_timestamp: true (optional, defaults to true)
 * show_expiration: true (optional, defaults to true)
 * delta_type: 5 (optional, 1, 5, or 15, defaults to 5)
 * show_delta_1min: false (optional, show 1min delta as secondary)
 * show_delta_5min: false (optional, show 5min delta as secondary)
 * show_delta_15min: false (optional, show 15min delta as secondary)
 */

class LibrelinkExtendedGauge extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._gaugeElement = null;
    this._lastGlucoseValue = null;
    this._infoContainer = null;
    this._gaugeContainer = null;
    this._initialized = false;
    this._gaugeLoaded = false;
    this._sensorBase = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this._config = {
      language: 'en',
      show_trend_arrow: true,
      show_trend_text: true,
      show_delta: true,
      show_timestamp: true,
      show_expiration: true,
      delta_type: 5,
      show_delta_1min: false,
      show_delta_5min: false,
      show_delta_15min: false,
      ...config
    };
    
    // Extract sensor base name from entity
    const entityParts = this._config.entity.split('.');
    if (entityParts.length === 2) {
      const nameParts = entityParts[1].split('_');
      const sensorTypes = ['glucose', 'measurement', 'value'];
      let cutIndex = nameParts.length;
      for (let i = nameParts.length - 1; i >= 0; i--) {
        if (sensorTypes.includes(nameParts[i].toLowerCase())) {
          cutIndex = i;
          break;
        }
      }
      if (cutIndex < nameParts.length) {
        this._sensorBase = nameParts.slice(0, cutIndex).join('_');
      } else {
        this._sensorBase = nameParts.slice(0, -1).join('_');
      }
    }
    
    if (!this._sensorBase) {
      this._sensorBase = entityParts[1].replace(/_glucose_measurement$/, '').replace(/_measurement$/, '');
    }
    
    this._createCardStructure();
    this._loadGauge();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._gaugeLoaded) {
      this._updateContent();
    } else {
      this._loadGauge();
    }
  }

  _getLanguage() {
    return this._config.language || 'sk';
  }

  _getTranslations() {
    const lang = this._getLanguage();
    const translations = {
      en: {
        just_now: 'Just now',
        min_ago: (n) => n === 1 ? '1 min ago' : `${n} min ago`,
        hour_ago: (n) => n === 1 ? '1 hour ago' : `${n} hours ago`,
        day_ago: (n) => n === 1 ? '1 day ago' : `${n} days ago`,
        expired: 'EXPIRED',
        expires: 'Expires in',
        time_units: {
          min: 'min',
          h: 'h',
          d: 'd',
          week: (n) => n === 1 ? 'week' : 'weeks',
          month: (n) => n === 1 ? 'month' : 'months'
        }
      },
      sk: {
        just_now: 'Pred chvíľou',
        min_ago: (n) => n === 1 ? 'Pred 1 minútou' : `Pred ${n} minútami`,
        hour_ago: (n) => n === 1 ? 'Pred 1 hodinou' : `Pred ${n} hodinami`,
        day_ago: (n) => n === 1 ? 'Pred 1 dňom' : `Pred ${n} dňami`,
        expired: 'EXPIROVAL',
        expires: 'Exspiruje o',
        time_units: {
          min: 'min',
          h: 'h',
          d: 'd',
          week: (n) => n === 1 ? 'týždeň' : 'týždne',
          month: (n) => n === 1 ? 'mesiac' : 'mesiace'
        }
      }
    };
    return translations[lang] || translations.sk;
  }

  _createCardStructure() {
    this.innerHTML = '';
    const container = document.createElement('ha-card');
    container.style.cssText = `
      padding: 16px 16px 8px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--ha-card-background);
      border-radius: var(--ha-card-border-radius);
      box-shadow: var(--ha-card-box-shadow);
      border: none;
    `;
    container.id = 'gauge-wrapper-container';

    this._gaugeContainer = document.createElement('div');
    this._gaugeContainer.style.cssText = `
      width: 100%;
      position: relative;
      background: transparent !important;
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
      min-height: 100px;
    `;
    this._gaugeContainer.id = 'gauge-container';
    this._gaugeContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">Loading gauge...</div>';
    container.appendChild(this._gaugeContainer);

    this._infoContainer = document.createElement('div');
    this._infoContainer.id = 'info-container';
    this._infoContainer.style.cssText = `
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: white;
      margin-top: -5px;
      padding: 8px 0 4px 0;
      width: 100%;
      background: transparent;
      border: none;
    `;
    container.appendChild(this._infoContainer);

    this.appendChild(container);
  }

  _loadGauge() {
    if (window.customElements && window.customElements.get('hui-gauge-card')) {
      this._createGauge();
      this._initialized = true;
      this._gaugeLoaded = true;
    } else {
      setTimeout(() => {
        this._loadGauge();
      }, 500);
    }
  }

  _createGauge() {
    if (!this._gaugeContainer || this._gaugeElement) return;
    
    try {
      const gaugeConfig = {
        type: 'gauge',
        entity: this._config.entity,
        name: this._config.name || 'Glucose',
        unit: this._config.unit || 'mmol/L',
        min: this._config.min || 1,
        max: this._config.max || 15.5,
        needle: true,
        severity: {
          green: this._config.green || 4.05,
          yellow: this._config.yellow || 10,
          red: this._config.red || 1
        }
      };

      const gaugeElement = document.createElement('hui-gauge-card');
      gaugeElement.setConfig(gaugeConfig);
      
      if (this._hass) {
        gaugeElement.hass = this._hass;
        const glucoseState = this._hass.states[this._config.entity];
        if (glucoseState) {
          this._lastGlucoseValue = glucoseState.state;
        }
      }
      
      gaugeElement.style.cssText = `
        all: unset !important;
        display: block !important;
        width: 100% !important;
        background: transparent !important;
        box-shadow: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
      `;
      
      this._gaugeContainer.innerHTML = '';
      this._gaugeContainer.appendChild(gaugeElement);
      this._gaugeElement = gaugeElement;
      
      requestAnimationFrame(() => {
        const innerCard = gaugeElement.querySelector('ha-card');
        if (innerCard) {
          innerCard.style.cssText = `
            all: unset !important;
            display: block !important;
            width: 100% !important;
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          `;
        }
      });
      
      if (this._hass) {
        this._updateContent();
      }
      
    } catch (e) {
      console.error('Gauge creation failed:', e);
      this._gaugeContainer.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">Error loading gauge: ${e.message}</div>`;
    }
  }

  _getSensor(sensorName) {
    if (!this._sensorBase) return null;
    const entityId = `sensor.${this._sensorBase}_${sensorName}`;
    const state = this._hass.states[entityId];
    if (state) return state;
    const altEntityId = `sensor.${sensorName}`;
    return this._hass.states[altEntityId] || null;
  }

  _formatTimestamp(isoString) {
    if (!isoString) return '';
    const t = this._getTranslations();
    
    try {
      const utcDate = new Date(isoString);
      if (isNaN(utcDate.getTime())) return isoString;
      
      const now = new Date();
      const diffMs = now - utcDate;
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMinutes < 1) return t.just_now;
      if (diffMinutes < 60) return t.min_ago(diffMinutes);
      if (diffHours < 24) return t.hour_ago(diffHours);
      return t.day_ago(diffDays);
    } catch (e) {
      return isoString;
    }
  }

  _formatTimeRemaining(isoString) {
    if (!isoString) return '';
    const t = this._getTranslations();
    
    try {
      const futureDate = new Date(isoString);
      if (isNaN(futureDate.getTime())) return isoString;
      
      const now = new Date();
      const diffMs = futureDate - now;
      
      if (diffMs < 0) {
        return t.expired;
      }
      
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);
      
      let timeStr = '';
      if (diffMinutes < 1) {
        timeStr = '1 min';
      } else if (diffMinutes < 60) {
        timeStr = `${diffMinutes} ${t.time_units.min}`;
      } else if (diffHours < 24) {
        timeStr = `${diffHours} ${t.time_units.h}`;
      } else if (diffDays < 7) {
        timeStr = `${diffDays} ${t.time_units.d}`;
      } else if (diffDays < 30) {
        timeStr = `${diffWeeks} ${t.time_units.week(diffWeeks)}`;
      } else {
        timeStr = `${diffMonths} ${t.time_units.month(diffMonths)}`;
      }
      
      return `${t.expires} ${timeStr}`;
    } catch (e) {
      return isoString;
    }
  }

  _getTimestampColor(timestamp) {
    if (!timestamp) return '#888';
    
    try {
      const utcDate = new Date(timestamp);
      if (isNaN(utcDate.getTime())) return '#888';
      
      const now = new Date();
      const diffMs = now - utcDate;
      const diffMinutes = Math.floor(diffMs / 60000);
      
      if (diffMinutes > 10) return '#FF5252';
      if (diffMinutes > 5) return '#FFC107';
      return '#4CAF50';
    } catch (e) {
      return '#888';
    }
  }

  _isExpired(expirationTimestamp) {
    if (!expirationTimestamp) return false;
    try {
      const expDate = new Date(expirationTimestamp);
      if (isNaN(expDate.getTime())) return false;
      return new Date() > expDate;
    } catch (e) {
      return false;
    }
  }

  _getDeltaColor(deltaValue) {
    if (isNaN(deltaValue)) return '#4CAF50';
    if (deltaValue > 1) return '#FF5252';
    if (deltaValue < -1) return '#FF5252';
    if (deltaValue > 0.3) return '#FFC107';
    if (deltaValue < -0.3) return '#FFC107';
    return '#4CAF50';
  }

  _updateContent() {
    if (!this._hass || !this._config || !this._infoContainer) return;

    const glucoseState = this._hass.states[this._config.entity];
    if (!glucoseState) {
      this._infoContainer.innerHTML = 'Entity not found';
      return;
    }

    const currentGlucoseValue = glucoseState.state;
    
    if (this._lastGlucoseValue !== currentGlucoseValue && this._gaugeElement) {
      this._lastGlucoseValue = currentGlucoseValue;
      if (this._gaugeElement && this._hass) {
        this._gaugeElement.hass = this._hass;
      }
    }

    // Get all sensor data
    const trendArrowState = this._getSensor('glucose_trend_arrow') || this._getSensor('trend_arrow');
    const delta1State = this._getSensor('delta_1min');
    const delta5State = this._getSensor('delta_5min');
    const delta15State = this._getSensor('delta_15min');
    const trendState = this._getSensor('trend');
    const timestampState = this._getSensor('last_measurement_timestamp');
    const expirationState = this._getSensor('expiration_timestamp');

    const trendArrow = trendArrowState ? trendArrowState.state : '';
    const delta1 = delta1State ? delta1State.state : '0';
    const delta5 = delta5State ? delta5State.state : '0';
    const delta15 = delta15State ? delta15State.state : '0';
    const trendText = trendState ? trendState.state : '';
    const timestampRaw = timestampState ? timestampState.state : '';
    const expirationRaw = expirationState ? expirationState.state : '';

    const timestampDisplay = this._formatTimestamp(timestampRaw);
    const timestampColor = this._getTimestampColor(timestampRaw);

    const isExpired = this._isExpired(expirationRaw);
    const t = this._getTranslations();
    const expirationDisplay = isExpired 
      ? t.expired 
      : this._formatTimeRemaining(expirationRaw);

    // Get delta based on configuration
    const deltaType = this._config.delta_type || 5;
    let mainDelta = '0';
    let mainDeltaColor = '#4CAF50';
    
    if (deltaType === 1) {
      mainDelta = delta1;
      mainDeltaColor = this._getDeltaColor(parseFloat(delta1));
    } else if (deltaType === 15) {
      mainDelta = delta15;
      mainDeltaColor = this._getDeltaColor(parseFloat(delta15));
    } else {
      mainDelta = delta5;
      mainDeltaColor = this._getDeltaColor(parseFloat(delta5));
    }

    // Build info sections
    let sections = [];

    // Trend arrow (show if enabled)
    if (this._config.show_trend_arrow !== false && trendArrow) {
      sections.push(`<span style="font-size: 28px;">${trendArrow}</span>`);
    }

    // Trend text (show if enabled)
    if (this._config.show_trend_text !== false && trendText) {
      sections.push(`<span style="font-size: 16px; margin-left: ${sections.length > 0 ? '4px' : '0'}; color: #888;">${trendText}</span>`);
    }

    // Main delta (show if enabled)
    if (this._config.show_delta !== false) {
      const marginLeft = sections.length > 0 ? '12px' : '0';
      sections.push(`
        <span style="font-size: 24px; margin-left: ${marginLeft}; color: ${mainDeltaColor};">
          Δ ${mainDelta}
        </span>
      `);
    }

    // Secondary deltas (if configured)
    let secondaryDeltas = [];
    if (this._config.show_delta_1min && delta1State) {
      const color = this._getDeltaColor(parseFloat(delta1));
      secondaryDeltas.push(`<span style="color: ${color};">1m: Δ${delta1}</span>`);
    }
    if (this._config.show_delta_5min && delta5State) {
      const color = this._getDeltaColor(parseFloat(delta5));
      secondaryDeltas.push(`<span style="color: ${color};">5m: Δ${delta5}</span>`);
    }
    if (this._config.show_delta_15min && delta15State) {
      const color = this._getDeltaColor(parseFloat(delta15));
      secondaryDeltas.push(`<span style="color: ${color};">15m: Δ${delta15}</span>`);
    }

    // Build the info HTML
    let infoHTML = '<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">';

    // Row 1: Trend and main delta
    if (sections.length > 0) {
      infoHTML += `<div>${sections.join('')}</div>`;
    }

    // Row 1b: Secondary deltas (if any)
    if (secondaryDeltas.length > 0) {
      infoHTML += `
        <div style="font-size: 14px; font-weight: normal; color: #888; margin-top: 2px;">
          ${secondaryDeltas.join('  ')}
        </div>
      `;
    }

    // Row 2: Timestamp (if enabled)
    if (this._config.show_timestamp !== false) {
      infoHTML += `
        <div style="font-size: 14px; font-weight: normal; color: ${timestampColor}; margin-top: 4px;">
          ${timestampDisplay}
        </div>
      `;
    }

    // Row 3: Expiration (if enabled)
    if (this._config.show_expiration !== false && expirationRaw) {
      const expColor = isExpired ? '#FF5252' : '#888';
      infoHTML += `
        <div style="font-size: 12px; font-weight: normal; color: ${expColor}; margin-top: 2px;">
          ${expirationDisplay}
        </div>
      `;
    }

    infoHTML += '</div>';
    this._infoContainer.innerHTML = infoHTML;
  }
}

// Register the custom element
if (!customElements.get('librelink-extended-gauge')) {
  customElements.define('librelink-extended-gauge', LibrelinkExtendedGauge);
}
