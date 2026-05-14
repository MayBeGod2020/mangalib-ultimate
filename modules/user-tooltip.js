// Модуль User Tooltip — попап с инфой о пользователе при наведении на ник
// + приватные заметки на пользователей (chrome.storage.local)
window.MUUserTooltip = (function () {
    'use strict';

    const MU = window.MULib;
    const TOOLTIP_ID = 'mu-user-tooltip';
    const CACHE = {}; // userId → данные (чтобы не дёргать API дважды)

    let hideTimer = null;
    let currentTooltip = null;

    // ==================== ЗАМЕТКИ ====================

    async function getUserNote(userId) {
        return new Promise(resolve => {
            chrome.storage.local.get('mu_user_notes', result => {
                const notes = result.mu_user_notes || {};
                resolve(notes[userId] || '');
            });
        });
    }

    async function setUserNote(userId, note) {
        return new Promise(resolve => {
            chrome.storage.local.get('mu_user_notes', result => {
                const notes = result.mu_user_notes || {};
                if (note.trim()) {
                    notes[userId] = note.trim();
                } else {
                    delete notes[userId];
                }
                chrome.storage.local.set({ mu_user_notes: notes }, resolve);
            });
        });
    }

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
                width: 250px;
                background: var(--background-elevated-1, #fff);
                border: 1px solid var(--border-base, #e5e5e5);
                border-radius: var(--radius-section-block, 10px);
                box-shadow: 0 8px 24px rgba(0,0,0,0.15);
                font-family: var(--reader-font-family, -apple-system, sans-serif);
                font-size: 12px;
                color: var(--text-primary, #212529);
                animation: mu-tooltip-in 0.15s ease;
                overflow: hidden;
                pointer-events: auto;
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
                background: var(--background-elevated-2, #f7f7f8);
                border-bottom: 1px solid var(--border-base, #e5e5e5);
            }
            .mu-tt-avatar {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                object-fit: cover;
                flex-shrink: 0;
                background: var(--background-fill-2, rgba(116,116,128,.08));
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary, #8a8a8e);
                font-size: 18px;
            }
            .mu-tt-username {
                font-weight: 700;
                color: var(--text-primary, #212529);
                font-size: 13px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .mu-tt-body {
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            .mu-tt-row {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 11px;
                color: var(--text-secondary, #8a8a8e);
            }
            .mu-tt-row b { color: var(--text-primary, #212529); }
            .mu-tt-banned {
                margin: 0 12px 10px;
                padding: 6px 10px;
                background: rgba(231,76,60,0.08);
                border: 1px solid rgba(231,76,60,0.35);
                border-radius: var(--radius-section-block, 6px);
                font-size: 11px;
                color: var(--red, #e74c3c);
            }

            /* ── Заметки ── */
            .mu-tt-note-section {
                border-top: 1px solid var(--border-light, #ebebeb);
                padding: 8px 12px;
            }
            .mu-tt-note-label {
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                font-weight: 700;
                color: var(--mu-accent, #f39c12);
                margin-bottom: 5px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .mu-tt-note-edit-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 12px;
                padding: 0;
                color: var(--text-secondary, #8a8a8e);
                line-height: 1;
                transition: color 0.15s;
            }
            .mu-tt-note-edit-btn:hover { color: var(--mu-accent, #f39c12); }
            .mu-tt-note-text {
                font-size: 12px;
                color: var(--text-primary, #212529);
                line-height: 1.4;
                white-space: pre-wrap;
                word-break: break-word;
            }
            .mu-tt-note-empty {
                font-size: 11px;
                color: var(--text-secondary, #8a8a8e);
                font-style: italic;
            }
            .mu-tt-note-textarea {
                width: 100%;
                box-sizing: border-box;
                background: var(--input-bg, #fff);
                border: 1px solid var(--mu-accent, #f39c12);
                border-radius: var(--radius-section-block, 6px);
                color: var(--text-primary, #212529);
                font-family: inherit;
                font-size: 12px;
                padding: 5px 8px;
                resize: vertical;
                min-height: 60px;
                outline: none;
            }
            .mu-tt-note-actions {
                display: flex;
                gap: 5px;
                margin-top: 5px;
            }
            .mu-tt-note-save {
                flex: 1;
                background: color-mix(in srgb, var(--mu-accent,#f39c12) 12%, transparent);
                border: 1px solid var(--mu-accent, #f39c12);
                color: var(--mu-accent, #f39c12);
                border-radius: var(--radius-section-block, 6px);
                font-size: 11px;
                padding: 4px 8px;
                cursor: pointer;
                font-family: inherit;
                font-weight: 600;
            }
            .mu-tt-note-cancel {
                background: var(--background-fill-4, rgba(116,116,128,.05));
                border: 1px solid var(--border-base, #e5e5e5);
                color: var(--text-secondary, #8a8a8e);
                border-radius: var(--radius-section-block, 6px);
                font-size: 11px;
                padding: 4px 8px;
                cursor: pointer;
                font-family: inherit;
            }
            .mu-tt-note-delete {
                background: none;
                border: none;
                color: var(--red, #e74c3c);
                font-size: 11px;
                padding: 4px 6px;
                cursor: pointer;
                font-family: inherit;
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

    // ==================== СЕКЦИЯ ЗАМЕТОК ====================

    function renderNoteSection(tip, userId, note) {
        // Удаляем старую секцию если есть
        tip.querySelector('.mu-tt-note-section')?.remove();

        const section = document.createElement('div');
        section.className = 'mu-tt-note-section';

        function showView() {
            MU.setHTML(section, `
                <div class="mu-tt-note-label">
                    📝 Заметка
                    <button class="mu-tt-note-edit-btn" title="Редактировать">✏️</button>
                </div>
                ${note
                    ? `<div class="mu-tt-note-text">${MU.esc(note)}</div>`
                    : `<div class="mu-tt-note-empty">нет заметки</div>`
                }
            `);
            section.querySelector('.mu-tt-note-edit-btn').addEventListener('click', showEdit);
        }

        function showEdit() {
            MU.setHTML(section, `
                <div class="mu-tt-note-label">📝 Заметка</div>
                <textarea class="mu-tt-note-textarea" placeholder="Введите заметку...">${MU.esc(note)}</textarea>
                <div class="mu-tt-note-actions">
                    <button class="mu-tt-note-save">Сохранить</button>
                    <button class="mu-tt-note-cancel">Отмена</button>
                    ${note ? `<button class="mu-tt-note-delete">Удалить</button>` : ''}
                </div>
            `);

            const textarea = section.querySelector('.mu-tt-note-textarea');
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);

            section.querySelector('.mu-tt-note-save').addEventListener('click', async () => {
                note = textarea.value.trim();
                await setUserNote(userId, note);
                showView();
                positionTooltip(tip, tip._anchor);
            });

            section.querySelector('.mu-tt-note-cancel').addEventListener('click', () => {
                showView();
                positionTooltip(tip, tip._anchor);
            });

            section.querySelector('.mu-tt-note-delete')?.addEventListener('click', async () => {
                note = '';
                await setUserNote(userId, '');
                showView();
                positionTooltip(tip, tip._anchor);
            });

            positionTooltip(tip, tip._anchor);
        }

        showView();
        tip.appendChild(section);
    }

    // ==================== ПОКАЗ ТУЛТИПА ====================

    function showTooltip(userId, username, anchorEl) {
        removeTooltip();

        const tip = document.createElement('div');
        tip.id = TOOLTIP_ID;
        tip._anchor = anchorEl;

        MU.setHTML(tip, `
            <div class="mu-tt-header">
                <div class="mu-tt-avatar">👤</div>
                <div class="mu-tt-username">${MU.esc(username)}</div>
            </div>
            <div class="mu-tt-body">
                <div class="mu-tt-row">Загружаю…</div>
            </div>
        `);

        // Тултип интерактивный — не скрываем пока мышь внутри
        tip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
        tip.addEventListener('mouseleave', () => {
            hideTimer = setTimeout(removeTooltip, 300);
        });

        document.body.appendChild(tip);
        currentTooltip = tip;
        positionTooltip(tip, anchorEl);

        // Грузим данные параллельно
        Promise.all([
            fetchUser(userId),
            getUserNote(userId)
        ]).then(([data, note]) => {
            if (!currentTooltip || currentTooltip !== tip) return;

            if (!data) {
                tip.querySelector('.mu-tt-body').innerHTML =
                    `<div class="mu-tt-row" style="color:var(--text-secondary,#8a8a8e)">Не удалось загрузить</div>`;
                renderNoteSection(tip, userId, note);
                positionTooltip(tip, anchorEl);
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
            const roles = MU.esc((data.roles || []).map(r => r.name || r).join(', '));

            // Уровень
            const level = data.points_info?.level ?? null;

            // Дата регистрации
            const regDate = formatDate(data.created_at);

            MU.setHTML(tip.querySelector('.mu-tt-body'), `
                ${level !== null ? `
                <div class="mu-tt-row">⭐ Уровень: <b>${level}</b>
                    ${data.points_info?.total_points
                        ? `<span style="opacity:0.6">(${data.points_info.total_points.toLocaleString('ru')} очков)</span>`
                        : ''}
                </div>` : ''}
                <div class="mu-tt-row">📅 Регистрация: <b>${regDate}</b></div>
                ${roles ? `<div class="mu-tt-row">🎭 Роли: <b>${roles}</b></div>` : ''}
            `);

            // Баны
            const bans = Array.isArray(data.ban_info)
                ? data.ban_info
                : (data.ban_info ? [data.ban_info] : []);

            if (bans.length > 0) {
                bans.forEach(ban => {
                    const until = ban.expired_at
                        ? `до ${new Date(ban.expired_at).toLocaleDateString('ru', { day:'2-digit', month:'2-digit', year:'numeric' })}`
                        : 'навсегда';
                    const reason = ban.reason?.label || ban.reason || '—';
                    const type   = ban.type === 'social' ? 'Соц.' : ban.type === 'functional' ? 'Функц.' : '';
                    const banEl  = document.createElement('div');
                    banEl.className = 'mu-tt-banned';
                    MU.setHTML(banEl, `🔨 <b>Забанен ${MU.esc(until)}</b>${type ? ` <span style="opacity:0.6;font-size:10px">(${MU.esc(type)})</span>` : ''}<br><span style="opacity:0.8">${MU.esc(reason)}</span>`);
                    tip.appendChild(banEl);
                });
                tip.style.borderColor = 'rgba(231,76,60,0.4)';
            }

            // Заметка
            renderNoteSection(tip, userId, note);
            positionTooltip(tip, anchorEl);
        });
    }

    function positionTooltip(tip, anchor) {
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        const tipH = tip.offsetHeight || 160;
        const tipW = tip.offsetWidth  || 250;

        let top  = rect.bottom + 6;
        let left = rect.left;

        if (left + tipW > window.innerWidth - 8)  left = window.innerWidth - tipW - 8;
        if (top  + tipH > window.innerHeight - 8)  top  = rect.top - tipH - 6;
        if (left < 8) left = 8;

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
        document.querySelectorAll('a[href*="/user/"]').forEach(attachHover);
    }

    // ==================== INIT ====================

    async function init() {
        injectStyles();
        scanLinks();

        const observer = new MutationObserver(() => scanLinks());
        observer.observe(document.body, { childList: true, subtree: true });

        MU.on('urlChanged', () => {
            setTimeout(scanLinks, 1500);
        });

        MU.log('UserTooltip', 'Модуль запущен');
    }

    return { init };

})();
