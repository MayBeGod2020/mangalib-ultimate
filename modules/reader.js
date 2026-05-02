// Модуль Reader — автоскролл при чтении манхвы
// Появляется только на страницах чтения, кнопка-переключатель

window.MUReader = (function() {
    'use strict';

    const MU = window.MULib;

    let settings = null;
    let isScrolling = false;
    let scrollAnimationId = null;
    let toggleButton = null;

    // ==================== ПРОВЕРКА СТРАНИЦЫ ЧТЕНИЯ ====================

    function isReaderPage() {
        // Страницы чтения манхвы и манги
        return /\/read\/v\d+\/c\d+/.test(location.pathname)
            || location.pathname.includes('/read/');
    }

    // ==================== СКОРОСТЬ ====================

    function getScrollSpeed() {
        const speedMap = {
            'slow':   0.5,
            'medium': 1.5,
            'fast':   3.0
        };
        return speedMap[settings.reader.scrollSpeed] || 1.5;
    }

    // ==================== АВТОСКРОЛЛ ====================

    function startScroll() {
        if (isScrolling) return;
        isScrolling = true;

        const speed = getScrollSpeed();

        function step() {
            if (!isScrolling) return;
            window.scrollBy(0, speed);

            // Если достигли конца — останавливаем
            if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 5) {
                stopScroll();
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
                border: 2px solid #9b59b6;
                color: #9b59b6;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                transition: all 0.2s;
                font-family: -apple-system, sans-serif;
            }
            #mu-reader-toggle:hover {
                transform: scale(1.1);
            }
            #mu-reader-toggle.active {
                background: #9b59b6;
                color: #fff;
                animation: mu-pulse 1.5s infinite;
            }
            @keyframes mu-pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(155,89,182,0.4); }
                50% { box-shadow: 0 4px 24px rgba(155,89,182,0.8); }
            }
        `;
        document.head.appendChild(style);
    }

    function createButton() {
        if (toggleButton) return;

        injectStyles();

        toggleButton = document.createElement('button');
        toggleButton.id = 'mu-reader-toggle';
        toggleButton.title = 'Автоскролл (нажми чтобы запустить/остановить)';
        toggleButton.innerHTML = '▼';
        toggleButton.addEventListener('click', toggleScroll);
        document.body.appendChild(toggleButton);

        updateButton();
    }

    function updateButton() {
        if (!toggleButton) return;
        if (isScrolling) {
            toggleButton.classList.add('active');
            toggleButton.innerHTML = '⏸';
            toggleButton.title = 'Остановить автоскролл';
        } else {
            toggleButton.classList.remove('active');
            toggleButton.innerHTML = '▼';
            toggleButton.title = 'Запустить автоскролл';
        }
    }

    function removeButton() {
        if (toggleButton) {
            toggleButton.remove();
            toggleButton = null;
        }
        stopScroll();
    }

    // ==================== УПРАВЛЕНИЕ ВИДИМОСТЬЮ ====================

    function updateVisibility() {
        if (!settings.reader.enabled) {
            removeButton();
            return;
        }

        if (isReaderPage()) {
            createButton();
        } else {
            removeButton();
        }
    }

    // ==================== ОСТАНОВКА ПРИ ВЗАИМОДЕЙСТВИИ ====================

    function setupInteractionStop() {
        // Останавливаем скролл если пользователь сам скроллит
        let userScrollTimeout = null;
        let lastUserScroll = 0;

        window.addEventListener('wheel', () => {
            if (isScrolling && Date.now() - lastUserScroll > 100) {
                stopScroll();
            }
            lastUserScroll = Date.now();
        });

        window.addEventListener('touchmove', () => {
            if (isScrolling) stopScroll();
        });
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    async function init() {
        settings = await MU.getSettings();

        setupInteractionStop();
        updateVisibility();

        // Следим за SPA навигацией
        let lastUrl = location.href;
        const navObserver = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                stopScroll();
                setTimeout(updateVisibility, 500);
            }
        });
        navObserver.observe(document.body, { childList: true, subtree: true });

        // Подписка на изменения настроек
        MU.on('settingsChanged', async () => {
            settings = await MU.getSettings();
            updateVisibility();
        });

        MU.log('Reader', 'Модуль Reader запущен');
    }

    return { init };

})();
