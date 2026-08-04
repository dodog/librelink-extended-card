/**
 * Librelink Extended Card for Home Assistant
 * https://github.com/dodog/librelink-extended-card
 * 
 * This card displays glucose data with trend arrow, delta, and timestamp.
 * 
 * Install via HACS or 
 * Manual Installation:
 * 1. Save this file to /config/www/librelink-extended-card.js
 * 2. Add as resource: Settings → Dashboards → Resources → /local/librelink-extended-card.js
 * 3. Clear browser cache
 *
 * You can configure this card either through the visual editor (Edit
 * Dashboard → Add Card → "Librelink Extended Card", or Edit on an existing
 * card) or by hand in YAML using the options below.
 * 
 * Usage:
 * type: custom:librelink-extended-card
 * entity: sensor.your_name_measurement
 * language: en (or sk, de, fr, es) - optional. If omitted, the card follows
 *   Home Assistant's own UI language and number format automatically
 *   (Settings → General → Language). Set this only to override HA's setting.
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
 * unit: mmol/L (optional. Auto-detected from the entity's unit_of_measurement
 *   if omitted, so mg/dL sensors work automatically. Set this to override it,
 *   e.g. unit: mg/dL)
 * decimals: 1 (optional. Auto-detected from the entity's "Display precision"
 *   setting (Settings → Devices & Services → Entities → your sensor) if
 *   omitted, falling back to 1 for mmol/L / 0 for mg/dL. Set this to force a
 *   specific number of decimal places regardless of that setting)
 * tap_action: { action: more-info } (optional, standard HA action config:
 *   more-info, navigate, url, call-service, toggle, or none)
 * hold_action: { action: none } (optional, same options as tap_action)
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
      tap_action: { action: 'more-info' },
      hold_action: { action: 'none' },
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

  // UI text language: uses the explicit `language:` config option if set,
  // otherwise follows Home Assistant's own UI language. Falls back to 'en'
  // if HA's language isn't one we have translations for.
  _getLanguage() {
    if (this._config.language) return this._config.language;

    const hassLanguage =
      (this._hass && this._hass.locale && this._hass.locale.language) ||
      (this._hass && this._hass.language) ||
      'en';

    const supported = ['en', 'sk', 'de', 'fr', 'es'];
    const base = hassLanguage.split('-')[0].toLowerCase();
    return supported.includes(base) ? base : 'en';
  }

  // Decimal/thousands formatting: follows Home Assistant's "Number Format"
  // setting (Settings → General → Language, or per-user profile).
  _getNumberFormatOptions() {
    const locale = this._hass && this._hass.locale;
    const languageLocale =
      (locale && locale.language) ||
      (this._hass && this._hass.language) ||
      this._getLanguage();

    const numberFormat = locale && locale.number_format;

    switch (numberFormat) {
      case 'comma_decimal': // 1,234.56
        return { locale: 'en-US' };
      case 'decimal_comma': // 1.234,56
        return { locale: 'de-DE' };
      case 'space_comma': // 1 234,56
        return { locale: 'fr-FR' };
      case 'none': // 1234.56 - no grouping
        return { locale: 'en-US', useGrouping: false };
      case 'language':
      case 'system':
      default:
        // Let the browser/HA-selected language decide (this is what gives
        // Slovak "6,1" vs English "6.1" automatically).
        return { locale: languageLocale };
    }
  }

  // Formats a number the way Home Assistant does
  _formatNumber(value, { decimals = 1, showSign = false } = {}) {
    const num = parseFloat(value);
    if (isNaN(num)) return value;

    const { locale, useGrouping } = this._getNumberFormatOptions();
    const options = {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    };
    if (useGrouping !== undefined) options.useGrouping = useGrouping;

    let formatted;
    try {
      formatted = num.toLocaleString(locale, options);
    } catch (e) {
      // Unknown/invalid locale string - fall back to a safe default
      formatted = num.toLocaleString('en-US', options);
    }
    return (showSign && num > 0) ? `+${formatted}` : formatted;
  }

  // Which unit to display/interpret values as. Defaults to whatever the
  // glucose sensor itself reports (unit_of_measurement attribute) so mg/dL
  // setups work automatically; `unit:` in config can force it either way.
  _getUnit(glucoseState) {
    if (this._config.unit) return this._config.unit;
    return (glucoseState && glucoseState.attributes && glucoseState.attributes.unit_of_measurement) || 'mmol/L';
  }

  _isMgDl(unit) {
    return /mg\s*\/\s*dl/i.test(unit || '');
  }

  // Converts a value/delta to its mmol/L equivalent purely for internal
  // threshold comparisons (color coding), regardless of the unit it's
  // actually displayed in. This is a straight linear conversion (no offset),
  // so it's valid for deltas as well as absolute values.
  _normalizeToMmol(value, unit) {
    return this._isMgDl(unit) ? value / 18.0182 : value;
  }

  // Fallback decimal count, used only when hass.formatEntityState() isn't
  // available (older HA) or fails. A sensible default based on the unit
  // (mg/dL is usually whole numbers, mmol/L usually has 1 decimal).
  _getDecimals(unit) {
    if (this._config.decimals !== undefined && this._config.decimals !== null) return this._config.decimals;
    return this._isMgDl(unit) ? 0 : 1;
  }

  // Figures out which characters the current locale uses for the decimal
  // point and thousands grouping, so we can reliably strip the trailing
  // unit text off whatever hass.formatEntityState() returns, without
  // assuming "." or "," specifically (some locales use neither).
  _getNumberSeparators(locale) {
    try {
      const parts = new Intl.NumberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(1234.5);
      let decimal = '.';
      let group = ',';
      for (const part of parts) {
        if (part.type === 'decimal') decimal = part.value;
        if (part.type === 'group') group = part.value;
      }
      return { decimal, group };
    } catch (e) {
      return { decimal: '.', group: ',' };
    }
  }

  _extractNumericPrefix(formatted, locale) {
    const { decimal, group } = this._getNumberSeparators(locale);
    const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^[+\\-−]?[\\d${esc(group)}\\s]*(?:${esc(decimal)}\\d+)?`);
    const match = formatted.match(pattern);
    return match ? match[0].trim() : formatted.trim();
  }

  // Formats a value the same way Home Assistant's own built-in cards do,
  // by delegating to hass.formatEntityState() when available - this is the
  // only reliable way to get the exact per-entity "Display precision" a
  // user configured, since that data isn't otherwise exposed to custom
  // cards. Falls back to manual formatting (unit-based decimal guess) if
  // formatEntityState isn't available or the entity doesn't exist.
  _formatEntityValue(stateObj, rawValue, { showSign = false } = {}) {
    const value = stateObj ? stateObj.state : rawValue;
    const unit = this._getUnit(this._hass.states[this._config.entity]);

    // Explicit override always wins, regardless of HA's own setting
    if (this._config.decimals !== undefined && this._config.decimals !== null) {
      return this._formatNumber(value, { decimals: this._config.decimals, showSign });
    }

    if (stateObj && this._hass && typeof this._hass.formatEntityState === 'function') {
      try {
        const full = this._hass.formatEntityState(stateObj);
        const { locale } = this._getNumberFormatOptions();
        let numeric = this._extractNumericPrefix(full, locale);
        const rawNum = parseFloat(value);
        if (numeric && showSign && !isNaN(rawNum) && rawNum > 0 && !numeric.startsWith('+')) {
          numeric = `+${numeric}`;
        }
        if (numeric) return numeric;
      } catch (e) {
        // fall through to manual formatting
      }
    }

    return this._formatNumber(value, { decimals: this._getDecimals(unit), showSign });
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
        sensor_expired: 'Sensor Expired',
        no_data: 'No Data',
        entity_unavailable: 'Sensor Unavailable',
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
        less_than_hour: 'menej ako 1 hodinu',
        one_hour: '1 hodinu',
        one_day: '1 deň',
        sensor_expired: 'Senzor vypršal',
        no_data: 'Žiadne dáta',
        entity_unavailable: 'Senzor nedostupný',
        time_units: {
          hours: 'hodín',
          days: 'dní'
        }
      },
      de: {
        just_now: 'Gerade jetzt',
        min_ago: (n) => n === 1 ? '1 min ago' : `vor ${n} min`,
        hour_ago: (n) => n === 1 ? 'vor 1 Stunde' : `vor ${n} Stunden`,
        day_ago: (n) => n === 1 ? 'vor 1 Tag' : `vor ${n} Tagen`,
        expired: 'ABGELAUFEN',
        expires: 'Läuft ab in',
        less_than_hour: 'Weniger als 1 Stunde',
        one_hour: '1 Stunde',
        one_day: '1 Tag',
        sensor_expired: 'Sensor abgelaufen',
        no_data: 'Keine Daten',
        entity_unavailable: 'Sensor nicht verfügbar',
        time_units: {
          hours: 'Stunden',
          days: 'Tage'
        }
      },
      fr: {
        just_now: 'À l\'instant',
        min_ago: (n) => n === 1 ? 'il y a 1 min' : `il y a ${n} min`,
        hour_ago: (n) => n === 1 ? 'il y a 1 heure' : `il y a ${n} heures`,
        day_ago: (n) => n === 1 ? 'il y a 1 jour' : `il y a ${n} jours`,
        expired: 'EXPIRÉ',
        expires: 'Expire dans',
        less_than_hour: 'Moins d\'1 heure',
        one_hour: '1 heure',
        one_day: '1 jour',
        sensor_expired: 'Capteur expiré',
        no_data: 'Pas de données',
        entity_unavailable: 'Capteur indisponible',
        time_units: {
          hours: 'heures',
          days: 'jours'
        }
      },
      es: {
        just_now: 'Ahora mismo',
        min_ago: (n) => n === 1 ? 'hace 1 min' : `hace ${n} min`,
        hour_ago: (n) => n === 1 ? 'hace 1 hora' : `hace ${n} horas`,
        day_ago: (n) => n === 1 ? 'hace 1 día' : `hace ${n} días`,
        expired: 'CADUCADO',
        expires: 'Caduca en',
        less_than_hour: 'Menos de 1 hora',
        one_hour: '1 hora',
        one_day: '1 día',
        sensor_expired: 'Sensor caducado',
        no_data: 'Sin datos',
        entity_unavailable: 'Sensor no disponible',
        time_units: {
          hours: 'horas',
          days: 'días'
        }
      }
    };
    return translations[lang] || translations.en;
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
    if (!timestamp) return 'var(--secondary-text-color, #888)';
    
    try {
      const utcDate = new Date(timestamp);
      if (isNaN(utcDate.getTime())) return 'var(--secondary-text-color, #888)';
      
      const now = new Date();
      const diffMs = now - utcDate;
      const diffMinutes = Math.floor(diffMs / 60000);
      
      if (diffMinutes > 10) return 'var(--error-color, #FF5252)';
      if (diffMinutes > 5) return 'var(--warning-color, #FFC107)';
      return 'var(--success-color, #4CAF50)';
    } catch (e) {
      return 'var(--secondary-text-color, #888)';
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

  _getDeltaColor(deltaValue, unit) {
    if (isNaN(deltaValue)) return 'var(--secondary-text-color, #aaa)';
    const mmolDelta = this._normalizeToMmol(deltaValue, unit);
    if (mmolDelta > 1) return 'var(--error-color, #FF5252)';
    if (mmolDelta < -1) return 'var(--error-color, #FF5252)';
    if (mmolDelta > 0.3) return 'var(--warning-color, #FFC107)';
    if (mmolDelta < -0.3) return 'var(--warning-color, #FFC107)';
    return 'var(--success-color, #4CAF50)';
  }

  _getGlucoseColor(value, unit) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 'var(--secondary-text-color, #888)';
    const mmolValue = this._normalizeToMmol(numValue, unit);
    if (mmolValue < 3.9) return 'var(--error-color, #FF0000)';
    if (mmolValue >= 10) return 'var(--warning-color, #FFC107)';
    return 'var(--success-color, #4CAF50)';
  }

  /**
   * Get user-friendly error message based on sensor state
   */
  _getErrorMessage(glucoseState, expirationState, timestampState) {
    const t = this._getTranslations();
    
    // Check if sensor is expired
    if (expirationState) {
      const isExpired = this._isExpired(expirationState.state);
      if (isExpired) {
        return t.sensor_expired;
      }
    }
    
    // Check if entity is unavailable
    if (!glucoseState || glucoseState.state === 'unavailable') {
      return t.entity_unavailable;
    }
    
    // Check if there's no data (state is 'unknown' or empty)
    if (!glucoseState || glucoseState.state === 'unknown' || glucoseState.state === '') {
      return t.no_data;
    }
    
    // Check if timestamp is too old (more than 30 minutes)
    if (timestampState) {
      try {
        const tsDate = new Date(timestampState.state);
        if (!isNaN(tsDate.getTime())) {
          const diffMs = Date.now() - tsDate;
          if (diffMs > 1800000) { // 30 minutes
            return t.no_data;
          }
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return null; // No error, normal state
  }

  // --- Tap / hold action handling -----------------------------------------

  _attachActionListeners(cardEl) {
    if (!cardEl) return;

    const tapAction = this._config.tap_action || { action: 'more-info' };
    const holdAction = this._config.hold_action || { action: 'none' };

    if (tapAction.action !== 'none' || holdAction.action !== 'none') {
      cardEl.style.cursor = 'pointer';
    }

    let holdTimeout = null;
    let holdFired = false;

    const clearHold = () => {
      if (holdTimeout) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }
    };

    cardEl.addEventListener('pointerdown', () => {
      holdFired = false;
      clearHold();
      holdTimeout = setTimeout(() => {
        holdFired = true;
        this._handleAction(holdAction);
      }, 500);
    });

    cardEl.addEventListener('pointerup', () => {
      clearHold();
      if (!holdFired) {
        this._handleAction(tapAction);
      }
    });

    cardEl.addEventListener('pointerleave', clearHold);
    cardEl.addEventListener('pointercancel', clearHold);

    // Long-press on touch devices would otherwise also open a context menu
    if (holdAction.action !== 'none') {
      cardEl.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  _handleAction(actionConfig) {
    if (!actionConfig || actionConfig.action === 'none') return;
    const entityId = actionConfig.entity || this._config.entity;

    switch (actionConfig.action) {
      case 'more-info':
        this.dispatchEvent(new CustomEvent('hass-more-info', {
          bubbles: true,
          composed: true,
          detail: { entityId }
        }));
        break;

      case 'navigate':
        if (actionConfig.navigation_path) {
          history.pushState(null, '', actionConfig.navigation_path);
          this.dispatchEvent(new CustomEvent('location-changed', {
            bubbles: true,
            composed: true,
            detail: { replace: !!actionConfig.navigation_replace }
          }));
        }
        break;

      case 'url':
        if (actionConfig.url_path) {
          window.open(actionConfig.url_path, actionConfig.new_tab === false ? '_self' : '_blank');
        }
        break;

      case 'call-service':
      case 'perform-action': {
        const serviceStr = actionConfig.service || actionConfig.perform_action || '';
        const [domain, service] = serviceStr.split('.');
        if (domain && service && this._hass) {
          this._hass.callService(domain, service, actionConfig.service_data || actionConfig.data || {}, actionConfig.target);
        }
        break;
      }

      case 'toggle':
        if (this._hass && entityId) {
          this._hass.callService('homeassistant', 'toggle', { entity_id: entityId });
        }
        break;

      default:
        break;
    }
  }

  _render() {
    if (!this._hass || !this._config) return;

    const glucoseState = this._hass.states[this._config.entity];
    const timestampState = this._getSensor('last_measurement_timestamp');
    const expirationState = this._getSensor('expiration_timestamp');

    const unit = this._getUnit(glucoseState);

    // Check for errors
    const errorMessage = this._getErrorMessage(glucoseState, expirationState, timestampState);
    if (errorMessage) {
      this.innerHTML = `
        <ha-card style="
          padding: 8px 16px 8px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--ha-card-background);
          border-radius: var(--ha-card-border-radius);
          box-shadow: var(--ha-card-box-shadow);
          border: none;
          min-height: 80px;
        ">
          <div style="
            font-size: 24px;
            font-weight: bold;
            color: var(--error-color, #FF5252);
            text-align: center;
          ">
            ${errorMessage}
          </div>
        </ha-card>
      `;
      this._attachActionListeners(this.querySelector('ha-card'));
      return;
    }

    // Normal rendering continues...
    const glucoseValue = glucoseState.state;
    const glucoseColor = this._getGlucoseColor(glucoseValue, unit);
    const t = this._getTranslations();

    // Get all sensor data
    const trendArrowState = this._getSensor('glucose_trend_arrow') || this._getSensor('trend_arrow');
    const delta1State = this._getSensor('delta_1min');
    const delta5State = this._getSensor('delta_5min');
    const delta15State = this._getSensor('delta_15min');
    const trendState = this._getSensor('trend');

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
    const expirationDisplay = isExpired 
      ? t.expired 
      : this._formatTimeRemaining(expirationRaw);

    // Get delta based on configuration
    const deltaType = this._config.delta_type || 5;
    let mainDelta = '0';
    let mainDeltaState = null;
    let mainDeltaColor = 'var(--success-color, #4CAF50)';
    
    if (deltaType === 1) {
      mainDelta = delta1;
      mainDeltaState = delta1State;
      mainDeltaColor = this._getDeltaColor(parseFloat(delta1), unit);
    } else if (deltaType === 15) {
      mainDelta = delta15;
      mainDeltaState = delta15State;
      mainDeltaColor = this._getDeltaColor(parseFloat(delta15), unit);
    } else {
      mainDelta = delta5;
      mainDeltaState = delta5State;
      mainDeltaColor = this._getDeltaColor(parseFloat(delta5), unit);
    }

    // Build info sections
    let infoLines = [];

    // Row 1: Glucose value (if enabled)
    if (this._config.show_measurement !== false) {
      infoLines.push(`
        <div style="
          font-size: 64px;
          font-weight: bold;
          color: ${glucoseColor};
          line-height: 1.2;
          font-family: var(--primary-font-family, 'Open Sans', sans-serif);
        ">
          ${this._formatEntityValue(glucoseState, glucoseValue)}
          <span style="
            font-size: 24px;
            font-weight: normal;
            color: var(--secondary-text-color, #999);
            margin-left: 4px;
          ">${unit}</span>
        </div>
      `);
    }

    // Row 2: Trend arrow, trend text, and main delta
    let row2Parts = [];
    
    if (this._config.show_trend_arrow !== false && trendArrow) {
      row2Parts.push(`<span style="font-size: 32px; color: var(--primary-text-color, white);">${trendArrow}</span>`);
    }
    
    if (this._config.show_trend_text !== false && trendText) {
      row2Parts.push(`<span style="font-size: 18px; color: var(--secondary-text-color, #888);">${trendText}</span>`);
    }
    
    if (this._config.show_delta !== false) {
      row2Parts.push(`<span style="font-size: 24px; color: ${mainDeltaColor};">Δ ${this._formatEntityValue(mainDeltaState, mainDelta, { showSign: true })}</span>`);
    }
    
    if (row2Parts.length > 0) {
      infoLines.push(`
        <div style="
          font-size: 24px;
          font-weight: bold;
          color: var(--primary-text-color, white);
          margin-top: ${this._config.show_measurement !== false ? '4px' : '0'};
        ">
          ${row2Parts.join('  ')}
        </div>
      `);
    }

    // Row 2b: Secondary deltas (if configured)
    let secondaryDeltas = [];
    if (this._config.show_delta_1min && delta1State) {
      const color = this._getDeltaColor(parseFloat(delta1), unit);
      secondaryDeltas.push(`<span style="color: ${color};">1m: Δ${this._formatEntityValue(delta1State, delta1, { showSign: true })}</span>`);
    }
    if (this._config.show_delta_5min && delta5State) {
      const color = this._getDeltaColor(parseFloat(delta5), unit);
      secondaryDeltas.push(`<span style="color: ${color};">5m: Δ${this._formatEntityValue(delta5State, delta5, { showSign: true })}</span>`);
    }
    if (this._config.show_delta_15min && delta15State) {
      const color = this._getDeltaColor(parseFloat(delta15), unit);
      secondaryDeltas.push(`<span style="color: ${color};">15m: Δ${this._formatEntityValue(delta15State, delta15, { showSign: true })}</span>`);
    }
    
    if (secondaryDeltas.length > 0) {
      infoLines.push(`
        <div style="
          font-size: 14px;
          font-weight: normal;
          color: var(--secondary-text-color, #888);
          margin-top: 2px;
        ">
          ${secondaryDeltas.join('  ')}
        </div>
      `);
    }

    // Row 3: Timestamp (if enabled)
    if (this._config.show_timestamp !== false) {
      infoLines.push(`
        <div style="
          font-size: 16px;
          font-weight: normal;
          color: ${timestampColor};
          margin-top: 8px;
        ">
          ${timestampDisplay}
        </div>
      `);
    }

    // Row 4: Expiration (if enabled)
    if (this._config.show_expiration !== false && expirationRaw) {
      const expColor = isExpired ? 'var(--error-color, #FF5252)' : 'var(--secondary-text-color, #888)';
      infoLines.push(`
        <div style="
          font-size: 14px;
          font-weight: normal;
          color: ${expColor};
          margin-top: 2px;
        ">
          ${expirationDisplay}
        </div>
      `);
    }

    // Build the card with theme variables
    this.innerHTML = `
      <ha-card style="
        padding: 8px 16px 8px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--ha-card-background, #1a1a1a);
        border-radius: var(--ha-card-border-radius, 12px);
        box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,0.3));
        border: 1px solid var(--ha-card-border-color, rgba(255,255,255,0.05));
        min-height: ${this._config.show_measurement !== false ? '130px' : '80px'};
      ">
        ${infoLines.join('')}
      </ha-card>
    `;
    this._attachActionListeners(this.querySelector('ha-card'));
  }

  static getConfigElement() {
    return document.createElement('librelink-extended-card-editor');
  }

  static getStubConfig() {
    return {
      entity: '',
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
      tap_action: { action: 'more-info' },
      hold_action: { action: 'none' }
    };
  }
}

// Register the custom element
if (!customElements.get('librelink-extended-card')) {
  customElements.define('librelink-extended-card', LibrelinkExtendedCard);
}


// Visual editor for the card.
class LibrelinkExtendedCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._renderForm();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) {
      this._form.hass = hass;
    } else {
      this._renderForm();
    }
  }

  get _schema() {
    return [
      { name: 'entity', required: true, selector: { entity: { domain: 'sensor' } } },
      {
        name: 'unit',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: '', label: 'Auto (from sensor)' },
              { value: 'mmol/L', label: 'mmol/L' },
              { value: 'mg/dL', label: 'mg/dL' }
            ]
          }
        }
      },
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: '', label: 'Auto (match Home Assistant)' },
              { value: 'en', label: 'English' },
              { value: 'sk', label: 'Slovenčina' },
              { value: 'de', label: 'Deutsch' },
              { value: 'fr', label: 'Français' },
              { value: 'es', label: 'Español' }
            ]
          }
        }
      },
      { name: 'decimals', selector: { number: { min: 0, max: 3, mode: 'box' } } },
      {
        name: 'delta_type',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: '1', label: '1 minute' },
              { value: '5', label: '5 minutes' },
              { value: '15', label: '15 minutes' }
            ]
          }
        }
      },
      { name: 'show_measurement', selector: { boolean: {} } },
      { name: 'show_trend_arrow', selector: { boolean: {} } },
      { name: 'show_trend_text', selector: { boolean: {} } },
      { name: 'show_delta', selector: { boolean: {} } },
      { name: 'show_timestamp', selector: { boolean: {} } },
      { name: 'show_expiration', selector: { boolean: {} } },
      { name: 'show_delta_1min', selector: { boolean: {} } },
      { name: 'show_delta_5min', selector: { boolean: {} } },
      { name: 'show_delta_15min', selector: { boolean: {} } },
      { name: 'tap_action', selector: { ui_action: {} } },
      { name: 'hold_action', selector: { ui_action: {} } }
    ];
  }

  _computeLabel(schema) {
    const labels = {
      entity: 'Glucose entity',
      unit: 'Unit',
      language: 'Language',
      decimals: 'Decimal places (override)',
      delta_type: 'Main delta window',
      show_measurement: 'Show measurement',
      show_trend_arrow: 'Show trend arrow',
      show_trend_text: 'Show trend text',
      show_delta: 'Show main delta',
      show_timestamp: 'Show timestamp',
      show_expiration: 'Show sensor expiration',
      show_delta_1min: 'Show 1 min delta',
      show_delta_5min: 'Show 5 min delta',
      show_delta_15min: 'Show 15 min delta',
      tap_action: 'Tap action',
      hold_action: 'Hold action'
    };
    return labels[schema.name] || schema.name;
  }

  _computeHelper(schema) {
    if (schema.name === 'decimals') {
      return "Leave blank to follow the entity's own Display Precision setting";
    }
    return undefined;
  }

  _renderForm() {
    if (!this._hass || !this._config) return;

    this.innerHTML = '';
    const form = document.createElement('ha-form');
    form.hass = this._hass;

    // ha-form expects real values for the fields it renders; map our
    // "unset means auto" config (undefined/missing) to '' for the select
    // fields, and delta_type to a string since the select options are strings.
    form.data = {
      ...this._config,
      unit: this._config.unit || '',
      language: this._config.language || '',
      delta_type: String(this._config.delta_type || 5)
    };

    form.schema = this._schema;
    form.computeLabel = this._computeLabel.bind(this);
    form.computeHelper = this._computeHelper.bind(this);

    form.addEventListener('value-changed', (ev) => {
      ev.stopPropagation();
      const newConfig = { ...ev.detail.value };

      // Convert the string-backed select back to a number
      newConfig.delta_type = parseInt(newConfig.delta_type, 10) || 5;

      // '' means "auto" - drop the key entirely so the card's own
      // auto-detection logic takes over instead of storing an empty string
      if (newConfig.unit === '') delete newConfig.unit;
      if (newConfig.language === '') delete newConfig.language;
      if (newConfig.decimals === null || newConfig.decimals === undefined || newConfig.decimals === '') {
        delete newConfig.decimals;
      }

      this._config = newConfig;
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: newConfig },
        bubbles: true,
        composed: true
      }));
    });

    this.appendChild(form);
    this._form = form;
  }
}

if (!customElements.get('librelink-extended-card-editor')) {
  customElements.define('librelink-extended-card-editor', LibrelinkExtendedCardEditor);
}

// Registers the card with HA Add Card picker
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === 'librelink-extended-card')) {
  window.customCards.push({
    type: 'librelink-extended-card',
    name: 'Librelink Extended Card',
    description: 'Glucose reading with trend arrow, delta, timestamp, and sensor expiration.'
  });
}
