// Главный файл — точка входа
// Координирует все модули и встраивает кнопки в правильном порядке

(async function() {
    'use strict';

    const MU = window.MULib;

    // Ищем правую часть шапки сайта чтобы вставить кнопки туда,
    // а не поверх нативных элементов управления.
    function findHeaderSlot() {
        const selectors = [
            // Семейство Lib — возможные варианты шапки
            '.header__right',
            '.header-actions',
            '[class*="header__actions"]',
            '[class*="header__right"]',
            '[class*="header__controls"]',
            '.app-header [class*="right"]',
            '.site-header [class*="right"]',
            // Читалка
            '[class*="reader__header"] [class*="right"]',
            '[class*="reader-header"] [class*="right"]',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            // Убеждаемся что элемент видим и находится вверху страницы
            if (el) {
                const rect = el.getBoundingClientRect();
                if (rect.top < 80) return el;
            }
        }
        return null;
    }

    // Контейнер для кнопок (Dashboard + Settings) в правом верхнем углу
    function createButtonContainer() {
        if (document.getElementById('mu-button-container')) return document.getElementById('mu-button-container');

        const container = document.createElement('div');
        container.id = 'mu-button-container';
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: -apple-system, sans-serif;
        `;

        const slot = findHeaderSlot();
        if (slot) {
            // Вставляем в шапку сайта — кнопки будут рядом с нативными
            container.style.marginRight = '4px';
            slot.prepend(container);
            MU.log('Main', 'Кнопки вставлены в header:', slot.className);
        } else {
            // Фолбэк: фиксированное позиционирование
            container.style.cssText += `
                position: fixed;
                top: 12px;
                right: 16px;
                z-index: 99999;
            `;
            document.body.appendChild(container);
            MU.log('Main', 'Кнопки в fixed-контейнере (header не найден)');
        }

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
