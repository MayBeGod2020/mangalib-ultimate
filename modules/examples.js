// Модуль Examples — база обучающих примеров для few-shot ИИ
// Хранит примеры нарушений в Firebase RTDB.
// Только администраторы могут добавлять и удалять.
// При каждом AI-запросе из analyze() сюда обращаются за релевантными примерами.

window.MUExamples = (function () {
    'use strict';

    const MU = window.MULib;

    const DB_PATH    = 'examples';
    const CACHE_TTL  = 30 * 60 * 1000; // 30 минут
    const MAX_IMG_PX = 900;             // максимальная ширина/высота при сжатии
    const IMG_QUALITY = 0.72;           // качество JPEG

    let examplesCache  = null;
    let cacheTimestamp = 0;
    let isAdmin        = false;
    let currentUser    = 'Модератор';

    const VIOLATION_TYPES = [
        'оскорбление пользователей',
        'флуд / оффтоп / комментарий без смысла',
        'спойлер',
        'реклама / спам',
        'провокации / конфликты',
        'ненормативная лексика',
        'запрещенный / непотребный контент',
        'нарушение форума',
    ];

    const VIOLATION_COLORS = {
        'оскорбление пользователей':              '#e74c3c',
        'флуд / оффтоп / комментарий без смысла': '#f39c12',
        'спойлер':                                '#9b59b6',
        'реклама / спам':                         '#e67e22',
        'провокации / конфликты':                 '#e67e22',
        'ненормативная лексика':                  '#e74c3c',
        'запрещенный / непотребный контент':      '#c0392b',
        'нарушение форума':                       '#3498db',
    };

    // ==================== FIREBASE CRUD ====================

    async function getExamples(forceRefresh = false) {
        if (!forceRefresh && examplesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
            return examplesCache;
        }
        const data = await MU.dbGet(DB_PATH);
        examplesCache  = data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [];
        cacheTimestamp = Date.now();
        return examplesCache;
    }

    async function addExample(record) {
        await MU.dbPush(DB_PATH, { ...record, addedBy: currentUser, timestamp: Date.now() });
        examplesCache = null; // сброс кэша
    }

    // Автосохранение после AI-анализа — без дубликатов
    // parsed = { verdict, rule, reason, reason_key }
    // sourceText — текст комментария или заголовок темы
    // typeHint — подсказка для violation_type (reason_key или строка из контекста)
    async function autoSave(sourceText, parsed, typeHint = '') {
        try {
            if (!sourceText || !parsed?.verdict) return;

            const content = String(sourceText).substring(0, 500);

            // Определяем тип нарушения
            const violationType = (
                parsed.reason_key ||
                typeHint ||
                parsed.rule ||
                ''
            ).toLowerCase().substring(0, 80);

            // Дедупликация: сравниваем первые 80 символов с уже сохранёнными
            const existing = await getExamples();
            const key80    = content.substring(0, 80).toLowerCase();
            const isDup    = existing.some(e =>
                (e.content || '').substring(0, 80).toLowerCase() === key80
            );
            if (isDup) {
                MU.log('Examples', 'autoSave: дубликат, пропускаем');
                return;
            }

            await MU.dbPush(DB_PATH, {
                violation_type: violationType,
                content,
                verdict:  parsed.verdict,
                reason:   (parsed.reason || '').substring(0, 200),
                mediaUrl: '',
                addedBy:  'ИИ (авто)',
                timestamp: Date.now(),
            });
            examplesCache = null;
            MU.log('Examples', 'autoSave: сохранён пример «' + content.substring(0, 40) + '…»');
        } catch (e) {
            MU.log('Examples', 'autoSave err:', e);
        }
    }

    async function deleteExample(id) {
        await MU.dbDelete(`${DB_PATH}/${id}`);
        examplesCache = null;
    }

    // ==================== FEW-SHOT BUILDER ====================

    // Возвращает строку с примерами для вставки в системный промпт.
    // violationHint — reason_key или произвольный текст для поиска похожей категории.
    async function buildFewShot(violationHint, count = 5) {
        try {
            const all = await getExamples();
            if (!all.length) return '';

            // Нормализуем хинт и ищем совпадение с типом нарушения
            const hint = (violationHint || '').toLowerCase();
            const relevant = all.filter(e => {
                if (!hint) return true;
                return (e.violation_type || '').toLowerCase().includes(hint) ||
                       hint.includes((e.violation_type || '').split('/')[0].trim().toLowerCase());
            });

            // Если совпадений меньше 2 — добираем из остальных
            let pool = relevant.length >= 2 ? relevant : all;

            // Перемешиваем и берём `count`
            const shuffled = pool.slice().sort(() => Math.random() - 0.5).slice(0, count);
            if (!shuffled.length) return '';

            const lines = shuffled.map((e, i) => {
                const text    = (e.content || '').substring(0, 200);
                const verdict = e.verdict || 'нарушает';
                const reason  = (e.reason  || '').substring(0, 120);
                const type    = e.violation_type || '';
                return `[Пример ${i + 1}] Тип: ${type}\nТекст: «${text}»\nВердикт: ${verdict}${reason ? `\nПояснение: ${reason}` : ''}`;
            });

            return '\n\n--- Обучающие примеры (ориентир) ---\n' + lines.join('\n\n') + '\n---';
        } catch (e) {
            MU.log('Examples', 'buildFewShot err:', e);
            return '';
        }
    }

    // ==================== МЕДИА: СЖАТИЕ ====================

    // Сжимает изображение через <canvas> и возвращает base64-строку
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = (ev) => {
                const img = new Image();
                img.onerror = reject;
                img.onload = () => {
                    let { width, height } = img;
                    if (width > MAX_IMG_PX || height > MAX_IMG_PX) {
                        const ratio = Math.min(MAX_IMG_PX / width, MAX_IMG_PX / height);
                        width  = Math.round(width  * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width  = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', IMG_QUALITY));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // ==================== UI — СЕКЦИЯ В ДАШБОРДЕ ====================

    const SECTION_ID = 'mu-examples-section';
    const FORM_ID    = 'mu-examples-form';

    function getColor(type) {
        return VIOLATION_COLORS[type] || '#888';
    }

    function renderExampleCard(e) {
        const color   = getColor(e.violation_type);
        const date    = e.timestamp ? new Date(e.timestamp).toLocaleDateString('ru') : '—';
        const preview = (e.content || '').substring(0, 120);
        const hasImg  = !!e.mediaUrl;

        return `
            <div class="mu-ex-card" data-exid="${MU.esc(e.id)}" style="
                border-left:3px solid ${color};
                background:rgba(255,255,255,0.03);
                border-radius:4px;padding:6px 8px;margin-bottom:6px;
                font-size:11px;
            ">
                <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;flex-wrap:wrap;">
                    <span style="background:${color}22;color:${color};border:1px solid ${color};
                        border-radius:10px;padding:1px 7px;font-size:10px;font-weight:600;white-space:nowrap;">
                        ${MU.esc(e.violation_type || '—')}
                    </span>
                    <span style="color:${e.verdict === 'нарушает' ? '#e74c3c' : e.verdict === 'не нарушает' ? '#2ecc71' : '#f39c12'};
                        font-size:10px;font-weight:600;">
                        ${MU.esc(e.verdict || '—')}
                    </span>
                    ${isAdmin ? `<button class="mu-ex-delete mu-dash-btn" data-delid="${MU.esc(e.id)}"
                        style="margin-left:auto;color:#e74c3c;font-size:10px;padding:1px 6px;">✕ Удалить</button>` : ''}
                </div>
                <div style="color:#ccc;line-height:1.4;margin-bottom:3px;">${MU.esc(preview)}${e.content?.length > 120 ? '…' : ''}</div>
                ${hasImg ? `<div style="margin:4px 0;"><img src="${MU.esc(e.mediaUrl)}"
                    style="max-width:100%;max-height:80px;border-radius:4px;object-fit:cover;cursor:pointer;"
                    class="mu-ex-img-thumb" data-src="${MU.esc(e.mediaUrl)}"></div>` : ''}
                <div style="color:#555;font-size:10px;">
                    ${MU.esc(e.addedBy || '—')} · ${date}
                </div>
            </div>
        `;
    }

    function renderAddForm() {
        if (!isAdmin) return '';
        const typeOptions = VIOLATION_TYPES
            .map(t => `<option value="${MU.esc(t)}">${MU.esc(t)}</option>`)
            .join('');
        return `
            <div id="${FORM_ID}" style="
                background:rgba(255,255,255,0.04);border:1px solid #333;
                border-radius:6px;padding:10px;margin-top:8px;display:none;
            ">
                <div class="mu-dash-label" style="margin-bottom:6px;">➕ Новый пример</div>
                <div style="margin-bottom:6px;">
                    <select id="mu-ex-type" style="width:100%;background:#1a1a2e;color:#ccc;border:1px solid #333;
                        border-radius:4px;padding:4px;font-size:11px;">
                        <option value="">— Тип нарушения —</option>
                        ${typeOptions}
                    </select>
                </div>
                <div style="margin-bottom:6px;">
                    <textarea id="mu-ex-content" rows="3" placeholder="Текст нарушения…"
                        style="width:100%;box-sizing:border-box;background:#1a1a2e;color:#ccc;
                        border:1px solid #333;border-radius:4px;padding:4px;font-size:11px;
                        resize:vertical;font-family:inherit;"></textarea>
                </div>
                <div style="margin-bottom:6px;">
                    <select id="mu-ex-verdict" style="background:#1a1a2e;color:#ccc;border:1px solid #333;
                        border-radius:4px;padding:4px;font-size:11px;">
                        <option value="нарушает">🚫 нарушает</option>
                        <option value="не нарушает">✅ не нарушает</option>
                        <option value="спорно">⚠️ спорно</option>
                    </select>
                </div>
                <div style="margin-bottom:6px;">
                    <input id="mu-ex-reason" type="text" placeholder="Краткое пояснение…"
                        style="width:100%;box-sizing:border-box;background:#1a1a2e;color:#ccc;
                        border:1px solid #333;border-radius:4px;padding:4px;font-size:11px;">
                </div>
                <div style="margin-bottom:8px;">
                    <label style="color:#888;font-size:10px;display:block;margin-bottom:3px;">
                        Медиа (фото/GIF, необязательно, до 1 МБ):
                    </label>
                    <input id="mu-ex-media" type="file" accept="image/*"
                        style="font-size:10px;color:#888;width:100%;">
                    <div id="mu-ex-media-preview" style="margin-top:4px;"></div>
                </div>
                <div style="display:flex;gap:6px;">
                    <button id="mu-ex-save" class="mu-dash-btn"
                        style="color:#2ecc71;flex:1;">💾 Сохранить</button>
                    <button id="mu-ex-cancel" class="mu-dash-btn"
                        style="color:#888;">Отмена</button>
                </div>
                <div id="mu-ex-save-status" style="font-size:10px;margin-top:4px;"></div>
            </div>
        `;
    }

    async function renderSection() {
        const section = document.getElementById(SECTION_ID);
        if (!section) return;

        const examples = await getExamples();
        const count    = examples.length;

        const listHtml = count
            ? examples
                .slice()
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .map(renderExampleCard)
                .join('')
            : '<div style="color:#444;font-size:11px;">Пока нет примеров</div>';

        MU.setHTML(section, `
            <div class="mu-dash-label" style="display:flex;align-items:center;cursor:pointer;" id="mu-ex-toggle-header">
                📚 Примеры
                <span style="color:#555;font-weight:400;font-size:10px;margin-left:4px;">(${count})</span>
                <span id="mu-ex-toggle-arrow" style="margin-left:auto;color:#555;font-size:10px;">▼</span>
            </div>
            <div id="mu-ex-body" style="display:none;">
                <div class="mu-dash-scrollable" id="mu-ex-list"
                    style="max-height:260px;margin-top:6px;">
                    ${listHtml}
                </div>
                ${isAdmin ? `<button class="mu-dash-btn" id="mu-ex-add-btn"
                    style="color:#2ecc71;margin-top:6px;width:100%;">
                    ➕ Добавить пример
                </button>` : ''}
                ${renderAddForm()}
            </div>
        `);

        attachSectionListeners();
    }

    function attachSectionListeners() {
        // Раскрытие секции
        document.getElementById('mu-ex-toggle-header')?.addEventListener('click', () => {
            const body  = document.getElementById('mu-ex-body');
            const arrow = document.getElementById('mu-ex-toggle-arrow');
            if (!body) return;
            const open = body.style.display === 'block';
            body.style.display  = open ? 'none' : 'block';
            if (arrow) arrow.textContent = open ? '▼' : '▲';
        });

        // Удаление примера
        document.getElementById(SECTION_ID)?.querySelectorAll('.mu-ex-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.delid;
                if (confirm('Удалить этот пример?')) {
                    await deleteExample(id);
                    await renderSection();
                }
            });
        });

        // Просмотр изображения на клик
        document.getElementById(SECTION_ID)?.querySelectorAll('.mu-ex-img-thumb').forEach(img => {
            img.addEventListener('click', () => showImageModal(img.dataset.src));
        });

        // Кнопка «Добавить»
        document.getElementById('mu-ex-add-btn')?.addEventListener('click', () => {
            const form = document.getElementById(FORM_ID);
            if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
        });

        // Превью медиа
        document.getElementById('mu-ex-media')?.addEventListener('change', async (e) => {
            const file    = e.target.files[0];
            const preview = document.getElementById('mu-ex-media-preview');
            if (!file || !preview) return;

            if (file.size > 5 * 1024 * 1024) {
                preview.textContent = '⚠️ Файл слишком большой (максимум 5 МБ)';
                e.target.value = '';
                return;
            }

            preview.innerHTML = '<span style="color:#888;font-size:10px;">Сжимаю…</span>';
            try {
                const b64 = await compressImage(file);
                const kb  = Math.round(b64.length * 0.75 / 1024);
                MU.setHTML(preview, `
                    <img src="${MU.esc(b64)}" style="max-width:100%;max-height:60px;border-radius:3px;margin-top:3px;">
                    <div style="color:#555;font-size:10px;">~${kb} КБ после сжатия</div>
                `);
                preview.dataset.b64 = b64;
            } catch {
                preview.textContent = '⚠️ Не удалось сжать изображение';
            }
        });

        // Отмена формы
        document.getElementById('mu-ex-cancel')?.addEventListener('click', () => {
            const form = document.getElementById(FORM_ID);
            if (form) form.style.display = 'none';
        });

        // Сохранение
        document.getElementById('mu-ex-save')?.addEventListener('click', async () => {
            const status  = document.getElementById('mu-ex-save-status');
            const type    = document.getElementById('mu-ex-type')?.value?.trim();
            const content = document.getElementById('mu-ex-content')?.value?.trim();
            const verdict = document.getElementById('mu-ex-verdict')?.value;
            const reason  = document.getElementById('mu-ex-reason')?.value?.trim();
            const mediaEl = document.getElementById('mu-ex-media-preview');
            const mediaUrl = mediaEl?.dataset?.b64 || '';

            if (!type) { if (status) status.textContent = '⚠️ Выберите тип нарушения'; return; }
            if (!content) { if (status) status.textContent = '⚠️ Введите текст'; return; }

            if (status) status.textContent = 'Сохраняю…';

            try {
                await addExample({ violation_type: type, content, verdict, reason, mediaUrl });
                if (status) status.textContent = '✓ Сохранено!';
                await renderSection();
                // Открываем тело обратно
                const body = document.getElementById('mu-ex-body');
                if (body) body.style.display = 'block';
            } catch (err) {
                if (status) status.textContent = '⚠️ Ошибка: ' + err.message;
            }
        });
    }

    // ==================== ПРОСМОТР ИЗОБРАЖЕНИЯ ====================

    function showImageModal(src) {
        const existing = document.getElementById('mu-ex-img-modal');
        if (existing) { existing.remove(); return; }

        const modal = document.createElement('div');
        modal.id = 'mu-ex-img-modal';
        modal.style.cssText = `
            position:fixed;inset:0;z-index:9999999;
            background:rgba(0,0,0,0.85);
            display:flex;align-items:center;justify-content:center;
            cursor:pointer;
        `;
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
        modal.appendChild(img);
        modal.addEventListener('click', () => modal.remove());
        document.body.appendChild(modal);
    }

    // ==================== ИНЪЕКЦИЯ В ДАШБОРД ====================

    function injectIntoDashboard() {
        const panel = document.getElementById('mu-dashboard-panel');
        if (!panel || document.getElementById(SECTION_ID)) return;

        const section = document.createElement('div');
        section.id = SECTION_ID;
        section.className = 'mu-dash-section';
        panel.appendChild(section);

        renderSection(); // асинхронно заполняем
    }

    // ==================== INIT ====================

    async function init() {
        isAdmin     = await MU.checkIsAdmin();
        currentUser = (await MU.cacheGet('current_user'))?.username || 'Модератор';

        MU.log('Examples', 'isAdmin:', isAdmin);

        // Учимся на реальных действиях модератора
        MU.on('modAction', ({ action, commentText, reason }) => {
            if (!commentText || commentText === '—') return;

            const verdict =
                action === 'ban'    ? 'нарушает' :
                action === 'delete' ? 'нарушает' : 'не нарушает';

            const parsed = {
                verdict,
                reason_key: reason || '',
                reason: `Модератор: ${action === 'ban' ? 'забанил' : 'удалил'}`,
            };

            autoSave(commentText, parsed, reason || '').catch(() => {});
            MU.log('Examples', `modAction "${action}" → autoSave`);
        });

        // Ждём открытия панели дашборда и инжектируем секцию
        MU.on('panelOpen', (which) => {
            if (which === 'dashboard') {
                setTimeout(injectIntoDashboard, 50);
            }
        });

        // На случай если панель уже есть
        if (document.getElementById('mu-dashboard-panel')) {
            injectIntoDashboard();
        }

        MU.log('Examples', 'Модуль запущен');
    }

    return { init, buildFewShot, getExamples, autoSave };

})();
