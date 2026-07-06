/**
 * Librelink Extended Card for Home Assistant
 * 
 * This card displays glucose data with trend arrow, delta, and timestamp.
 * 
 * Installation:
 * 1. Save this file to /config/www/librelink-extended-card.js
 * 2. Add as resource: Settings → Dashboards → Resources → /local/librelink-extended-card.js
 * 3. Clear browser cache
 * 
 * Usage:
 * type: custom:librelink-extended-card
 * entity: sensor.your_name_measurement
 * language: en (or sk)
 * show_measurement: true (optional, defaults to true) 
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

class LibrelinkExtendedCard extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._config = null;
    this._sensorBase = null;
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this._config = {
      language: 'en',
      show_measurement: true,
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
    
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _getLanguage() {
    return this._config.language || 'en';
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
        less_than_hour: 'Less than 1 hour',
        one_hour: '1 hour',
        one_day: '1 day',
        time_units: {
          hours: 'hours',
          days: 'days'
        }
      },
      sk: {
        just_now: 'Pred chvíľou',
        min_ago: (n) => n === 1 ? 'Pred 1 minútou' : `Pred ${n} minútami`,
        hour_ago: (n) => n === 1 ? 'Pred 1 hodinou' : `Pred ${n} hodinami`,
        day_ago: (n) => n === 1 ? 'Pred 1 dňom' : `Pred ${n} dňami`,
        expired: 'EXPIROVAL',
        expires: 'Exspiruje o',
        less_than_hour: 'Menej ako 1 hodinu',
        one_hour: '1 hodinu',
        one_day: '1 deň',
        time_units: {
          hours: 'hodín',
          days: 'dní'
        }
      }
    };
    return translations[lang] || translations.sk;
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
      
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      let timeStr = '';
      if (diffDays >= 1) {
        timeStr = diffDays === 1 ? t.one_day : `${diffDays} ${t.time_units.days}`;
      } else if (diffHours >= 1) {
        timeStr = diffHours === 1 ? t.one_hour : `${diffHours} ${t.time_units.hours}`;
      } else {
        timeStr = t.less_than_hour;
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

  _getGlucoseColor(value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '#4CAF50';
    if (numValue < 4.05) return '#FF0000';
    if (numValue >= 10) return '#FFC107';
    return '#4CAF50';
  }

  _render() {
    if (!this._hass || !this._config) return;

    const glucoseState = this._hass.states[this._config.entity];
    if (!glucoseState) {
      this.innerHTML = `<ha-card>Entity not found: ${this._config.entity}</ha-card>`;
      return;
    }

    const glucoseValue = glucoseState.state;
    const glucoseColor = this._getGlucoseColor(glucoseValue);

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
    let infoLines = [];

    // Row 1: Glucose value (if enabled)
    if (this._config.show_measurement !== false) {
      infoLines.push(`
        <div style="font-size: 64px; font-weight: bold; color: ${glucoseColor}; line-height: 1.2;">
          ${parseFloat(glucoseValue).toFixed(1)}
          <span style="font-size: 24px; font-weight: normal; color: #999; margin-left: 4px;">mmol/L</span>
        </div>
      `);
    }

    // Row 2: Trend arrow, trend text, and main delta
    let row2Parts = [];
    
    if (this._config.show_trend_arrow !== false && trendArrow) {
      row2Parts.push(`<span style="font-size: 32px;">${trendArrow}</span>`);
    }
    
    if (this._config.show_trend_text !== false && trendText) {
      row2Parts.push(`<span style="font-size: 18px; color: #888;">${trendText}</span>`);
    }
    
    if (this._config.show_delta !== false) {
      row2Parts.push(`<span style="font-size: 24px; color: ${mainDeltaColor};">Δ ${mainDelta}</span>`);
    }
    
    if (row2Parts.length > 0) {
      infoLines.push(`
        <div style="font-size: 24px; font-weight: bold; color: white; margin-top: ${this._config.show_measurement !== false ? '4px' : '0'};">
          ${row2Parts.join('  ')}
        </div>
      `);
    }

    // Row 2b: Secondary deltas (if configured)
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
    
    if (secondaryDeltas.length > 0) {
      infoLines.push(`
        <div style="font-size: 14px; font-weight: normal; color: #888; margin-top: 2px;">
          ${secondaryDeltas.join('  ')}
        </div>
      `);
    }

    // Row 3: Timestamp (if enabled)
    if (this._config.show_timestamp !== false) {
      infoLines.push(`
        <div style="font-size: 16px; font-weight: normal; color: ${timestampColor}; margin-top: 8px;">
          ${timestampDisplay}
        </div>
      `);
    }

    // Row 4: Expiration (if enabled)
    if (this._config.show_expiration !== false && expirationRaw) {
      const expColor = isExpired ? '#FF5252' : '#888';
      infoLines.push(`
        <div style="font-size: 14px; font-weight: normal; color: ${expColor}; margin-top: 2px;">
          ${expirationDisplay}
        </div>
      `);
    }

    // Build the card
    this.innerHTML = `
      <ha-card style="
        padding: 1px 6px 3px 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--ha-card-background);
        border-radius: var(--ha-card-border-radius);
        box-shadow: var(--ha-card-box-shadow);
        border: none;
        min-height: ${this._config.show_measurement !== false ? '130px' : '80px'};
      ">
        ${infoLines.join('')}
      </ha-card>
    `;
  }
}

// Register the custom element
if (!customElements.get('librelink-extended-card')) {
  customElements.define('librelink-extended-card', LibrelinkExtendedCard);
}
