// Модуль Dashboard — командная панель модераторов
// Показывает онлайн модераторов, watchlist, объявления

window.MUDashboard = (function() {
    'use strict';

    const MU = window.MULib;

    const EXCLUDED_ROLES = ['eks-moderator', 'on_vacation'];
    const MODERATORS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

    // ==================== СОСТОЯНИЕ ====================

    let settings = null;
    let ME = { username: 'Модератор', id: 'unknown' };
    let allModerators = [];
    let onlineCache = {};
    let onlineCacheTime = 0;
    let currentWatchlist = [];
    let lastWatchlistStr = '';
    let pollIntervalId = null;
    let isPanelOpen = false;

    // ==================== ЗАГРУЗКА ДАННЫХ ====================

    async function getCurrentModerator() {
        const userId = MU.getCurrentUserId();
        if (!userId) return { username: 'Модератор', id: 'unknown' };

        // Проверяем кэш
        const cached = await MU.cacheGet('current_user');
        if (cached && cached.id === userId && Date.now() - cached.timestamp < 86400000) {
            return { username: cached.username, id: cached.id };
        }

        try {
            const data = await MU.apiCall(`user/${userId}`);
            const username = data?.data?.username || 'Модератор';
            await MU.cacheSet('current_user', { id: userId, username, timestamp: Date.now() });
            return { username, id: userId };
        } catch (e) {
            return { username: 'Модератор', id: userId };
        }
    }

    async function fetchAllModerators() {
        // Сначала проверяем кэш в chrome.storage.local
        const cached = await MU.cacheGet('moderators_list');
        if (cached && cached.list && Date.now() - cached.updatedAt < MODERATORS_CACHE_TTL) {
            MU.log('Dashboard', 'Модераторы из локального кэша:', cached.list.length);
            return cached.list;
        }

        MU.log('Dashboard', 'Загружаем список модераторов через API...');

        try {
            const data = await MU.apiCall('user?filter=moderators&page=1&sort_by=id&sort_type=desc');
            const result = [];

            data?.data?.forEach(user => {
                const roles = user.roles || [];
                if (roles.some(r => EXCLUDED_ROLES.includes(r.name))) return;

                let group = '—';
                if (roles.some(r => r.name === 'admin')) group = 'Админ';
                else if (roles.some(r => r.name === 'moderated_anonsmoderated')) group = 'Модератор Анонсов';
                else if (roles.some(r => r.name === 'moderated_forums')) group = 'Модератор Форума';
                else if (roles.some(r => r.name === 'moderated')) group = 'Модератор';

                result.push({ id: String(user.id), username: user.username, group });
            });

            await MU.cacheSet('moderators_list', { list: result, updatedAt: Date.now() });
            MU.log('Dashboard', 'Загружено модераторов:', result.length);
            return result;
        } catch (e) {
            MU.log('Dashboard', 'Ошибка загрузки:', e);
            return [];
        }
    }

    async function loadOnlineStatuses() {
        const intervalMs = settings.dashboard.updateInterval * 60 * 1000;

        // Кэш
        if (Date.now() - onlineCacheTime < intervalMs && Object.keys(onlineCache).length > 0) {
            return onlineCache;
        }

        // Загружаем кэш с диска
        const diskCache = await MU.cacheGet('online_statuses');
        if (diskCache && Date.now() - diskCache.timestamp < intervalMs) {
            onlineCache     = diskCache.data;
            onlineCacheTime = diskCache.timestamp;
            return onlineCache;
        }

        if (allModerators.length === 0) return {};

        MU.log('Dashboard', 'Загружаем онлайн статусы...');

        const result = {};

        // Загружаем по одному с задержкой 2 секунды чтобы не превысить лимит
        for (const mod of allModerators) {
            try {
                const data = await MU.apiCall(`user/${mod.id}`);
                const lastOnline = data?.data?.last_online_at;
                if (lastOnline) result[mod.id] = new Date(lastOnline).getTime();
            } catch (e) {}

            // Задержка между запросами
            await new Promise(r => setTimeout(r, 2000));
        }

        onlineCache     = result;
        onlineCacheTime = Date.now();
        await MU.cacheSet('online_statuses', { data: result, timestamp: onlineCacheTime });

        return result;
    }

    // ==================== WATCHLIST ====================

    async function getWatchlist() {
        const data = await MU.dbGet('watchlist');
        return data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [];
    }

    async function addToWatchlist(term) {
        await MU.dbPush('watchlist', { term, addedBy: ME.username, addedAt: Date.now() });
    }

    async function removeFromWatchlist(id) {
        await MU.dbDelete(`watchlist/${id}`);
    }

    function applyWatchlistToCards() {
        document.querySelectorAll('.acp_acq').forEach(card => {
            const commentText = card.querySelector('.comment__content')?.innerText?.toLowerCase() || '';
            const authorText  = card.querySelector('.comment-author__name')?.innerText?.toLowerCase() || '';
            const fullText    = commentText + ' ' + authorText;

            card.querySelector('.watchlist-badge')?.remove();
            card.style.outline = '';

            const matched = currentWatchlist.filter(w => fullText.includes(w.term.toLowerCase()));
            if (matched.length > 0) {
                card.style.outline = '2px solid #e74c3c';
                const badge = document.createElement('div');
                badge.className = 'watchlist-badge';
                badge.style.cssText = `background:rgba(231,76,60,0.2);border:1px solid #e74c3c;color:#e74c3c;font-size:10px;padding:2px 8px;border-radius:10px;margin-top:4px;display:inline-block;`;
                badge.textContent = `⚠️ ${matched.map(w => w.term).join(', ')}`;
                card.querySelector('.acp_aj')?.appendChild(badge);
            }
        });
    }

    // ==================== ОБЪЯВЛЕНИЕ ====================

    async function getAnnouncement() { return await MU.dbGet('announcement'); }

    async function setAnnouncement(text) {
        await MU.dbSet('announcement', { text, author: ME.username, time: Date.now() });
    }

    async function clearAnnouncement() { await MU.dbDelete('announcement'); }

    // ==================== ИНТЕРФЕЙС ====================

    function injectStyles() {
        if (document.getElementById('mu-dashboard-styles')) return;

        const style = document.createElement('style');
        style.id = 'mu-dashboard-styles';
        style.textContent = `
            #mu-dashboard-toggle {
                background:#1a1a2e;border:1px solid #9b59b6;border-radius:20px;
                padding:5px 12px;color:#9b59b6;cursor:pointer;display:flex;
                align-items:center;gap:6px;font-size:12px;font-weight:600;
                box-shadow:0 2px 8px rgba(155,89,182,0.3);transition:all 0.2s;
                white-space:nowrap;font-family:-apple-system,sans-serif;
            }
            #mu-dashboard-toggle:hover { background:rgba(155,89,182,0.15); }
            #mu-dashboard-panel {
                display:none;position:fixed;top:50px;right:16px;width:340px;
                background:#0f0f1a;border:1px solid #2a2a3e;border-radius:12px;
                box-shadow:0 8px 24px rgba(0,0,0,0.6);overflow:hidden;
                z-index:99998;font-family:-apple-system,sans-serif;font-size:12px;
            }
            #mu-dashboard-panel.open { display:block; }
            .mu-dash-section { padding:10px 14px;border-bottom:1px solid #1e1e2e; }
            .mu-dash-section:last-child { border-bottom:none; }
            .mu-dash-label { font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#555;margin-bottom:6px;font-weight:600; }
            .mu-dash-btn { padding:3px 10px;border-radius:6px;border:1px solid currentColor;background:transparent;cursor:pointer;font-size:11px;color:inherit; }
            .mu-dash-btn:hover { background:rgba(255,255,255,0.05); }
            .mu-watch-tag { display:inline-flex;align-items:center;gap:4px;background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.4);color:#e74c3c;border-radius:10px;padding:2px 8px;font-size:11px;cursor:pointer;margin:2px; }
            .mu-watch-tag:hover { background:rgba(231,76,60,0.3); }
            .mu-mod-group { margin-bottom:8px; }
            .mu-mod-group-name { font-size:10px;color:#555;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600; }
            .mu-mod-item { display:flex;align-items:center;gap:6px;padding:2px 0;font-size:12px; }
            .mu-mod-dot-online  { width:6px;height:6px;background:#2ecc71;border-radius:50%;flex-shrink:0; }
            .mu-mod-dot-recent  { width:6px;height:6px;background:#f39c12;border-radius:50%;flex-shrink:0; }
            .mu-mod-dot-offline { width:6px;height:6px;background:#333;border-radius:50%;flex-shrink:0; }
            .mu-mod-name-online  { color:#e0e0e0; }
            .mu-mod-name-recent  { color:#888; }
            .mu-mod-name-offline { color:#444; }
            .mu-mod-name-me { color:#9b59b6;font-weight:600; }
            .mu-dash-scrollable { max-height:280px;overflow-y:auto; }
            .mu-dash-scrollable::-webkit-scrollbar { width:4px; }
            .mu-dash-scrollable::-webkit-scrollbar-track { background:#0f0f1a; }
            .mu-dash-scrollable::-webkit-scrollbar-thumb { background:#333;border-radius:2px; }
        `;
        document.head.appendChild(style);
    }

    function createDashboardButton() {
        if (document.getElementById('mu-dashboard-toggle')) return null;

        const btn = document.createElement('button');
        btn.id = 'mu-dashboard-toggle';
        btn.innerHTML = `
            📊 Панель
            <span id="mu-online-count" style="background:#2ecc71;color:#000;border-radius:10px;padding:0 5px;font-size:10px;font-weight:700;">—</span>
        `;
        btn.addEventListener('click', toggleDashboard);
        return btn;
    }

    function createDashboardPanel() {
        if (document.getElementById('mu-dashboard-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'mu-dashboard-panel';
        panel.innerHTML = `
            <div class="mu-dash-section" style="background:#12122a">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <span style="color:#9b59b6;font-weight:700;font-size:13px">📊 Панель управления</span>
                    <span id="mu-dash-updated" style="color:#333;font-size:10px"></span>
                </div>
                <div style="color:#555;font-size:10px;margin-top:2px">
                    Вы: <span style="color:#9b59b6" id="mu-dash-me-name">${ME.username}</span>
                </div>
            </div>
            <div id="mu-announcement-section" class="mu-dash-section" style="display:none">
                <div class="mu-dash-label" style="color:#e74c3c">📢 Объявление</div>
                <div id="mu-announcement-text" style="color:#fff;line-height:1.5;font-size:12px"></div>
                <button class="mu-dash-btn" id="mu-clear-announce" style="color:#e74c3c;margin-top:6px;font-size:10px">Убрать</button>
            </div>
            <div class="mu-dash-section">
                <div class="mu-dash-label">
                    👥 Модераторы
                    <span style="color:#555;font-weight:400;font-size:10px;margin-left:4px">🟢&lt;15м 🟡&lt;2ч ⚫давно</span>
                </div>
                <div class="mu-dash-scrollable">
                    <div id="mu-moderators-list">
                        <div style="color:#444;font-size:11px">Загрузка...</div>
                    </div>
                </div>
            </div>
            <div class="mu-dash-section">
                <div class="mu-dash-label">⚠️ Watchlist</div>
                <div id="mu-watchlist-items" style="margin-bottom:6px;min-height:20px">
                    <span style="color:#444">пусто</span>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="mu-dash-btn" id="mu-add-watch" style="color:#f39c12">+ Добавить</button>
                    <button class="mu-dash-btn" id="mu-announce-btn" style="color:#9b59b6">📢 Объявление</button>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Закрытие по клику вне
        document.addEventListener('click', (e) => {
            if (e.target.closest('#mu-dashboard-toggle')) return;
            if (e.target.closest('#mu-dashboard-panel')) return;
            if (e.target.closest('#mu-settings-toggle')) return;
            if (e.target.closest('#mu-settings-panel')) return;
            panel.classList.remove('open');
            isPanelOpen = false;
        });

        document.getElementById('mu-add-watch').addEventListener('click', async () => {
            const term = prompt('Ник или ключевое слово:');
            if (term?.trim()) { await addToWatchlist(term.trim()); await refresh(); }
        });

        document.getElementById('mu-announce-btn').addEventListener('click', async () => {
            const text = prompt('Объявление для всех модераторов:');
            if (text?.trim()) { await setAnnouncement(text.trim()); await refresh(); }
        });

        document.getElementById('mu-clear-announce').addEventListener('click', async () => {
            await clearAnnouncement(); await refresh();
        });
    }

    function toggleDashboard() {
        const panel = document.getElementById('mu-dashboard-panel');
        if (!panel) return;

        isPanelOpen = !panel.classList.contains('open');
        panel.classList.toggle('open');

        if (isPanelOpen) {
            refresh();
        }
    }

    // ==================== ОБНОВЛЕНИЕ ДАННЫХ ====================

    async function refresh() {
        if (!isPanelOpen) return; // Не обновляем если панель закрыта

        const onlineStatuses = await loadOnlineStatuses();

        let onlineCount = 0;
        allModerators.forEach(mod => {
            if (MU.getOnlineStatus(onlineStatuses[mod.id]) === 'online') onlineCount++;
        });

        const countEl = document.getElementById('mu-online-count');
        if (countEl) countEl.textContent = onlineCount;

        renderModeratorsList(onlineStatuses);
        await renderAnnouncement();
        await renderWatchlist();

        const updEl = document.getElementById('mu-dash-updated');
        if (updEl) updEl.textContent = new Date().toLocaleTimeString('ru-RU');
    }

    function renderModeratorsList(onlineStatuses) {
        const listEl = document.getElementById('mu-moderators-list');
        if (!listEl || allModerators.length === 0) return;

        if (!listEl.dataset.built) {
            listEl.dataset.built = 'true';
            const groups = {};
            allModerators.forEach(mod => {
                if (!groups[mod.group]) groups[mod.group] = [];
                groups[mod.group].push(mod);
            });

            const groupOrder = ['Админ', 'Модератор', 'Модератор Анонсов', 'Модератор Форума'];
            listEl.innerHTML = groupOrder.filter(g => groups[g]).map(groupName => {
                const items = groups[groupName].map(mod => `
                    <div class="mu-mod-item" data-mod-id="${mod.id}">
                        <span class="mu-mod-dot mu-mod-dot-offline"></span>
                        <span class="mu-mod-name mu-mod-name-offline">
                            ${mod.username}${mod.id === ME.id ? ' <span style="color:#555;font-size:10px">(вы)</span>' : ''}
                        </span>
                        <span class="mu-mod-time" style="color:#444;font-size:10px;margin-left:auto"></span>
                    </div>
                `).join('');
                return `
                    <div class="mu-mod-group" data-group="${groupName}">
                        <div class="mu-mod-group-name">
                            ${groupName}
                            <span class="mu-group-online-count" style="color:#2ecc71"></span>
                        </div>
                        ${items}
                    </div>
                `;
            }).join('');
        }

        ['Админ', 'Модератор', 'Модератор Анонсов', 'Модератор Форума'].forEach(groupName => {
            const groupEl = listEl.querySelector(`[data-group="${groupName}"]`);
            if (!groupEl) return;

            let onlineInGroup = 0;
            groupEl.querySelectorAll('.mu-mod-item[data-mod-id]').forEach(item => {
                const modId  = item.dataset.modId;
                const isMe   = modId === ME.id;
                const status = MU.getOnlineStatus(onlineStatuses[modId]);
                if (status === 'online') onlineInGroup++;

                const dot    = item.querySelector('.mu-mod-dot');
                const name   = item.querySelector('.mu-mod-name');
                const timeEl = item.querySelector('.mu-mod-time');

                if (dot)    dot.className    = `mu-mod-dot mu-mod-dot-${status}`;
                if (name)   name.className   = `mu-mod-name ${isMe ? 'mu-mod-name-me' : `mu-mod-name-${status}`}`;
                if (timeEl) timeEl.textContent = onlineStatuses[modId] ? MU.formatLastOnline(onlineStatuses[modId]) : '';
            });

            const groupCountEl = groupEl.querySelector('.mu-group-online-count');
            if (groupCountEl) groupCountEl.textContent = onlineInGroup > 0 ? `(${onlineInGroup} онлайн)` : '';
        });
    }

    async function renderAnnouncement() {
        const announcement = await getAnnouncement();
        const annSection = document.getElementById('mu-announcement-section');
        const annText    = document.getElementById('mu-announcement-text');
        if (!annSection || !annText) return;

        if (announcement?.text) {
            annSection.style.display = 'block';
            annText.innerHTML = `<b style="color:#e74c3c">${announcement.author}:</b> ${announcement.text}`;
        } else {
            annSection.style.display = 'none';
        }
    }

    async function renderWatchlist() {
        currentWatchlist = await getWatchlist();
        const watchEl = document.getElementById('mu-watchlist-items');
        if (!watchEl) return;

        if (currentWatchlist.length > 0) {
            watchEl.innerHTML = currentWatchlist.map(w => `
                <span class="mu-watch-tag" data-watchid="${w.id}" title="Добавил ${w.addedBy}">
                    ${w.term} ✕
                </span>
            `).join('');
            watchEl.querySelectorAll('[data-watchid]').forEach(el => {
                el.addEventListener('click', async () => {
                    if (confirm(`Удалить "${el.textContent.trim().replace(' ✕', '')}"?`)) {
                        await removeFromWatchlist(el.dataset.watchid);
                        await renderWatchlist();
                    }
                });
            });
        } else {
            watchEl.innerHTML = '<span style="color:#444">пусто</span>';
        }

        // Применяем к карточкам только если изменились
        const watchlistStr = JSON.stringify(currentWatchlist);
        if (watchlistStr !== lastWatchlistStr) {
            lastWatchlistStr = watchlistStr;
            applyWatchlistToCards();
        }
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    async function init() {
        if (!MU.isAuthorized()) return null;

        settings = await MU.getSettings();
        if (!settings.dashboard.enabled) return null;

        const [moderator, mods] = await Promise.all([
            getCurrentModerator(),
            fetchAllModerators()
        ]);

        ME = moderator;
        allModerators = mods;

        const isModerator = allModerators.some(m => m.id === ME.id);
        if (!isModerator) {
            MU.log('Dashboard', 'Не модератор — панель скрыта');
            return null;
        }

        injectStyles();
        createDashboardPanel();

        // Подписка на изменение настроек
        MU.on('settingsChanged', async () => {
            settings = await MU.getSettings();
            const btn = document.getElementById('mu-dashboard-toggle');
            const panel = document.getElementById('mu-dashboard-panel');
            if (settings.dashboard.enabled) {
                btn?.style.removeProperty('display');
            } else {
                if (btn) btn.style.display = 'none';
                panel?.classList.remove('open');
                isPanelOpen = false;
            }
        });

        MU.log('Dashboard', 'Модуль Dashboard запущен');

        // Возвращаем кнопку для встраивания через main.js
        return {
            createButton: createDashboardButton,
            isAvailable: true,
            ME
        };
    }

    return { init };

})();
