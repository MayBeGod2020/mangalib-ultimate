// Общие функции и константы для всех модулей расширения
window.MULib = window.MULib || {};

(function(MU) {
    'use strict';

    MU.SITE_CONFIG = {
        'mangalib.me':     { endpoint: 'manga', siteId: '1', name: 'MangaLib' },
        'v2.shlib.life':   { endpoint: 'manga', siteId: '2', name: 'ShLib' },
        'ranobelib.me':    { endpoint: 'manga', siteId: '3', name: 'RanobeLib' },
        'hentailib.me':    { endpoint: 'manga', siteId: '4', name: 'HentaiLib' },
        'v5.animelib.org': { endpoint: 'anime', siteId: '5', name: 'AnimeLib' },
    };

    MU.FIREBASE_URL = 'https://mangalib-moderation-default-rtdb.europe-west1.firebasedatabase.app';

    MU.getCurrentSite = function() {
        return MU.SITE_CONFIG[location.hostname] || { endpoint: 'manga', siteId: '1', name: 'MangaLib' };
    };

    MU.getSiteName = function() {
        return MU.getCurrentSite().name;
    };

    MU.getAuthToken = function() {
        try {
            const auth = JSON.parse(localStorage.getItem('auth'));
            return auth?.token?.access_token || null;
        } catch (e) { return null; }
    };

    MU.getCurrentUserId = function() {
        try {
            const token = MU.getAuthToken();
            if (!token) return null;
            const payload = JSON.parse(atob(token.split('.')[1]));
            return String(payload.sub) || null;
        } catch (e) { return null; }
    };

    MU.isAuthorized = function() {
        return !!MU.getAuthToken();
    };

    // Fetch через background worker — для Firebase (обход CORS)
    MU.bgFetch = function(url, options) {
        options = options || {};
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'fetch',
                url,
                method: options.method || 'GET',
                headers: options.headers || {},
                body: options.body || undefined
            }, response => {
                if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
                if (response?.ok) {
                    resolve({
                        status: response.status,
                        text: () => Promise.resolve(response.text),
                        json: () => Promise.resolve(JSON.parse(response.text))
                    });
                } else {
                    reject(new Error(response?.error || 'fetch failed'));
                }
            });
        });
    };

    // Firebase helpers
    MU.dbGet = async function(path) {
        try {
            const r = await MU.bgFetch(`${MU.FIREBASE_URL}/${path}.json`);
            return await r.json();
        } catch (e) { return null; }
    };

    MU.dbSet = async function(path, data) {
        try {
            await MU.bgFetch(`${MU.FIREBASE_URL}/${path}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return true;
        } catch (e) { return false; }
    };

    MU.dbPush = async function(path, data) {
        try {
            const r = await MU.bgFetch(`${MU.FIREBASE_URL}/${path}.json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await r.json();
        } catch (e) { return null; }
    };

    MU.dbDelete = async function(path) {
        try {
            await MU.bgFetch(`${MU.FIREBASE_URL}/${path}.json`, { method: 'DELETE' });
            return true;
        } catch (e) { return false; }
    };

    // API cdnlibs — прямой fetch с токеном (работает на сайтах семейства)
    MU.apiCall = async function(path, options) {
        options = options || {};
        const token = MU.getAuthToken();
        const site  = MU.getCurrentSite();
        try {
            const res = await fetch(`https://api.cdnlibs.org/api/${path}`, {
                method: options.method || 'GET',
                headers: {
                    'Accept': 'application/json',
                    'site-id': options.siteId || site.siteId,
                    'Authorization': `Bearer ${token}`,
                    ...(options.headers || {})
                },
                body: options.body || undefined
            });
            return await res.json();
        } catch (e) {
            MU.log('API', 'Ошибка:', e);
            return null;
        }
    };

    // Время
    MU.getNowUTC = function() {
        return new Date().toLocaleString('ru-RU', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'UTC'
        }) + ' UTC';
    };

    MU.formatLastOnline = function(lastOnlineTs) {
        if (!lastOnlineTs) return '';
        const diff = Date.now() - lastOnlineTs;
        const mins = Math.floor(diff / 60000);
        const hrs  = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (days > 0)  return `${days}д`;
        if (hrs > 0)   return `${hrs}ч`;
        if (mins > 0)  return `${mins}м`;
        return 'сейчас';
    };

    MU.getOnlineStatus = function(lastOnlineTs) {
        if (!lastOnlineTs) return 'offline';
        const diff = Date.now() - lastOnlineTs;
        if (diff < 15 * 60 * 1000)     return 'online';
        if (diff < 2 * 60 * 60 * 1000) return 'recent';
        return 'offline';
    };

    // Простой event bus
    MU.events = new EventTarget();
    MU.emit = function(name, data) {
        MU.events.dispatchEvent(new CustomEvent(name, { detail: data }));
    };
    MU.on = function(name, handler) {
        MU.events.addEventListener(name, e => handler(e.detail));
    };

    // Логгер
    MU.log = function(module, ...args) {
        console.log(`[MU:${module}]`, ...args);
    };

    // Chrome storage helpers
    MU.cacheGet = function(key) {
        return new Promise(resolve => {
            chrome.storage.local.get(key, result => resolve(result[key] || null));
        });
    };

    MU.cacheSet = function(key, value) {
        return new Promise(resolve => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    };

})(window.MULib);
