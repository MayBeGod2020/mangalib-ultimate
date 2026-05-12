// Главный файл — точка входа
// Координирует все модули и встраивает кнопки в правильном порядке

(async function() {
    'use strict';

    const MU = window.MULib;

    // Контейнер для кнопок (Dashboard + Settings).
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

        // === ЧИТАЛКА: DOM-вставка перед блоком иконок (bookmark / note / gear) ===
        // Структура: div.xz_b > … > div.xz_jm.xz_bc > div.xz_hi > svg[bookmark]
        const readerHeader = document.querySelector('.xz_b');
        if (readerHeader) {
            const bookmarkSvg = readerHeader.querySelector('svg[data-icon="bookmark"]');
            // svg → div.xz_hi.xz_ba → div.xz_jm.xz_bc
            const actionBlock = bookmarkSvg?.parentElement?.parentElement;
            if (actionBlock && actionBlock.parentElement === readerHeader) {
                readerHeader.insertBefore(container, actionBlock);
            } else {
                readerHeader.appendChild(container);
            }
            MU.log('Main', 'Reader: кнопки вставлены перед блоком иконок читалки');
            return container;
        }

        // === ГЛАВНАЯ И ДРУГИЕ СТРАНИЦЫ: position:absolute внутри шапки ===
        // Абсолютное позиционирование внутри fixed-шапки: не сдвигает flex-элементы,
        // right отсчитывается от правого края шапки (= ширина кнопки гамбургера + зазор).
        const header = document.querySelector('[data-header]');
        if (header) {
            // Измеряем ширину кнопки-гамбургера, чтобы встать ровно левее неё
            const barsSvg = header.querySelector('svg[data-icon="bars"]');
            const barsBtn = barsSvg?.parentElement?.parentElement; // svg→w5_eb→w5_c5
            const barsW   = barsBtn ? barsBtn.getBoundingClientRect().width : 40;

            container.style.cssText += `
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                right: ${Math.round(barsW + 8)}px;
                z-index: 100;
            `;
            header.appendChild(container);
            MU.log('Main', 'Main: кнопки absolute в header, right:', Math.round(barsW + 8));
            return container;
        }

        // Фолбэк: нет шапки — fixed в правом верхнем углу
        container.style.cssText += `
            position: fixed;
            top: 8px;
            right: 55px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
        MU.log('Main', 'Main: кнопки fixed (fallback)');
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
        await window.MUExamples.init().catch(e => MU.log('Main', 'Examples err:', e));
        await window.MUForumAnalysis.init().catch(e => MU.log('Main', 'ForumAnalysis err:', e));

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
