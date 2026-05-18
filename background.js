// Background service worker

// ==================== FETCH PROXY (для Firebase CORS) ====================

const FETCH_TIMEOUT_MS = 25000;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'fetch') {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        fetch(request.url, {
            method:  request.method  || 'GET',
            headers: request.headers || {},
            body:    request.body    || undefined,
            signal:  controller.signal,
        })
        .then(async r => {
            const text = await r.text();
            sendResponse({ ok: r.ok, status: r.status, text });
        })
        .catch(e => {
            const isAbort = e?.name === 'AbortError';
            sendResponse({
                ok:      false,
                error:   isAbort ? `fetch timeout (>${FETCH_TIMEOUT_MS}ms)` : (e?.message || 'fetch failed'),
                aborted: isAbort,
            });
        })
        .finally(() => clearTimeout(timeoutId));
        return true;
    }
});
