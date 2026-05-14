window.MUModeration = (function() {
    'use strict';

    const MU = window.MULib;

    const REASON_MAP = {
        'без причины':                            '6',
        'оскорбление пользователей':              '3',
        'флуд / оффтоп / комментарий без смысла': '4',
        'реклама / спам':                         '5',
        'спойлер':                                '1',
        'провокации / конфликты':                 '7',
        'ненормативная лексика':                  '2',
        'запрещенный / непотребный контент':      '8',
        'бессмысленная / пустая тема':            '9',
        'дубликат темы':                          '10',
        'некорректный заголовок':                 '11',
        'твинк аккаунт':                          '12',
    };

    const RULES_CHEATSHEET = {
        '3': { title: '1. Оскорбления — от 7 дней', color: '#e74c3c', items: [
            'Прямые оскорбления, оскорбления вопросом',
            'Завуалированные оскорбления («пнх», «муд*к», на другом языке)',
            'Оскорбление групп пользователей, родственников',
            'Оскорбление национальности, расы, политических взглядов',
            'Оскорбление труда переводчика/автора',
            'Просьбы ускорить выход главы, «не сдох ли переводчик»',
        ]},
        '4': { title: '2. Флуд / Оффтоп — от 1 дня', color: '#f39c12', items: [
            'Комментарии без смысловой нагрузки («++++», «Плюсую»)',
            'Бессмысленный набор символов, чрезмерный капс',
            'Чрезмерное использование эмодзи (больше 15 символов)',
            'Дублирование похожих сообщений',
            '«Ура, глава», «Наконец дождался», «Погнали»',
            '«№ круг», «Вернулся перечитать № раз»',
            '«А когда глава?», «Почему так долго?»',
            'Оффтоп — диалог ушёл от темы главы/тайтла',
        ]},
        '1': { title: '3. Спойлеры — от 2 дней', color: '#9b59b6', items: [
            'Преждевременно раскрытая сюжетная информация',
            'Текст не заключён в тег [spoiler]',
            'Ссылки на оригинал, если глава ещё не переведена',
        ]},
        '5': { title: '4. Реклама / Спам — от 5 дней', color: '#e67e22', items: [
            'Ссылки/названия/упоминания сайтов-конкурентов',
            'Ссылки на работу другой команды (не указанной на странице)',
            'Призывы читать на другом сайте или «там больше глав»',
            'Призывы перейти, подписаться, проголосовать',
            'Реклама услуг/товаров и сторонних ресурсов',
            'Несогласованные с администрацией розыгрыши',
        ]},
        '7': { title: '5. Провокации / Конфликты — от 3 дней', color: '#e67e22', items: [
            'Обсуждение религии, политики, идеологий',
            'Конфликты на тему яоя, эротики, хентая, юри',
            '«Фу, опять *жанр*», «Кто это читает?»',
            'Обсуждение военного конфликта России и Украины',
            'Обвинения, провокации, участие в конфликте',
            'Лозунги, патриотические высказывания',
        ]},
        '2': { title: '6. Ненормативная лексика', color: '#e74c3c', items: [
            'Текст состоит в основном или только из мата',
            'Большое количество необоснованной ненормативной лексики = флуд',
        ]},
        '8': { title: '7. Запрещённый контент — от 7 дней', color: '#c0392b', items: [
            'Способы/призывы к суициду, обсуждение суицида',
            'Призыв к насилию или травле',
            'Расчленёнка, насилие, жестокость',
            'Сексуальный контент (ссылки, изображения, детальное описание)',
            'Любые виды пропаганды',
            'Контент из реестров запрещённых материалов',
        ]},
        '12': { title: '9. Твинк аккаунт — перманентный', color: '#1abc9c', items: [
            'Создание/использование другого аккаунта в обход бана',
            'Банится основной аккаунт и все твинки',
        ]},
        '9': { title: '1. Бессмысленная / Пустая тема (форум) — от 1 дня', color: '#95a5a6', items: [
            'Семейные/личные проблемы, поиск отношений',
            'Глупые вопросы или бессмысленные обсуждения',
            'Категория поста не соответствует содержанию',
        ]},
        '10': { title: '2. Дубликат темы (форум) — от 6 часов', color: '#3498db', items: [
            'Тема/вопрос уже существует (за последние 2 дня)',
            'Дубликаты создают дезинформацию',
        ]},
        '11': { title: '3. Некорректный заголовок (форум) — от 2 часов', color: '#3498db', items: [
            'Заголовок не отражает содержание темы',
            'Большая часть заголовка в капсе или из символов/эмодзи',
            'Содержит нецензурную лексику',
        ]},
    };

    const REASON_COLORS = {
        'ненормативная лексика':                  '#e74c3c',
        'оскорбление пользователей':              '#e74c3c',
        'запрещенный / непотребный контент':      '#c0392b',
        'провокации / конфликты':                 '#e67e22',
        'реклама / спам':                         '#f39c12',
        'флуд / оффтоп / комментарий без смысла': '#f39c12',
        'спойлер':                                '#9b59b6',
        'твинк аккаунт':                          '#1abc9c',
        'некорректный заголовок':                 '#3498db',
        'дубликат темы':                          '#3498db',
        'бессмысленная / пустая тема':            '#95a5a6',
        'без причины':                            '#95a5a6',
    };

    let settings       = null;
    let activeCard     = null;
    let activeComment  = null; // комментарий на страницах манги/аниме
    let popupFilled    = false;

    // ==================== ШПАРГАЛКА ====================

    function injectCheatsheet(popup, selectValue) {
        if (!settings?.moderation?.cheatsheet) return;
        popup.querySelector('#mod-cheatsheet')?.remove();
        const rule = RULES_CHEATSHEET[selectValue];
        if (!rule) return;

        const textarea = popup.querySelector('textarea.form-input__field');
        const el = document.createElement('div');
        el.id = 'mod-cheatsheet';
        el.style.cssText = `margin:8px 0;padding:8px 10px;border-left:3px solid ${rule.color};background:rgba(0,0,0,0.15);border-radius:4px;font-size:11px;line-height:1.5;`;

        const title = document.createElement('div');
        title.style.cssText = `font-weight:600;margin-bottom:6px;color:${rule.color}`;
        title.textContent = rule.title;
        el.appendChild(title);

        const hint = document.createElement('div');
        hint.style.cssText = `font-size:10px;opacity:0.6;margin-bottom:4px`;
        hint.textContent = '👆 Нажми на пункт — добавится в комментарий';
        el.appendChild(hint);

        const ul = document.createElement('ul');
        ul.style.cssText = `margin:0;padding-left:14px;`;

        rule.items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            li.style.cssText = `cursor:pointer;padding:2px 0;opacity:0.85;border-radius:3px;transition:opacity 0.15s;`;
            li.addEventListener('mouseenter', () => { li.style.opacity='1'; li.style.color=rule.color; });
            li.addEventListener('mouseleave', () => { li.style.opacity='0.85'; li.style.color=''; });
            li.addEventListener('click', () => {
                if (!textarea) return;
                textarea.value += `\n⚠️ ${item}`;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                li.style.color = '#2ecc71';
                setTimeout(() => { li.style.color=''; li.style.opacity='0.85'; }, 600);
            });
            ul.appendChild(li);
        });
        el.appendChild(ul);

        const group = [...popup.querySelectorAll('.form-group')].find(g => g.innerText.includes('Комментарий от модератора'));
        if (group) group.insertAdjacentElement('beforebegin', el);
    }

    function setTextarea(textarea, text) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function forceSelect(popup, reason) {
        const value = REASON_MAP[reason.toLowerCase().trim()];
        if (!value) return;

        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            // Ищем select — сначала по классу, потом любой в попапе
            const select = popup.querySelector('select.form-input__field')
                        || popup.querySelector('select[class*="form-input"]')
                        || popup.querySelector('select');
            if (!select) { if (attempts >= 10) clearInterval(interval); return; }
            const option = [...select.options].find(o => o.value === value);
            if (option) option.selected = true;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
            if (select.value === value || attempts >= 10) {
                clearInterval(interval);
                injectCheatsheet(popup, value);
            }
        }, 100);
    }

    function autoCheckBanCheckbox(popup) {
        const setting = settings?.moderation?.autoCheckBan;
        // null/undefined/'default' = не трогать, true/'checked' = ставить, false/'unchecked' = снимать
        if (setting === undefined || setting === null || setting === 'default') return;

        setTimeout(() => {
            const checkbox = popup.querySelector('.control__input[type="checkbox"]')
                          || popup.querySelector('input[type="checkbox"]');
            if (!checkbox) return;
            const shouldCheck = (setting === true || setting === 'checked');
            if (shouldCheck && !checkbox.checked) checkbox.click();
            if (!shouldCheck && checkbox.checked) checkbox.click();
        }, 150);
    }

    // ==================== СЕЛЕКТОРЫ КАРТОЧЕК ====================

    // Структура страницы модерации:
    //   .reports-container > div.aek_ael (карточка)
    //     div.aek_ag (заголовок: причина, счётчик, время, репортёр)
    //       span.aek_f3 ← текст причины
    //     div.comment.iz_z (тело: аватар, ник, текст комментария, ссылки)
    // Классы aek_* — хешированные, могут меняться. Используем позиционные селекторы.
    const CARD_SEL   = '.aek_ael, .abz_ab0, [class*="abz_ab"]';
    const HEADER_SEL = '.aek_ag, .abz_ah, [class*="abz_ah"]';

    // Причина — первый span в заголовке карточки
    function getCardReason(card) {
        // Заголовок — первый дочерний div карточки (до .comment)
        const header = card.querySelector(HEADER_SEL)
                    || card.firstElementChild;
        if (header) {
            // Берём текст первого span-а в заголовке
            const span = header.querySelector('span');
            if (span) {
                const t = (span.textContent || '').trim().toLowerCase();
                if (t) return t;
            }
        }

        // Фолбэк: ищем причину по всему textContent карточки
        const cardText = (card.textContent || '').toLowerCase().replace(/\s+/g, ' ');
        for (const reason of Object.keys(REASON_MAP)) {
            if (cardText.includes(reason)) return reason;
        }
        return '';
    }

    // Элемент с текстом причины для цветовой подсветки
    function getReasonElement(card) {
        const header = card.querySelector(HEADER_SEL) || card.firstElementChild;
        return header?.querySelector('span') || null;
    }

    // Причина с заглавной буквой для отображения
    function reasonDisplay(reason) {
        return reason.charAt(0).toUpperCase() + reason.slice(1);
    }

    // ==================== ИСТОРИЯ БАНОВ НА КАРТОЧКАХ ====================

    const BAN_CACHE = {};

    async function fetchBanCount(userId) {
        if (BAN_CACHE[userId] !== undefined) return BAN_CACHE[userId];
        try {
            const resp = await fetch(
                `https://api.cdnlibs.org/api/user/${userId}?fields[]=ban_info`
            );
            if (!resp.ok) { BAN_CACHE[userId] = null; return null; }
            const json = await resp.json();
            // ban_info.count если есть, иначе просто факт наличия бана
            const info = json?.data?.ban_info;
            BAN_CACHE[userId] = info ?? null;
            return BAN_CACHE[userId];
        } catch { BAN_CACHE[userId] = null; return null; }
    }

    async function injectBanBadge(card) {
        if (card.dataset.banChecked) return;
        card.dataset.banChecked = 'true';

        // Ищем ссылку на профиль пользователя в теле комментария
        const body     = card.querySelector('.comment') || card;
        const userLink = body.querySelector('a[href*="/user/"]') || card.querySelector('a[href*="/user/"]');
        if (!userLink) return;

        const match = userLink.href?.match(/\/user\/(\d+)/);
        if (!match) return;
        const userId = match[1];

        const banInfo = await fetchBanCount(userId);

        // Находим блок автора
        const authorEl = card.querySelector('.comment-author__name')
                       || card.querySelector('[class*="comment-author"]')
                       || userLink;
        if (!authorEl) return;

        // Удаляем старый бейдж если есть
        authorEl.parentElement?.querySelector('.mu-ban-count')?.remove();

        // ban_info — массив активных банов
        const bans = Array.isArray(banInfo) ? banInfo : (banInfo ? [banInfo] : []);
        if (bans.length > 0) {
            const ban   = bans[0]; // берём первый (актуальный)
            const until = ban.expired_at
                ? `до ${new Date(ban.expired_at).toLocaleDateString('ru', { day:'2-digit', month:'2-digit', year:'numeric' })}`
                : 'навсегда';
            const reason = ban.reason?.label || '—';

            const badge = document.createElement('span');
            badge.className = 'mu-ban-count';
            badge.title = `${reason} · ${until}`;
            badge.style.cssText = `
                display:inline-flex;align-items:center;gap:3px;
                margin-left:6px;padding:1px 6px;border-radius:8px;
                background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.5);
                color:#e74c3c;font-size:10px;font-weight:700;
                cursor:default;vertical-align:middle;white-space:nowrap;
            `;
            badge.textContent = `🔨 ${until}`;
            authorEl.parentElement
                ? authorEl.insertAdjacentElement('afterend', badge)
                : authorEl.appendChild(badge);
        }
    }

    // ==================== ЦВЕТОВАЯ КОДИРОВКА ====================

    function colorizeCards() {
        if (!settings?.moderation?.colorizeCards) return;
        document.querySelectorAll(CARD_SEL).forEach(card => {
            // Бейдж банов — всегда, независимо от colorize
            injectBanBadge(card);

            if (card.dataset.colored) return;
            card.dataset.colored = 'true';

            const reason = getCardReason(card);
            const color  = REASON_COLORS[reason];
            if (!color) return;

            card.style.borderLeft  = `4px solid ${color}`;
            card.style.paddingLeft = '8px';

            const reasonEl = getReasonElement(card);
            if (reasonEl) {
                reasonEl.style.backgroundColor = color;
                reasonEl.style.color           = '#fff';
                reasonEl.style.padding         = '2px 6px';
                reasonEl.style.borderRadius    = '4px';
                reasonEl.style.fontSize        = '12px';
            }
        });
    }

    // ==================== ФИЛЬТР + МАССОВОЕ УДАЛЕНИЕ ====================

    let activeFilter = null;
    let updateMassButton = null;

    function buildFilterPanel() {
        const onModPage = location.href.includes('/moderation/comments')
            || (location.href.includes('/moderation') && !!document.querySelector('.reports-container'));
        if (!onModPage) return;

        const cards = document.querySelectorAll(CARD_SEL);
        const reasons = new Set();
        cards.forEach(card => {
            const text = getCardReason(card);
            if (text) reasons.add(text);
        });
        if (reasons.size === 0) return;

        const existing = document.getElementById('mod-filter-panel');
        const existingReasons = existing
            ? new Set([...existing.querySelectorAll('button[data-reason]')].map(b => b.dataset.reason))
            : new Set();

        const allPresent = [...reasons].every(r => existingReasons.has(r));
        if (existing && allPresent) {
            // Просто обновляем счётчик кнопки массового удаления
            if (updateMassButton) updateMassButton();
            return;
        }

        existing?.remove();

        const panel = document.createElement('div');
        panel.id = 'mod-filter-panel';
        panel.style.cssText = `position:sticky;top:0;z-index:100;background:var(--color-background-primary,#1a1a2e);padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:8px;align-items:center;`;

        const allBtn = document.createElement('button');
        allBtn.textContent = 'Все';
        allBtn.style.cssText = `padding:3px 10px;border-radius:12px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.15);color:inherit;cursor:pointer;font-size:11px;font-weight:600;`;
        allBtn.addEventListener('click', () => {
            activeFilter = null;
            document.querySelectorAll(CARD_SEL).forEach(c => c.style.display='');
            panel.querySelectorAll('button[data-reason]').forEach(b => b.style.background='transparent');
            updateMassButton();
        });
        panel.appendChild(allBtn);

        reasons.forEach(reason => {
            const color = REASON_COLORS[reason] || '#95a5a6';
            const btn   = document.createElement('button');
            btn.textContent    = reasonDisplay(reason);
            btn.dataset.reason = reason;
            btn.style.cssText  = `padding:3px 10px;border-radius:12px;border:1px solid ${color};background:transparent;color:${color};cursor:pointer;font-size:11px;`;
            btn.addEventListener('click', () => {
                if (activeFilter === reason) {
                    activeFilter = null;
                    document.querySelectorAll(CARD_SEL).forEach(c => c.style.display='');
                } else {
                    activeFilter = reason;
                    document.querySelectorAll(CARD_SEL).forEach(card => {
                        card.style.display = getCardReason(card) === reason ? '' : 'none';
                    });
                }
                panel.querySelectorAll('button[data-reason]').forEach(b => {
                    const c = REASON_COLORS[b.dataset.reason.toLowerCase()] || '#95a5a6';
                    b.style.background = b.dataset.reason === activeFilter ? c + '44' : 'transparent';
                });
                updateMassButton();
            });
            panel.appendChild(btn);
        });

        // Разделитель
        const divider = document.createElement('div');
        divider.style.cssText = `flex:1;`;
        panel.appendChild(divider);

        // Кнопка массового удаления
        const massBtn = document.createElement('button');
        massBtn.id = 'mod-mass-delete';
        massBtn.style.cssText = `padding:4px 12px;border-radius:12px;border:1px solid #e74c3c;background:rgba(231,76,60,0.1);color:#e74c3c;cursor:pointer;font-size:11px;font-weight:600;`;
        massBtn.addEventListener('click', () => massDeleteVisible());
        panel.appendChild(massBtn);

        updateMassButton = function() {
            const visibleCards = [...document.querySelectorAll(CARD_SEL)].filter(c =>
                c.style.display !== 'none' && !c.dataset.viewed
            );
            const count = visibleCards.length;
            if (activeFilter) {
                massBtn.textContent = `🗑️ Удалить все "${reasonDisplay(activeFilter)}" (${count})`;
            } else {
                massBtn.textContent = `🗑️ Удалить все (${count})`;
            }
            massBtn.disabled = count === 0;
            massBtn.style.opacity = count === 0 ? '0.4' : '1';
            massBtn.style.cursor  = count === 0 ? 'not-allowed' : 'pointer';
        };

        updateMassButton();

        // Вставляем панель перед контейнером жалоб
        const container = document.querySelector('.reports-container');
        if (container) {
            container.insertAdjacentElement('beforebegin', panel);
        } else {
            const firstCard = document.querySelector(CARD_SEL);
            firstCard?.parentElement?.insertBefore(panel, firstCard);
        }
    }

    // Ждёт появления попапа, таймаут ms
    function waitForPopup(ms = 2500) {
        return new Promise(resolve => {
            const deadline = Date.now() + ms;
            (function check() {
                const p = document.querySelector('.popup-body')
                       || document.querySelector('[class*="popup__body"]')
                       || document.querySelector('.modal-body');
                if (p)                    { resolve(p);    return; }
                if (Date.now() > deadline){ resolve(null); return; }
                setTimeout(check, 80);
            })();
        });
    }

    // Ждёт закрытия попапа, таймаут ms
    function waitForPopupClose(ms = 4000) {
        return new Promise(resolve => {
            const deadline = Date.now() + ms;
            (function check() {
                const p = document.querySelector('.popup-body')
                       || document.querySelector('[class*="popup__body"]')
                       || document.querySelector('.modal-body');
                if (!p)                   { resolve(); return; }
                if (Date.now() > deadline){ resolve(); return; }
                setTimeout(check, 80);
            })();
        });
    }

    let _massDeleteRunning = false;

    async function massDeleteVisible() {
        if (_massDeleteRunning) return;

        const visibleCards = [...document.querySelectorAll(CARD_SEL)].filter(c =>
            c.style.display !== 'none' && !c.dataset.viewed
        );
        const count = visibleCards.length;
        if (count === 0) return;

        const filterText = activeFilter ? ` категории "${activeFilter}"` : '';

        if (!confirm(`Удалить ${count} комментариев${filterText} БЕЗ бана пользователей?\n\nКомментарии будут удалены со страниц где они были написаны.`)) {
            return;
        }

        if (!confirm(`⚠️ ВЫ УВЕРЕНЫ?\n\nБудет удалено ${count} комментариев. Это действие НЕЛЬЗЯ отменить.\n\nПродолжить?`)) {
            return;
        }

        // Индикатор прогресса
        const progress = document.createElement('div');
        progress.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#0f0f1a;border:2px solid #e74c3c;border-radius:12px;padding:20px 30px;z-index:99999;color:#fff;font-family:-apple-system,sans-serif;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.8);min-width:240px;`;
        MU.setHTML(progress, `
            <div style="color:#e74c3c;font-size:14px;font-weight:600;margin-bottom:10px">🗑️ Массовое удаление</div>
            <div id="mass-progress-text" style="color:#ccc;font-size:12px;margin-bottom:8px">0 / ${MU.esc(count)}</div>
            <div style="width:200px;height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;margin:0 auto">
                <div id="mass-progress-bar" style="width:0%;height:100%;background:#e74c3c;transition:width 0.2s"></div>
            </div>
            <button id="mass-cancel-btn" style="margin-top:12px;padding:4px 12px;border:1px solid #95a5a6;background:transparent;color:#95a5a6;border-radius:6px;cursor:pointer;font-size:11px">Остановить</button>
        `);
        document.body.appendChild(progress);

        _massDeleteRunning = true;
        let cancelled = false;
        document.getElementById('mass-cancel-btn')?.addEventListener('click', () => { cancelled = true; });

        let processed = 0;
        let skipped   = 0;

        for (const card of visibleCards) {
            if (cancelled) break;

            const delBtn = [...card.querySelectorAll('button, a')]
                .find(b => b.innerText?.trim().toLowerCase() === 'удалить');

            if (!delBtn) { skipped++; continue; }

            // Устанавливаем активную карточку чтобы autoFillPopup знал контекст
            activeCard   = card;
            popupFilled  = false;

            delBtn.click();

            // Ждём появления попапа (он может открыться не мгновенно)
            const popup = await waitForPopup(2500);

            if (popup) {
                // Даём autoFillPopup заполнить textarea если включён
                await new Promise(r => setTimeout(r, 400));

                // Кликаем кнопку подтверждения (то же что Ctrl+Enter)
                const submitBtn = popup.querySelector('.btn.is-filled.variant-danger');
                if (submitBtn) {
                    submitBtn.click();
                    // Ждём закрытия попапа
                    await waitForPopupClose(4000);
                } else {
                    // Нет кнопки подтверждения — закрываем попап и пропускаем
                    popup.querySelector('.popup-close, [class*="popup-close"]')?.click();
                    await waitForPopupClose(1500);
                    skipped++;
                    continue;
                }
            } else {
                // Попап не открылся — возможно удаление прошло без попапа
                await new Promise(r => setTimeout(r, 300));
            }

            card.dataset.viewed = 'true';
            card.dataset.banned = 'true'; // помечаем чтобы observer не делал grayscale повторно
            card.style.opacity  = '0.4';
            card.style.filter   = 'grayscale(60%)';
            processed++;

            const progressText = document.getElementById('mass-progress-text');
            if (progressText) progressText.textContent = `${processed} / ${count}`;
            const bar = document.getElementById('mass-progress-bar');
            if (bar) bar.style.width = `${(processed / count) * 100}%`;

            // Небольшая пауза между карточками чтобы не нагружать сервер
            await new Promise(r => setTimeout(r, 200));
        }

        updateMassButton?.();

        MU.setHTML(progress, `
            <div style="color:#2ecc71;font-size:14px;font-weight:600;margin-bottom:6px">✓ Готово</div>
            <div style="color:#ccc;font-size:12px">
                Удалено: ${MU.esc(processed)}${skipped ? ` · пропущено: ${MU.esc(skipped)}` : ''}${cancelled ? ' (остановлено)' : ''}
            </div>
        `);
        setTimeout(() => progress.remove(), 3000);
        _massDeleteRunning = false;
    }

    // ==================== ТАЙТЛ ====================

    function slugToTitle(slug) {
        return slug.replace(/^\d+--?/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function getApiInfo(href) {
        try {
            const url  = new URL(href);
            const host = url.hostname;
            const path = url.pathname;
            let slug   = null;

            const mangaMatch = path.match(/\/(?:manga|book|anime)\/([^/?]+)/);
            if (mangaMatch) slug = mangaMatch[1];
            if (!slug) {
                const chapterMatch = path.match(/\/ru\/(?:anime\/)?([^/]+)\/(?:read|watch)/);
                if (chapterMatch) slug = chapterMatch[1];
            }
            if (!slug) return null;

            const config = MU.SITE_CONFIG[host] || { endpoint: 'manga', siteId: '1' };
            return { slug, endpoint: config.endpoint, siteId: config.siteId };
        } catch (e) { return null; }
    }

    async function fetchTitle(href) {
        if (!href) return '—';
        const info = getApiInfo(href);
        if (!info) return '—';

        const cacheKey = `mu_title_${info.slug}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) return cached;

        const fallback = slugToTitle(info.slug);
        try {
            const data = await MU.apiCall(`${info.endpoint}/${info.slug}`, { siteId: info.siteId });
            const title = data?.data?.rus_name || data?.data?.name || fallback;
            sessionStorage.setItem(cacheKey, title);
            return title;
        } catch (e) { return fallback; }
    }

    // ==================== ДАННЫЕ КАРТОЧКИ ====================

    function parseCommentLink(href) {
        if (!href) return { chapter: '—', page: '—', isChapter: false };
        let chapter = '—', page = '—', isChapter = false;
        try {
            const url = new URL(href);
            page = url.searchParams.get('p') || '—';
            const m = url.pathname.match(/\/read\/v\d+\/c(\d+)/);
            if (m) { chapter = m[1]; isChapter = true; }
            if (!isChapter) page = '—';
        } catch (e) {}
        return { chapter, page, isChapter };
    }

    function getCardData(card) {
        const reason = getCardReason(card) || '—';
        // Тело комментария находится в .comment внутри карточки
        const body   = card.querySelector('.comment') || card;
        const commentText = extractCommentText(body);
        const author = body.querySelector('.comment-author__name')?.innerText?.trim()
                    || card.querySelector('.comment-author__name')?.innerText?.trim() || '—';
        const link   = body.querySelector('a.btn.variant-primary')?.href
                    || card.querySelector('a[href*="/read/"], a[href*="/manga/"]')?.href || '';

        const timeEl   = card?.querySelector('time.comment__time');
        const datetime = timeEl?.getAttribute('datetime');
        let time = '—';
        if (datetime) {
            try {
                time = new Date(datetime).toLocaleString('ru-RU', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
                }) + ' UTC';
            } catch (e) { time = timeEl?.innerText?.trim() || '—'; }
        } else {
            time = timeEl?.innerText?.trim() || '—';
        }

        const { chapter, page, isChapter } = parseCommentLink(link);
        return { reason, commentText, author, link, time, chapter, page, isChapter };
    }

    function buildText(data, title) {
        let text = `📖 Тайтл: ${title}\n`;
        if (data.isChapter) {
            text += `📑 Глава: ${data.chapter}\n`;
            if (data.page !== '—') text += `📄 Страница: ${data.page}\n`;
        }
        text += `\n👤 Нарушитель: ${data.author}\n`;
        text += `⚠️ Причина жалобы: ${data.reason}\n`;
        text += `🕐 Время комментария: ${data.time}\n`;
        text += `\n💬 Комментарий:\n${data.commentText}`;
        return text;
    }

    // ==================== ФОРУМ ====================

    function getThreadData() {
        const title = (
            document.querySelector('[class*="jh_by"]') ||
            document.querySelector('.gf_b8')
        )?.innerText?.trim() || 'Без названия';

        const category = document.querySelector('span[style*="color"]')?.innerText?.trim() || 'Общая';

        const content = [...document.querySelectorAll('.text-content p.node-paragraph')]
            .map(p => p.innerText?.trim())
            .filter(Boolean)
            .join('\n')
            .substring(0, 600) || (
            document.querySelector('.text-content') ||
            document.querySelector('.gf_a3')
        )?.innerText?.substring(0, 600)?.trim() || 'Пусто';

        // Автор темы — ищем .user-inline__username ВНЕ шапки/сайдбара
        // (первый матч — это логин текущего юзера в хедере)
        const usernames = [...document.querySelectorAll('.user-inline__username, [class*="user-inline__username"]')];
        const threadAuthor = usernames.find(el =>
            !el.closest('header, nav, aside, [class*="header"], [class*="sidebar"], [class*="navbar"], [class*="menu"]')
        );
        const author = threadAuthor?.innerText?.trim()
            || usernames[usernames.length - 1]?.innerText?.trim()
            || document.querySelector('a[href*="/user/"]:not([href*="/bookmarks"])')?.innerText?.trim()
            || '—';

        const time = (
            document.querySelector('time[datetime]') ||
            document.querySelector('time') ||
            document.querySelector('.gf_gh')
        )?.innerText?.trim() || '—';

        MU.log('Forum', `getThreadData: title="${title}", author="${author}", time="${time}", content="${content.substring(0,50)}..."`);

        return `📅 Дата бана: ${MU.getNowUTC()}\n📋 Тема: ${title}\n🗂 Категория: ${category}\n👤 Автор: ${author}\n🕐 Время: ${time}\n\n💬 Содержание:\n${content}...`;
    }

    function getReviewData() {
        const siteName = MU.getSiteName();
        const author   = document.querySelector('a[href*="/user/"][href*="/reviews"]')?.innerText?.trim()
                      || document.querySelector('.user-inline__username')?.innerText?.trim() || '—';
        const title    = document.querySelector('a[href*="/manga/"], a[href*="/book/"], a[href*="/anime/"]')?.innerText?.trim() || '—';
        const type     = [...document.querySelectorAll('.p0_al')].find(el =>
                           ['Положительный','Нейтральный','Отрицательный'].includes(el.innerText?.trim())
                         )?.innerText?.trim() || '—';
        const text     = document.querySelector('p.node-paragraph')?.innerText?.trim()?.substring(0, 300) || '—';
        return `📅 Дата бана: ${MU.getNowUTC()}\n🌐 Сайт: ${siteName}\n📖 Тайтл: ${title}\n👤 Автор отзыва: ${author}\n💬 Тип: ${type}\n\n📝 Отзыв:\n${text}...\n\n🔗 ${location.href}`;
    }

    function getCollectionData() {
        const siteName = MU.getSiteName();
        const name     = document.querySelector('meta[property="og:title"]')?.content || document.title.split('.')[0].trim() || '—';
        const author   = document.querySelector('.user-inline__username')?.innerText?.trim() || '—';
        const desc     = document.querySelector('p.node-paragraph')?.innerText?.trim()?.substring(0, 300) || '—';
        return `📅 Дата бана: ${MU.getNowUTC()}\n🌐 Сайт: ${siteName}\n📚 Коллекция: ${name}\n👤 Автор: ${author}\n\n📝 Описание:\n${desc}...\n\n🔗 ${location.href}`;
    }

    // ==================== ОБРАБОТЧИКИ ПОПАПОВ ====================

    function handleModerationPopup(popup) {
        if (!settings?.moderation?.autoFillPopup) return;
        if (!activeCard || popupFilled) return;

        // Ищем textarea — сначала рядом с лейблом, потом любую
        let textarea = null;
        const allTa = popup.querySelectorAll('textarea');
        for (const ta of allTa) {
            const parent = ta.closest('.form-group, [class*="form-group"], [class*="field"], [class*="group"]');
            const label  = parent?.textContent || '';
            if (label.includes('Комментарий от модератора')) { textarea = ta; break; }
        }
        if (!textarea && allTa.length > 0) textarea = allTa[allTa.length - 1];
        if (!textarea) return;
        popupFilled = true;

        const data = getCardData(activeCard);
        setTextarea(textarea, buildText(data, '⏳ загружается...'));
        forceSelect(popup, data.reason);
        autoCheckBanCheckbox(popup);

        fetchTitle(data.link).then(title => {
            if (document.querySelector('.popup-body') && textarea) {
                setTextarea(textarea, buildText(data, title));
            }
            // AI анализ с контекстом тайтла
            window.MUAiVerdict?.onPopupOpen(data.commentText, data.reason, popup, { title });
        });

    }

    function handleForumPopup(popup) {
        if (!settings?.moderation?.autoFillPopup) return;
        const isBanModal = popup.innerText.includes('Комментарий от модератора');
        const textarea   = popup.querySelector('textarea.form-input__field');
        if (isBanModal && textarea && !textarea.dataset.autoFilled) {
            textarea.dataset.autoFilled = 'true';
            setTextarea(textarea, getThreadData());
            autoCheckBanCheckbox(popup);
            const select = popup.querySelector('select.form-input__field');
            if (select && !select.dataset.forumListener) {
                select.dataset.forumListener = 'true';
                select.addEventListener('change', () => injectCheatsheet(popup, select.value));
            }
        }
    }

    // ==================== СТРАНИЦЫ МАНГИ / АНИМЕ ====================

    function extractCommentText(comment) {
        const el = comment?.querySelector('.comment__content');
        if (!el) return '—';
        // innerText не читает скрытый текст (спойлеры), textContent читает всё
        const text = el.textContent?.trim();
        if (text && text !== '—') return text;
        // Фолбэк: пробуем достать из HTML убрав теги
        return el.innerHTML?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '—';
    }

    function getCommentData(comment) {
        const commentText = extractCommentText(comment);
        const author      = comment?.querySelector('.comment-author__name, .comment__head a')?.innerText?.trim() || '—';
        const timeEl      = comment?.querySelector('time');
        const datetime    = timeEl?.getAttribute('datetime');
        let time = '—';
        if (datetime) {
            try {
                time = new Date(datetime).toLocaleString('ru-RU', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
                }) + ' UTC';
            } catch { time = timeEl?.innerText?.trim() || '—'; }
        } else {
            time = timeEl?.innerText?.trim() || '—';
        }
        return { commentText, author, time };
    }

    function getPageContext() {
        // Название тайтла
        const title =
            document.querySelector('h1.media-name__main')?.innerText?.trim() ||
            document.querySelector('h1[class*="title"]')?.innerText?.trim() ||
            document.querySelector('meta[property="og:title"]')?.content?.split('·')[0]?.trim() ||
            document.title?.split('·')[0]?.split('—')[0]?.trim() ||
            '—';

        // Глава (если страница чтения)
        const chapterMatch = location.pathname.match(/\/c(\d+)/);
        const chapter = chapterMatch ? `Глава ${chapterMatch[1]}` : null;

        // Жанры
        const genres = [...document.querySelectorAll('[class*="genre"], [class*="tag"]')]
            .slice(0, 5).map(el => el.innerText?.trim()).filter(Boolean).join(', ');

        return { title, chapter, genres };
    }

    function handleCommentPagePopup(popup) {
        if (!settings?.moderation?.autoFillPopup) return;
        if (!activeComment) return;

        const isBanModal = popup.innerText.includes('Комментарий от модератора');
        const textarea   = popup.querySelector('textarea.form-input__field');
        if (!isBanModal || !textarea || textarea.dataset.autoFilled) return;

        textarea.dataset.autoFilled = 'true';
        popupFilled = true;

        const data    = getCommentData(activeComment);
        const context = getPageContext();
        const text = `📅 Дата бана: ${MU.getNowUTC()}\n🔗 Страница: ${location.href}\n\n👤 Автор: ${data.author}\n🕐 Время: ${data.time}\n\n💬 Комментарий:\n${data.commentText}`;
        setTextarea(textarea, text);
        autoCheckBanCheckbox(popup);

        // ИИ сам выберет причину, передаём контекст страницы
        window.MUAiVerdict?.onPopupOpen(data.commentText, '', popup, context);
    }

    // Публичный метод — вызывается из ai-verdict после получения ответа
    function selectReason(popup, reasonText) {
        forceSelect(popup, reasonText);
    }

    function handleReviewCollectionPopup(popup) {
        if (!settings?.moderation?.autoFillPopup) return;
        const isReview     = location.href.includes('/reviews/');
        const isCollection = location.href.includes('/collections/');
        if (!isReview && !isCollection) return;

        const isBanModal = popup.innerText.includes('Комментарий от модератора');
        const textarea   = popup.querySelector('textarea.form-input__field');
        if (isBanModal && textarea && !textarea.dataset.autoFilled) {
            textarea.dataset.autoFilled = 'true';
            setTextarea(textarea, isReview ? getReviewData() : getCollectionData());
            autoCheckBanCheckbox(popup);
            const select       = popup.querySelector('select.form-input__field');
            const defaultValue = isReview ? 'user-functional_ban-review' : 'user-functional_ban-collection';
            if (select && !select.dataset.listener) {
                select.dataset.listener = 'true';
                const option = [...select.options].find(o => o.value === defaultValue);
                if (option) {
                    option.selected = true;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        }
    }

    // ==================== OBSERVER ====================

    let mainObserver = null;
    let _lastPopup   = false;

    function debounce(fn, ms) {
        let timer = null;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    }

    function startObserver() {
        if (mainObserver) mainObserver.disconnect();

        const onMutation = debounce(() => {
            if (!settings?.moderation?.enabled) return;

            const isModerationPage = location.href.includes('/moderation/comments')
                || (location.href.includes('/moderation') && !!document.querySelector('.reports-container'));
            const isForumPage      = location.href.includes('/forum/discussion/');
            const isReviewCollPage = location.href.includes('/reviews/') || location.href.includes('/collections/');

            if (isModerationPage) {
                colorizeCards();
                buildFilterPanel();
            }

            const popup    = document.querySelector('.popup-body')
                          || document.querySelector('[class*="popup__body"]')
                          || document.querySelector('[class*="popup-body"]')
                          || document.querySelector('.modal-body');
            const hasPopup = !!popup;

            // Попап закрылся
            if (!hasPopup && _lastPopup) {
                _lastPopup = false;
                popupFilled = false;
                window.MUAiVerdict?.onPopupClose();
                if (isModerationPage && activeCard && !activeCard.dataset.banned) {
                    activeCard.style.opacity  = '0.5';
                    activeCard.style.filter   = 'grayscale(40%)';
                    activeCard.dataset.viewed = 'true';
                }
                if (activeCard) delete activeCard.dataset.banned;

                if (isModerationPage && settings?.moderation?.autoScrollToNext && activeCard) {
                    setTimeout(() => {
                        const cards      = [...document.querySelectorAll(CARD_SEL)];
                        const currentIdx = cards.indexOf(activeCard);
                        const next       = cards.slice(currentIdx + 1).find(c => !c.dataset.viewed);
                        if (next) next.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 200);
                }
            }

            _lastPopup = hasPopup;
            if (!popup) return;

            if (isModerationPage)      handleModerationPopup(popup);
            else if (isForumPage)      handleForumPopup(popup);
            else if (isReviewCollPage) handleReviewCollectionPopup(popup);
            else                       handleCommentPagePopup(popup);
        }, 150); // дебаунс 150 мс — группируем шквал мутаций в один вызов

        mainObserver = new MutationObserver(onMutation);
        mainObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ==================== КЛАВИШИ ====================

    function setupHotkeys() {
        document.addEventListener('keydown', (e) => {
            const popup = document.querySelector('.popup-body');
            if (!popup) return;

            if (e.key === 'Escape') { e.preventDefault(); popup.querySelector('.popup-close')?.click(); return; }
            if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); popup.querySelector('.btn.is-filled.variant-danger')?.click(); return; }
            if (e.ctrlKey && e.key === 'b') { e.preventDefault(); popup.querySelectorAll('.control__input[type="checkbox"]')[0]?.click(); return; }
            if (e.ctrlKey && e.key === 'p') { e.preventDefault(); popup.querySelectorAll('.control__input[type="checkbox"]')[1]?.click(); return; }

            if (e.ctrlKey && ['1','2','3','4','5','6','7','8','9'].includes(e.key)) {
                e.preventDefault();
                const select = popup.querySelector('select.form-input__field');
                if (!select) return;
                const option = [...select.options].find(o => o.value === e.key);
                if (option) {
                    option.selected = true;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    injectCheatsheet(popup, e.key);
                }
            }
        });
    }

    // ==================== INIT ====================

    async function init() {
        settings = await MU.getSettings();

        document.addEventListener('click', (e) => {
            const isBanSubmit = !!e.target.closest('.btn.is-filled.variant-danger');

            if (isBanSubmit && activeCard) {
                activeCard.dataset.banned = 'true';
            }

            // Перехватываем пока попап ещё открыт → данные доступны
            if (isBanSubmit) {
                const popup  = document.querySelector('.popup-body')
                            || document.querySelector('[class*="popup__body"]')
                            || document.querySelector('.modal-body');
                const select = popup?.querySelector('select.form-input__field')
                            || popup?.querySelector('select');
                const banReason = [...(select?.options || [])].find(o => o.selected)?.text?.trim() || '';

                let commentText = '';
                let cardReason  = '';
                if (activeCard) {
                    const data  = getCardData(activeCard);
                    commentText = data.commentText;
                    cardReason  = data.reason;
                } else if (activeComment) {
                    commentText = extractCommentText(activeComment);
                }

                if (commentText && commentText !== '—') {
                    MU.emit('modAction', {
                        action:      'ban',
                        commentText,
                        reason:      banReason || cardReason,
                    });
                }
            }
        }, true);

        document.addEventListener('click', (e) => {
            // Пробуем точный селектор
            let card = e.target.closest(CARD_SEL);

            // Фолбэк: ищем карточку — элемент, содержащий .comment (тело комментария)
            // Предыдущая версия ошибочно находила div с кнопками действий вместо всей карточки
            if (!card && location.href.includes('/moderation')) {
                let el = e.target.parentElement;
                while (el && el !== document.body) {
                    if (el.querySelector?.('.comment, .comment__content')) {
                        card = el;
                        break;
                    }
                    el = el.parentElement;
                }
            }

            if (card) { activeCard = card; popupFilled = false; }
        }, true);

        // Трекинг комментария на страницах манги/аниме
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.comment__dropdown, button.comment__dropdown');
            if (btn) {
                activeComment = btn.closest('.comment');
                popupFilled = false;
            }
            // Также отслеживаем кнопку "жалоба" если она открывает попап напрямую
            const complainBtn = e.target.closest('button');
            if (complainBtn?.innerText?.trim() === 'жалоба') {
                activeComment = complainBtn.closest('.comment');
                popupFilled = false;
            }
        }, true);

        // Трекаем клик по «Удалить» внутри карточки (без попапа)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('a, button');
            if (!btn) return;
            if (btn.innerText?.trim().toLowerCase() !== 'удалить') return;

            // Ищем ближайшую карточку
            const card = btn.closest(CARD_SEL) || activeCard;
            if (!card) return;

            const data = getCardData(card);
            if (data.commentText && data.commentText !== '—') {
                MU.emit('modAction', {
                    action:      'delete',
                    commentText: data.commentText,
                    reason:      data.reason,
                });
            }
        }, true);

        setupHotkeys();
        startObserver();

        MU.on('settingsChanged', async (newSettings) => {
            settings = newSettings;
        });

        // Полуавтоматический ИИ: применить вердикт к открытому попапу
        MU.on('aiApplyVerdict', ({ reasonKey, popup }) => {
            if (!popup || !reasonKey) return;
            forceSelect(popup, reasonKey);
        });

        MU.log('Moderation', 'Модуль запущен');
    }

    return { init, selectReason };

})();