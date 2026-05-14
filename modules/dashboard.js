// Модуль Dashboard — командная панель модераторов
// Показывает онлайн модераторов, watchlist, объявления

window.MUDashboard = (function() {
    'use strict';

    const MU = window.MULib;

    const EXCLUDED_ROLES = ['eks-moderator', 'on_vacation'];
    const MODERATORS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 часа

    // Текущий сайт — все данные хранятся с его префиксом
    const SITE      = MU.getCurrentSite(); // { siteId, name, endpoint }
    const SITE_KEY  = SITE.siteId;         // '1' для MangaLib, '4' для HentaiLib, …
    const SITE_NAME = SITE.name;           // 'MangaLib', 'HentaiLib', …

    // Firebase-пути — site-specific
    const DB_WATCHLIST    = `sites/${SITE_KEY}/watchlist`;
    const DB_ANNOUNCEMENT = `sites/${SITE_KEY}/announcement`;

    // Ключи chrome.storage.local — site-specific
    const CACHE_MODS   = `moderators_list_${SITE_KEY}`;
    const CACHE_ONLINE = `online_statuses_${SITE_KEY}`;

    // ==================== СОСТОЯНИЕ ====================

    let settings = null;
    let ME = { username: 'Модератор', id: 'unknown' };
    let allModerators = [];
    let onlineCache = {};
    let onlineCacheTime = 0;
    let currentWatchlist = [];
    let lastWatchlistStr = '';
    let pollIntervalId = null;
    let clockIntervalId = null;
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
        const cached = await MU.cacheGet(CACHE_MODS);
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

            await MU.cacheSet(CACHE_MODS, { list: result, updatedAt: Date.now() });
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
        const diskCache = await MU.cacheGet(CACHE_ONLINE);
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
            // Прерываем если панель закрыта — не тратим запросы впустую
            if (!isPanelOpen) break;

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
        await MU.cacheSet(CACHE_ONLINE, { data: result, timestamp: onlineCacheTime });

        return result;
    }

    // ==================== WATCHLIST ====================

    async function getWatchlist() {
        const data = await MU.dbGet(DB_WATCHLIST);
        return data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [];
    }

    async function addToWatchlist(term) {
        await MU.dbPush(DB_WATCHLIST, { term, addedBy: ME.username, addedAt: Date.now() });
    }

    async function removeFromWatchlist(id) {
        await MU.dbDelete(`${DB_WATCHLIST}/${id}`);
    }

    function applyWatchlistToCards() {
        document.querySelectorAll('.aek_ael, .abz_ab0, [class*="abz_ab"]').forEach(card => {
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

    async function getAnnouncement() { return await MU.dbGet(DB_ANNOUNCEMENT); }

    async function setAnnouncement(text) {
        await MU.dbSet(DB_ANNOUNCEMENT, { text, author: ME.username, time: Date.now() });
    }

    async function clearAnnouncement() { await MU.dbDelete(DB_ANNOUNCEMENT); }

    // ==================== ИНТЕРФЕЙС ====================

    function injectStyles() {
        if (document.getElementById('mu-dashboard-styles')) return;

        const style = document.createElement('style');
        style.id = 'mu-dashboard-styles';
        style.textContent = `
            /* ── Кнопка-тогглер ── */
            #mu-dashboard-toggle {
                background: var(--background-elevated-1, #fff);
                border: 1px solid var(--mu-accent, #f39c12);
                border-radius: 20px;
                padding: 4px 12px;
                color: var(--mu-accent, #f39c12);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
                box-shadow: 0 2px 8px color-mix(in srgb, var(--mu-accent,#f39c12) 20%, transparent);
                transition: all 0.2s;
                white-space: nowrap;
                font-family: var(--reader-font-family, -apple-system, sans-serif);
            }
            #mu-dashboard-toggle:hover {
                background: color-mix(in srgb, var(--mu-accent,#f39c12) 10%, transparent);
            }

            /* ── Счётчик онлайн ── */
            #mu-online-count {
                background: var(--green, #2ecc71);
                color: #fff;
                border-radius: 10px;
                padding: 0 6px;
                font-size: 10px;
                font-weight: 700;
                min-width: 16px;
                text-align: center;
            }

            /* ── Панель ── */
            #mu-dashboard-panel {
                display: none;
                position: fixed;
                top: 52px;
                right: 16px;
                width: 340px;
                max-height: 82vh;
                background: var(--background-elevated-1, #fff);
                border: 1px solid var(--border-base, #e5e5e5);
                border-radius: var(--radius-section-block, 10px);
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                overflow: hidden;
                z-index: 99998;
                font-family: var(--reader-font-family, -apple-system, sans-serif);
                font-size: 13px;
                flex-direction: column;
            }
            #mu-dashboard-panel.open { display: flex !important; }

            /* ── Шапка ── */
            .mu-dash-header {
                padding: 12px 16px;
                background: var(--background-elevated-2, #f7f7f8);
                border-bottom: 1px solid var(--border-base, #e5e5e5);
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-shrink: 0;
            }
            .mu-dash-title {
                color: var(--mu-accent, #f39c12);
                font-weight: 700;
                font-size: 14px;
            }
            .mu-dash-close {
                background: none;
                border: none;
                color: var(--text-secondary, #8a8a8e);
                cursor: pointer;
                font-size: 18px;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.15s;
            }
            .mu-dash-close:hover {
                background: var(--background-fill-3, rgba(118,118,128,.12));
                color: var(--text-primary, #212529);
            }

            /* ── Прокручиваемое тело ── */
            .mu-dash-body {
                flex: 1;
                overflow-y: auto;
            }
            .mu-dash-body::-webkit-scrollbar { width: 4px; }
            .mu-dash-body::-webkit-scrollbar-track { background: var(--background, #f2f2f3); }
            .mu-dash-body::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb, #c1c1c1); border-radius: 2px; }

            /* ── Секции ── */
            .mu-dash-section {
                padding: 10px 16px;
                border-bottom: 1px solid var(--border-light, #ebebeb);
            }
            .mu-dash-section:last-child { border-bottom: none; }

            .mu-dash-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: var(--mu-accent, #f39c12);
                margin-bottom: 8px;
                font-weight: 700;
            }

            /* ── Кнопки ── */
            .mu-dash-btn {
                background: var(--background-fill-4, rgba(116,116,128,.05));
                border: 1px solid var(--mu-accent, #f39c12);
                color: var(--mu-accent, #f39c12);
                padding: 5px 12px;
                border-radius: var(--radius-section-block, 8px);
                cursor: pointer;
                font-size: 12px;
                font-family: inherit;
                transition: background 0.15s;
            }
            .mu-dash-btn:hover {
                background: color-mix(in srgb, var(--mu-accent,#f39c12) 10%, transparent);
            }
            .mu-dash-btn-danger {
                border-color: var(--red, #e74c3c);
                color: var(--red, #e74c3c);
            }
            .mu-dash-btn-danger:hover { background: rgba(231,76,60,0.08); }

            /* ── Watchlist теги ── */
            .mu-watch-tag {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                background: rgba(231,76,60,0.08);
                border: 1px solid rgba(231,76,60,0.35);
                color: var(--red, #e74c3c);
                border-radius: 20px;
                padding: 3px 10px;
                font-size: 11px;
                cursor: pointer;
                margin: 2px;
                transition: background 0.15s;
            }
            .mu-watch-tag:hover { background: rgba(231,76,60,0.18); }

            /* ── Список модераторов ── */
            .mu-mod-group { margin-bottom: 10px; }
            .mu-mod-group:last-child { margin-bottom: 0; }
            .mu-mod-group-name {
                font-size: 10px;
                color: var(--text-secondary, #8a8a8e);
                text-transform: uppercase;
                letter-spacing: 0.6px;
                margin-bottom: 5px;
                font-weight: 600;
            }
            .mu-mod-item {
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 3px 0;
                font-size: 12px;
            }
            .mu-mod-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .mu-mod-dot-online  { background: var(--green, #2ecc71); }
            .mu-mod-dot-recent  { background: var(--yellow, #f39c12); }
            .mu-mod-dot-offline { background: var(--border-base, #ddd); }

            .mu-mod-name { font-size: 12px; }
            .mu-mod-name-online  { color: var(--text-primary, #212529); }
            .mu-mod-name-recent  { color: var(--text-secondary, #8a8a8e); }
            .mu-mod-name-offline { color: var(--text-secondary, #8a8a8e); opacity: 0.5; }
            .mu-mod-name-me      { color: var(--mu-accent, #f39c12); font-weight: 600; }

            .mu-mod-time {
                font-size: 10px;
                color: var(--text-secondary, #8a8a8e);
                margin-left: auto;
                opacity: 0.7;
            }

            /* ── Объявление ── */
            .mu-dash-announce-box {
                background: rgba(231,76,60,0.06);
                border: 1px solid rgba(231,76,60,0.25);
                border-radius: var(--radius-section-block, 8px);
                padding: 8px 10px;
                font-size: 12px;
                color: var(--text-primary, #212529);
                line-height: 1.5;
                margin-bottom: 6px;
            }

            /* ── Метка сайта ── */
            .mu-dash-site-badge {
                background: color-mix(in srgb, var(--mu-accent,#f39c12) 12%, transparent);
                border: 1px solid color-mix(in srgb, var(--mu-accent,#f39c12) 30%, transparent);
                border-radius: 10px;
                padding: 1px 7px;
                font-size: 10px;
                color: var(--mu-accent, #f39c12);
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
    }

    function createDashboardButton() {
        if (document.getElementById('mu-dashboard-toggle')) return null;

        const btn = document.createElement('button');
        btn.id = 'mu-dashboard-toggle';
        MU.setHTML(btn, `
            📊 Панель
            <span id="mu-online-count">—</span>
            <span class="mu-dash-site-badge">${MU.esc(SITE_NAME)}</span>
        `);
        btn.addEventListener('click', toggleDashboard);
        return btn;
    }

    function createDashboardPanel() {
        if (document.getElementById('mu-dashboard-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'mu-dashboard-panel';
        MU.setHTML(panel, `
            <div class="mu-dash-header">
                <div>
                    <div class="mu-dash-title">📊 Панель управления</div>
                    <div style="font-size:11px;color:var(--text-secondary,#8a8a8e);margin-top:2px;display:flex;align-items:center;gap:6px">
                        <span>Вы: <b style="color:var(--mu-accent,#f39c12)" id="mu-dash-me-name">${MU.esc(ME.username)}</b></span>
                        <span class="mu-dash-site-badge">${MU.esc(SITE_NAME)}</span>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                    <span id="mu-dash-updated" style="font-size:10px;color:var(--text-secondary,#8a8a8e);opacity:0.6"></span>
                    <button class="mu-dash-close" id="mu-dash-close-btn">✕</button>
                </div>
            </div>

            <div class="mu-dash-body">
                <div id="mu-announcement-section" class="mu-dash-section" style="display:none">
                    <div class="mu-dash-label" style="color:var(--red,#e74c3c)">📢 Объявление</div>
                    <div class="mu-dash-announce-box">
                        <div id="mu-announcement-text"></div>
                    </div>
                    <button class="mu-dash-btn mu-dash-btn-danger" id="mu-clear-announce">Убрать</button>
                </div>

                <div class="mu-dash-section">
                    <div class="mu-dash-label" style="display:flex;align-items:center;justify-content:space-between">
                        <span>👥 Модераторы</span>
                        <span style="color:var(--text-secondary,#8a8a8e);font-size:10px;text-transform:none;letter-spacing:0;font-weight:400">🟢&lt;15м 🟡&lt;2ч ⚫давно</span>
                    </div>
                    <div id="mu-moderators-list">
                        <div style="color:var(--text-secondary,#8a8a8e);font-size:12px">Загрузка...</div>
                    </div>
                </div>

                <div class="mu-dash-section">
                    <div class="mu-dash-label">⚠️ Watchlist</div>
                    <div id="mu-watchlist-items" style="margin-bottom:8px;min-height:20px">
                        <span style="color:var(--text-secondary,#8a8a8e);font-size:12px">пусто</span>
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button class="mu-dash-btn" id="mu-add-watch">+ Добавить</button>
                        <button class="mu-dash-btn" id="mu-announce-btn">📢 Объявление</button>
                    </div>
                </div>
            </div>
        `);
        document.body.appendChild(panel);

        // Кнопка закрытия
        document.getElementById('mu-dash-close-btn').addEventListener('click', closeDashboard);

        // Закрытие по клику вне
        document.addEventListener('click', (e) => {
            if (e.target.closest('#mu-dashboard-toggle')) return;
            if (e.target.closest('#mu-dashboard-panel')) return;
            if (e.target.closest('#mu-settings-toggle')) return;
            if (e.target.closest('#mu-settings-panel')) return;
            panel.classList.remove('open');
            isPanelOpen = false;
            stopClock();
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

    function closeDashboard() {
        const panel = document.getElementById('mu-dashboard-panel');
        if (!panel) return;
        panel.classList.remove('open');
        isPanelOpen = false;
        stopClock();
    }

    function toggleDashboard() {
        const panel = document.getElementById('mu-dashboard-panel');
        if (!panel) return;

        isPanelOpen = !panel.classList.contains('open');
        panel.classList.toggle('open');

        if (isPanelOpen) {
            // Позиционируем под кнопкой динамически
            const btn = document.getElementById('mu-dashboard-toggle');
            if (btn) {
                const rect = btn.getBoundingClientRect();
                panel.style.top  = (rect.bottom + 8) + 'px';
                panel.style.right = (window.innerWidth - rect.right) + 'px';
            }
            // Закрываем панель настроек если открыта
            MU.emit('panelOpen', 'dashboard');
            startClock();
            refresh();
        }
    }

    // ==================== UTC-ЧАСЫ ====================

    function tickClock() {
        const el = document.getElementById('mu-dash-updated');
        if (!el) return;
        const now = new Date();
        const h = String(now.getUTCHours()).padStart(2, '0');
        const m = String(now.getUTCMinutes()).padStart(2, '0');
        const s = String(now.getUTCSeconds()).padStart(2, '0');
        el.textContent = `${h}:${m}:${s} UTC`;
    }

    function startClock() {
        tickClock(); // сразу показываем
        clearInterval(clockIntervalId);
        clockIntervalId = setInterval(tickClock, 1000);
    }

    function stopClock() {
        clearInterval(clockIntervalId);
        clockIntervalId = null;
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

        // Время тикает отдельно — см. startClock()
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
            MU.setHTML(listEl, groupOrder.filter(g => groups[g]).map(groupName => {
                const items = groups[groupName].map(mod => `
                    <div class="mu-mod-item" data-mod-id="${mod.id}">
                        <span class="mu-mod-dot mu-mod-dot-offline"></span>
                        <span class="mu-mod-name mu-mod-name-offline">
                            ${MU.esc(mod.username)}${mod.id === ME.id ? ' <span style="color:var(--text-secondary,#8a8a8e);font-size:10px">(вы)</span>' : ''}
                        </span>
                        <span class="mu-mod-time"></span>
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
            }).join(''));
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
            if (groupCountEl) {
                groupCountEl.textContent = onlineInGroup > 0 ? ` (${onlineInGroup})` : '';
                groupCountEl.style.color = 'var(--green, #2ecc71)';
            }
        });
    }

    async function renderAnnouncement() {
        const announcement = await getAnnouncement();
        const annSection = document.getElementById('mu-announcement-section');
        const annText    = document.getElementById('mu-announcement-text');
        if (!annSection || !annText) return;

        if (announcement?.text) {
            annSection.style.display = 'block';
            MU.setHTML(annText, `<b style="color:var(--red,#e74c3c)">${MU.esc(announcement.author)}:</b> ${MU.esc(announcement.text)}`);
        } else {
            annSection.style.display = 'none';
        }
    }

    async function renderWatchlist() {
        currentWatchlist = await getWatchlist();
        const watchEl = document.getElementById('mu-watchlist-items');
        if (!watchEl) return;

        if (currentWatchlist.length > 0) {
            MU.setHTML(watchEl, currentWatchlist.map(w => `
                <span class="mu-watch-tag" data-watchid="${MU.esc(w.id)}" title="Добавил ${MU.esc(w.addedBy)}">
                    ${MU.esc(w.term)} ✕
                </span>
            `).join(''));
            watchEl.querySelectorAll('[data-watchid]').forEach(el => {
                el.addEventListener('click', async () => {
                    if (confirm(`Удалить "${el.textContent.trim().replace(' ✕', '')}"?`)) {
                        await removeFromWatchlist(el.dataset.watchid);
                        await renderWatchlist();
                    }
                });
            });
        } else {
            watchEl.innerHTML = '<span style="color:var(--text-secondary,#8a8a8e);font-size:12px">пусто</span>';
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

        // Закрываемся когда открывается панель настроек
        MU.on('panelOpen', (which) => {
            if (which !== 'dashboard') closeDashboard();
        });

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
