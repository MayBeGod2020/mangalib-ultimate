// Модуль AI Verdict — анализ комментария через DeepSeek
window.MUAiVerdict = (function () {
    'use strict';

    const MU = window.MULib;
    let settings = null;
    let currentRequest = null;

    const PANEL_ID = 'mu-ai-verdict';

    // Промпт для проверки (причина жалобы известна)
    const VERIFY_PROMPT = `Ты — помощник модератора на аниме/манга сайте. Тебе дают текст комментария и причину жалобы. Твоя задача — кратко и чётко ответить, нарушает ли комментарий правила.

Правила сайта:
1. Оскорбления — прямые/завуалированные оскорбления пользователей, переводчиков, авторов (от 7 дней)
2. Флуд / Оффтоп — бессмысленные комментарии, капс, дублирование, «ура глава», «а когда глава?» (от 1 дня)
3. Спойлеры — раскрытие сюжета без тега [spoiler] (от 2 дней)
4. Реклама / Спам — ссылки на конкурентов, призывы перейти на другой сайт (от 5 дней)
5. Провокации / Конфликты — политика, религия, конфликты по жанрам (от 3 дней)
6. Ненормативная лексика — текст состоит преимущественно из мата (отдельно)
7. Запрещённый контент — суицид, насилие, пропаганда, сексуальный контент (от 7 дней)

Ответ строго в формате JSON (без markdown):
{"verdict":"нарушает"|"не нарушает"|"спорно","rule":"название правила или пусто","confidence":"высокая"|"средняя"|"низкая","reason":"1-2 предложения объяснения","reason_key":""}`;

    // Промпт для автовыбора (причина неизвестна — страница манги)
    const CLASSIFY_PROMPT = `Ты — помощник модератора на аниме/манга сайте. Тебе дают текст комментария. Определи, нарушает ли он правила, и если да — выбери точную причину из списка.

Правила сайта:
1. Оскорбления — прямые/завуалированные оскорбления пользователей, переводчиков, авторов (от 7 дней)
2. Флуд / Оффтоп — бессмысленные комментарии, капс, дублирование, «ура глава», «а когда глава?» (от 1 дня)
3. Спойлеры — раскрытие сюжета без тега [spoiler] (от 2 дней)
4. Реклама / Спам — ссылки на конкурентов, призывы перейти на другой сайт (от 5 дней)
5. Провокации / Конфликты — политика, религия, конфликты по жанрам (от 3 дней)
6. Ненормативная лексика — текст состоит преимущественно из мата (отдельно)
7. Запрещённый контент — суицид, насилие, пропаганда, сексуальный контент (от 7 дней)

Допустимые значения поля reason_key (выбери одно точно из списка или оставь пустым если не нарушает):
"оскорбление пользователей"
"флуд / оффтоп / комментарий без смысла"
"спойлер"
"реклама / спам"
"провокации / конфликты"
"ненормативная лексика"
"запрещенный / непотребный контент"

Ответ строго в формате JSON (без markdown):
{"verdict":"нарушает"|"не нарушает"|"спорно","rule":"название правила или пусто","confidence":"высокая"|"средняя"|"низкая","reason":"1-2 предложения объяснения","reason_key":"точное значение из списка выше или пусто"}`;

    // ==================== UI ====================

    function removePanel() {
        document.getElementById(PANEL_ID)?.remove();
        if (currentRequest) { currentRequest.abort?.(); currentRequest = null; }
    }

    function showPanel(state, data = {}) {
        removePanel();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:999999;
            width:300px;background:#0f0f1a;border-radius:12px;
            box-shadow:0 8px 32px rgba(0,0,0,0.7);
            font-family:-apple-system,sans-serif;font-size:12px;
            border:1px solid #2a2a3e;overflow:hidden;
            animation:mu-ai-slide-in 0.25s ease;
        `;

        if (state === 'loading') {
            panel.style.borderColor = '#2a2a3e';
            panel.innerHTML = `
                <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;color:#aaa;">
                    <span style="display:inline-block;width:16px;height:16px;border:2px solid #444;
                        border-top-color:#f39c12;border-radius:50%;animation:mu-ai-spin 0.8s linear infinite;"></span>
                    <span>ИИ анализирует комментарий…</span>
                    <button onclick="document.getElementById('${PANEL_ID}').remove()"
                        style="margin-left:auto;background:none;border:none;color:#555;cursor:pointer;font-size:16px;padding:0;">✕</button>
                </div>
            `;
        } else if (state === 'result') {
            const colors = {
                'нарушает':     { bg: '#1a0a0a', border: '#e74c3c', badge: '#e74c3c', icon: '🚫' },
                'не нарушает':  { bg: '#0a1a0a', border: '#2ecc71', badge: '#2ecc71', icon: '✅' },
                'спорно':       { bg: '#1a140a', border: '#f39c12', badge: '#f39c12', icon: '⚠️' },
            };
            const c = colors[data.verdict] || colors['спорно'];
            const confColor = { 'высокая': '#2ecc71', 'средняя': '#f39c12', 'низкая': '#e74c3c' };

            panel.style.background   = c.bg;
            panel.style.borderColor  = c.border;
            panel.innerHTML = `
                <div style="padding:10px 14px;border-bottom:1px solid ${c.border}22;
                    display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">${c.icon}</span>
                    <span style="font-weight:700;color:${c.border};font-size:13px;">
                        ${data.verdict.charAt(0).toUpperCase() + data.verdict.slice(1)}
                    </span>
                    ${data.rule ? `<span style="margin-left:4px;color:#aaa;font-size:11px;">· ${data.rule}</span>` : ''}
                    <button onclick="document.getElementById('${PANEL_ID}').remove()"
                        style="margin-left:auto;background:none;border:none;color:#555;cursor:pointer;font-size:16px;padding:0;line-height:1;">✕</button>
                </div>
                <div style="padding:10px 14px;">
                    <div style="color:#ccc;line-height:1.5;margin-bottom:8px;">${data.reason || ''}</div>
                    <div style="color:${confColor[data.confidence] || '#aaa'};font-size:10px;opacity:0.8;">
                        Уверенность: ${data.confidence || '—'}
                    </div>
                </div>
                <div style="padding:0 14px 10px;display:flex;gap:6px;">
                    <button id="mu-ai-rerun"
                        style="flex:1;padding:4px 8px;border-radius:6px;border:1px solid #2a2a3e;
                        background:transparent;color:#aaa;cursor:pointer;font-size:10px;">
                        🔄 Перепроверить
                    </button>
                </div>
            `;
        } else if (state === 'error') {
            panel.style.borderColor = '#e74c3c';
            panel.innerHTML = `
                <div style="padding:12px 14px;color:#e74c3c;display:flex;align-items:center;gap:8px;">
                    <span>⚠️</span>
                    <span style="flex:1;">${data.message || 'Ошибка запроса к ИИ'}</span>
                    <button onclick="document.getElementById('${PANEL_ID}').remove()"
                        style="background:none;border:none;color:#555;cursor:pointer;font-size:16px;padding:0;">✕</button>
                </div>
            `;
        }

        // CSS анимации
        if (!document.getElementById('mu-ai-styles')) {
            const style = document.createElement('style');
            style.id = 'mu-ai-styles';
            style.textContent = `
                @keyframes mu-ai-spin { to { transform: rotate(360deg); } }
                @keyframes mu-ai-slide-in {
                    from { opacity:0; transform:translateY(12px); }
                    to   { opacity:1; transform:translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(panel);

        // Кнопка «Перепроверить»
        document.getElementById('mu-ai-rerun')?.addEventListener('click', () => {
            if (data._commentText !== undefined) {
                analyze(data._commentText, data._reason || '', data._popup || null, data._pageContext || null);
            }
        });

        // Автоскрытие через 30 секунд
        setTimeout(() => document.getElementById(PANEL_ID)?.remove(), 30000);
    }

    // ==================== API ====================

    async function analyze(commentText, reason, popup = null, pageContext = null) {
        const apiKey = settings?.ai?.deepseekKey;
        if (!apiKey) return;

        showPanel('loading');

        const isClassifyMode = !reason; // нет причины — режим автовыбора
        const systemPrompt   = isClassifyMode ? CLASSIFY_PROMPT : VERIFY_PROMPT;

        // Формируем контекстный блок если есть данные о странице
        let contextBlock = '';
        if (pageContext?.title && pageContext.title !== '—') {
            contextBlock += `\nКонтекст страницы:`;
            contextBlock += `\n- Тайтл: ${pageContext.title}`;
            if (pageContext.chapter) contextBlock += `\n- ${pageContext.chapter}`;
            if (pageContext.genres)  contextBlock += `\n- Жанры: ${pageContext.genres}`;
            contextBlock += '\n';
        }

        const userMessage = isClassifyMode
            ? `${contextBlock}Текст комментария:\n${commentText}`
            : `${contextBlock}Причина жалобы: ${reason}\n\nТекст комментария:\n${commentText}`;

        try {
            const controller = new AbortController();
            currentRequest = controller;

            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: userMessage },
                    ],
                    max_tokens: 200,
                    temperature: 0.1,
                    response_format: { type: 'json_object' }, // гарантированный JSON без markdown
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const msg = err?.error?.message || `HTTP ${response.status}`;
                MU.log('AiVerdict', 'API error:', msg, err);
                throw new Error(msg);
            }

            const data = await response.json();
            const raw  = data.choices?.[0]?.message?.content?.trim() || '';

            MU.log('AiVerdict', 'Raw response:', raw);

            // Если пришла ошибка API
            if (data.error) throw new Error(data.error.message || 'Ошибка API');
            if (!raw)       throw new Error('Пустой ответ от модели');

            let parsed;
            try {
                // 1. Прямой парсинг
                parsed = JSON.parse(raw);
            } catch {
                try {
                    // 2. Убираем markdown-блоки ```json ... ```
                    const clean = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
                    parsed = JSON.parse(clean);
                } catch {
                    try {
                        // 3. Вырезаем первый JSON-объект из текста
                        const match = raw.match(/\{[\s\S]*\}/);
                        if (match) parsed = JSON.parse(match[0]);
                        else throw new Error('JSON не найден');
                    } catch {
                        throw new Error(`Ответ: ${raw.substring(0, 100)}`);
                    }
                }
            }

            showPanel('result', { ...parsed, _commentText: commentText, _reason: reason, _popup: popup, _pageContext: pageContext });

            // В режиме автовыбора — подставляем причину в дропдаун попапа
            if (isClassifyMode && parsed.reason_key && popup && document.body.contains(popup)) {
                window.MUModeration?.selectReason(popup, parsed.reason_key);
            }

        } catch (err) {
            if (err.name === 'AbortError') return;
            showPanel('error', { message: err.message });
        } finally {
            currentRequest = null;
        }
    }

    // ==================== ИНТЕГРАЦИЯ ====================

    // Вызывается из moderation.js когда открывается попап
    function onPopupOpen(commentText, reason, popup = null, pageContext = null) {
        if (!settings?.ai?.enabled || !settings?.ai?.deepseekKey) return;
        analyze(commentText, reason, popup, pageContext);
    }

    function onPopupClose() {
        removePanel();
    }

    // ==================== INIT ====================

    // ==================== БАТЧ-СКАНИРОВАНИЕ ====================

    const BATCH_PROMPT = `Ты — помощник модератора аниме/манга сайта. Тебе дан пронумерованный список комментариев. Найди те, что нарушают правила:

1. Оскорбления пользователей, переводчиков, авторов
2. Флуд / оффтоп / бессмысленный текст («ура глава», «а когда?», наборы символов)
3. Спойлеры без тега [spoiler]
4. Реклама / ссылки на конкурентов
5. Провокации, политика, религия
6. Ненормативная лексика (преимущественно мат)
7. Запрещённый контент (насилие, суицид, пропаганда)

Верни ТОЛЬКО JSON без markdown:
{"suspicious":[{"id":1,"reason_key":"оскорбление пользователей","short":"краткое пояснение"},...]}
Если нарушений нет — {"suspicious":[]}`;

    const BATCH_SIZE   = 50;
    let   batchRunning = false;

    function extractText(comment) {
        const el = comment.querySelector('.comment__content');
        if (!el) return '';
        return (el.textContent || el.innerText || '').trim().substring(0, 300);
    }

    const SHORT_LABELS = {
        'оскорбление пользователей':              'Оскорбление',
        'флуд / оффтоп / комментарий без смысла': 'Флуд',
        'спойлер':                                'Спойлер',
        'реклама / спам':                         'Реклама',
        'провокации / конфликты':                 'Провокация',
        'ненормативная лексика':                  'Мат',
        'запрещенный / непотребный контент':      'Запрещённый контент',
    };

    function markComment(comment, reasonKey, short) {
        if (comment.dataset.aiBadged) return;
        comment.dataset.aiBadged = 'true';

        const colors = {
            'оскорбление пользователей':              '#e74c3c',
            'флуд / оффтоп / комментарий без смысла': '#f39c12',
            'спойлер':                                '#9b59b6',
            'реклама / спам':                         '#e67e22',
            'провокации / конфликты':                 '#e67e22',
            'ненормативная лексика':                  '#e74c3c',
            'запрещенный / непотребный контент':      '#c0392b',
        };
        const color = colors[reasonKey] || '#e74c3c';
        const label = SHORT_LABELS[reasonKey] || reasonKey;

        const badge = document.createElement('span');
        badge.dataset.aiBadge = 'true';
        badge.title = short || reasonKey; // полный текст при наведении
        badge.style.cssText = `
            display:inline-flex;align-items:center;gap:3px;
            margin-left:8px;padding:2px 7px;border-radius:10px;
            background:${color}22;border:1px solid ${color};
            color:${color};font-size:10px;font-weight:600;
            cursor:default;vertical-align:middle;
            white-space:nowrap;flex-shrink:0;
        `;
        badge.textContent = `🚩 ${label}`;

        // Вставляем рядом с именем автора
        const head = comment.querySelector('.comment__head, .comment-author__name');
        if (head) {
            head.style.flexWrap = 'nowrap';
            head.style.display  = 'flex';
            head.style.alignItems = 'center';
            head.appendChild(badge);
        }
    }

    function clearBadges() {
        document.querySelectorAll('[data-ai-badge]').forEach(el => el.remove());
        document.querySelectorAll('[data-ai-badged]').forEach(el => delete el.dataset.aiBadged);
    }

    async function batchScanPage() {
        if (batchRunning) return;
        const apiKey = settings?.ai?.deepseekKey;
        if (!apiKey || !settings?.ai?.enabled) {
            alert('Включите ИИ и добавьте API ключ в настройках (⚙️ → 🤖 ИИ)');
            return;
        }

        const comments = [...document.querySelectorAll('.comment')].filter(c => {
            const text = extractText(c);
            return text.length > 3 && !c.dataset.aiBadged;
        });

        if (comments.length === 0) {
            showBatchStatus('Нет новых комментариев для проверки', '#2ecc71');
            return;
        }

        batchRunning = true;
        updateScanButton(true);
        clearBadges();

        let flagged = 0;
        const total = comments.length;

        // Разбиваем на батчи по BATCH_SIZE
        for (let i = 0; i < comments.length; i += BATCH_SIZE) {
            const batch  = comments.slice(i, i + BATCH_SIZE);
            const listed = batch.map((c, idx) => `[${i + idx + 1}] ${extractText(c)}`).join('\n');

            showBatchStatus(`Сканирую ${i + 1}–${Math.min(i + BATCH_SIZE, total)} из ${total}…`, '#f39c12');

            try {
                const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [
                            { role: 'system', content: BATCH_PROMPT },
                            { role: 'user',   content: listed },
                        ],
                        max_tokens: 800,
                        temperature: 0.1,
                        response_format: { type: 'json_object' },
                    }),
                });

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

                const data = await resp.json();
                const raw  = data.choices?.[0]?.message?.content?.trim() || '{}';
                MU.log('AiVerdict', 'Batch raw:', raw);

                let parsed;
                try { parsed = JSON.parse(raw); } catch { parsed = {}; }

                (parsed.suspicious || []).forEach(item => {
                    const globalIdx = item.id - 1; // id начинается с 1
                    const comment   = comments[globalIdx];
                    if (comment) {
                        markComment(comment, item.reason_key, item.short);
                        flagged++;
                    }
                });

            } catch (err) {
                MU.log('AiVerdict', 'Batch error:', err.message);
            }
        }

        batchRunning = false;
        updateScanButton(false);
        showBatchStatus(
            flagged > 0 ? `🚩 Найдено нарушений: ${flagged} из ${total}` : `✅ Нарушений не найдено (${total} комм.)`,
            flagged > 0 ? '#e74c3c' : '#2ecc71'
        );
    }

    // ==================== КНОПКА СКАНИРОВАНИЯ ====================

    const SCAN_BTN_ID   = 'mu-batch-scan-btn';
    const SCAN_STATUS_ID = 'mu-batch-status';

    function showBatchStatus(text, color) {
        let el = document.getElementById(SCAN_STATUS_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = SCAN_STATUS_ID;
            el.style.cssText = `
                position:fixed;bottom:68px;left:24px;z-index:999998;
                padding:8px 14px;border-radius:8px;font-size:12px;
                font-family:-apple-system,sans-serif;font-weight:600;
                box-shadow:0 4px 12px rgba(0,0,0,0.5);
                transition:all 0.3s;
            `;
            document.body.appendChild(el);
        }
        el.textContent = text;
        el.style.background = color + '22';
        el.style.border = `1px solid ${color}`;
        el.style.color  = color;
        clearTimeout(el._timer);
        if (!batchRunning) el._timer = setTimeout(() => el.remove(), 5000);
    }

    function updateScanButton(running) {
        const btn = document.getElementById(SCAN_BTN_ID);
        if (!btn) return;
        btn.textContent = running ? '⏳ Сканирую…' : '🔍 Проверить страницу';
        btn.disabled    = running;
        btn.style.opacity = running ? '0.7' : '1';
    }

    function injectScanButton() {
        if (document.getElementById(SCAN_BTN_ID)) return;

        // Показываем только если включено в настройках и есть комментарии
        // Разрешаем на /moderation/comments, блокируем только на /moderation/ (список жалоб)
        const hasComments      = document.querySelector('.comment__content, .comment__body');
        const isModListPage    = /\/moderation\/?$/.test(location.pathname) ||
                                 /\/moderation\/(?!comments)/.test(location.pathname);
        if (!hasComments || isModListPage) return;
        if (!settings?.ai?.showScanButton) return;

        const btn = document.createElement('button');
        btn.id = SCAN_BTN_ID;
        btn.textContent = '🔍 Проверить страницу';
        btn.style.cssText = `
            position:fixed;bottom:24px;left:24px;z-index:999998;
            padding:7px 14px;border-radius:20px;border:1px solid #f39c12;
            background:rgba(243,156,18,0.12);color:#f39c12;
            font-size:12px;font-weight:600;cursor:pointer;
            font-family:-apple-system,sans-serif;
            box-shadow:0 4px 12px rgba(0,0,0,0.4);
            transition:all 0.2s;
        `;
        btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(243,156,18,0.25)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(243,156,18,0.12)'; });
        btn.addEventListener('click', batchScanPage);
        document.body.appendChild(btn);
    }

    // ==================== INIT ====================

    async function init() {
        settings = await MU.getSettings();
        MU.on('settingsChanged', s => {
            settings = s;
            // Реагируем на изменение галочки showScanButton
            if (!s?.ai?.showScanButton) {
                document.getElementById(SCAN_BTN_ID)?.remove();
                document.getElementById(SCAN_STATUS_ID)?.remove();
            } else {
                setTimeout(injectScanButton, 300);
            }
        });

        // Инжектируем кнопку когда страница готова
        setTimeout(injectScanButton, 2000);
        MU.on('urlChanged', () => {
            document.getElementById(SCAN_BTN_ID)?.remove();
            document.getElementById(SCAN_STATUS_ID)?.remove();
            setTimeout(injectScanButton, 2000);
        });

        MU.log('AiVerdict', 'Модуль запущен');
    }

    return { init, onPopupOpen, onPopupClose };

})();
