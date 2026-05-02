// Модуль Settings UI — кнопка шестерёнки и панель настроек
// Управляет всеми настройками расширения

window.MUSettingsUI = (function () {
    'use strict';

    const MU = window.MULib;

    let settings = null;
    let isPanelOpen = false;
    let activeTab = 'moderation';

    // ==================== СТИЛИ ====================

    function injectStyles() {
        if (document.getElementById('mu-settings-styles')) return;

        const style = document.createElement('style');
        style.id = 'mu-settings-styles';
        style.textContent = `
            #mu-settings-toggle {
                background:#1a1a2e;border:1px solid #f39c12;border-radius:50%;
                width:32px;height:32px;color:#f39c12;cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                font-size:16px;box-shadow:0 2px 8px rgba(243,156,18,0.3);
                transition:all 0.2s;font-family:-apple-system,sans-serif;
                padding:0;
            }
            #mu-settings-toggle:hover {
                transform: rotate(45deg);
                background: rgba(243,156,18,0.15);
            }
            #mu-settings-panel {
                display:none;
                position:fixed;top:50px;right:16px;width:380px;
                max-height:80vh;background:#0f0f1a;border:1px solid #2a2a3e;
                border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.6);
                overflow:hidden;z-index:99998;font-family:-apple-system,sans-serif;
                font-size:12px;flex-direction:column;
            }
            #mu-settings-panel.open { display:flex !important; }
            .mu-settings-header {
                padding:12px 16px;background:#12122a;border-bottom:1px solid #1e1e2e;
                display:flex;justify-content:space-between;align-items:center;
            }
            .mu-settings-title { color:#f39c12;font-weight:700;font-size:14px; }
            .mu-settings-close {
                background:none;border:none;color:#666;cursor:pointer;
                font-size:18px;padding:0;width:24px;height:24px;
            }
            .mu-settings-close:hover { color:#fff; }
            .mu-settings-tabs {
                display:flex;background:#0a0a1a;border-bottom:1px solid #1e1e2e;
                overflow-x:auto;
            }
            .mu-settings-tab {
                padding:10px 14px;background:none;border:none;color:#666;
                cursor:pointer;font-size:11px;border-bottom:2px solid transparent;
                white-space:nowrap;transition:color 0.15s;
            }
            .mu-settings-tab:hover { color:#aaa; }
            .mu-settings-tab.active { color:#f39c12;border-bottom-color:#f39c12; }
            .mu-settings-content {
                flex:1;overflow-y:auto;padding:14px 16px;
            }
            .mu-settings-content::-webkit-scrollbar { width:4px; }
            .mu-settings-content::-webkit-scrollbar-track { background:#0f0f1a; }
            .mu-settings-content::-webkit-scrollbar-thumb { background:#333;border-radius:2px; }

            .mu-setting-row {
                display:flex;justify-content:space-between;align-items:center;
                padding:8px 0;border-bottom:1px solid #1a1a2e;
            }
            .mu-setting-row:last-child { border-bottom:none; }
            .mu-setting-label {
                color:#ccc;font-size:12px;flex:1;padding-right:10px;
            }
            .mu-setting-desc {
                color:#555;font-size:10px;margin-top:2px;
            }

            /* Toggle button */
            .mu-toggle {
                position:relative;flex-shrink:0;cursor:pointer;
            }
            .mu-toggle input { display:none; }
            .mu-toggle-slider {
                display:inline-flex;align-items:center;justify-content:center;
                padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;
                letter-spacing:0.3px;transition:all 0.2s;user-select:none;
                border:1px solid #2a2a3e;background:#1a1a2e;color:#555;
                min-width:60px;
            }
            .mu-toggle-slider::before { content: 'ВЫКЛ'; }
            .mu-toggle input:checked + .mu-toggle-slider {
                background:rgba(243,156,18,0.15);border-color:#f39c12;color:#f39c12;
            }
            .mu-toggle input:checked + .mu-toggle-slider::before { content: 'ВКЛ'; }

            /* Select */
            .mu-select {
                background:#1a1a2e;border:1px solid #2a2a3e;color:#ccc;
                padding:4px 8px;border-radius:4px;font-size:11px;cursor:pointer;
                min-width:100px;
            }

            /* Input */
            .mu-input {
                background:#1a1a2e;border:1px solid #2a2a3e;color:#ccc;
                padding:4px 8px;border-radius:4px;font-size:11px;
                width:100%;box-sizing:border-box;
            }
            .mu-input[type="color"] {
                width:32px;height:24px;padding:2px;cursor:pointer;
            }
            .mu-input[type="range"] {
                cursor:pointer;
            }

            /* Section title */
            .mu-section-title {
                color:#f39c12;font-size:11px;text-transform:uppercase;
                letter-spacing:0.5px;font-weight:600;margin-top:14px;margin-bottom:6px;
            }
            .mu-section-title:first-child { margin-top:0; }

            /* Buttons */
            .mu-btn {
                background:#1a1a2e;border:1px solid #f39c12;color:#f39c12;
                padding:5px 12px;border-radius:6px;cursor:pointer;font-size:11px;
                font-family:inherit;
            }
            .mu-btn:hover { background:rgba(243,156,18,0.1); }
            .mu-btn-danger {
                border-color:#e74c3c;color:#e74c3c;
            }
            .mu-btn-danger:hover { background:rgba(231,76,60,0.1); }

            /* Wallpaper preview */
            .mu-wallpaper-preview {
                width:100%;height:80px;background:#1a1a2e;border:1px dashed #2a2a3e;
                border-radius:6px;margin-top:6px;background-size:cover;
                background-position:center;display:flex;align-items:center;
                justify-content:center;color:#555;font-size:10px;
            }
        `;
        document.head.appendChild(style);
    }

    // ==================== СОЗДАНИЕ КНОПКИ ====================

    function createSettingsButton() {
        if (document.getElementById('mu-settings-toggle')) return null;

        const btn = document.createElement('button');
        btn.id = 'mu-settings-toggle';
        btn.title = 'Настройки';
        btn.textContent = '⚙';
        btn.addEventListener('click', toggleSettings);
        return btn;
    }

    // ==================== СОЗДАНИЕ ПАНЕЛИ ====================

    function createSettingsPanel() {
        if (document.getElementById('mu-settings-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'mu-settings-panel';
        panel.innerHTML = `
            <div class="mu-settings-header">
                <span class="mu-settings-title">⚙️ Настройки</span>
                <button class="mu-settings-close" id="mu-settings-close-btn">✕</button>
            </div>
            <div class="mu-settings-tabs" id="mu-settings-tabs"></div>
            <div class="mu-settings-content" id="mu-settings-content"></div>
        `;
        document.body.appendChild(panel);

        document.getElementById('mu-settings-close-btn').addEventListener('click', () => {
            panel.classList.remove('open');
            isPanelOpen = false;
        });

        // Закрытие по клику вне (с задержкой чтобы не закрывать сразу при создании)
        setTimeout(() => {
            document.addEventListener('click', (e) => {
                if (e.target.closest('#mu-settings-toggle')) return;
                if (e.target.closest('#mu-settings-panel')) return;
                if (e.target.closest('#mu-dashboard-toggle')) return;
                if (e.target.closest('#mu-dashboard-panel')) return;
                if (isPanelOpen) {
                    panel.classList.remove('open');
                    isPanelOpen = false;
                }
            });
        }, 500);

        renderTabs();
        renderTab('moderation');
    }

    function toggleSettings() {
        const panel = document.getElementById('mu-settings-panel');
        if (!panel) return;
        isPanelOpen = !panel.classList.contains('open');
        panel.classList.toggle('open');
    }

    // ==================== ВКЛАДКИ ====================

    function renderTabs() {
        const tabsEl = document.getElementById('mu-settings-tabs');
        if (!tabsEl) return;

        const tabs = [
            { id: 'moderation', label: '🛡️ Модерация' },
            { id: 'dashboard', label: '📊 Панель' },
            { id: 'reader', label: '📖 Чтение' },
            { id: 'personalization', label: '🎨 Темы' },
            { id: 'ai', label: '🤖 ИИ' },
        ];

        tabsEl.innerHTML = tabs.map(t => `
            <button class="mu-settings-tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
                ${t.label}
            </button>
        `).join('');

        tabsEl.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTab = btn.dataset.tab;
                tabsEl.querySelectorAll('.mu-settings-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderTab(activeTab);
            });
        });
    }

    // ==================== РЕНДЕР ВКЛАДОК ====================

    function renderTab(tabId) {
        const contentEl = document.getElementById('mu-settings-content');
        if (!contentEl) return;

        if (tabId === 'moderation') contentEl.innerHTML = renderModerationTab();
        if (tabId === 'dashboard') contentEl.innerHTML = renderDashboardTab();
        if (tabId === 'reader') contentEl.innerHTML = renderReaderTab();
        if (tabId === 'personalization') contentEl.innerHTML = renderPersonalizationTab();
        if (tabId === 'ai') contentEl.innerHTML = renderAiTab();

        attachListeners(tabId);
    }

    function renderToggle(section, key, checked) {
        return `
            <label class="mu-toggle">
                <input type="checkbox" data-section="${section}" data-key="${key}" ${checked ? 'checked' : ''}>
                <span class="mu-toggle-slider"></span>
            </label>
        `;
    }

    function renderModerationTab() {
        const m = settings.moderation;
        return `
            <div class="mu-section-title">Включение</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Включить модуль модерации</div>
                    <div class="mu-setting-desc">Главный переключатель</div>
                </div>
                ${renderToggle('moderation', 'enabled', m.enabled)}
            </div>

            <div class="mu-section-title">Попап бана</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Автозаполнение попапа</div>
                    <div class="mu-setting-desc">Автоматически вставлять текст комментария модератора</div>
                </div>
                ${renderToggle('moderation', 'autoFillPopup', m.autoFillPopup)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Шпаргалка правил</div>
                    <div class="mu-setting-desc">Показывать правила и кликабельные пункты</div>
                </div>
                ${renderToggle('moderation', 'cheatsheet', m.cheatsheet)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Автонажатие "Забанить"</div>
                    <div class="mu-setting-desc">Сразу включать чекбокс бана при открытии</div>
                </div>
                ${renderToggle('moderation', 'autoCheckBan', m.autoCheckBan)}
            </div>

            <div class="mu-section-title">Список жалоб</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Цветовая кодировка</div>
                    <div class="mu-setting-desc">Подсвечивать карточки по типу нарушения</div>
                </div>
                ${renderToggle('moderation', 'colorizeCards', m.colorizeCards)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Автоскролл к следующей</div>
                    <div class="mu-setting-desc">После закрытия попапа прокрутить к следующей жалобе</div>
                </div>
                ${renderToggle('moderation', 'autoScrollToNext', m.autoScrollToNext)}
            </div>
        `;
    }

    function renderDashboardTab() {
        const d = settings.dashboard;
        return `
            <div class="mu-section-title">Включение</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Включить панель модераторов</div>
                    <div class="mu-setting-desc">Кнопка "📊 Панель" с онлайн статусами</div>
                </div>
                ${renderToggle('dashboard', 'enabled', d.enabled)}
            </div>

            <div class="mu-section-title">Параметры</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Интервал обновления</div>
                    <div class="mu-setting-desc">Как часто обновлять онлайн статусы</div>
                </div>
                <select class="mu-select" data-section="dashboard" data-key="updateInterval">
                    <option value="5"  ${d.updateInterval === 5 ? 'selected' : ''}>5 мин</option>
                    <option value="15" ${d.updateInterval === 15 ? 'selected' : ''}>15 мин</option>
                    <option value="30" ${d.updateInterval === 30 ? 'selected' : ''}>30 мин</option>
                </select>
            </div>
        `;
    }

    function renderReaderTab() {
        const r = settings.reader;
        return `
            <div class="mu-section-title">Автоскролл</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Включить автоскролл</div>
                    <div class="mu-setting-desc">Кнопка ▼ на страницах чтения манхвы</div>
                </div>
                ${renderToggle('reader', 'enabled', r.enabled)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Скорость скролла</div>
                    <div class="mu-setting-desc">Быстрота прокрутки</div>
                </div>
                <select class="mu-select" data-section="reader" data-key="scrollSpeed">
                    <option value="slow"   ${r.scrollSpeed === 'slow' ? 'selected' : ''}>Медленно</option>
                    <option value="medium" ${r.scrollSpeed === 'medium' ? 'selected' : ''}>Средне</option>
                    <option value="fast"   ${r.scrollSpeed === 'fast' ? 'selected' : ''}>Быстро</option>
                </select>
            </div>
        `;
    }

    function renderPersonalizationTab() {
        const p = settings.personalization;
        const themes = window.MUPersonalization?.getPresetThemes() || {};

        return `
            <div class="mu-section-title">Включение</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Включить персонализацию</div>
                    <div class="mu-setting-desc">Применять настройки тем и шрифтов</div>
                </div>
                ${renderToggle('personalization', 'enabled', p.enabled)}
            </div>

            <div class="mu-section-title">Тема</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Готовая тема</div>
                    <div class="mu-setting-desc">Выберите цветовую схему</div>
                </div>
                <select class="mu-select" data-section="personalization" data-key="theme">
                    ${Object.entries(themes).map(([k, t]) => `
                        <option value="${k}" ${p.theme === k ? 'selected' : ''}>${t.name}</option>
                    `).join('')}
                </select>
            </div>

            <div class="mu-section-title">Акцентный цвет</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Кастомный цвет</div>
                    <div class="mu-setting-desc">Перебивает цвет темы (пусто = не менять)</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center">
                    <input type="color" class="mu-input" data-section="personalization" data-key="accentColor"
                           value="${p.accentColor || '#9b59b6'}">
                    <button class="mu-btn" id="mu-clear-accent" style="font-size:9px;padding:3px 6px">Сброс</button>
                </div>
            </div>

            <div class="mu-section-title">Кастомный фон</div>
            <div class="mu-setting-row" style="flex-direction:column;align-items:stretch">
                <div>
                    <div class="mu-setting-label">Загрузить обои</div>
                    <div class="mu-setting-desc">Изображение фона или URL</div>
                </div>
                <input type="file" class="mu-input" id="mu-wallpaper-file" accept="image/*" style="margin-top:6px">
                <input type="text" class="mu-input" id="mu-wallpaper-url" placeholder="Или вставьте URL изображения"
                       value="${(p.customWallpaper && p.customWallpaper.startsWith('http')) ? p.customWallpaper : ''}"
                       style="margin-top:6px">
                ${p.customWallpaper ? `
                    <div class="mu-wallpaper-preview" style="background-image:url('${p.customWallpaper}')">
                        ${p.customWallpaper.startsWith('data:') ? 'Загруженное изображение' : ''}
                    </div>
                    <button class="mu-btn mu-btn-danger" id="mu-clear-wallpaper" style="margin-top:6px;font-size:10px">Удалить фон</button>
                ` : ''}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Прозрачность фона</div>
                    <div class="mu-setting-desc">${Math.round((p.wallpaperOpacity || 0.3) * 100)}%</div>
                </div>
                <input type="range" class="mu-input" data-section="personalization" data-key="wallpaperOpacity"
                       min="0.05" max="1" step="0.05" value="${p.wallpaperOpacity || 0.3}" style="width:100px">
            </div>

            <div class="mu-section-title">Шрифт глав ранобе</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Семейство шрифтов</div>
                    <div class="mu-setting-desc">Применяется к тексту глав ранобе</div>
                </div>
                <select class="mu-select" data-section="personalization" data-key="ranobeFontFamily">
                    <option value=""                            ${!p.ranobeFontFamily ? 'selected' : ''}>По умолчанию</option>
                    <option value="'Georgia', serif"            ${p.ranobeFontFamily === "'Georgia', serif" ? 'selected' : ''}>Georgia</option>
                    <option value="'Times New Roman', serif"    ${p.ranobeFontFamily === "'Times New Roman', serif" ? 'selected' : ''}>Times New Roman</option>
                    <option value="'Merriweather', serif"       ${p.ranobeFontFamily === "'Merriweather', serif" ? 'selected' : ''}>Merriweather</option>
                    <option value="'Roboto Slab', serif"        ${p.ranobeFontFamily === "'Roboto Slab', serif" ? 'selected' : ''}>Roboto Slab</option>
                    <option value="'Open Sans', sans-serif"     ${p.ranobeFontFamily === "'Open Sans', sans-serif" ? 'selected' : ''}>Open Sans</option>
                    <option value="'Roboto', sans-serif"        ${p.ranobeFontFamily === "'Roboto', sans-serif" ? 'selected' : ''}>Roboto</option>
                    <option value="'Inter', sans-serif"         ${p.ranobeFontFamily === "'Inter', sans-serif" ? 'selected' : ''}>Inter</option>
                    <option value="'JetBrains Mono', monospace" ${p.ranobeFontFamily === "'JetBrains Mono', monospace" ? 'selected' : ''}>JetBrains Mono</option>
                </select>
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Размер шрифта</div>
                    <div class="mu-setting-desc">${p.ranobeFontSize}px</div>
                </div>
                <input type="range" class="mu-input" data-section="personalization" data-key="ranobeFontSize"
                       min="12" max="32" step="1" value="${p.ranobeFontSize}" style="width:100px">
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Межстрочный интервал</div>
                    <div class="mu-setting-desc">${p.ranobeLineHeight}</div>
                </div>
                <input type="range" class="mu-input" data-section="personalization" data-key="ranobeLineHeight"
                       min="1.0" max="2.5" step="0.1" value="${p.ranobeLineHeight}" style="width:100px">
            </div>

            <div style="margin-top:16px;text-align:center">
                <button class="mu-btn mu-btn-danger" id="mu-reset-all">Сбросить все настройки</button>
            </div>
        `;
    }

    function renderAiTab() {
        const ai = settings.ai || {};
        const hasKey = !!ai.deepseekKey;
        return `
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">ИИ анализ комментариев</div>
                    <div class="mu-setting-desc">При открытии попапа бана — ИИ покажет нарушает ли комментарий правила</div>
                </div>
                ${renderToggle('ai', 'enabled', ai.enabled)}
            </div>

            <div class="mu-setting-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
                <div class="mu-setting-label">DeepSeek API ключ</div>
                <div class="mu-setting-desc" style="margin-bottom:4px;">
                    Получить на <a href="https://platform.deepseek.com/api_keys" target="_blank"
                    style="color:#f39c12;">platform.deepseek.com</a>
                </div>
                <div style="display:flex;gap:6px;width:100%;">
                    <input type="password" id="mu-ai-key-input" placeholder="sk-..."
                        value="${ai.deepseekKey || ''}"
                        style="flex:1;padding:6px 10px;background:#1a1a2e;border:1px solid #2a2a3e;
                        border-radius:6px;color:#fff;font-size:11px;outline:none;">
                    <button id="mu-ai-key-save"
                        style="padding:6px 12px;border-radius:6px;border:1px solid #f39c12;
                        background:rgba(243,156,18,0.1);color:#f39c12;cursor:pointer;font-size:11px;">
                        Сохранить
                    </button>
                </div>
                ${hasKey ? `<div style="color:#2ecc71;font-size:10px;">✓ Ключ сохранён</div>` : ''}
            </div>

            <div style="margin-top:8px;padding:10px;background:rgba(243,156,18,0.05);
                border:1px solid rgba(243,156,18,0.15);border-radius:8px;font-size:10px;color:#aaa;line-height:1.6;">
                🤖 Используется модель <b style="color:#f39c12">deepseek-chat</b><br>
                Ключ хранится локально в браузере и никуда не отправляется кроме DeepSeek API.
            </div>
        `;
    }

    // ==================== ОБРАБОТЧИКИ ====================

    function attachListeners(tabId) {
        const contentEl = document.getElementById('mu-settings-content');

        // Toggles
        contentEl.querySelectorAll('input[type="checkbox"][data-section]').forEach(input => {
            input.addEventListener('change', async (e) => {
                await MU.updateSetting(e.target.dataset.section, e.target.dataset.key, e.target.checked);
                settings = await MU.getSettings();
            });
        });

        // Selects
        contentEl.querySelectorAll('select[data-section]').forEach(select => {
            select.addEventListener('change', async (e) => {
                let value = e.target.value;
                if (e.target.dataset.key === 'updateInterval') value = parseInt(value);
                await MU.updateSetting(e.target.dataset.section, e.target.dataset.key, value);
                settings = await MU.getSettings();
            });
        });

        // Color inputs
        contentEl.querySelectorAll('input[type="color"][data-section]').forEach(input => {
            input.addEventListener('change', async (e) => {
                await MU.updateSetting(e.target.dataset.section, e.target.dataset.key, e.target.value);
                settings = await MU.getSettings();
            });
        });

        // Range inputs
        contentEl.querySelectorAll('input[type="range"][data-section]').forEach(input => {
            input.addEventListener('input', async (e) => {
                let value = parseFloat(e.target.value);
                await MU.updateSetting(e.target.dataset.section, e.target.dataset.key, value);
                settings = await MU.getSettings();
                renderTab(activeTab); // Перерисовываем чтобы обновить значения
            });
        });

        // Wallpaper file
        const wallpaperFile = document.getElementById('mu-wallpaper-file');
        if (wallpaperFile) {
            wallpaperFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    await MU.updateSetting('personalization', 'customWallpaper', ev.target.result);
                    settings = await MU.getSettings();
                    renderTab(activeTab);
                };
                reader.readAsDataURL(file);
            });
        }

        // Wallpaper URL
        const wallpaperUrl = document.getElementById('mu-wallpaper-url');
        if (wallpaperUrl) {
            wallpaperUrl.addEventListener('change', async (e) => {
                if (e.target.value.trim()) {
                    await MU.updateSetting('personalization', 'customWallpaper', e.target.value.trim());
                    settings = await MU.getSettings();
                    renderTab(activeTab);
                }
            });
        }

        // Clear wallpaper
        const clearWallpaper = document.getElementById('mu-clear-wallpaper');
        if (clearWallpaper) {
            clearWallpaper.addEventListener('click', async () => {
                await MU.updateSetting('personalization', 'customWallpaper', '');
                settings = await MU.getSettings();
                renderTab(activeTab);
            });
        }

        // Clear accent
        const clearAccent = document.getElementById('mu-clear-accent');
        if (clearAccent) {
            clearAccent.addEventListener('click', async () => {
                await MU.updateSetting('personalization', 'accentColor', '');
                settings = await MU.getSettings();
                renderTab(activeTab);
            });
        }

        // AI key save
        const aiKeySave = document.getElementById('mu-ai-key-save');
        if (aiKeySave) {
            aiKeySave.addEventListener('click', async () => {
                const val = document.getElementById('mu-ai-key-input')?.value?.trim() || '';
                await MU.updateSetting('ai', 'deepseekKey', val);
                settings = await MU.getSettings();
                renderTab(activeTab);
            });
        }

        // Reset all
        const resetAll = document.getElementById('mu-reset-all');
        if (resetAll) {
            resetAll.addEventListener('click', async () => {
                if (confirm('Сбросить ВСЕ настройки расширения к значениям по умолчанию?')) {
                    await MU.resetSettings();
                    settings = await MU.getSettings();
                    renderTab(activeTab);
                }
            });
        }
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    async function init() {
        settings = await MU.getSettings();

        injectStyles();
        createSettingsPanel();

        MU.on('settingsChanged', async () => {
            settings = await MU.getSettings();
        });

        MU.log('SettingsUI', 'Модуль настроек запущен');

        return { createButton: createSettingsButton };
    }

    return { init };

})();