// Модуль Forum Analysis — ИИ-анализ тем форума
// Работает на страницах /forum/discussion/*
// Кнопка «🤖 Анализ темы» вставляется рядом с заголовком темы

window.MUForumAnalysis = (function () {
    'use strict';

    const MU = window.MULib;
    let settings = null;

    const PANEL_ID = 'mu-forum-analysis-panel';

    // Промпт для анализа форумной темы
    // {FORUM_RULES} заменяется на правила из настроек
    const FORUM_SYSTEM_PROMPT = `Ты — помощник модератора форума аниме/манга сайта. Тебе дают информацию о теме форума: заголовок, категорию, содержание первого поста и историю банов автора.

Правила форума:
{FORUM_RULES}

Определи, нарушает ли тема правила форума. При оценке учти историю банов автора — повторные нарушения требуют более строгого вердикта.

Ответ строго в формате JSON (без markdown):
{"verdict":"нарушает"|"не нарушает"|"спорно","rule":"название нарушенного правила или пусто","confidence":"высокая"|"средняя"|"низкая","reason":"1-2 предложения объяснения"}`;

    const DEFAULT_FORUM_RULES = `1. Бессмысленная / Пустая тема — семейные проблемы, поиск отношений, глупые вопросы, категория не соответствует содержанию (от 1 дня)
2. Дубликат темы — тема уже существует за последние 2 дня (от 6 часов)
3. Некорректный заголовок — не отражает содержание, капс, символы/эмодзи, нецензурная лексика (от 2 часов)
4. Оскорбления — в адрес пользователей, переводчиков, авторов (от 7 дней)
5. Реклама / Спам — ссылки на конкурентов, призывы перейти (от 5 дней)
6. Провокации — политика, религия, конфликты (от 3 дней)
7. Запрещённый контент — насилие, суицид, пропаганда (от 7 дней)`;

    // ==================== ОПРЕДЕЛЕНИЕ СТРАНИЦЫ ====================

    function isForumPage() {
        return location.href.includes('/forum/discussion/');
    }

    // ==================== СБОР ДАННЫХ ====================

    function getTopicData() {
        // === ЗАГОЛОВОК — несколько уровней fallback ===
        const title = (
            document.querySelector('[class*="jh_by"]') ||
            document.querySelector('.gf_b8') ||
            document.querySelector('h1')
        )?.innerText?.trim() ||
            document.querySelector('meta[property="og:title"]')?.content?.trim() ||
            document.title?.split(/[|—–]/)?.[0]?.trim() ||
            'Без названия';

        // === КАТЕГОРИЯ — ищем ссылку на раздел форума рядом с автором/временем ===
        // На скриншоте: "Поиск тайтлов" — ссылка вида /forum/... рядом с шапкой поста
        const categoryEl = (
            // 1. Цветной span (старый вариант)
            document.querySelector('span[style*="color"]') ||
            // 2. Ссылка на раздел форума, не на главную форума и не "На форум"
            [...document.querySelectorAll('a[href*="/forum/"]')]
                .find(a => {
                    const txt = a.innerText?.trim();
                    return txt &&
                        txt !== 'На форум' &&
                        txt !== 'Форум' &&
                        !a.href.match(/\/forum\/?$/) &&
                        !a.href.includes('/discussion/');
                })
        );
        const category = categoryEl?.innerText?.trim() || 'Общая';

        // === ТЕКСТ ПЕРВОГО ПОСТА ===
        const content = [...document.querySelectorAll('.text-content p.node-paragraph')]
            .map(p => p.innerText?.trim())
            .filter(Boolean)
            .join('\n')
            .substring(0, 800) ||
            (document.querySelector('.text-content') || document.querySelector('.gf_a3'))
                ?.innerText?.substring(0, 800)?.trim() ||
            // Ещё один fallback — просто весь видимый текст поста
            document.querySelector('[class*="gf_a"], [class*="post__body"], [class*="topic__body"]')
                ?.innerText?.substring(0, 800)?.trim() ||
            'Пусто';

        // === АВТОР — ВНЕ шапки/сайдбара ===
        const allUsernames = [
            ...document.querySelectorAll('.user-inline__username, [class*="user-inline__username"]'),
        ];
        const threadAuthorEl = allUsernames.find(el =>
            !el.closest('header, nav, aside, [class*="header"], [class*="sidebar"], [class*="navbar"], [class*="menu"]')
        );
        const authorName = threadAuthorEl?.innerText?.trim() || '—';

        // === userId из ссылки на профиль ===
        const userLink =
            threadAuthorEl?.closest('a[href*="/user/"]') ||
            threadAuthorEl?.parentElement?.querySelector('a[href*="/user/"]') ||
            threadAuthorEl?.parentElement?.closest('a[href*="/user/"]') ||
            document.querySelector('a[href*="/user/"]:not([href*="/bookmarks"]):not([href*="/achievements"])');
        const userId = userLink?.href?.match(/\/user\/(\d+)/)?.[1] || null;

        MU.log('ForumAnalysis', `title="${title}", category="${category}", author="${authorName}", userId=${userId}, content[0..50]="${content.substring(0,50)}"`);
        return { title, category, content, authorName, userId };
    }

    async function fetchBanInfo(userId) {
        if (!userId) return null;
        try {
            const resp = await fetch(`https://api.cdnlibs.org/api/user/${userId}?fields[]=ban_info`);
            if (!resp.ok) return null;
            const json = await resp.json();
            return json?.data?.ban_info || null;
        } catch { return null; }
    }

    function formatBanInfo(banInfo) {
        if (!banInfo) return 'История банов: нет данных';
        const count = banInfo.count ?? 0;
        if (count === 0) return 'История банов: чистая';
        const lastReason = banInfo.last_reason || banInfo.last_ban_reason || 'причина неизвестна';
        return `История банов: ${count} бан(а/ов), последняя причина — «${lastReason}»`;
    }

    // ==================== АНАЛИЗ ====================

    async function runAnalysis() {
        const ai     = settings?.ai || {};
        const apiKey = ai.apiKey || ai.deepseekKey || '';
        if (!ai.enabled || !apiKey) {
            alert('Включите ИИ и добавьте API ключ в настройках (⚙️ → 🤖 ИИ)');
            return;
        }

        showPanel('loading');

        try {
            const { title, category, content, authorName, userId } = getTopicData();

            // Получаем историю банов параллельно
            const banInfo = await fetchBanInfo(userId);

            const forumRules = ai.forumRules?.trim() || DEFAULT_FORUM_RULES;
            const systemPrompt = FORUM_SYSTEM_PROMPT.replace('{FORUM_RULES}', forumRules);

            const userMessage =
                `Заголовок темы: ${title}\n` +
                `Категория: ${category}\n` +
                `Автор: ${authorName}\n` +
                `${formatBanInfo(banInfo)}\n\n` +
                `Содержание первого поста:\n${content}`;

            const controller = new AbortController();
            const raw    = await window.MUAiVerdict.callAI(systemPrompt, userMessage, controller.signal, 280);
            if (!raw)    throw new Error('Пустой ответ от модели');
            const parsed = window.MUAiVerdict.parseJSON(raw);

            showPanel('result', {
                ...parsed,
                _title:      title,
                _authorName: authorName,
                _banInfo:    banInfo,
            });

            // Автопополнение базы примеров (текст = заголовок + начало поста)
            const exampleText = `[Форум] ${title}\n${content.substring(0, 300)}`;
            window.MUExamples?.autoSave(exampleText, parsed, parsed.rule || 'нарушение форума');
        } catch (err) {
            if (err.name === 'AbortError') return;
            showPanel('error', { message: err.message });
        }
    }

    // ==================== UI ====================

    function removePanel() {
        document.getElementById(PANEL_ID)?.remove();
    }

    function showPanel(state, data = {}) {
        removePanel();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:999999;
            width:310px;
            background:var(--background-elevated-1,#fff);
            border-radius:var(--radius-section-block,10px);
            box-shadow:0 8px 32px rgba(0,0,0,0.18);
            font-family:var(--reader-font-family,-apple-system,sans-serif);font-size:12px;
            border:1px solid var(--border-base,#e5e5e5);overflow:hidden;
            animation:mu-forum-slide-in 0.25s ease;
        `;

        if (!document.getElementById('mu-forum-analysis-styles')) {
            const style = document.createElement('style');
            style.id = 'mu-forum-analysis-styles';
            style.textContent = `
                @keyframes mu-forum-slide-in {
                    from { opacity:0; transform:translateY(12px); }
                    to   { opacity:1; transform:translateY(0); }
                }
                @keyframes mu-forum-spin { to { transform:rotate(360deg); } }
            `;
            document.head.appendChild(style);
        }

        const esc = MU.esc;

        if (state === 'loading') {
            MU.setHTML(panel, `
                <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;
                    color:var(--text-secondary,#8a8a8e);">
                    <span style="display:inline-block;width:16px;height:16px;
                        border:2px solid var(--border-base,#e5e5e5);
                        border-top-color:var(--mu-accent,#f39c12);border-radius:50%;
                        animation:mu-forum-spin 0.8s linear infinite;flex-shrink:0;"></span>
                    <span>ИИ анализирует тему форума…</span>
                    <button id="mu-forum-panel-close"
                        style="margin-left:auto;background:none;border:none;
                        color:var(--text-secondary,#8a8a8e);cursor:pointer;font-size:16px;padding:0;">✕</button>
                </div>
            `);

        } else if (state === 'result') {
            const colors = {
                'нарушает':    { bg: 'rgba(231,76,60,0.06)',  border: '#e74c3c', icon: '🚫' },
                'не нарушает': { bg: 'rgba(46,204,113,0.06)', border: '#2ecc71', icon: '✅' },
                'спорно':      { bg: 'rgba(243,156,18,0.06)', border: '#f39c12', icon: '⚠️' },
            };
            const c          = colors[data.verdict] || colors['спорно'];
            const confColor  = { 'высокая': '#2ecc71', 'средняя': '#f39c12', 'низкая': '#e74c3c' };
            const verdictLabel = esc(data.verdict.charAt(0).toUpperCase() + data.verdict.slice(1));
            const banCount     = data._banInfo?.count ?? null;
            const banBadge     = banCount !== null
                ? `<span style="font-size:10px;color:${banCount > 0 ? '#e74c3c' : '#2ecc71'};
                    margin-left:4px;">
                    ${banCount > 0 ? `⚠️ ${banCount} бан(а)` : '✓ банов нет'}
                   </span>`
                : '';

            panel.style.borderColor = c.border;
            MU.setHTML(panel, `
                <div style="padding:10px 14px;border-bottom:1px solid ${c.border}33;
                    background:${c.bg};display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">${c.icon}</span>
                    <span style="font-weight:700;color:${c.border};font-size:13px;">${verdictLabel}</span>
                    ${data.rule
                        ? `<span style="color:var(--text-secondary,#8a8a8e);font-size:11px;">· ${esc(data.rule)}</span>`
                        : ''}
                    <button id="mu-forum-panel-close"
                        style="margin-left:auto;background:none;border:none;
                        color:var(--text-secondary,#8a8a8e);cursor:pointer;font-size:16px;padding:0;line-height:1;">✕</button>
                </div>
                <div style="padding:10px 14px;">
                    <div style="color:var(--text-primary,#212529);line-height:1.5;margin-bottom:6px;">
                        ${esc(data.reason || '')}
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="color:${confColor[data.confidence] || 'var(--text-secondary,#8a8a8e)'};
                            font-size:10px;opacity:0.8;">
                            Уверенность: ${esc(data.confidence || '—')}
                        </span>
                        ${banBadge}
                    </div>
                </div>
                <div style="padding:0 14px 10px;">
                    <button id="mu-forum-rerun"
                        style="width:100%;padding:4px 8px;border-radius:6px;
                        border:1px solid var(--border-base,#e5e5e5);
                        background:transparent;
                        color:var(--text-secondary,#8a8a8e);
                        cursor:pointer;font-size:10px;font-family:inherit;">
                        🔄 Перепроверить
                    </button>
                </div>
            `);

            document.getElementById('mu-forum-rerun')?.addEventListener('click', runAnalysis);

        } else if (state === 'error') {
            panel.style.borderColor = '#e74c3c';
            MU.setHTML(panel, `
                <div style="padding:12px 14px;color:#e74c3c;display:flex;align-items:center;gap:8px;">
                    <span>⚠️</span>
                    <span style="flex:1;">${esc(data.message || 'Ошибка запроса к ИИ')}</span>
                    <button id="mu-forum-panel-close"
                        style="background:none;border:none;
                        color:var(--text-secondary,#8a8a8e);cursor:pointer;font-size:16px;padding:0;">✕</button>
                </div>
            `);
        }

        document.body.appendChild(panel);

        document.getElementById('mu-forum-panel-close')?.addEventListener('click', removePanel);
        setTimeout(() => document.getElementById(PANEL_ID)?.remove(), 40000);
    }

    // ==================== ПУНКТ В МЕНЮ «...» ====================

    const MENU_ITEM_ID = 'mu-forum-analysis-menu-item';

    function injectMenuItem(menuList) {
        if (!isForumPage()) return;
        if (!settings?.ai?.enabled) return;
        if (menuList.querySelector(`#${MENU_ITEM_ID}`)) return;

        const item = document.createElement('div');
        item.id = MENU_ITEM_ID;
        item.className = 'menu-item';

        // Копируем Vue-scoped атрибут (data-v-xxxxxxxx) чтобы сработал CSS сайта
        for (const attr of menuList.attributes) {
            if (attr.name.startsWith('data-v-')) {
                item.setAttribute(attr.name, '');
            }
        }

        // Иконка + текст — структура как у соседних пунктов
        MU.setHTML(item, `
            <span class="menu-item__icon menu-item__icon_left"
                style="display:inline-flex;align-items:center;justify-content:center;
                       font-size:0.875em;width:1em;flex-shrink:0;">🤖</span>
            <div class="menu-item__text">Анализ темы</div>
        `);

        item.style.cursor = 'pointer';

        item.addEventListener('click', () => {
            // Закрываем меню кликом вне его
            document.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            setTimeout(runAnalysis, 80);
        });

        // Вставляем перед «Забанить» (последний пункт) или в конец
        const banItem = [...menuList.querySelectorAll('.menu-item')]
            .find(el => el.textContent?.trim() === 'Забанить');
        if (banItem) {
            menuList.insertBefore(item, banItem);
        } else {
            menuList.appendChild(item);
        }

        MU.log('ForumAnalysis', 'Пункт меню вставлен');
    }

    // ==================== НАБЛЮДАТЕЛЬ ЗА МЕНЮ ====================

    function setupMenuObserver() {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    // Меню может быть самим узлом или внутри него
                    const menuList = node.classList?.contains('menu-list')
                        ? node
                        : node.querySelector?.('.menu-list');
                    if (menuList) injectMenuItem(menuList);
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return observer;
    }

    // ==================== INIT ====================

    async function init() {
        settings = await MU.getSettings();
        MU.on('settingsChanged', s => { settings = s; });

        // Запускаем наблюдатель за появлением меню «...»
        setupMenuObserver();

        MU.log('ForumAnalysis', 'Модуль запущен');
    }

    return { init };

})();
