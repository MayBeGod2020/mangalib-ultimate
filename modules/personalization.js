// Модуль Personalization — кастомизация интерфейса
// Темы, обои, шрифты ранобе, цветовая палитра

window.MUPersonalization = (function() {
    'use strict';

    const MU = window.MULib;

    let settings = null;

    // ==================== ГОТОВЫЕ ТЕМЫ ====================

    const PRESET_THEMES = {
        'default': {
            name: 'По умолчанию',
            css: ''
        },
        'cyberpunk': {
            name: 'Cyberpunk',
            css: `
                :root {
                    --color-accent-rgb: 255, 0, 200 !important;
                    --color-accent: #ff00c8 !important;
                }
                body {
                    background: linear-gradient(135deg, #0a0014 0%, #14001f 100%) !important;
                }
                .button, .btn, button {
                    text-shadow: 0 0 4px currentColor !important;
                }
            `
        },
        'nature': {
            name: 'Nature',
            css: `
                :root {
                    --color-accent-rgb: 76, 175, 80 !important;
                    --color-accent: #4caf50 !important;
                }
                body {
                    background: linear-gradient(135deg, #0d1a0d 0%, #1a2a1a 100%) !important;
                }
            `
        },
        'ocean': {
            name: 'Ocean',
            css: `
                :root {
                    --color-accent-rgb: 33, 150, 243 !important;
                    --color-accent: #2196f3 !important;
                }
                body {
                    background: linear-gradient(135deg, #001629 0%, #002a4d 100%) !important;
                }
            `
        },
        'sunset': {
            name: 'Sunset',
            css: `
                :root {
                    --color-accent-rgb: 255, 152, 0 !important;
                    --color-accent: #ff9800 !important;
                }
                body {
                    background: linear-gradient(135deg, #1f0a00 0%, #3d1500 100%) !important;
                }
            `
        }
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
    }

    function removeAll() {
        document.getElementById('mu-theme-style')?.remove();
        document.getElementById('mu-wallpaper-style')?.remove();
        document.getElementById('mu-accent-style')?.remove();
        document.getElementById('mu-ranobe-style')?.remove();
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

    // ==================== ГОРЯЧАЯ КЛАВИША CTRL+SHIFT+T ====================

    function showThemeToast(name) {
        document.getElementById('mu-theme-toast')?.remove();
        const toast = document.createElement('div');
        toast.id = 'mu-theme-toast';
        toast.style.cssText = `
            position:fixed;top:60px;left:50%;transform:translateX(-50%);
            z-index:999999;
            background:var(--background-elevated-1,#fff);
            border:1px solid var(--mu-accent,#f39c12);
            border-radius:8px;padding:8px 18px;
            font-family:var(--reader-font-family,-apple-system,sans-serif);
            font-size:13px;color:var(--mu-accent,#f39c12);font-weight:600;
            pointer-events:none;
            box-shadow:0 4px 16px rgba(0,0,0,0.12);
            animation:mu-toast-in 0.2s ease;
        `;
        if (!document.getElementById('mu-toast-anim')) {
            const s = document.createElement('style');
            s.id = 'mu-toast-anim';
            s.textContent = `@keyframes mu-toast-in{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
            document.head.appendChild(s);
        }
        toast.textContent = `🎨 Тема: ${name}`;
        document.body.appendChild(toast);
        setTimeout(() => toast?.remove(), 2000);
    }

    function setupThemeHotkey() {
        const themeKeys = Object.keys(PRESET_THEMES);
        document.addEventListener('keydown', async (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                if (!settings.personalization.enabled) {
                    await MU.updateSetting('personalization', 'enabled', true);
                }
                const cur = settings.personalization.theme || 'default';
                const idx = themeKeys.indexOf(cur);
                const next = themeKeys[(idx + 1) % themeKeys.length];
                await MU.updateSetting('personalization', 'theme', next);
                settings = await MU.getSettings();
                applyAll();
                showThemeToast(PRESET_THEMES[next].name);
            }
        });
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================

    async function init() {
        settings = await MU.getSettings();

        applyAll();
        setupThemeHotkey();

        MU.on('settingsChanged', async () => {
            settings = await MU.getSettings();
            applyAll();
        });

        MU.log('Personalization', 'Модуль персонализации запущен');
    }

    return {
        init,
        getPresetThemes: () => PRESET_THEMES
    };

})();
