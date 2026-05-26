// Модуль Personalization — кастомизация интерфейса
// Темы, обои, шрифты ранобе, цветовая палитра

window.MUPersonalization = (function() {
    'use strict';

    const MU = window.MULib;

    let settings = null;

    // ==================== ГОТОВЫЕ ТЕМЫ ====================

    const PRESET_THEMES = {
        'default': { name: 'По умолчанию', css: '' },

        'cyberpunk': {
            name: '🟣 Cyberpunk',
            css: `
                :root { --color-accent-rgb:255,0,200!important; --color-accent:#ff00c8!important; }
                body { background:linear-gradient(135deg,#0a0014 0%,#14001f 100%)!important; }
                .button,.btn,button { text-shadow:0 0 4px currentColor!important; }
            `
        },
        'nature': {
            name: '🟢 Nature',
            css: `
                :root { --color-accent-rgb:76,175,80!important; --color-accent:#4caf50!important; }
                body { background:linear-gradient(135deg,#0d1a0d 0%,#1a2a1a 100%)!important; }
            `
        },
        'ocean': {
            name: '🔵 Ocean',
            css: `
                :root { --color-accent-rgb:33,150,243!important; --color-accent:#2196f3!important; }
                body { background:linear-gradient(135deg,#001629 0%,#002a4d 100%)!important; }
            `
        },
        'sunset': {
            name: '🟠 Sunset',
            css: `
                :root { --color-accent-rgb:255,152,0!important; --color-accent:#ff9800!important; }
                body { background:linear-gradient(135deg,#1f0a00 0%,#3d1500 100%)!important; }
            `
        },

        // ── Новые темы ──
        'sakura': {
            name: '🌸 Sakura',
            css: `
                :root { --color-accent-rgb:233,88,133!important; --color-accent:#e95885!important; }
                body { background:linear-gradient(135deg,#1a0a10 0%,#2a1020 100%)!important; }
            `
        },
        'midnight': {
            name: '🌙 Midnight',
            css: `
                :root { --color-accent-rgb:100,181,246!important; --color-accent:#64b5f6!important; }
                body { background:linear-gradient(135deg,#060914 0%,#0d1526 100%)!important; }
            `
        },
        'nord': {
            name: '❄️ Nord',
            css: `
                :root { --color-accent-rgb:136,192,208!important; --color-accent:#88c0d0!important; }
                body { background:linear-gradient(135deg,#1c2130 0%,#242d3f 100%)!important; }
            `
        },
        'sepia': {
            name: '📜 Sepia',
            css: `
                :root { --color-accent-rgb:188,143,80!important; --color-accent:#bc8f50!important; }
                body { background:linear-gradient(135deg,#1a1408 0%,#261e0e 100%)!important; }
            `
        },
        'forest': {
            name: '🌲 Forest',
            css: `
                :root { --color-accent-rgb:102,187,106!important; --color-accent:#66bb6a!important; }
                body { background:linear-gradient(135deg,#0a1a0c 0%,#122018 100%)!important; }
            `
        },
        'crimson': {
            name: '🔴 Crimson',
            css: `
                :root { --color-accent-rgb:229,57,53!important; --color-accent:#e53935!important; }
                body { background:linear-gradient(135deg,#1a0404 0%,#260a0a 100%)!important; }
            `
        },
    };

    // ==================== ПРИМЕНЕНИЕ ====================

    function applyAll() {
        if (!settings.personalization.enabled) {
            removeAll();
            return;
        }

        applyTheme();
        applyWallpaper();
        applyAccentColor();
        applyRanobeFont();
        applyBorderRadius();
    }

    function removeAll() {
        document.getElementById('mu-theme-style')?.remove();
        document.getElementById('mu-wallpaper-style')?.remove();
        document.getElementById('mu-accent-style')?.remove();
        document.getElementById('mu-ranobe-style')?.remove();
        document.getElementById('mu-radius-style')?.remove();
    }

    function applyTheme() {
        document.getElementById('mu-theme-style')?.remove();
        const themeKey = settings.personalization.theme;
        const theme = PRESET_THEMES[themeKey];
        if (!theme || !theme.css) return;

        const style = document.createElement('style');
        style.id = 'mu-theme-style';
        style.textContent = theme.css;
        document.head.appendChild(style);
    }

    function applyWallpaper() {
        document.getElementById('mu-wallpaper-style')?.remove();
        const wallpaper = settings.personalization.customWallpaper;
        if (!wallpaper) return;

        // Безопасность: принимаем только data:image/... и http(s)-URL
        const isDataImage = wallpaper.startsWith('data:image/');
        const isHttpUrl   = /^https?:\/\//i.test(wallpaper);
        if (!isDataImage && !isHttpUrl) return;
        // Экранируем кавычки чтобы исключить CSS-инъекцию через URL
        const safeWallpaper = wallpaper.replace(/'/g, '%27').replace(/\)/g, '%29');

        const opacity = settings.personalization.wallpaperOpacity ?? 0.3;

        const style = document.createElement('style');
        style.id = 'mu-wallpaper-style';
        style.textContent = `
            body::before {
                content: '';
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url('${safeWallpaper}');
                background-size: cover;
                background-position: center;
                background-attachment: fixed;
                opacity: ${opacity};
                z-index: -1;
                pointer-events: none;
            }
            body {
                background-color: rgba(0, 0, 0, 0.85) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function applyAccentColor() {
        document.getElementById('mu-accent-style')?.remove();
        const color = settings.personalization.accentColor;
        if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return;

        // Конвертируем HEX в RGB
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const style = document.createElement('style');
        style.id = 'mu-accent-style';
        style.textContent = `
            :root {
                --color-accent: ${color} !important;
                --color-accent-rgb: ${r}, ${g}, ${b} !important;
            }
        `;
        document.head.appendChild(style);
    }

    function applyBorderRadius() {
        document.getElementById('mu-radius-style')?.remove();
        const br = settings.personalization.borderRadius || 'normal';
        if (br === 'normal') return;

        const val = br === 'sharp' ? '0px' : '20px'; // sharp=0, round=20
        const style = document.createElement('style');
        style.id = 'mu-radius-style';
        style.textContent = `:root { --radius-section-block:${val}!important; --radius-sm:${val}!important; }`;
        document.head.appendChild(style);
    }

    function applyRanobeFont() {
        document.getElementById('mu-ranobe-style')?.remove();
        const family = settings.personalization.ranobeFontFamily;
        const size   = settings.personalization.ranobeFontSize;
        const lh     = settings.personalization.ranobeLineHeight;

        if (!family && !size && !lh) return;

        const css = `
            .node-doc.text-content p.node-paragraph,
            .node-doc.text-content {
                ${family ? `font-family: ${family} !important;` : ''}
                ${size   ? `font-size: ${size}px !important;` : ''}
                ${lh     ? `line-height: ${lh} !important;` : ''}
            }
        `;

        const style = document.createElement('style');
        style.id = 'mu-ranobe-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    // Применяем стили немедленно при загрузке страницы — до задержки в main.js
    // и до проверки роли модератора. Это устраняет задержку появления темы
    // на новых вкладках и перекрытие стилями сайта при SPA-рендере.
    async function applyNow() {
        settings = await MU.getSettings();
        applyAll();
    }

    async function init() {
        // Повторно применяем (settings уже загружены в applyNow)
        if (!settings) settings = await MU.getSettings();
        applyAll();

        // Кросс-вкладочная синхронизация и изменения из настроек
        MU.on('settingsChanged', (newSettings) => {
            // Используем переданные данные напрямую — не делаем лишний async round-trip
            if (newSettings) settings = newSettings;
            applyAll();
        });

        // SPA-навигация: сайт может перерендерить страницу и перекрыть наши стили
        MU.on('urlChanged', () => {
            // Небольшая задержка чтобы сайт успел отрендериться
            setTimeout(applyAll, 300);
        });

        MU.log('Personalization', 'Модуль персонализации запущен');
    }

    return {
        init,
        applyNow,
        getPresetThemes: () => PRESET_THEMES
    };

})();
