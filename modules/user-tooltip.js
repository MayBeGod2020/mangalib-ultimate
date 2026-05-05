// Модуль User Tooltip — попап с инфой о пользователе при наведении на ник
window.MUUserTooltip = (function () {
    'use strict';

    const MU = window.MULib;
    const TOOLTIP_ID = 'mu-user-tooltip';
    const CACHE = {}; // userId → данные (чтобы не дёргать API дважды)

    let hideTimer = null;
    let currentTooltip = null;

    // ==================== API ====================

    async function fetchUser(userId) {
        if (CACHE[userId]) return CACHE[userId];

        const url = `https://api.cdnlibs.org/api/user/${userId}` +
            `?fields[]=ban_info&fields[]=roles&fields[]=created_at&fields[]=points`;

        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const json = await resp.json();
            CACHE[userId] = json.data || null;
            return CACHE[userId];
        } catch {
            return null;
        }
    }

    // ==================== UI ====================

    function injectStyles() {
        if (document.getElementById('mu-tooltip-styles')) return;
        const style = document.createElement('style');
        style.id = 'mu-tooltip-styles';
        style.textContent = `
            #${TOOLTIP_ID} {
                position: fixed;
                z-index: 999999;
                width: 240px;
                background: #0f0f1a;
                border: 1px solid #2a2a3e;
                border-radius: 10px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.7);
                font-family: -apple-system, sans-serif;
                font-size: 12px;
                color: #ccc;
                pointer-events: none;
                animation: mu-tooltip-in 0.15s ease;
                overflow: hidden;
            }
            @keyframes mu-tooltip-in {
                from { opacity: 0; transform: translateY(6px); }
                to   { opacity: 1; transform: translateY(0); }
            }
            .mu-tt-header {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                background: #12122a;
                border-bottom: 1px solid #1e1e2e;
            }
            .mu-tt-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
                background: #1a1a2e;
            }
            .mu-tt-username {
                font-weight: 700;
                color: #fff;
                font-size: 13px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .mu-tt-body {
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .mu-tt-row {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                color: #aaa;
            }
            .mu-tt-row b { color: #ddd; }
            .mu-tt-banned {
                margin: 0 12px 10px;
                padding: 6px 10px;
                background: rgba(231,76,60,0.12);
                border: 1px solid rgba(231,76,60,0.4);
                border-radius: 6px;
                font-size: 11px;
                color: #e74c3c;
            }
        `;
        document.head.appendChild(style);
    }

    function formatDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        const now = new Date();
        const years = Math.floor((now - d) / (1000 * 60 * 60 * 24 * 365));
        const months = Math.floor((now - d) / (1000 * 60 * 60 * 24 * 30));
        if (years >= 1) return `${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'} назад`;
        if (months >= 1) return `${months} мес. назад`;
        return 'недавно';
    }

    function showTooltip(userId, username, anchorEl) {
        removeTooltip();

        // Создаём "скелетон" сразу
        const tip = document.createElement('div');
        tip.id = TOOLTIP_ID;
        tip.innerHTML = `
            <div class="mu-tt-header">
                <div class="mu-tt-avatar" style="background:#1a1a2e;display:flex;align-items:center;justify-content:center;color:#333;font-size:18px;">👤</div>
                <div class="mu-tt-username">${username}</div>
            </div>
            <div class="mu-tt-body">
                <div class="mu-tt-row" style="color:#555;">Загружаю…</div>
            </div>
        `;
        document.body.appendChild(tip);
        currentTooltip = tip;
        positionTooltip(tip, anchorEl);

        // Подгружаем данные
        fetchUser(userId).then(data => {
            if (!currentTooltip || currentTooltip !== tip) return;
            if (!data) {
                tip.querySelector('.mu-tt-body').innerHTML =
                    `<div class="mu-tt-row" style="color:#555;">Не удалось загрузить</div>`;
                return;
            }

            // Аватар
            const avatarEl = tip.querySelector('.mu-tt-avatar');
            if (data.avatar?.url) {
                const img = document.createElement('img');
                img.className = 'mu-tt-avatar';
                img.src = data.avatar.url;
                img.alt = '';
                avatarEl.replaceWith(img);
            }

            // Роли
            const roles = (data.roles || []).map(r => r.name || r).join(', ');

            // Уровень
            const level = data.points_info?.level ?? null;

            // Дата регистрации
            const regDate = formatDate(data.created_at);

            // Тело
            tip.querySelector('.mu-tt-body').innerHTML = `
                ${level !== null ? `
                <div class="mu-tt-row">⭐ Уровень: <b>${level}</b>
                    ${data.points_info?.total_points ? `<span style="color:#555">(${data.points_info.total_points.toLocaleString('ru')} очков)</span>` : ''}
                </div>` : ''}
                <div class="mu-tt-row">📅 Регистрация: <b>${regDate}</b></div>
                ${roles ? `<div class="mu-tt-row">🎭 Роли: <b>${roles}</b></div>` : ''}
            `;

            // Бан — ban_info это массив активных банов
            const bans = Array.isArray(data.ban_info) ? data.ban_info : (data.ban_info ? [data.ban_info] : []);
            if (bans.length > 0) {
                bans.forEach(ban => {
                    const until = ban.expired_at
                        ? `до ${new Date(ban.expired_at).toLocaleDateString('ru', { day:'2-digit', month:'2-digit', year:'numeric' })}`
                        : 'навсегда';
                    const reason = ban.reason?.label || ban.reason || '—';
                    const type   = ban.type === 'social' ? 'Соц.' : ban.type === 'functional' ? 'Функц.' : '';
                    const banEl  = document.createElement('div');
                    banEl.className = 'mu-tt-banned';
                    banEl.innerHTML = `🔨 <b>Забанен ${until}</b>${type ? ` <span style="opacity:0.6;font-size:10px">(${type})</span>` : ''}<br><span style="opacity:0.8">${reason}</span>`;
                    tip.appendChild(banEl);
                });
                tip.style.borderColor = '#e74c3c44';
            }

            positionTooltip(tip, anchorEl);
        });
    }

    function positionTooltip(tip, anchor) {
        const rect = anchor.getBoundingClientRect();
        const tipH = tip.offsetHeight || 120;
        const tipW = tip.offsetWidth  || 240;

        let top  = rect.bottom + 6;
        let left = rect.left;

        // Не выходить за правый край
        if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
        // Не выходить за нижний край
        if (top + tipH > window.innerHeight - 8) top = rect.top - tipH - 6;

        tip.style.top  = `${top}px`;
        tip.style.left = `${left}px`;
    }

    function removeTooltip() {
        document.getElementById(TOOLTIP_ID)?.remove();
        currentTooltip = null;
    }

    // ==================== СЛЕЖЕНИЕ ЗА НИКНЕЙМАМИ ====================

    function attachHover(link) {
        if (link.dataset.muTooltip) return;
        link.dataset.muTooltip = 'true';

        const match = link.href?.match(/\/user\/(\d+)/);
        if (!match) return;
        const userId   = match[1];
        const username = link.querySelector('[class*="username"], [class*="name"]')?.innerText?.trim()
                      || link.innerText?.trim()
                      || `#${userId}`;

        link.addEventListener('mouseenter', () => {
            clearTimeout(hideTimer);
            showTooltip(userId, username, link);
        });
        link.addEventListener('mouseleave', () => {
            hideTimer = setTimeout(removeTooltip, 300);
        });
    }

    function scanLinks() {
        document.querySelectorAll('a[href*="/ru/user/"]').forEach(attachHover);
    }

    // ==================== INIT ====================

    async function init() {
        injectStyles();
        scanLinks();

        // Следим за новыми комментариями / динамическим контентом
        const observer = new MutationObserver(() => scanLinks());
        observer.observe(document.body, { childList: true, subtree: true });

        MU.on('urlChanged', () => {
            setTimeout(scanLinks, 1500);
        });

        MU.log('UserTooltip', 'Модуль запущен');
    }

    return { init };

})();
