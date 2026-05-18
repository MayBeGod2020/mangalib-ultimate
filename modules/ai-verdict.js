// Модуль AI Verdict — анализ комментария через выбранный AI-провайдер
window.MUAiVerdict = (function () {
    'use strict';

    const MU = window.MULib;
    let settings = null;
    let currentRequest = null;
    let autoHideTimer = null;
    let batchAborted  = false;

    const PANEL_ID   = 'mu-ai-verdict';
    const CHAT_PROMPT = `Ты — опытный помощник модератора аниме/манга сайта. Тебе дан контекст нарушения и история банов пользователя. Отвечай кратко, по делу, на русском языке. Если спрашивают про срок бана — учитывай количество и тяжесть прошлых нарушений и давай конкретную рекомендацию (например: «1 день», «3 дня», «7 дней», «постоянный»).`;

    // Допустимые значения reason_key — должно совпадать с REASON_MAP в moderation.js
    const VALID_REASON_KEYS = new Set([
        'без причины',
        'оскорбление пользователей',
        'флуд / оффтоп / комментарий без смысла',
        'реклама / спам',
        'спойлер',
        'провокации / конфликты',
        'ненормативная лексика',
        'запрещенный / непотребный контент',
        'бессмысленная / пустая тема',
        'дубликат темы',
        'некорректный заголовок',
        'твинк аккаунт',
    ]);

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

    // ==================== ПРОВАЙДЕРЫ ====================

    const PROVIDERS = {
        deepseek: {
            name:    'DeepSeek',
            url:     'https://api.deepseek.com/v1/chat/completions',
            model:   'deepseek-chat',
            format:  'openai',
            jsonMode: true,
            keyHint: 'platform.deepseek.com/api_keys',
            keyPlaceholder: 'sk-...',
        },
        openai: {
            name:    'ChatGPT (OpenAI)',
            url:     'https://api.openai.com/v1/chat/completions',
            model:   'gpt-4o-mini',
            format:  'openai',
            jsonMode: true,
            keyHint: 'platform.openai.com/api-keys',
            keyPlaceholder: 'sk-...',
        },
        gemini: {
            name:    'Google Gemini',
            url:     'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
            model:   'gemini-2.0-flash',
            format:  'gemini',
            jsonMode: false,
            keyHint: 'aistudio.google.com/apikey',
            keyPlaceholder: 'AIza...',
        },
        claude: {
            name:    'Claude (Anthropic)',
            url:     'https://api.anthropic.com/v1/messages',
            model:   'claude-3-haiku-20240307',
            format:  'anthropic',
            jsonMode: false,
            keyHint: 'console.anthropic.com/settings/keys',
            keyPlaceholder: 'sk-ant-...',
        },
        qwen: {
            name:    'Qwen (Alibaba)',
            url:     'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
            model:   'qwen-turbo',
            format:  'openai',
            jsonMode: true,
            keyHint: 'dashscope.console.aliyun.com',
            keyPlaceholder: 'sk-...',
        },
        grok: {
            name:    'Grok (xAI)',
            url:     'https://api.x.ai/v1/chat/completions',
            model:   'grok-beta',
            format:  'openai',
            jsonMode: true,
            keyHint: 'console.x.ai',
            keyPlaceholder: 'xai-...',
        },
        mistral: {
            name:    'Mistral AI',
            url:     'https://api.mistral.ai/v1/chat/completions',
            model:   'mistral-small-latest',
            format:  'openai',
            jsonMode: false,
            keyHint: 'console.mistral.ai',
            keyPlaceholder: '...',
        },
        groq: {
            name:    'Groq (бесплатный фолбэк)',
            url:     'https://api.groq.com/openai/v1/chat/completions',
            model:   'llama-3.3-70b-versatile',
            format:  'openai',
            jsonMode: true,
            keyHint: 'console.groq.com/keys',
            keyPlaceholder: 'gsk_...',
        },
        custom: {
            name:    'OpenAI-совместимый (кастомный)',
            url:     '', // берётся из настроек ai.customApiUrl
            model:   '', // берётся из настроек ai.customModel
            format:  'openai',
            jsonMode: false,
            keyHint: 'openrouter.ai/keys',
            keyPlaceholder: 'sk-or-...',
        },
    };

    // Универсальный вызов AI — возвращает текст ответа
    // useGroq=true: принудительно использовать Groq (фолбэк при 402/429)
    async function callAI(systemPrompt, userMessage, signal, maxTokens = 300, useGroq = false, noJsonMode = false) {
        const ai = settings?.ai || {};

        let apiKey, provider;
        if (useGroq) {
            apiKey   = ai.groqKey || '';
            provider = PROVIDERS.groq;
            if (!apiKey) throw new Error('Groq API ключ не задан');
        } else {
            apiKey   = ai.apiKey || ai.deepseekKey || ''; // миграция старого ключа
            const provKey = ai.provider || 'deepseek';
            provider = PROVIDERS[provKey] || PROVIDERS.deepseek;

            // Кастомный провайдер — подставляем URL и модель из настроек
            if (provKey === 'custom') {
                const customUrl   = ai.customApiUrl?.trim();
                const customModel = ai.customModel?.trim();
                if (!customUrl)   throw new Error('Укажи URL кастомного провайдера в настройках ИИ');
                if (!customModel) throw new Error('Укажи название модели в настройках ИИ');
                provider = { ...PROVIDERS.custom, url: customUrl, model: customModel };
            }

            // Если основной ключ пуст, но есть Groq — используем Groq как основной
            if (!apiKey && ai.groqKey) {
                return callAI(systemPrompt, userMessage, signal, maxTokens, true);
            }
            if (!apiKey) throw new Error('API ключ не задан');
        }

        // Для провайдеров без jsonMode добавляем напоминание в промпт
        // noJsonMode=true — чат-режим, свободный текст, никаких JSON-инструкций
        const effectiveJsonMode = provider.jsonMode && !noJsonMode;
        const sysPrompt = noJsonMode
            ? systemPrompt
            : effectiveJsonMode
                ? systemPrompt
                : systemPrompt + '\n\nВАЖНО: отвечай ТОЛЬКО чистым JSON без markdown-блоков и пояснений.';

        let url, options;

        if (provider.format === 'openai') {
            url     = provider.url;
            options = {
                method:  'POST',
                signal,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model:       provider.model,
                    messages:    [{ role: 'system', content: sysPrompt }, { role: 'user', content: userMessage }],
                    max_tokens:  maxTokens,
                    temperature: 0.1,
                    ...(effectiveJsonMode ? { response_format: { type: 'json_object' } } : {}),
                }),
            };

        } else if (provider.format === 'gemini') {
            url     = `${provider.url}?key=${apiKey}`;
            options = {
                method:  'POST',
                signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: sysPrompt }] },
                    contents:          [{ role: 'user', parts: [{ text: userMessage }] }],
                    generationConfig:  { maxOutputTokens: maxTokens, temperature: 0.1 },
                }),
            };

        } else if (provider.format === 'anthropic') {
            url     = provider.url;
            options = {
                method:  'POST',
                signal,
                headers: {
                    'Content-Type':      'application/json',
                    'x-api-key':         apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model:      provider.model,
                    system:     sysPrompt,
                    messages:   [{ role: 'user', content: userMessage }],
                    max_tokens: maxTokens,
                }),
            };
        }

        const resp = await fetch(url, options);
        if (!resp.ok) {
            // Автофолбэк на Groq при исчерпании лимита/баланса
            if (!useGroq && (resp.status === 402 || resp.status === 429) && ai.groqKey) {
                MU.log('AiVerdict', `HTTP ${resp.status} — переключаемся на Groq`);
                MU.emit('aiLimitReached');
                return callAI(systemPrompt, userMessage, signal, maxTokens, true);
            }
            const err = await resp.json().catch(() => ({}));
            throw new Error(err?.error?.message || `HTTP ${resp.status}`);
        }

        // Успешный запрос к основному провайдеру — сбрасываем бейдж
        if (!useGroq) MU.emit('aiLimitCleared');

        const data = await resp.json();

        // Извлекаем текст ответа в зависимости от формата
        if (provider.format === 'gemini') {
            return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        } else if (provider.format === 'anthropic') {
            return data.content?.[0]?.text?.trim() || '';
        } else {
            return data.choices?.[0]?.message?.content?.trim() || '';
        }
    }

    // Парсим JSON из ответа (с фолбэками)
    function parseJSON(raw) {
        try { return JSON.parse(raw); } catch {}
        try {
            const clean = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
            return JSON.parse(clean);
        } catch {}
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) try { return JSON.parse(match[0]); } catch {}
        throw new Error(`Не удалось разобрать ответ: ${raw.substring(0, 80)}`);
    }

    // ==================== ИСТОРИЯ БАНОВ ====================

    const BAN_CACHE = {}; // userId → { bans, username, level }

    async function fetchUserBanInfo(userId) {
        if (BAN_CACHE[userId]) return BAN_CACHE[userId];
        try {
            const url = `https://api.cdnlibs.org/api/user/${userId}` +
                `?fields[]=ban_info&fields[]=roles&fields[]=created_at&fields[]=points`;
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const json = await resp.json();
            const d = json.data;
            if (!d) return null;
            const result = {
                username: d.username || d.name || `#${userId}`,
                level:    d.points_info?.level ?? null,
                roles:    (d.roles || []).map(r => r.name || r).join(', '),
                regDate:  d.created_at || null,
                bans:     Array.isArray(d.ban_info) ? d.ban_info : (d.ban_info ? [d.ban_info] : []),
            };
            BAN_CACHE[userId] = result;
            return result;
        } catch { return null; }
    }

    function formatBanHistory(info) {
        if (!info) return 'История банов недоступна.';
        const lines = [
            `Пользователь: ${info.username}`,
            info.level !== null ? `Уровень: ${info.level}` : '',
            info.roles ? `Роли: ${info.roles}` : '',
        ].filter(Boolean);

        if (info.bans.length === 0) {
            lines.push('Банов: нет');
        } else {
            lines.push(`Банов всего: ${info.bans.length}`);
            info.bans.forEach((ban, i) => {
                const reason = ban.reason?.label || ban.reason || '—';
                const until  = ban.expired_at
                    ? `до ${new Date(ban.expired_at).toLocaleDateString('ru')}`
                    : 'навсегда';
                const type   = ban.type === 'social' ? 'соц.' : ban.type === 'functional' ? 'функц.' : ban.type || '';
                lines.push(`  ${i + 1}. ${reason} (${until}${type ? ', ' + type : ''})`);
            });
        }
        return lines.join('\n');
    }

    // ==================== UI ====================

    function removePanel() {
        document.getElementById(PANEL_ID)?.remove();
        if (currentRequest) { currentRequest.abort?.(); currentRequest = null; }
        if (autoHideTimer)  { clearTimeout(autoHideTimer); autoHideTimer = null; }
    }

    function showPanel(state, data = {}) {
        removePanel();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:999999;
            width:300px;
            background:var(--background-elevated-1,#fff);
            border-radius:var(--radius-section-block,10px);
            box-shadow:0 8px 32px rgba(0,0,0,0.18);
            font-family:var(--reader-font-family,-apple-system,sans-serif);font-size:12px;
            border:1px solid var(--border-base,#e5e5e5);overflow:hidden;
            animation:mu-ai-slide-in 0.25s ease;
        `;

        if (state === 'loading') {
            MU.setHTML(panel, `
                <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;
                    color:var(--text-secondary,#8a8a8e);">
                    <span style="display:inline-block;width:16px;height:16px;
                        border:2px solid var(--border-base,#e5e5e5);
                        border-top-color:var(--mu-accent, #f39c12);border-radius:50%;
                        animation:mu-ai-spin 0.8s linear infinite;flex-shrink:0;"></span>
                    <span>ИИ анализирует комментарий…</span>
                    <button id="mu-ai-loading-close"
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
            const c = colors[data.verdict] || colors['спорно'];
            const confColor = { 'высокая': '#2ecc71', 'средняя': '#f39c12', 'низкая': '#e74c3c' };

            const esc = MU.esc;
            const verdictStr   = data.verdict || '';
            const verdictLabel = esc(verdictStr ? verdictStr.charAt(0).toUpperCase() + verdictStr.slice(1) : '—');

            panel.style.background  = `var(--background-elevated-1,#fff)`;
            panel.style.borderColor = c.border;
            MU.setHTML(panel, `
                <div style="padding:10px 14px;border-bottom:1px solid ${c.border}33;
                    background:${c.bg};display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">${c.icon}</span>
                    <span style="font-weight:700;color:${c.border};font-size:13px;">
                        ${verdictLabel}
                    </span>
                    ${data.rule ? `<span style="margin-left:4px;color:var(--text-secondary,#8a8a8e);font-size:11px;">· ${esc(data.rule)}</span>` : ''}
                    <button id="mu-ai-close-btn"
                        style="margin-left:auto;background:none;border:none;
                        color:var(--text-secondary,#8a8a8e);cursor:pointer;font-size:16px;padding:0;line-height:1;">✕</button>
                </div>
                <div style="padding:10px 14px;">
                    <div style="color:var(--text-primary,#212529);line-height:1.5;margin-bottom:8px;">${esc(data.reason || '')}</div>
                    <div style="color:${confColor[data.confidence] || 'var(--text-secondary,#8a8a8e)'};font-size:10px;opacity:0.8;">
                        Уверенность: ${esc(data.confidence || '—')}
                    </div>
                </div>
                <div style="padding:0 14px 10px;display:flex;gap:6px;">
                    <button id="mu-ai-rerun"
                        style="flex:1;padding:4px 8px;border-radius:6px;
                        border:1px solid var(--border-base,#e5e5e5);
                        background:transparent;
                        color:var(--text-secondary,#8a8a8e);
                        cursor:pointer;font-size:10px;font-family:inherit;">
                        🔄 Перепроверить
                    </button>
                    ${data.verdict === 'нарушает' && data.reason_key && data._popup ? `
                    <button id="mu-ai-apply"
                        style="flex:1;padding:4px 8px;border-radius:6px;
                        border:1px solid #e74c3c;
                        background:rgba(231,76,60,0.08);
                        color:#e74c3c;font-weight:600;
                        cursor:pointer;font-size:10px;font-family:inherit;">
                        🔨 Применить
                    </button>` : ''}
                </div>
                <div style="border-top:1px solid var(--border-base,#e5e5e5);padding:8px 14px 10px;">
                    <div id="mu-ai-chat-log" style="
                        max-height:130px;overflow-y:auto;
                        display:flex;flex-direction:column;gap:5px;
                        margin-bottom:6px;
                    "></div>
                    <div style="display:flex;gap:5px;align-items:center;">
                        <input id="mu-ai-chat-input" type="text"
                            placeholder="Спросить ИИ… (срок бана, рекомендации)"
                            style="flex:1;padding:5px 8px;border-radius:6px;
                            border:1px solid var(--border-base,#e5e5e5);
                            background:var(--input-bg,#fff);
                            color:var(--text-primary,#212529);
                            font-size:11px;font-family:inherit;outline:none;
                            transition:border-color 0.15s;">
                        <button id="mu-ai-chat-send" title="Отправить"
                            style="padding:5px 9px;border-radius:6px;
                            border:1px solid var(--mu-accent,#f39c12);
                            background:color-mix(in srgb,var(--mu-accent,#f39c12) 15%,transparent);
                            color:var(--mu-accent,#f39c12);font-size:13px;
                            cursor:pointer;flex-shrink:0;line-height:1;">➤</button>
                    </div>
                </div>
            `);
            document.getElementById('mu-ai-close-btn')?.addEventListener('click', () => {
                document.getElementById(PANEL_ID)?.remove();
            });
        } else if (state === 'error') {
            panel.style.borderColor = '#e74c3c';
            MU.setHTML(panel, `
                <div style="padding:12px 14px;color:#e74c3c;display:flex;align-items:center;gap:8px;">
                    <span>⚠️</span>
                    <span style="flex:1;">${MU.esc(data.message || 'Ошибка запроса к ИИ')}</span>
                    <button id="mu-ai-error-close"
                        style="background:none;border:none;
                        color:var(--text-secondary,#8a8a8e);cursor:pointer;font-size:16px;padding:0;">✕</button>
                </div>
            `);
        }

        // CSS анимации + чат-пузыри
        if (!document.getElementById('mu-ai-styles')) {
            const style = document.createElement('style');
            style.id = 'mu-ai-styles';
            style.textContent = `
                @keyframes mu-ai-spin { to { transform: rotate(360deg); } }
                @keyframes mu-ai-slide-in {
                    from { opacity:0; transform:translateY(12px); }
                    to   { opacity:1; transform:translateY(0); }
                }
                .mu-chat-msg {
                    padding:5px 9px;border-radius:8px;font-size:11px;line-height:1.5;
                    max-width:90%;word-break:break-word;animation:mu-ai-slide-in 0.15s ease;
                }
                .mu-chat-msg.user {
                    align-self:flex-end;
                    background:color-mix(in srgb,var(--mu-accent,#f39c12) 15%,transparent);
                    border:1px solid color-mix(in srgb,var(--mu-accent,#f39c12) 40%,transparent);
                    color:var(--text-primary,#212529);
                }
                .mu-chat-msg.ai {
                    align-self:flex-start;
                    background:var(--background-elevated-2,#f7f7f8);
                    border:1px solid var(--border-base,#e5e5e5);
                    color:var(--text-primary,#212529);
                }
                .mu-chat-msg.loading {
                    align-self:flex-start;
                    background:var(--background-elevated-2,#f7f7f8);
                    border:1px solid var(--border-base,#e5e5e5);
                    color:var(--text-secondary,#8a8a8e);
                    font-style:italic;
                }
                #mu-ai-chat-input:focus {
                    border-color:var(--mu-accent,#f39c12)!important;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(panel);

        // Кнопки закрытия (loading / error / result)
        document.getElementById('mu-ai-loading-close')?.addEventListener('click', () => {
            document.getElementById(PANEL_ID)?.remove();
        });
        document.getElementById('mu-ai-error-close')?.addEventListener('click', () => {
            document.getElementById(PANEL_ID)?.remove();
        });

        // Кнопка «Перепроверить»
        document.getElementById('mu-ai-rerun')?.addEventListener('click', () => {
            if (data._commentText !== undefined) {
                analyze(data._commentText, data._reason || '', data._popup || null, data._pageContext || null);
            }
        });

        // Кнопка «Применить» — вставляет причину в попап бана
        document.getElementById('mu-ai-apply')?.addEventListener('click', () => {
            MU.emit('aiApplyVerdict', { reasonKey: data.reason_key, popup: data._popup });
            document.getElementById(PANEL_ID)?.remove();
        });

        // Чат с ИИ
        if (state === 'result') {
            const chatInput = panel.querySelector('#mu-ai-chat-input');
            const chatSend  = panel.querySelector('#mu-ai-chat-send');
            const chatLog   = panel.querySelector('#mu-ai-chat-log');

            // Извлекаем userId автора из popup-элемента
            const authorLink = data._popup?.querySelector('a[href*="/user/"]');
            const authorMatch = authorLink?.href?.match(/\/user\/(\d+)/);
            const authorId    = authorMatch?.[1] || null;

            let banInfoCache  = null;
            let chatBusy      = false;

            function appendMsg(text, cls) {
                const div = document.createElement('div');
                div.className = `mu-chat-msg ${cls}`;
                div.textContent = text;
                chatLog.appendChild(div);
                chatLog.scrollTop = chatLog.scrollHeight;
                return div;
            }

            async function sendChatMessage() {
                const question = chatInput?.value?.trim();
                if (!question || chatBusy) return;

                chatBusy = true;
                chatInput.value = '';
                chatSend.disabled = true;
                chatSend.style.opacity = '0.5';

                appendMsg(question, 'user');
                const loadingEl = appendMsg('ИИ думает…', 'loading');

                try {
                    // Один раз подгружаем историю банов
                    if (authorId && banInfoCache === null) {
                        banInfoCache = await fetchUserBanInfo(authorId);
                    }

                    const banBlock = authorId
                        ? `\n\nИстория банов:\n${formatBanHistory(banInfoCache)}`
                        : '';

                    const contextMsg = [
                        `Комментарий: ${data._commentText || '—'}`,
                        `Вердикт ИИ: ${data.verdict || '—'}`,
                        data.rule ? `Правило: ${data.rule}` : '',
                        data.reason ? `Объяснение: ${data.reason}` : '',
                        banBlock,
                        `\nВопрос модератора: ${question}`,
                    ].filter(Boolean).join('\n');

                    const answer = await callAI(CHAT_PROMPT, contextMsg, null, 200, false, true);

                    loadingEl.remove();
                    appendMsg(answer || 'Нет ответа', 'ai');

                    // Если панель скрыта автотаймером — продлеваем
                    if (autoHideTimer) {
                        clearTimeout(autoHideTimer);
                        autoHideTimer = setTimeout(() => {
                            document.getElementById(PANEL_ID)?.remove();
                            autoHideTimer = null;
                        }, 30000);
                    }
                } catch (e) {
                    loadingEl.remove();
                    appendMsg(`Ошибка: ${e.message}`, 'ai');
                } finally {
                    chatBusy = false;
                    if (chatSend) { chatSend.disabled = false; chatSend.style.opacity = '1'; }
                }
            }

            chatSend?.addEventListener('click', sendChatMessage);
            chatInput?.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
            });
        }

        // Webhook уведомление при вердикте «нарушает» с высокой уверенностью
        if (data.verdict === 'нарушает' && data.confidence === 'высокая') {
            sendWebhookNotification(data);
        }

        // Автоскрытие через 30 секунд — сохраняем taskId чтобы можно было отменить
        if (autoHideTimer) clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(() => {
            document.getElementById(PANEL_ID)?.remove();
            autoHideTimer = null;
        }, 30000);
    }

    // ==================== WEBHOOK ====================

    async function sendWebhookNotification(data) {
        const webhookUrl = settings?.ai?.webhookUrl?.trim();
        if (!webhookUrl) return;

        const commentPreview = (data._commentText || '').slice(0, 200);
        const pageUrl = location.href;
        const siteName = MU.getCurrentSite().name;

        // Определяем формат по URL — Discord или Telegram
        const isDiscord  = webhookUrl.includes('discord.com/api/webhooks');
        const isTelegram = webhookUrl.includes('api.telegram.org');

        try {
            if (isDiscord) {
                await MU.bgFetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        embeds: [{
                            title: `🚫 Нарушение на ${siteName}`,
                            description: `**Правило:** ${data.rule || '—'}\n**Причина:** ${data.reason || '—'}\n\n> ${commentPreview}`,
                            color: 0xe74c3c,
                            fields: [
                                { name: 'Уверенность', value: data.confidence || '—', inline: true },
                                { name: 'Страница', value: `[Открыть](${pageUrl})`, inline: true },
                            ],
                            footer: { text: 'Mangalib Ultimate Helper' },
                        }]
                    })
                });
            } else if (isTelegram) {
                // Telegram: GET с text в URL (аналогично браузерному тесту)
                const text = [
                    `🚫 Нарушение на ${siteName}`,
                    `Правило: ${data.rule || '—'}`,
                    `Причина: ${data.reason || '—'}`,
                    `Уверенность: ${data.confidence || '—'}`,
                    '',
                    commentPreview,
                    '',
                    pageUrl,
                ].join('\n');
                const sep = webhookUrl.includes('?') ? '&' : '?';
                await MU.bgFetch(
                    `${webhookUrl}${sep}text=${encodeURIComponent(text)}`,
                    { method: 'GET' }
                );
            } else {
                // ntfy.sh и любой другой HTTP webhook — POST с текстом в теле
                // ntfy.sh: https://ntfy.sh/<topic>  (не заблокирован в РФ, есть приложение)
                const text = [
                    `🚫 Нарушение на ${siteName}`,
                    `Правило: ${data.rule || '—'}`,
                    `Причина: ${data.reason || '—'}`,
                    `Уверенность: ${data.confidence || '—'}`,
                    '',
                    commentPreview,
                    '',
                    pageUrl,
                ].join('\n');
                await MU.bgFetch(webhookUrl, {
                    method:  'POST',
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Title':        `Нарушение на ${siteName}`,
                        'Tags':         'warning',
                    },
                    body: text,
                });
            }
        } catch (e) {
            MU.log('AiVerdict', 'Webhook error:', e);
        }
    }

    // ==================== API ====================

    async function analyze(commentText, reason, popup = null, pageContext = null) {
        const ai = settings?.ai || {};
        if (!ai.apiKey && !ai.deepseekKey && !ai.groqKey) return;

        showPanel('loading');

        const isClassifyMode = !reason;
        const systemPrompt   = isClassifyMode ? CLASSIFY_PROMPT : VERIFY_PROMPT;

        let contextBlock = '';
        if (pageContext?.title && pageContext.title !== '—') {
            contextBlock += `\nКонтекст страницы:\n- Тайтл: ${pageContext.title}`;
            if (pageContext.chapter) contextBlock += `\n- ${pageContext.chapter}`;
            if (pageContext.genres)  contextBlock += `\n- Жанры: ${pageContext.genres}`;
            contextBlock += '\n';
        }
        const userMessage = isClassifyMode
            ? `${contextBlock}Текст комментария:\n${commentText}`
            : `${contextBlock}Причина жалобы: ${reason}\n\nТекст комментария:\n${commentText}`;

        try {
            const controller = new AbortController();
            currentRequest   = controller;

            // Few-shot: добавляем релевантные примеры в системный промпт
            let enhancedPrompt = systemPrompt;
            if (window.MUExamples) {
                const fewShot = await window.MUExamples.buildFewShot(reason || '').catch(() => '');
                if (fewShot) enhancedPrompt += fewShot;
            }

            const raw    = await callAI(enhancedPrompt, userMessage, controller.signal, 250);
            if (!raw)    throw new Error('Пустой ответ от модели');
            const parsed = parseJSON(raw);

            showPanel('result', { ...parsed, _commentText: commentText, _reason: reason, _popup: popup, _pageContext: pageContext });

            if (isClassifyMode
                && typeof parsed.reason_key === 'string'
                && VALID_REASON_KEYS.has(parsed.reason_key.toLowerCase().trim())
                && popup
                && document.body.contains(popup)
            ) {
                window.MUModeration?.selectReason(popup, parsed.reason_key);
            }

            // Автопополнение базы примеров
            window.MUExamples?.autoSave(commentText, parsed, parsed.reason_key || reason);
        } catch (err) {
            if (err.name === 'AbortError') return;
            showPanel('error', { message: err.message });
        } finally {
            currentRequest = null;
        }
    }

    // ==================== ИНТЕГРАЦИЯ ====================

    function onPopupOpen(commentText, reason, popup = null, pageContext = null) {
        const ai = settings?.ai || {};
        if (!ai.enabled || (!ai.apiKey && !ai.deepseekKey && !ai.groqKey)) return;
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
        const ai     = settings?.ai || {};
        const apiKey = ai.apiKey || ai.deepseekKey || ai.groqKey;
        if (!apiKey || !ai.enabled) {
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

        batchRunning  = true;
        batchAborted  = false;
        updateScanButton(true);
        clearBadges();

        let flagged = 0;
        const total = comments.length;

        // Разбиваем на батчи по BATCH_SIZE
        for (let i = 0; i < comments.length; i += BATCH_SIZE) {
            if (batchAborted) break;

            const batch  = comments.slice(i, i + BATCH_SIZE);
            const listed = batch.map((c, idx) => `[${i + idx + 1}] ${extractText(c)}`).join('\n');

            showBatchStatus(`Сканирую ${i + 1}–${Math.min(i + BATCH_SIZE, total)} из ${total}…`, '#f39c12');

            try {
                const raw = await callAI(BATCH_PROMPT, listed, null, 1000).catch(() => '{}');
                if (batchAborted) break;

                let parsed;
                try { parsed = parseJSON(raw); } catch { parsed = {}; }

                (parsed.suspicious || []).forEach(item => {
                    const globalIdx = item.id - 1; // id начинается с 1
                    const comment   = comments[globalIdx];
                    if (comment) {
                        markComment(comment, item.reason_key, item.short);
                        flagged++;
                        // Webhook — уведомляем о каждом найденном нарушении
                        sendWebhookNotification({
                            verdict:    'нарушает',
                            confidence: 'высокая',
                            rule:       item.reason_key,
                            reason:     item.short || item.reason_key,
                            _commentText: extractText(comment),
                        });
                    }
                });

            } catch (err) {
                MU.log('AiVerdict', 'Batch error:', err.message);
            }
        }

        batchRunning = false;
        updateScanButton(false);
        if (batchAborted) {
            showBatchStatus(`⏹ Сканирование остановлено (${flagged} из ${total})`, '#95a5a6');
        } else {
            showBatchStatus(
                flagged > 0 ? `🚩 Найдено нарушений: ${flagged} из ${total}` : `✅ Нарушений не найдено (${total} комм.)`,
                flagged > 0 ? '#e74c3c' : '#2ecc71'
            );
        }
    }

    // ==================== БЕЙДЖ «API лимит» ====================

    const LIMIT_BADGE_ID = 'mu-ai-limit-badge';

    function showLimitBadge() {
        if (document.getElementById(LIMIT_BADGE_ID)) return;
        const badge = document.createElement('div');
        badge.id = LIMIT_BADGE_ID;
        badge.style.cssText = `
            position:fixed;top:52px;right:16px;z-index:99999;
            padding:6px 10px 6px 12px;border-radius:20px;
            background:rgba(231,76,60,0.12);border:1px solid #e74c3c;
            color:#e74c3c;font-size:11px;font-weight:600;
            font-family:var(--reader-font-family,-apple-system,sans-serif);
            box-shadow:0 4px 12px rgba(0,0,0,0.15);
            display:flex;align-items:center;gap:6px;
            animation:mu-ai-slide-in 0.25s ease;
        `;
        const text = document.createElement('span');
        text.textContent = '⚠️ API лимит — переключено на Groq';
        badge.appendChild(text);
        const close = document.createElement('button');
        close.textContent = '✕';
        close.style.cssText = `background:none;border:none;color:#e74c3c;cursor:pointer;
            font-size:14px;padding:0;line-height:1;flex-shrink:0;`;
        close.addEventListener('click', hideLimitBadge);
        badge.appendChild(close);
        document.body.appendChild(badge);
    }

    function hideLimitBadge() {
        document.getElementById(LIMIT_BADGE_ID)?.remove();
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
                padding:8px 14px;
                border-radius:var(--radius-section-block,8px);
                font-size:12px;
                font-family:var(--reader-font-family,-apple-system,sans-serif);
                font-weight:600;
                box-shadow:0 4px 12px rgba(0,0,0,0.15);
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
            padding:7px 14px;border-radius:20px;
            border:1px solid var(--mu-accent, #f39c12);
            background:color-mix(in srgb, var(--mu-accent, #f39c12) 12%, transparent);
            color:var(--mu-accent, #f39c12);
            font-size:12px;font-weight:600;cursor:pointer;
            font-family:var(--reader-font-family,-apple-system,sans-serif);
            box-shadow:0 4px 12px rgba(0,0,0,0.15);
            transition:all 0.2s;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'color-mix(in srgb, var(--mu-accent, #f39c12) 25%, transparent)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'color-mix(in srgb, var(--mu-accent, #f39c12) 12%, transparent)';
        });
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

        MU.on('aiLimitReached', showLimitBadge);
        MU.on('aiLimitCleared', hideLimitBadge);

        // Инжектируем кнопку когда страница готова
        setTimeout(injectScanButton, 2000);
        MU.on('urlChanged', () => {
            // Прерываем активное батч-сканирование при смене страницы
            if (batchRunning) batchAborted = true;
            document.getElementById(SCAN_BTN_ID)?.remove();
            document.getElementById(SCAN_STATUS_ID)?.remove();
            setTimeout(injectScanButton, 2000);
        });

        MU.log('AiVerdict', 'Модуль запущен');
    }

    // Экспортируем для использования в других модулях (forum-analysis и др.)
    return { init, onPopupOpen, onPopupClose, callAI, parseJSON };

})();
