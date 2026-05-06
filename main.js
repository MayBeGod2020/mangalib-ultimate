// Главный файл — точка входа
// Координирует все модули и встраивает кнопки в правильном порядке

(async function() {
    'use strict';

    const MU = window.MULib;

    // Контейнер для кнопок (Dashboard + Settings) в правом верхнем углу
    function createButtonContainer() {
        if (document.getElementById('mu-button-container')) return document.getElementById('mu-button-container');

        const container = document.createElement('div');
        container.id = 'mu-button-container';
        container.style.cssText = `
            position: fixed;
            top: 12px;
            right: 16px;
            z-index: 99999;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: -apple-system, sans-serif;
        `;
        document.body.appendChild(container);
        return container;
    }

    async function init() {
        MU.log('Main', 'Запуск Mangalib Ultimate Helper');

        // Проверяем роль пользователя — только модераторы/админы видят расширение
        const isMod = await MU.checkIsModerator();
        if (!isMod) {
            MU.log('Main', 'Нет прав модератора — расширение не загружается');
            return;
        }

        // Определяем акцентный цвет сайта и выставляем --mu-accent
        MU.detectAccentColor();

        // Запускаем модули в правильном порядке
        // 1. Персонализация — самая первая, чтобы стили применились сразу
        await window.MUPersonalization.init();

        // 2. Reader (автоскролл при чтении)
        await window.MUReader.init();

        // 3. Модерация
        await window.MUModeration.init();

        // 4. AI Verdict
        await window.MUAiVerdict.init();

        // 5. Settings UI (кнопка ⚙️)
        const settingsModule = await window.MUSettingsUI.init();

        // 6. User Tooltip — попап при наведении на ник
        await window.MUUserTooltip.init();

        // 7. Dashboard — последний, чтобы быть рядом с шестерёнкой
        const dashboardModule = await window.MUDashboard.init();

        // Встраиваем кнопки в контейнер в правом верхнем углу
        // Порядок: Панель → Шестерёнка
        const container = createButtonContainer();

        // Кнопка панели (если модуль доступен — пользователь модератор)
        if (dashboardModule?.isAvailable) {
            const dashBtn = dashboardModule.createButton();
            if (dashBtn) container.appendChild(dashBtn);
        }

        // Кнопка настроек (всегда показывается)
        const settingsBtn = settingsModule.createButton();
        if (settingsBtn) container.appendChild(settingsBtn);

        MU.log('Main', 'Все модули запущены');

        // Проверяем наличие обновления
        checkUpdateBanner();
    }

    // ==================== БАННЕР ОБНОВЛЕНИЯ ====================

    async function checkUpdateBanner() {
        const { updateAvailable, updateVersion } = await chrome.storage.local.get(['updateAvailable', 'updateVersion']);
        if (!updateAvailable) return;

        const current = chrome.runtime.getManifest().version;
        if (document.getElementById('mu-update-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'mu-update-banner';
        banner.style.cssText = `
            position:fixed;bottom:16px;left:50%;transform:translateX(-50%);
            z-index:9999999;
            background:var(--background-elevated-1,#fff);
            border:1px solid var(--mu-accent, #f39c12);
            border-radius:var(--radius-section-block,10px);
            padding:10px 16px;
            font-family:var(--reader-font-family,-apple-system,sans-serif);font-size:13px;
            color:var(--text-primary,#212529);
            display:flex;align-items:center;gap:12px;
            box-shadow:0 4px 20px rgba(0,0,0,0.15);
            animation:mu-ai-slide-in 0.3s ease;
        `;
        banner.innerHTML = `
            <span>🔄 Доступна новая версия <b style="color:var(--mu-accent,#f39c12)">v${updateVersion}</b> (у вас v${current})</span>
            <a href="https://github.com/MayBeGod2020/mangalib-ultimate/archive/refs/heads/main.zip"
               target="_blank"
               style="padding:5px 12px;background:var(--mu-accent,#f39c12);color:#000;border-radius:6px;
                      font-weight:700;font-size:12px;text-decoration:none;white-space:nowrap;">
               ⬇️ Скачать
            </a>
            <button onclick="this.closest('#mu-update-banner').remove()"
                style="background:none;border:none;color:var(--text-secondary,#8a8a8e);
                cursor:pointer;font-size:18px;padding:0;line-height:1;">✕</button>
        `;
        document.body.appendChild(banner);
    }

    // SPA навигация — следим за сменой URL
    let lastUrl = location.href;
    function setupSPAObserver() {
        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                MU.log('Main', 'SPA navigation:', lastUrl);
                MU.emit('urlChanged', lastUrl);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Запускаем когда страница готова
    if (document.readyState === 'complete') {
        setTimeout(() => { init(); setupSPAObserver(); }, 1000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(() => { init(); setupSPAObserver(); }, 1000);
        });
    }

})();
