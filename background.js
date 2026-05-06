// Background service worker

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
