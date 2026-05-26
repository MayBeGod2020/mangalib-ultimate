// Хранилище настроек через chrome.storage.sync
window.MULib = window.MULib || {};

(function(MU) {
    'use strict';

    MU.DEFAULT_SETTINGS = {
        moderation: {
            enabled:          true,
            autoFillPopup:    true,
            autoFillPageInfo: false, // вставлять тайтл/главу/страницу (сайт сам их показывает)
            colorizeCards:    true,
            cheatsheet:       true,
            autoScrollToNext: true,
            autoCheckBan:     false,
        },
        dashboard: {
            enabled:        true,
            updateInterval: 30,
        },
        reader: {
            enabled:     true,
            scrollSpeed: 'medium',
        },
        personalization: {
            enabled:          false,
            theme:            'default',
            borderRadius:     'normal',  // sharp | normal | round
            customWallpaper:  '',
            wallpaperOpacity: 0.3,
            accentColor:      '',
            ranobeFontFamily: '',
            ranobeFontSize:   16,
            ranobeLineHeight: 1.6,
        },
        ai: {
            enabled:         false,
            provider:        'deepseek',
            apiKey:          '',
            deepseekKey:     '', // устарело — для миграции старых пользователей
            groqKey:         '',
            customApiUrl:    '', // кастомный OpenAI-совместимый endpoint
            customModel:     '', // модель для кастомного провайдера
            showScanButton:  false,
            forumRules:      '',
            webhookUrl:      '', // Discord/Telegram/ntfy webhook для уведомлений
        }
    };

    let cachedSettings = null;

    MU.getSettings = async function() {
        if (cachedSettings) return cachedSettings;
        return new Promise(resolve => {
            chrome.storage.sync.get('settings', result => {
                const stored = result.settings || {};
                cachedSettings = {
                    moderation:      { ...MU.DEFAULT_SETTINGS.moderation,      ...(stored.moderation      || {}) },
                    dashboard:       { ...MU.DEFAULT_SETTINGS.dashboard,       ...(stored.dashboard       || {}) },
                    reader:          { ...MU.DEFAULT_SETTINGS.reader,          ...(stored.reader          || {}) },
                    personalization: { ...MU.DEFAULT_SETTINGS.personalization, ...(stored.personalization || {}) },
                    ai:              { ...MU.DEFAULT_SETTINGS.ai,              ...(stored.ai              || {}) },
                };
                resolve(cachedSettings);
            });
        });
    };

    MU.setSettings = async function(newSettings) {
        cachedSettings = newSettings;
        return new Promise(resolve => {
            chrome.storage.sync.set({ settings: newSettings }, () => {
                MU.emit('settingsChanged', newSettings);
                resolve();
            });
        });
    };

    MU.updateSetting = async function(section, key, value) {
        const settings = await MU.getSettings();
        if (!settings[section]) settings[section] = {};
        settings[section][key] = value;
        await MU.setSettings(settings);
        return settings;
    };

    MU.resetSettings = async function() {
        cachedSettings = null;
        await MU.setSettings(JSON.parse(JSON.stringify(MU.DEFAULT_SETTINGS)));
    };

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.settings) {
            const stored = changes.settings.newValue || {};
            cachedSettings = {
                moderation:      { ...MU.DEFAULT_SETTINGS.moderation,      ...(stored.moderation      || {}) },
                dashboard:       { ...MU.DEFAULT_SETTINGS.dashboard,       ...(stored.dashboard       || {}) },
                reader:          { ...MU.DEFAULT_SETTINGS.reader,          ...(stored.reader          || {}) },
                personalization: { ...MU.DEFAULT_SETTINGS.personalization, ...(stored.personalization || {}) },
                ai:              { ...MU.DEFAULT_SETTINGS.ai,              ...(stored.ai              || {}) },
            };
            MU.emit('settingsChanged', cachedSettings);
        }
    });

})(window.MULib);
