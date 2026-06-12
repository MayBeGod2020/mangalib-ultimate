// Модуль Personalization — кастомизация интерфейса
// Темы, обои, шрифты ранобе, цветовая палитра

window.MUPersonalization = (function() {
    'use strict';

    const MU = window.MULib;

    let settings = null;

    // ==================== ГОТОВЫЕ ТЕМЫ ====================

    // Хелпер: генерирует CSS темы с правильным фоном через html (не body)
    // bg1/bg2 — цвета градиента в HEX, e1/e2/e3 — оттенки для блоков
    // Генерирует CSS темы. Прямо таргетирует .paper и header — сайт использует
    // захардкоженные цвета в своих классах, не CSS-переменные.
    function themeCss(accentHex, accentRgb, bg1, bg2, e1, e2, e3) {
        e1 = e1 || bg2;
        e2 = e2 || bg1;
        e3 = e3 || bg1;
        return `
            :root {
                --color-accent:${accentHex}!important;
                --color-accent-rgb:${accentRgb}!important;
                --color-primary:${accentHex}!important;
                --color-primary-rgb:${accentRgb}!important;
                --background:${bg2}!important;
                --background-elevated-1:${e1}!important;
                --background-elevated-2:${e2}!important;
                --background-elevated-3:${e3}!important;
                --border-base:rgba(255,255,255,0.10)!important;
                --border-light:rgba(255,255,255,0.07)!important;
            }
            html { background:linear-gradient(160deg,${bg1} 0%,${bg2} 100%) fixed!important; }
            body { background:transparent!important; }
            /* Прямой таргет — сайт использует background-shorthand, не CSS-переменные */
            /* .paper — «Сейчас читают», «Последние обновления» и другие секции */
            .paper,
            .section.paper,
            /* og_g — блок «Продолжить читать» (не .paper) */
            .og_g { background:${e1}!important; }
            /* Шапка сайта */
            [data-header], header, .n6_g { background:${e2}!important; }
            /* Карточки-ссылки (продолжить читать) */
            .card-inline._elevated-2 { background:${e1}!important; }
        `;
    }

    const PRESET_THEMES = {
        'default': { name: 'По умолчанию', css: '' },
        //                  accent      accentRgb          bg-dark    bg-base    el-1       el-2       el-3
        'mint':     { name: '🌿 Mint',     css: themeCss('#00e676','0,230,118',  '#060f18','#0a1624','#122030','#1a2d42','#223550') },
        'cyberpunk':{ name: '🟣 Cyberpunk',css: themeCss('#ff00c8','255,0,200', '#060010','#0e001c','#180028','#200032','#280040') +
                                                `.button,.btn,button{text-shadow:0 0 4px currentColor!important;}` },
        'nature':   { name: '🟢 Nature',   css: themeCss('#4caf50','76,175,80',  '#060e06','#0d1a0d','#132213','#1a2a1a','#203220') },
        'ocean':    { name: '🔵 Ocean',    css: themeCss('#2196f3','33,150,243', '#000d1a','#001629','#001f38','#002848','#003058') },
        'sunset':   { name: '🟠 Sunset',   css: themeCss('#ff9800','255,152,0',  '#140500','#1f0a00','#2a1000','#361500','#421a00') },
        'sakura':   { name: '🌸 Sakura',   css: themeCss('#e95885','233,88,133', '#110608','#1a0a10','#22101a','#2a1522','#32192a') },
        'midnight': { name: '🌙 Midnight', css: themeCss('#64b5f6','100,181,246','#03060e','#060914','#0b1020','#10182c','#152038') },
        'nord':     { name: '❄️ Nord',     css: themeCss('#88c0d0','136,192,208','#161d2a','#1c2130','#222838','#293040','#303848') },
        'sepia':    { name: '📜 Sepia',    css: themeCss('#bc8f50','188,143,80', '#110e06','#1a1408','#221c0e','#2a2214','#32281a') },
        'forest':   { name: '🌲 Forest',   css: themeCss('#66bb6a','102,187,106','#060d06','#0a1a0c','#101f10','#152614','#1a2e18') },
        'crimson':  { name: '🔴 Crimson',  css: themeCss('#e53935','229,57,53',  '#110202','#1a0404','#220808','#2a0c0c','#321010') },
        'glass':    { name: '🪟 Glass',    css: themeCss('#8ab4f8','138,180,248','#04060f','#060916','#0d1222','#14202e','#1c2e3a') },
    };

    // ==================== ПРИМЕНЕНИЕ ====================

    function applyAll() {
        if (!settings.personalization.enabled) {
            removeAll();
            return;
        }

        applyTheme();
        applyBgColor();
        applyWallpaper();
        applyAccentColor();
        applyRanobeFont();
        applyBorderRadius();
        applyGlass();
    }

    function removeAll() {
        document.getElementById('mu-theme-style')?.remove();
        document.getElementById('mu-bgcolor-style')?.remove();
        document.getElementById('mu-wallpaper-style')?.remove();
        document.getElementById('mu-accent-style')?.remove();
        document.getElementById('mu-ranobe-style')?.remove();
        document.getElementById('mu-radius-style')?.remove();
        document.getElementById('mu-glass-style')?.remove();
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

        const opacity     = settings.personalization.wallpaperOpacity ?? 0.3;
        const glassActive = settings.personalization.glassEffect;

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
                /* При glassmorphism нужен более прозрачный фон чтобы обои просвечивали */
                background-color: ${glassActive ? 'rgba(0,0,0,0.60)' : 'rgba(0,0,0,0.85)'} !important;
            }
        `;
        document.head.appendChild(style);
    }

    function applyAccentColor() {
        document.getElementById('mu-accent-style')?.remove();
        const color = settings.personalization.accentColor;
        if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return;

        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        const style = document.createElement('style');
        style.id = 'mu-accent-style';
        // Переопределяем все возможные CSS-переменные акцента которые использует сайт
        style.textContent = `
            :root {
                --color-accent:       ${color} !important;
                --color-accent-rgb:   ${r},${g},${b} !important;
                --color-primary:      ${color} !important;
                --color-primary-rgb:  ${r},${g},${b} !important;
                --primary:            ${color} !important;
                --accent:             ${color} !important;
                --mu-accent:          ${color} !important;
            }
            a { color: ${color} !important; }
            a:hover { opacity: 0.8; }
            .button--primary, .btn-primary,
            [class*="btn"][class*="primary"],
            [class*="button"][class*="primary"] {
                background-color: ${color} !important;
                border-color: ${color} !important;
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

    function applyBgColor() {
        document.getElementById('mu-bgcolor-style')?.remove();
        const color = settings.personalization.bgColor;
        if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return;

        const r = parseInt(color.slice(1,3),16);
        const g = parseInt(color.slice(3,5),16);
        const b = parseInt(color.slice(5,7),16);

        // Генерируем несколько оттенков на основе выбранного цвета:
        // base — выбранный, elevated1 — чуть светлее, elevated2 — ещё светлее, dark — темнее
        const clamp  = (v) => Math.max(0, Math.min(255, v));
        const toHex  = (v) => clamp(v).toString(16).padStart(2,'0');
        const shift  = (dr,dg,db) => `#${toHex(r+dr)}${toHex(g+dg)}${toHex(b+db)}`;
        const toRgb  = (dr,dg,db) => `${clamp(r+dr)},${clamp(g+dg)},${clamp(b+db)}`;

        const dark     = shift(-30,-30,-30);   // темнее для градиента
        const el1      = shift(18, 18, 18);    // --background-elevated-1
        const el2      = shift(30, 30, 30);    // --background-elevated-2
        const el3      = shift(40, 40, 40);    // --background-elevated-3

        const style = document.createElement('style');
        style.id = 'mu-bgcolor-style';
        style.textContent = `
            html { background:linear-gradient(160deg,${color} 0%,${dark} 100%) fixed!important; }
            body { background:transparent!important; }
            :root {
                --background:            rgb(${toRgb(0,0,0)}) !important;
                --background-rgb:        ${toRgb(0,0,0)} !important;
                --background-elevated-1: rgb(${toRgb(18,18,18)}) !important;
                --background-elevated-2: rgb(${toRgb(30,30,30)}) !important;
                --background-elevated-3: rgb(${toRgb(40,40,40)}) !important;
                --background-fill-4:     rgba(255,255,255,0.05) !important;
                --input-bg:              rgb(${toRgb(22,22,22)}) !important;
                --input-border:          rgba(255,255,255,0.12) !important;
                --border-base:           rgba(255,255,255,0.10) !important;
                --border-light:          rgba(255,255,255,0.07) !important;
            }
            /* Прямой таргет — сайт использует background-shorthand, не CSS-переменные */
            .paper,
            .section.paper,
            .og_g { background:rgb(${toRgb(18,18,18)})!important; }
            [data-header], header, .n6_g { background:rgb(${toRgb(30,30,30)})!important; }
            .card-inline._elevated-2 { background:rgb(${toRgb(18,18,18)})!important; }
        `;
        document.head.appendChild(style);
    }

    function applyGlass() {
        document.getElementById('mu-glass-style')?.remove();
        if (!settings.personalization.glassEffect) return;
        // Без обоев glassmorphism выглядит некорректно — просто смывает фон
        if (!settings.personalization.customWallpaper) return;

        const style = document.createElement('style');
        style.id = 'mu-glass-style';
        // Переопределяем CSS-переменные фона на полупрозрачные rgba —
        // все элементы сайта, использующие эти переменные, станут прозрачными.
        // backdrop-filter добавляем только к верхнеуровневым контейнерам,
        // чтобы не убить производительность.
        style.textContent = `
            :root {
                --background:            rgba(8,  8, 18, 0.40) !important;
                --background-elevated-1: rgba(16, 16, 28, 0.52) !important;
                --background-elevated-2: rgba(10, 10, 22, 0.62) !important;
                --background-fill-4:     rgba(255,255,255, 0.05) !important;
                --input-bg:              rgba(255,255,255, 0.07) !important;
            }
            header, .header, [class*="-header"],
            .layout, .layout-page, main,
            aside, .sidebar, [class*="sidebar"],
            .app-body, .app-content,
            .modal__content, .popup__content,
            .dropdown__content, [class*="dropdown"],
            .card, [class*="-card"], [class*="card-"],
            .chapter-item, [class*="chapter-item"],
            .book-item, [class*="book-item"],
            .comments-section, .comment-item,
            .forum-item, [class*="forum"],
            nav, .nav, footer {
                backdrop-filter: blur(14px) saturate(1.3) !important;
                -webkit-backdrop-filter: blur(14px) saturate(1.3) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function applyRanobeFont() {
        document.getElementById('mu-ranobe-style')?.remove();
        const family = settings.personalization.ranobeFontFamily;
        const size   = settings.personalization.ranobeFontSize;
        const lh     = settings.personalization.ranobeLineHeight;

        const def = MU.DEFAULT_SETTINGS.personalization;
        if (!family && size === def.ranobeFontSize && lh === def.ranobeLineHeight) return;

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
