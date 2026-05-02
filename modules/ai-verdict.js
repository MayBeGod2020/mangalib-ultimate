// Модуль AI Verdict — анализ комментария через DeepSeek
window.MUAiVerdict = (function () {
    'use strict';

    const MU = window.MULib;
    let settings = null;
    let currentRequest = null;

    const PANEL_ID = 'mu-ai-verdict';

    const RULES_PROMPT = `Ты — помощник модератора на аниме/манга сайте. Тебе дают текст комментария и причину жалобы. Твоя задача — кратко и чётко ответить, нарушает ли комментарий правила.

Правила сайта:
1. Оскорбления — прямые/завуалированные оскорбления пользователей, переводчиков, авторов (от 7 дней)
2. Флуд / Оффтоп — бессмысленные комментарии, капс, дублирование, «ура глава», «а когда глава?» (от 1 дня)
3. Спойлеры — раскрытие сюжета без тега [spoiler] (от 2 дней)
4. Реклама / Спам — ссылки на конкурентов, призывы перейти на другой сайт (от 5 дней)
5. Провокации / Конфликты — политика, религия, конфликты по жанрам (от 3 дней)
6. Ненормативная лексика — текст состоит преимущественно из мата (отдельно)
7. Запрещённый контент — суицид, насилие, пропаганда, сексуальный контент (от 7 дней)
8. Бессмысленная тема (форум) — личные проблемы, глупые вопросы, не та категория (от 1 дня)
9. Дубликат темы (форум) — тема уже существует (от 6 часов)
10. Некорректный заголовок (форум) — заголовок не отражает содержание, капс, мат (от 2 часов)

Ответ строго в формате JSON (без markdown, без блоков кода):
{"verdict":"нарушает"|"не нарушает"|"спорно","rule":"название правила или пусто","confidence":"высокая"|"средняя"|"низкая","reason":"1-2 предложения объяснения"}`;

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
            if (data._commentText && data._reason) {
                analyze(data._commentText, data._reason);
            }
        });

        // Автоскрытие через 30 секунд
        setTimeout(() => document.getElementById(PANEL_ID)?.remove(), 30000);
    }

    // ==================== API ====================

    async function analyze(commentText, reason) {
        const apiKey = settings?.ai?.deepseekKey;
        if (!apiKey) return;

        showPanel('loading');

        const userMessage = `Причина жалобы: ${reason}\n\nТекст комментария:\n${commentText}`;

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
                    model: 'deepseek-v4-flash',
                    messages: [
                        // prefix_cache_id кешируется автоматически по совпадению префикса
                        { role: 'system', content: RULES_PROMPT },
                        { role: 'user',   content: userMessage },
                    ],
                    max_tokens: 200,
                    temperature: 0.1,
                    response_format: { type: 'json_object' }, // гарантированный JSON без markdown
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err?.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const raw  = data.choices?.[0]?.message?.content?.trim() || '';

            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch {
                throw new Error('Не удалось разобрать ответ ИИ');
            }

            showPanel('result', { ...parsed, _commentText: commentText, _reason: reason });

        } catch (err) {
            if (err.name === 'AbortError') return;
            showPanel('error', { message: err.message });
        } finally {
            currentRequest = null;
        }
    }

    // ==================== ИНТЕГРАЦИЯ ====================

    // Вызывается из moderation.js когда открывается попап
    function onPopupOpen(commentText, reason) {
        if (!settings?.ai?.enabled || !settings?.ai?.deepseekKey) return;
        analyze(commentText, reason);
    }

    function onPopupClose() {
        removePanel();
    }

    // ==================== INIT ====================

    async function init() {
        settings = await MU.getSettings();
        MU.on('settingsChanged', s => { settings = s; });
        MU.log('AiVerdict', 'Модуль запущен');
    }

    return { init, onPopupOpen, onPopupClose };

})();
