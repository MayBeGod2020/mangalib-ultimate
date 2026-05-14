// Модуль Reader — автоскролл при чтении манхвы
// Появляется только на страницах чтения, кнопка-переключатель

window.MUReader = (function() {
    'use strict';

    const MU = window.MULib;

    let settings          = null;
    let isScrolling       = false;
    let scrollAnimationId = null;
    let toggleButton      = null;
    let isAutoNavigating  = false;

    // ==================== ПРОВЕРКА СТРАНИЦЫ ЧТЕНИЯ ====================

    function isReaderPage() {
        return /\/read\/v\d+\/c\d+/.test(location.pathname)
            || location.pathname.includes('/read/');
    }

    // ==================== СКОРОСТЬ ====================

    function getScrollSpeed() {
        const speedMap = { 'slow': 0.5, 'medium': 1.5, 'fast': 3.0 };
        return speedMap[settings.reader.scrollSpeed] || 1.5;
    }

    // ==================== ПОИСК СКРОЛЛЯЩЕГОСЯ КОНТЕЙНЕРА ====================

    function findScrollContainer() {
        const selectors = [
            '.reader-container',
            '.reader__images',
            '[class*="reader-images"]',
            '[class*="reader__content"]',
            '[class*="chapter-reader"]',
            '.v-virtual-scroll',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.scrollHeight > el.clientHeight + 50) return el;
        }

        let best = null;
        let bestScrollHeight = 0;
        document.querySelectorAll('*').forEach(el => {
            if (el.scrollHeight > el.clientHeight + 100) {
                const oy = getComputedStyle(el).overflowY;
                if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > bestScrollHeight) {
                    bestScrollHeight = el.scrollHeight;
                    best = el;
                }
            }
        });

        return best || document.documentElement;
    }

    // ==================== КОНЕЦ КОНТЕНТА ГЛАВЫ ====================
    // Ищем где заканчиваются страницы манги (до комментариев).
    // Возвращает значение scrollTop контейнера, при котором нужно остановиться.

    function findChapterEndScrollTop(container, useWindow) {
        // 1. Ищем начало секции комментариев / реакций — остановимся чуть выше неё
        const commentSelectors = [
            '[class*="comments-section"]',
            '[class*="comment-section"]',
            '[id*="comments"]',
            '[class*="reactions"]',
            '[class*="chapter-end"]',
            '[class*="reader-end"]',
        ];
        for (const sel of commentSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                return getElementScrollTop(el, container, useWindow);
            }
        }

        // 2. Ищем блок навигации по главам в нижней части читалки
        const navSelectors = [
            '[class*="reader-navigation"]',
            '[class*="chapter-navigation"]',
            '[class*="reader__navigation"]',
        ];
        for (const sel of navSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                return getElementScrollTop(el, container, useWindow);
            }
        }

        // 3. Последний крупный img (страница манги) — берём его нижнюю границу
        const imgs = [...document.querySelectorAll('img')]
            .filter(img => img.getBoundingClientRect().width > 150);
        if (imgs.length > 0) {
            const lastImg = imgs[imgs.length - 1];
            return getElementBottomScrollTop(lastImg, container, useWindow);
        }

        return null; // нет ориентира — скроллим до конца
    }

    // Вспомогательные: конвертация позиции элемента → scrollTop контейнера

    function getElementScrollTop(el, container, useWindow) {
        const elRect = el.getBoundingClientRect();
        if (useWindow) {
            return window.scrollY + elRect.top;
        }
        const cRect = container.getBoundingClientRect();
        return container.scrollTop + elRect.top - cRect.top;
    }

    function getElementBottomScrollTop(el, container, useWindow) {
        const elRect = el.getBoundingClientRect();
        if (useWindow) {
            return window.scrollY + elRect.bottom;
        }
        const cRect = container.getBoundingClientRect();
        return container.scrollTop + elRect.bottom - cRect.top;
    }

    // ==================== ПЕРЕХОД НА СЛЕДУЮЩУЮ ГЛАВУ ====================

    function findNextChapterButton() {
        // Стандартные селекторы читалки семейства Lib
        const selectors = [
            '[class*="reader-navigation__next"]',
            '[class*="chapter-navigation__next"]',
            '[class*="reader__navigation"] a:last-child',
            '[class*="reader-controls"] [class*="next"]',
            '[data-direction="next"]',
            'a[rel="next"]',
            'button[aria-label*="след"]',
            'a[aria-label*="след"]',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && !el.disabled) return el;
        }

        // Поиск по URL-паттерну: текущая /cN → ищем ссылку на /c(N+1)
        const chapterMatch = location.pathname.match(/\/c(\d+)/);
        if (chapterMatch) {
            const nextNum = parseInt(chapterMatch[1]) + 1;
            const nextLink = document.querySelector(`a[href*="/c${nextNum}"]`);
            if (nextLink) return nextLink;
        }

        return null;
    }

    function goToNextChapter() {
        const btn = findNextChapterButton();
        if (btn) {
            MU.log('Reader', 'Переход на следующую главу:', btn.href || btn.textContent.trim());
            isAutoNavigating = true;
            btn.click();
            return true;
        }
        MU.log('Reader', 'Кнопка следующей главы не найдена — останавливаем скролл');
        return false;
    }

    // ==================== АВТОСКРОЛЛ ====================

    function startScroll() {
        if (isScrolling) return;
        isScrolling = true;

        const speed     = getScrollSpeed();
        const container = findScrollContainer();
        const useWindow = (container === document.documentElement || container === document.body);

        // Рассчитываем где заканчивается контент главы
        const chapterEnd = findChapterEndScrollTop(container, useWindow);
        MU.log('Reader', 'chapterEnd scrollTop:', chapterEnd);

        function currentScrollBottom() {
            return useWindow
                ? window.scrollY + window.innerHeight
                : container.scrollTop + container.clientHeight;
        }

        function totalScrollHeight() {
            return useWindow
                ? document.documentElement.scrollHeight
                : container.scrollHeight;
        }

        function doScroll() {
            if (useWindow) window.scrollBy(0, speed);
            else container.scrollTop += speed;
        }

        function step() {
            if (!isScrolling) return;

            doScroll();

            const bottom = currentScrollBottom();

            // Достигли конца контента главы → переходим на следующую
            if (chapterEnd !== null && bottom >= chapterEnd) {
                const navigated = goToNextChapter();
                if (!navigated) stopScroll(); // следующей главы нет
                // isAutoNavigating=true → URL change handler перезапустит скролл
                return;
            }

            // Фолбэк: достигли самого конца страницы (нет комментариев и нет кнопки)
            if (bottom >= totalScrollHeight() - 5) {
                const navigated = goToNextChapter();
                if (!navigated) stopScroll();
                return;
            }

            scrollAnimationId = requestAnimationFrame(step);
        }

        scrollAnimationId = requestAnimationFrame(step);
        updateButton();
    }

    function stopScroll() {
        isScrolling = false;
        if (scrollAnimationId) {
            cancelAnimationFrame(scrollAnimationId);
            scrollAnimationId = null;
        }
        updateButton();
    }

    function toggleScroll() {
        if (isScrolling) stopScroll();
        else startScroll();
    }

    // ==================== КНОПКА ====================

    function injectStyles() {
        if (document.getElementById('mu-reader-styles')) return;
        const style = document.createElement('style');
        style.id = 'mu-reader-styles';
        style.textContent = `
            #mu-reader-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 99999;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: #1a1a2e;
                border: 2px solid var(--mu-accent, #9b59b6);
                color: var(--mu-accent, #9b59b6);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                transition: all 0.2s;
                font-family: -apple-system, sans-serif;
            }
            #mu-reader-toggle:hover { transform: scale(1.1); }
            #mu-reader-toggle.active {
                background: var(--mu-accent, #9b59b6);
                color: #fff;
                animation: mu-pulse 1.5s infinite;
            }
            #mu-reader-toggle.navigating {
                background: #f39c12;
                border-color: #f39c12;
                color: #fff;
            }
            @keyframes mu-pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(155,89,182,0.4); }
                50%       { box-shadow: 0 4px 24px rgba(155,89,182,0.8); }
            }
        `;
        document.head.appendChild(style);
    }

    function createButton() {
        if (toggleButton) return;
        injectStyles();
        toggleButton = document.createElement('button');
        toggleButton.id = 'mu-reader-toggle';
        toggleButton.title = 'Автоскролл';
        toggleButton.innerHTML = '▼';
        toggleButton.addEventListener('click', toggleScroll);
        document.body.appendChild(toggleButton);
        updateButton();
    }

    function updateButton() {
        if (!toggleButton) return;
        toggleButton.classList.remove('active', 'navigating');
        if (isAutoNavigating) {
            toggleButton.classList.add('navigating');
            toggleButton.innerHTML = '⏭';
            toggleButton.title = 'Переход на следующую главу…';
        } else if (isScrolling) {
            toggleButton.classList.add('active');
            toggleButton.innerHTML = '⏸';
            toggleButton.title = 'Остановить автоскролл';
        } else {
            toggleButton.innerHTML = '▼';
            toggleButton.title = 'Запустить автоскролл';
        }
    }

    function removeButton() {
        if (toggleButton) { toggleButton.remove(); toggleButton = null; }
        stopScroll();
    }

    // ==================== УПРАВЛЕНИЕ ВИДИМОСТЬЮ ====================

    function updateVisibility() {
        if (!settings.reader.enabled) { removeButton(); return; }
        if (isReaderPage()) createButton();
        else removeButton();
    }

    // ==================== ОСТАНОВКА ПРИ ВЗАИМОДЕЙСТВИИ ====================

    function setupInteractionStop() {
        window.addEventListener('wheel', () => {
            if (isScrolling) stopScroll();
        }, { passive: true });
        window.addEventListener('touchmove', () => {
            if (isScrolling) stopScroll();
        }, { passive: true });
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    async function init() {
        settings = await MU.getSettings();
        setupInteractionStop();
        updateVisibility();

        // Следим за SPA навигацией
        let lastUrl = location.href;
        const navObserver = new MutationObserver(() => {
            if (location.href === lastUrl) return;
            lastUrl = location.href;

            const wasAutoNavigating = isAutoNavigating;
            isAutoNavigating = false;
            stopScroll();

            // Ждём загрузки нового контента
            setTimeout(() => {
                updateVisibility();

                // Если это был авто-переход — перезапускаем скролл
                if (wasAutoNavigating && isReaderPage()) {
                    MU.log('Reader', 'Авто-переход завершён, перезапуск скролла');
                    updateButton();
                    // Доп. пауза чтобы изображения успели вставиться в DOM
                    setTimeout(() => {
                        if (!isScrolling) startScroll();
                    }, 800);
                }
            }, 600);
        });
        navObserver.observe(document.body, { childList: true, subtree: true });

        MU.on('settingsChanged', async () => {
            settings = await MU.getSettings();
            updateVisibility();
        });

        MU.log('Reader', 'Модуль Reader запущен');
    }

    return { init };

})();
