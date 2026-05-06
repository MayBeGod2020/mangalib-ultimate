// Background service worker

const GITHUB_MANIFEST_URL =
    'https://raw.githubusercontent.com/MayBeGod2020/mangalib-ultimate/main/manifest.json';

// ==================== FETCH PROXY (для Firebase CORS) ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetch') {
        fetch(request.url, {
            method:  request.method  || 'GET',
            headers: request.headers || {},
            body:    request.body    || undefined
        })
        .then(async r => {
            const text = await r.text();
            sendResponse({ ok: true, status: r.status, text });
        })
        .catch(e => {
            sendResponse({ ok: false, error: e.message });
        });
        return true;
    }
});

// ==================== ПРОВЕРКА ОБНОВЛЕНИЙ ====================

async function checkForUpdate() {
    try {
        const resp = await fetch(GITHUB_MANIFEST_URL + '?t=' + Date.now());
        if (!resp.ok) return;

        const remote  = await resp.json();
        const current = chrome.runtime.getManifest().version;

        if (isNewer(remote.version, current)) {
            // Сохраняем флаг — контент-скрипт покажет баннер
            await chrome.storage.local.set({
                updateAvailable: true,
                updateVersion:   remote.version,
                updateCheckedAt: Date.now()
            });
        } else {
            await chrome.storage.local.set({
                updateAvailable: false,
                updateCheckedAt: Date.now()
            });
        }
    } catch (e) {
        // Нет сети — молча игнорируем
    }
}

// Сравнивает версии вида "2.1" / "3.0" / "3.1"
function isNewer(remote, current) {
    const r = remote.split('.').map(Number);
    const c = current.split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, c.length); i++) {
        const rv = r[i] || 0;
        const cv = c[i] || 0;
        if (rv > cv) return true;
        if (rv < cv) return false;
    }
    return false;
}

// Запускаем проверку при старте service worker
checkForUpdate();

// Повторяем раз в сутки через Alarms API
chrome.alarms.create('updateCheck', { periodInMinutes: 60 * 24 });
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === 'updateCheck') checkForUpdate();
});
