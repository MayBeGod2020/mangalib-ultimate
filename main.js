// Главный файл — точка входа
// Координирует все модули и встраивает кнопки в правильном порядке

(async function() {
    'use strict';

    const MU = window.MULib;

    // Контейнер для кнопок (Dashboard + Settings).
    // Используем position:fixed — не вставляем в DOM шапки, не сдвигаем нативные кнопки.
    // Позиционируем после блока логотипа (слева), вертикально по центру шапки.
    function createButtonContainer() {
        if (document.getElementById('mu-button-container')) return document.getElementById('mu-button-container');

        const container = document.createElement('div');
        container.id = 'mu-button-container';

        // Вычисляем позицию: сразу после блока логотипа, вертикально по центру шапки
        const headerEl  = document.querySelector('[data-header]');
        const logoBlock = headerEl?.querySelector(':scope > * > *:first-child');

        let topPx  = 8;
        let leftPx = 200; // запасной вариант, если не нашли шапку

        if (headerEl) {
            const hRect = headerEl.getBoundingClientRect();
            topPx = Math.round(hRect.top + (hRect.height - 32) / 2);
        }
        if (logoBlock) {
            const lRect = logoBlock.getBoundingClientRect();
            leftPx = Math.round(lRect.right + 10);
        }

        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: -apple-system, sans-serif;
            position: fixed;
            top: ${topPx}px;
            left: ${leftPx}px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
        MU.log('Main', 'Кнопки в fixed-контейнере, left:', leftPx, 'top:', topPx);
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

        // Запускаем модули в правильном порядке.
        // .catch() на каждом: ошибка в одном модуле не роняет всё расширение.
        await window.MUPersonalization.init().catch(e => MU.log('Main', 'Personalization err:', e));
        await window.MUReader.init().catch(e => MU.log('Main', 'Reader err:', e));
        await window.MUModeration.init().catch(e => MU.log('Main', 'Moderation err:', e));
        await window.MUAiVerdict.init().catch(e => MU.log('Main', 'AIVerdict err:', e));

        const settingsModule = await window.MUSettingsUI.init()
            .catch(e => { MU.log('Main', 'SettingsUI err:', e); return null; });

        await window.MUUserTooltip.init().catch(e => MU.log('Main', 'Tooltip err:', e));

        const dashboardModule = await window.MUDashboard.init()
            .catch(e => { MU.log('Main', 'Dashboard err:', e); return null; });

        // Встраиваем кнопки (position:fixed — не влияет на layout шапки)
        const container = createButtonContainer();

        if (dashboardModule?.isAvailable) {
            const dashBtn = dashboardModule.createButton?.();
            if (dashBtn) container.appendChild(dashBtn);
        }

        if (settingsModule) {
            const settingsBtn = settingsModule.createButton?.();
            if (settingsBtn) container.appendChild(settingsBtn);
        }

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
