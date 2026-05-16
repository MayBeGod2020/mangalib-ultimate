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
                background:var(--background-elevated-1,#fff);
                border:1px solid var(--mu-accent, #f39c12);border-radius:50%;
                width:32px;height:32px;color:var(--mu-accent, #f39c12);cursor:pointer;
                display:flex;align-items:center;justify-content:center;
                font-size:16px;box-shadow:0 2px 8px color-mix(in srgb, var(--mu-accent, #f39c12) 25%, transparent);
                transition:all 0.2s;font-family:var(--reader-font-family,-apple-system,sans-serif);
                padding:0;
            }
            #mu-settings-toggle:hover {
                transform:rotate(45deg);
                background:color-mix(in srgb, var(--mu-accent, #f39c12) 10%, transparent);
            }
            #mu-settings-panel {
                display:none;
                position:fixed;top:52px;right:16px;width:390px;
                max-height:82vh;
                background:var(--background-elevated-1,#fff);
                border:1px solid var(--border-base,#e5e5e5);
                border-radius:var(--radius-section-block,8px);
                box-shadow:0 8px 32px rgba(0,0,0,0.15);
                overflow:hidden;z-index:99998;
                font-family:var(--reader-font-family,-apple-system,sans-serif);
                font-size:13px;flex-direction:column;
            }
            #mu-settings-panel.open { display:flex !important; }

            .mu-settings-header {
                padding:12px 16px;
                background:var(--background-elevated-2,#fff);
                border-bottom:1px solid var(--border-base,#e5e5e5);
                display:flex;justify-content:space-between;align-items:center;
            }
            .mu-settings-title {
                color:var(--mu-accent, #f39c12);font-weight:700;font-size:14px;
            }
            .mu-settings-close {
                background:none;border:none;
                color:var(--text-secondary,#8a8a8e);
                cursor:pointer;font-size:18px;padding:0;width:24px;height:24px;
                display:flex;align-items:center;justify-content:center;
                border-radius:50%;transition:background 0.15s;
            }
            .mu-settings-close:hover {
                background:var(--background-fill-3,rgba(118,118,128,.12));
                color:var(--text-primary,#212529);
            }

            .mu-settings-tabs {
                display:flex;
                background:var(--background-elevated-2,#fff);
                border-bottom:1px solid var(--border-base,#e5e5e5);
                overflow-x:hidden;
            }
            .mu-settings-tab {
                flex:1;padding:9px 4px;background:none;border:none;
                color:var(--text-secondary,#8a8a8e);
                cursor:pointer;font-size:10px;border-bottom:2px solid transparent;
                white-space:nowrap;transition:color 0.15s;text-align:center;
                font-family:inherit;
            }
            .mu-settings-tab:hover { color:var(--text-primary,#212529); }
            .mu-settings-tab.active {
                color:var(--mu-accent, #f39c12);border-bottom-color:var(--mu-accent, #f39c12);
                font-weight:600;
            }

            .mu-settings-content {
                flex:1;overflow-y:auto;padding:14px 16px;
                background:var(--background-elevated-1,#fff);
            }
            .mu-settings-content::-webkit-scrollbar { width:4px; }
            .mu-settings-content::-webkit-scrollbar-track {
                background:var(--background,#f2f2f3);
            }
            .mu-settings-content::-webkit-scrollbar-thumb {
                background:var(--scrollbar-thumb,#c1c1c1);border-radius:2px;
            }

            .mu-setting-row {
                display:flex;justify-content:space-between;align-items:center;
                padding:9px 0;
                border-bottom:1px solid var(--border-light,#e9e9e9);
            }
            .mu-setting-row:last-child { border-bottom:none; }
            .mu-setting-label {
                color:var(--text-primary,#212529);font-size:13px;
                flex:1;padding-right:12px;font-weight:500;
            }
            .mu-setting-desc {
                color:var(--text-secondary,#8a8a8e);font-size:11px;margin-top:2px;
                font-weight:400;
            }

            /* Toggle */
            .mu-toggle { position:relative;flex-shrink:0;cursor:pointer; }
            .mu-toggle input { display:none; }
            .mu-toggle-slider {
                display:inline-flex;align-items:center;justify-content:center;
                padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
                letter-spacing:0.3px;transition:all 0.2s;user-select:none;
                border:1px solid var(--border-base,#e5e5e5);
                background:var(--background-fill-4,rgba(116,116,128,.05));
                color:var(--text-secondary,#8a8a8e);
                min-width:56px;
            }
            .mu-toggle-slider::before { content:'ВЫКЛ'; }
            .mu-toggle input:checked + .mu-toggle-slider {
                background:color-mix(in srgb, var(--mu-accent, #f39c12) 12%, transparent);
                border-color:var(--mu-accent, #f39c12);color:var(--mu-accent, #f39c12);
            }
            .mu-toggle input:checked + .mu-toggle-slider::before { content:'ВКЛ'; }

            /* Select */
            .mu-select {
                background:var(--input-bg,#fff);
                border:1px solid var(--input-border,#dcdee2);
                color:var(--text-primary,#212529);
                padding:5px 8px;
                border-radius:var(--radius-section-block,8px);
                font-size:12px;cursor:pointer;min-width:110px;
                font-family:inherit;
            }
            .mu-select:focus { outline:none;border-color:var(--mu-accent, #f39c12); }

            /* Input */
            .mu-input {
                background:var(--input-bg,#fff);
                border:1px solid var(--input-border,#dcdee2);
                color:var(--text-primary,#212529);
                padding:5px 9px;
                border-radius:var(--radius-section-block,8px);
                font-size:12px;width:100%;box-sizing:border-box;
                font-family:inherit;
            }
            .mu-input:focus { outline:none;border-color:var(--mu-accent, #f39c12); }
            .mu-input[type="color"] { width:32px;height:28px;padding:2px;cursor:pointer; }
            .mu-input[type="range"] { cursor:pointer; }

            /* Section title */
            .mu-section-title {
                color:var(--mu-accent, #f39c12);font-size:10px;text-transform:uppercase;
                letter-spacing:0.8px;font-weight:700;
                margin-top:16px;margin-bottom:4px;
            }
            .mu-section-title:first-child { margin-top:0; }

            /* Buttons */
            .mu-btn {
                background:var(--background-fill-4,rgba(116,116,128,.05));
                border:1px solid var(--mu-accent, #f39c12);color:var(--mu-accent, #f39c12);
                padding:6px 14px;
                border-radius:var(--radius-section-block,8px);
                cursor:pointer;font-size:12px;font-family:inherit;
                transition:background 0.15s;
            }
            .mu-btn:hover { background:color-mix(in srgb, var(--mu-accent, #f39c12) 10%, transparent); }
            .mu-btn-danger { border-color:var(--red,#f44336);color:var(--red,#f44336); }
            .mu-btn-danger:hover { background:rgba(244,67,54,0.08); }

            /* Tooltip icon */
            .mu-tip-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background: var(--border-base, #e5e5e5);
                color: var(--text-secondary, #8a8a8e);
                font-size: 9px;
                font-weight: 700;
                cursor: help;
                position: relative;
                flex-shrink: 0;
                margin-left: 5px;
                vertical-align: middle;
                line-height: 1;
                border: none;
                outline: none;
                font-family: inherit;
            }
            .mu-tip-icon::after {
                content: attr(data-tip);
                position: absolute;
                bottom: calc(100% + 6px);
                right: -8px;
                background: var(--background-elevated-1, #2a2a2a);
                color: var(--text-primary, #212529);
                padding: 7px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 400;
                white-space: normal;
                width: 210px;
                line-height: 1.5;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s;
                z-index: 99999;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                border: 1px solid var(--border-base, #e5e5e5);
                text-align: left;
            }
            .mu-tip-icon:hover::after { opacity: 1; }

            /* Wallpaper preview */
            .mu-wallpaper-preview {
                width:100%;height:80px;
                background:var(--background,#f2f2f3);
                border:1px dashed var(--border-base,#e5e5e5);
                border-radius:var(--radius-section-block,8px);
                margin-top:6px;background-size:cover;background-position:center;
                display:flex;align-items:center;justify-content:center;
                color:var(--text-secondary,#8a8a8e);font-size:11px;
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
        MU.setHTML(panel, `
            <div class="mu-settings-header">
                <span class="mu-settings-title">⚙️ Настройки</span>
                <button class="mu-settings-close" id="mu-settings-close-btn">✕</button>
            </div>
            <div class="mu-settings-tabs" id="mu-settings-tabs"></div>
            <div class="mu-settings-content" id="mu-settings-content"></div>
        `);
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

    function closeSettings() {
        const panel = document.getElementById('mu-settings-panel');
        if (!panel) return;
        panel.classList.remove('open');
        isPanelOpen = false;
    }

    function toggleSettings() {
        const panel = document.getElementById('mu-settings-panel');
        if (!panel) return;
        isPanelOpen = !panel.classList.contains('open');
        panel.classList.toggle('open');

        if (isPanelOpen) {
            // Позиционируем под кнопкой шестерёнки динамически
            const btn = document.getElementById('mu-settings-toggle');
            if (btn) {
                const rect = btn.getBoundingClientRect();
                panel.style.top  = (rect.bottom + 8) + 'px';
                panel.style.right = (window.innerWidth - rect.right) + 'px';
            }
            // Закрываем панель дашборда если открыта
            MU.emit('panelOpen', 'settings');
        }
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

        MU.setHTML(tabsEl, tabs.map(t => `
            <button class="mu-settings-tab ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
                ${t.label}
            </button>
        `).join(''));

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

        if (tabId === 'moderation') MU.setHTML(contentEl, renderModerationTab());
        if (tabId === 'dashboard') MU.setHTML(contentEl, renderDashboardTab());
        if (tabId === 'reader') MU.setHTML(contentEl, renderReaderTab());
        if (tabId === 'personalization') MU.setHTML(contentEl, renderPersonalizationTab());
        if (tabId === 'ai') MU.setHTML(contentEl, renderAiTab());

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

    function tip(text) {
        return `<button class="mu-tip-icon" data-tip="${MU.esc(text)}" tabindex="-1" aria-label="Подсказка">?</button>`;
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
                    <div class="mu-setting-label">Автозаполнение попапа бана ${tip('При клике «Удалить» автоматически заполняет попап: тайтл, автор, текст комментария и причина жалобы')}</div>
                    <div class="mu-setting-desc">Автоматически вставлять текст комментария модератора</div>
                </div>
                ${renderToggle('moderation', 'autoFillPopup', m.autoFillPopup)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Шпаргалка правил ${tip('В попапе бана показывает текст правила под выбранной причиной')}</div>
                    <div class="mu-setting-desc">Показывать правила и кликабельные пункты</div>
                </div>
                ${renderToggle('moderation', 'cheatsheet', m.cheatsheet)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Автоотметка «Забанить» ${tip('При открытии попапа автоматически ставит галочку «Забанить»')}</div>
                    <div class="mu-setting-desc">Сразу включать чекбокс бана при открытии</div>
                </div>
                ${renderToggle('moderation', 'autoCheckBan', m.autoCheckBan)}
            </div>

            <div class="mu-section-title">Список жалоб</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Цветовая кодировка жалоб ${tip('Окрашивает карточки жалоб по типу нарушения — быстрее ориентироваться в списке')}</div>
                    <div class="mu-setting-desc">Подсвечивать карточки по типу нарушения</div>
                </div>
                ${renderToggle('moderation', 'colorizeCards', m.colorizeCards)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Автоскролл к следующей жалобе ${tip('После закрытия попапа автоматически прокручивает к следующей непросмотренной карточке')}</div>
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
                    <div class="mu-setting-label">Панель модераторов ${tip('Показывает онлайн-статус команды, watchlist ключевых слов и объявления. Данные отдельны для каждого сайта семейства Lib')}</div>
                    <div class="mu-setting-desc">Кнопка "📊 Панель" с онлайн статусами</div>
                </div>
                ${renderToggle('dashboard', 'enabled', d.enabled)}
            </div>

            <div class="mu-section-title">Параметры</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Интервал обновления ${tip('Как часто обновляется онлайн-статус модераторов (в секундах)')}</div>
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
                    <div class="mu-setting-label">Автоскролл ${tip('Плавная автопрокрутка при чтении манхвы. Колёсиком мыши регулируй скорость. При достижении конца главы переходит на следующую')}</div>
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
                    <div class="mu-setting-label">Персонализация ${tip('Изменяет внешний вид сайта только для тебя — другие пользователи не видят изменения')}</div>
                    <div class="mu-setting-desc">Применять настройки тем и шрифтов</div>
                </div>
                ${renderToggle('personalization', 'enabled', p.enabled)}
            </div>

            <div class="mu-section-title">Тема</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Тема ${tip('Встроенные пресеты цветовых схем')}</div>
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
                    <div class="mu-setting-label">Акцентный цвет ${tip('Основной цвет кнопок и элементов интерфейса')}</div>
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
                    <div class="mu-setting-label">Обои ${tip('Фоновое изображение для сайта. Вставь прямую ссылку на картинку (https://...)')}</div>
                    <div class="mu-setting-desc">Изображение фона или URL</div>
                </div>
                <input type="file" class="mu-input" id="mu-wallpaper-file" accept="image/*" style="margin-top:6px">
                <input type="text" class="mu-input" id="mu-wallpaper-url" placeholder="Или вставьте URL изображения"
                       value="${MU.esc((p.customWallpaper && p.customWallpaper.startsWith('http')) ? p.customWallpaper : '')}"
                       style="margin-top:6px">
                ${p.customWallpaper ? `
                    <div class="mu-wallpaper-preview" style="background-image:url('${MU.esc(p.customWallpaper)}')">
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
                    <div class="mu-setting-label">Шрифт ранобе ${tip('Название шрифта из Google Fonts для чтения ранобе, например: Merriweather')}</div>
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
                    <div class="mu-setting-label">Размер шрифта ${tip('Размер текста в пикселях для чтения ранобе')}</div>
                    <div class="mu-setting-desc">${p.ranobeFontSize}px</div>
                </div>
                <input type="range" class="mu-input" data-section="personalization" data-key="ranobeFontSize"
                       min="12" max="32" step="1" value="${p.ranobeFontSize}" style="width:100px">
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Межстрочный интервал ${tip('Расстояние между строками при чтении ранобе. 1.6 — стандарт, 2.0 — просторнее')}</div>
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
        // Миграция: если старый deepseekKey есть, а новый apiKey пустой
        const currentKey = ai.apiKey || ai.deepseekKey || '';
        const currentProvider = ai.provider || 'deepseek';

        const providers = {
            deepseek: { name: 'DeepSeek',         hint: 'platform.deepseek.com/api_keys',        ph: 'sk-...' },
            openai:   { name: 'ChatGPT (OpenAI)',  hint: 'platform.openai.com/api-keys',           ph: 'sk-...' },
            gemini:   { name: 'Google Gemini',     hint: 'aistudio.google.com/apikey',             ph: 'AIza...' },
            claude:   { name: 'Claude (Anthropic)',hint: 'console.anthropic.com/settings/keys',    ph: 'sk-ant-...' },
            qwen:     { name: 'Qwen (Alibaba)',    hint: 'dashscope.console.aliyun.com',           ph: 'sk-...' },
            grok:     { name: 'Grok (xAI)',        hint: 'console.x.ai',                          ph: 'xai-...' },
            mistral:  { name: 'Mistral AI',        hint: 'console.mistral.ai',                    ph: '...' },
        };
        const p = providers[currentProvider] || providers.deepseek;

        const hasAnyKey = !!(currentKey || ai.groqKey);

        return `
            ${!hasAnyKey ? `
            <div style="background:rgba(243,156,18,0.08);border:1px solid rgba(243,156,18,0.3);
                border-radius:var(--radius-section-block,8px);padding:12px 14px;margin-bottom:4px;">
                <div style="font-weight:700;color:var(--mu-accent,#f39c12);margin-bottom:8px;font-size:12px;">
                    🚀 Первый раз? Вот как запустить ИИ за 2 минуты
                </div>
                <div style="font-size:11px;color:var(--text-secondary,#8a8a8e);line-height:1.7;">
                    ИИ-анализ необязателен — модерация работает и без него.<br>
                    Если хочешь включить ИИ, самый простой способ (бесплатно):<br>
                    <ol style="margin:6px 0 0 14px;padding:0;color:var(--text-primary,#212529);">
                        <li>Зайди на
                            <a href="https://console.groq.com/keys" target="_blank"
                                style="color:var(--mu-accent,#f39c12);">console.groq.com</a>
                            → создай аккаунт (Google или GitHub)
                        </li>
                        <li>Нажми <b>Create API Key</b>, скопируй ключ</li>
                        <li>Вставь его в поле <b>«Groq API ключ»</b> ниже и нажми Сохранить</li>
                        <li>Включи тумблер <b>«ИИ анализ»</b> чуть ниже</li>
                    </ol>
                    <div style="margin-top:8px;opacity:0.7;">
                        Если уже есть ключ DeepSeek / OpenAI / Gemini — вставь его в поле «API ключ» выше.
                    </div>
                </div>
            </div>
            ` : ''}
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">ИИ анализ комментариев ${tip('При открытии попапа ИИ автоматически анализирует комментарий и показывает вердикт с объяснением и уверенностью')}</div>
                    <div class="mu-setting-desc">При открытии попапа бана — ИИ покажет нарушает ли комментарий правила</div>
                </div>
                ${renderToggle('ai', 'enabled', ai.enabled)}
            </div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">Кнопка сканирования страницы ${tip('Добавляет кнопку «🔍 Проверить страницу» — ИИ пакетно проверяет все комментарии и помечает подозрительные')}</div>
                    <div class="mu-setting-desc">Показывать кнопку "🔍 Проверить страницу"</div>
                </div>
                ${renderToggle('ai', 'showScanButton', ai.showScanButton)}
            </div>

            <div class="mu-section-title">Провайдер</div>
            <div class="mu-setting-row">
                <div>
                    <div class="mu-setting-label">AI сервис</div>
                    <div class="mu-setting-desc">Выберите провайдера и вставьте его API ключ</div>
                </div>
                <select class="mu-select" id="mu-ai-provider-select">
                    ${Object.entries(providers).map(([k, v]) =>
                        `<option value="${k}" ${k === currentProvider ? 'selected' : ''}>${v.name}</option>`
                    ).join('')}
                </select>
            </div>

            <div class="mu-setting-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
                <div class="mu-setting-label">API ключ</div>
                <div class="mu-setting-desc" id="mu-ai-hint" style="margin-bottom:4px;">
                    Получить на <a href="https://${MU.esc(p.hint)}" target="_blank" style="color:var(--mu-accent, #f39c12);">${MU.esc(p.hint)}</a>
                </div>
                <div style="display:flex;gap:6px;width:100%;">
                    <input type="password" id="mu-ai-key-input" class="mu-input"
                        placeholder="${MU.esc(p.ph)}"
                        value="${MU.esc(currentKey)}"
                        style="flex:1;font-size:11px;">
                    <button id="mu-ai-key-save" class="mu-btn"
                        style="padding:6px 12px;font-size:11px;white-space:nowrap;">
                        Сохранить
                    </button>
                </div>
                ${currentKey ? `<div style="color:#2ecc71;font-size:10px;">✓ Ключ сохранён</div>` : ''}
            </div>

            <div class="mu-section-title">Правила форума</div>
            <div class="mu-setting-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
                <div class="mu-setting-label">Правила форума для ИИ</div>
                <div class="mu-setting-desc" style="margin-bottom:4px;">
                    ИИ будет руководствоваться этими правилами при анализе тем. Оставь пустым — используются правила по умолчанию.
                </div>
                <textarea id="mu-ai-forum-rules" class="mu-input" rows="5"
                    placeholder="1. Бессмысленная тема — ...&#10;2. Дубликат — ...&#10;3. Некорректный заголовок — ..."
                    style="resize:vertical;font-size:11px;line-height:1.5;"
                >${MU.esc(ai.forumRules || '')}</textarea>
                <button id="mu-ai-forum-rules-save" class="mu-btn"
                    style="padding:6px 12px;font-size:11px;align-self:flex-end;">
                    Сохранить правила
                </button>
            </div>

            <div class="mu-section-title">Бесплатный фолбэк</div>
            <div class="mu-setting-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
                <div class="mu-setting-label">Groq API ключ <span style="font-size:10px;opacity:0.7;">(бесплатно)</span></div>
                <div class="mu-setting-desc" style="margin-bottom:4px;">
                    Бесплатный ИИ на базе Llama. Если основной API ключ не заполнен — Groq работает как основной провайдер.
                    При ошибке 402/429 переключается автоматически.<br>
                    Получить: <a href="https://console.groq.com/keys" target="_blank"
                        style="color:var(--mu-accent, #f39c12);">console.groq.com/keys</a>
                </div>
                <div style="display:flex;gap:6px;width:100%;">
                    <input type="password" id="mu-ai-groq-key-input" class="mu-input"
                        placeholder="gsk_..."
                        value="${MU.esc(ai.groqKey || '')}"
                        style="flex:1;font-size:11px;">
                    <button id="mu-ai-groq-key-save" class="mu-btn"
                        style="padding:6px 12px;font-size:11px;white-space:nowrap;">
                        Сохранить
                    </button>
                </div>
                ${ai.groqKey ? `<div style="color:#2ecc71;font-size:10px;">✓ Groq ключ сохранён</div>` : ''}
            </div>

            <div class="mu-section-title">Уведомления</div>
            <div class="mu-setting-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
                <div class="mu-setting-label">Webhook уведомления</div>
                <div class="mu-setting-desc" style="margin-bottom:4px;">
                    При высокой уверенности ИИ отправит уведомление о нарушении.<br>
                    <b>ntfy.sh</b> (работает в РФ без VPN): <code style="font-size:10px">https://ntfy.sh/твоя-тема</code><br>
                    <b>Telegram</b>: <code style="font-size:10px">https://api.telegram.org/bot&lt;TOKEN&gt;/sendMessage?chat_id=&lt;ID&gt;</code><br>
                    <b>Discord</b>: вставь URL вебхука канала.
                </div>
                <div style="display:flex;gap:6px;width:100%;">
                    <input type="text" id="mu-ai-webhook-input" class="mu-input"
                        placeholder="https://ntfy.sh/моя-тема"
                        value="${MU.esc(ai.webhookUrl || '')}"
                        style="flex:1;font-size:11px;">
                    <button id="mu-ai-webhook-save" class="mu-btn"
                        style="padding:6px 12px;font-size:11px;white-space:nowrap;">
                        Сохранить
                    </button>
                </div>
                ${ai.webhookUrl ? `<div style="color:#2ecc71;font-size:10px;">✓ Webhook сохранён</div>` : ''}
            </div>

            <div style="margin-top:8px;padding:10px;
                background:var(--background-fill-4,rgba(116,116,128,.05));
                border:1px solid var(--border-base,#e5e5e5);
                border-radius:var(--radius-section-block,8px);
                font-size:10px;color:var(--text-secondary,#8a8a8e);line-height:1.6;">
                🤖 Ключи хранятся локально в браузере и отправляются только выбранным провайдерам.
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

        // AI provider select — обновляем подсказку без перерисовки
        const aiProviderSelect = document.getElementById('mu-ai-provider-select');
        if (aiProviderSelect) {
            aiProviderSelect.addEventListener('change', async (e) => {
                await MU.updateSetting('ai', 'provider', e.target.value);
                settings = await MU.getSettings();
                renderTab(activeTab); // перерисовываем чтобы обновить подсказку и placeholder
            });
        }

        // AI key save
        const aiKeySave = document.getElementById('mu-ai-key-save');
        if (aiKeySave) {
            aiKeySave.addEventListener('click', async () => {
                const val = document.getElementById('mu-ai-key-input')?.value?.trim() || '';
                await MU.updateSetting('ai', 'apiKey', val);
                // Очищаем старый deepseekKey если мигрировали
                if (settings.ai?.deepseekKey) await MU.updateSetting('ai', 'deepseekKey', '');
                settings = await MU.getSettings();
                renderTab(activeTab);
            });
        }

        // Forum rules save
        const forumRulesSave = document.getElementById('mu-ai-forum-rules-save');
        if (forumRulesSave) {
            forumRulesSave.addEventListener('click', async () => {
                const val = document.getElementById('mu-ai-forum-rules')?.value?.trim() || '';
                await MU.updateSetting('ai', 'forumRules', val);
                settings = await MU.getSettings();
                renderTab(activeTab);
            });
        }

        // Groq key save
        const groqKeySave = document.getElementById('mu-ai-groq-key-save');
        if (groqKeySave) {
            groqKeySave.addEventListener('click', async () => {
                const val = document.getElementById('mu-ai-groq-key-input')?.value?.trim() || '';
                await MU.updateSetting('ai', 'groqKey', val);
                settings = await MU.getSettings();
                renderTab(activeTab);
            });
        }

        // Webhook save
        const webhookSave = document.getElementById('mu-ai-webhook-save');
        if (webhookSave) {
            webhookSave.addEventListener('click', async () => {
                const val = document.getElementById('mu-ai-webhook-input')?.value?.trim() || '';
                await MU.updateSetting('ai', 'webhookUrl', val);
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

    // ==================== ПРИВЕТСТВЕННЫЙ ПОПАП ====================

    function showWelcomeModal() {
        const overlay = document.createElement('div');
        overlay.id = 'mu-welcome-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:999999;
            background:rgba(0,0,0,0.55);
            display:flex;align-items:center;justify-content:center;
            font-family:var(--reader-font-family,-apple-system,sans-serif);
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background:var(--background-elevated-1,#fff);
            border:1px solid var(--border-base,#e5e5e5);
            border-radius:var(--radius-section-block,12px);
            box-shadow:0 16px 48px rgba(0,0,0,0.25);
            padding:28px 28px 22px;
            max-width:460px;width:90%;
            max-height:90vh;overflow-y:auto;
        `;

        MU.setHTML(modal, `
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:22px;font-weight:800;color:var(--mu-accent,#f39c12);line-height:1.3;">
                    🛡️ Mangalib Ultimate Helper
                </div>
                <div style="font-size:15px;font-weight:600;color:var(--text-primary,#212529);margin-top:4px;">
                    Добро пожаловать!
                </div>
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px;">
                ${[
                    ['🔨', 'Автозаполнение попапа', 'Тайтл, автор, текст и причина жалобы заполняются автоматически'],
                    ['🤖', 'ИИ-анализ нарушений', 'ИИ проверяет комментарий и сразу говорит нарушает или нет. Бесплатно через Groq'],
                    ['📊', 'Командная панель', 'Онлайн-статус модераторов, watchlist слов, объявления команды'],
                    ['👤', 'Карточки пользователей', 'Наведи на ник — увидишь уровень, роли, историю банов и приватные заметки'],
                    ['📖', 'Автоскролл при чтении', 'Плавная прокрутка и автопереход на следующую главу'],
                ].map(([icon, title, desc]) => `
                    <div style="display:flex;gap:12px;align-items:flex-start;
                        background:var(--background-fill-4,rgba(116,116,128,.05));
                        border:1px solid var(--border-base,#e5e5e5);
                        border-radius:8px;padding:10px 12px;">
                        <div style="font-size:20px;flex-shrink:0;line-height:1;">${icon}</div>
                        <div>
                            <div style="font-weight:700;font-size:13px;color:var(--text-primary,#212529);">${title}</div>
                            <div style="font-size:11px;color:var(--text-secondary,#8a8a8e);margin-top:2px;line-height:1.5;">${desc}</div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="background:color-mix(in srgb, var(--mu-accent,#f39c12) 10%, transparent);
                border:1px solid color-mix(in srgb, var(--mu-accent,#f39c12) 30%, transparent);
                border-radius:8px;padding:10px 14px;margin-bottom:18px;
                font-size:12px;color:var(--text-primary,#212529);line-height:1.6;">
                💡 <b>Быстрый старт:</b> нажми ⚙️ → вкладка 🤖 ИИ → вставь бесплатный ключ с
                <a href="https://console.groq.com" target="_blank"
                    style="color:var(--mu-accent,#f39c12);">console.groq.com</a>
            </div>

            <div style="text-align:center;">
                <button id="mu-welcome-close" style="
                    background:var(--mu-accent,#f39c12);
                    color:#fff;border:none;
                    padding:10px 32px;border-radius:8px;
                    font-size:14px;font-weight:700;cursor:pointer;
                    font-family:inherit;transition:opacity 0.15s;
                ">Начать работу →</button>
            </div>
        `);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        modal.querySelector('#mu-welcome-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    async function checkAndShowWelcome() {
        return new Promise((resolve) => {
            chrome.storage.local.get('mu_welcomed', (data) => {
                if (data.mu_welcomed) { resolve(); return; }
                chrome.storage.local.set({ mu_welcomed: true }, () => {
                    setTimeout(() => { showWelcomeModal(); resolve(); }, 2000);
                });
            });
        });
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    async function init() {
        settings = await MU.getSettings();

        injectStyles();
        createSettingsPanel();

        MU.on('settingsChanged', async () => {
            settings = await MU.getSettings();
        });

        // Закрываемся когда открывается панель дашборда
        MU.on('panelOpen', (which) => {
            if (which !== 'settings') closeSettings();
        });

        MU.log('SettingsUI', 'Модуль настроек запущен');

        return { createButton: createSettingsButton, checkAndShowWelcome };
    }

    return { init };

})();