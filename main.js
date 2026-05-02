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

        // Запускаем модули в правильном порядке
        // 1. Персонализация — самая первая, чтобы стили применились сразу
        await window.MUPersonalization.init();

        // 2. Reader (автоскролл при чтении)
        await window.MUReader.init();

        // 3. Модерация
        await window.MUModeration.init();

        // 4. Settings UI (кнопка ⚙️)
        const settingsModule = await window.MUSettingsUI.init();

        // 5. Dashboard — последний, чтобы быть рядом с шестерёнкой
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
