// Главный файл — точка входа
// Координирует все модули и встраивает кнопки в правильном порядке

(async function() {
    'use strict';

    const MU = window.MULib;

    // Ищем элемент в шапке сайта перед которым вставим наши кнопки.
    // Возвращает { anchor, mode } или null.
    function findHeaderSlot() {
        // === Читалка ===
        // Блок с кнопками закладки / заметок / шестерёнки читалки
        for (const icon of ['gear', 'bookmark', 'note-sticky']) {
            const svg = document.querySelector(`svg[data-icon="${icon}"]`);
            if (!svg) continue;
            // svg → div-обёртка → блок нативных кнопок (то, перед чем встаём)
            const block = svg.parentElement?.parentElement;
            if (block?.parentElement) return { anchor: block, mode: 'before' };
        }

        // === Основные страницы сайта ===
        // Гамбургер-меню (fa-bars) — последняя кнопка в правом блоке шапки
        // Структура: svg → div.w5_eb → div.w5_c5 → div.l9_t.l9_bc
        const bars = document.querySelector('svg[data-icon="bars"]');
        if (bars) {
            // svg → иконка-обёртка → div.w5_c5 (то, перед чем встаём в flex-ряду)
            const barsBtn = bars.parentElement?.parentElement;
            if (barsBtn?.parentElement) return { anchor: barsBtn, mode: 'before' };
        }

        // === Фолбэк: любой fixed/sticky header вверху страницы ===
        const header = [...document.querySelectorAll('header, [role="banner"]')]
            .find(el => {
                const s = getComputedStyle(el);
                const r = el.getBoundingClientRect();
                return (s.position === 'fixed' || s.position === 'sticky')
                    && r.top < 10 && r.height < 100;
            });
        if (header?.lastElementChild) {
            return { anchor: header.lastElementChild, mode: 'prepend' };
        }

        return null;
    }

    // Контейнер для кнопок (Dashboard + Settings)
    function createButtonContainer() {
        if (document.getElementById('mu-button-container')) return document.getElementById('mu-button-container');

        const container = document.createElement('div');
        container.id = 'mu-button-container';
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: -apple-system, sans-serif;
            margin-right: 4px;
        `;

        const slot = findHeaderSlot();
        if (slot) {
            if (slot.mode === 'before') {
                // Вставляем перед найденным элементом (читалка / гамбургер)
                slot.anchor.parentElement.insertBefore(container, slot.anchor);
            } else {
                // prepend — добавляем в начало последнего блока шапки
                slot.anchor.prepend(container);
            }
            MU.log('Main', 'Кнопки вставлены в header, mode:', slot.mode);
        } else {
            // Последний фолбэк: fixed поверх всего
            container.style.cssText += `
                position: fixed;
                top: 12px;
                right: 16px;
                z-index: 2147483647;
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
