# План улучшения UX (`my-service-back`)

Пошаговое руководство по доработке пользовательского интерфейса.
Задачи разбиты на **небольшие атомарные шаги** (по 1–2 файла за шаг), чтобы их можно было выполнять по очереди любой моделью без риска сломать вёрстку или серверную логику.

> **Важные правила перед началом любой задачи:**
> 1. Не менять существующую структуру модалок, описанную в `docs/ui-service-modal.md` и `docs/ui-carousel-modal.md`, если это явно не указано в шаге.
> 2. Все общие стили сайта живут в `views/partials/head.ejs` внутри тега `<style>`.
> 3. Клиентский JS пишется на совместимом ES5/ES6 без сборщиков и внешних библиотек — прямо в соответствующем `.ejs` шаблоне.

---

## Этап 1. Поиск и быстрая фильтрация в каталоге `/modeli`

Клиент заходит на `/modeli`, чтобы быстро найти свой принтер или картридж среди 56+ позиций.

### Задача 1.1. Добавить данные о картридже в карточки каталога (`views/models.ejs`)
**Цель:** позволить клиентскому поиску искать не только по названию принтера (`P1102`), но и по номеру картриджа (`85A`, `725`, `106A`, `TN-1075`), а также показывать картридж прямо на карточке.

**Файл:** `views/models.ejs`

**Что сделать:**
1. Внутри цикла `<% g.items.forEach(function(p) { %>` у элемента `<li>` добавить data-атрибуты для поиска:
   ```html
   <li data-model-item
       data-brand="<%= g.brandSlug %>"
       data-search="<%= (p.brand + ' ' + p.model + ' ' + (p.cartridge_note || '') + ' ' + p.meta).toLowerCase() %>">
   ```
2. Внутри `<a class="cat-card" ...>` после `<span class="cat-meta"><%= p.meta %></span>` добавить вывод картриджа (если он заполнен):
   ```html
   <% if (p.cartridge_note) { %>
     <span class="cat-cartridge">Картридж: <%= p.cartridge_note %></span>
   <% } %>
   ```
3. У секции бренда `<section class="cat-brand" ...>` добавить атрибут `data-brand-section="<%= g.brandSlug %>"`.

**Проверка:** страница `/modeli` открывается без ошибок, под типом устройства на карточках виден номер картриджа.

---

### Задача 1.2. Добавить панель поиска и фильтр по брендам (`views/models.ejs`)
**Цель:** дать пользователю поле живого поиска и кнопки быстрого выбора бренда над списком моделей.

**Файл:** `views/models.ejs`

**Что сделать:**
1. В `views/models.ejs` сразу после `<p class="detail-desc">...</p>` (перед `<% if (!groups.length) { %>`) вставить панель фильтрации:
   ```html
   <% if (groups.length) { %>
     <div class="cat-tools" data-cat-tools>
       <div class="cat-search-wrap">
         <input type="search"
                class="cat-search"
                data-cat-search
                placeholder="Поиск по модели или картриджу (например: P1102, 85A, MF3010)..."
                autocomplete="off"
                aria-label="Поиск по модели или картриджу" />
       </div>
       <div class="cat-chips" role="group" aria-label="Фильтр по бренду">
         <button type="button" class="cat-chip is-active" data-brand-filter="all">Все (<%= models.length %>)</button>
         <% groups.forEach(function(g) { %>
           <button type="button"
                   class="cat-chip"
                   data-brand-filter="<%= g.brandSlug %>"
                   style="--accent: var(--brand-<%= g.brandSlug %>, var(--primary))">
             <%= g.brand %> (<%= g.items.length %>)
           </button>
         <% }); %>
       </div>
     </div>
     <div class="empty-state" data-cat-empty hidden>
       Ничего не найдено. Попробуйте ввести часть названия модели или позвоните нам — заправим и отремонтируем почти любой аппарат.
     </div>
   <% } %>
   ```
2. Перед закрывающим `</body>` в `views/models.ejs` добавить скрипт фильтрации:
   ```html
   <script>
   (function () {
     var searchInput = document.querySelector("[data-cat-search]");
     var chips = [].slice.call(document.querySelectorAll("[data-brand-filter]"));
     var sections = [].slice.call(document.querySelectorAll("[data-brand-section]"));
     var emptyBox = document.querySelector("[data-cat-empty]");
     if (!searchInput || !sections.length) return;

     var activeBrand = "all";

     function applyFilter() {
       var q = searchInput.value.replace(/^\s+|\s+$/g, "").toLowerCase();
       var totalVisible = 0;

       sections.forEach(function (sec) {
         var brandMatch = activeBrand === "all" || sec.getAttribute("data-brand-section") === activeBrand;
         var items = [].slice.call(sec.querySelectorAll("[data-model-item]"));
         var visibleInSec = 0;

         items.forEach(function (li) {
           var hay = li.getAttribute("data-search") || "";
           var show = brandMatch && (!q || hay.indexOf(q) !== -1);
           li.hidden = !show;
           if (show) visibleInSec++;
         });

         sec.hidden = visibleInSec === 0;
         totalVisible += visibleInSec;
       });

       if (emptyBox) emptyBox.hidden = totalVisible > 0;
     }

     searchInput.addEventListener("input", applyFilter);

     chips.forEach(function (chip) {
       chip.addEventListener("click", function () {
         activeBrand = chip.getAttribute("data-brand-filter") || "all";
         chips.forEach(function (c) { c.classList.toggle("is-active", c === chip); });
         applyFilter();
       });
     });
   })();
   </script>
   ```

**Проверка:** ввод `85a` или `p1102` мгновенно оставляет нужные карточки и скрывает пустые секции брендов; клик по бренду фильтрует секцию.

---

### Задача 1.3. Стили для поиска, чипсов брендов и плашки картриджа (`views/partials/head.ejs`)
**Цель:** оформить поиск и чипсы в едином стиле сайта (светлое стекло + градиентные акценты).

**Файл:** `views/partials/head.ejs` (рядом с блоком `/* ── каталог моделей ── */`, около строки 1347)

**Что сделать:**
Добавить CSS-правила:
```css
  .cat-tools {
    margin: 1.1rem 0 1.4rem;
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }
  .cat-search {
    width: 100%;
    padding: .75rem 1rem;
    font-family: inherit;
    font-size: .95rem;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid rgba(148, 163, 203, .38);
    border-radius: 14px;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, .04);
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .cat-search:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(76, 110, 245, .16);
  }
  .cat-chips {
    display: flex;
    flex-wrap: wrap;
    gap: .45rem;
  }
  .cat-chip {
    padding: .38rem .85rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 203, .32);
    background: var(--surface-2);
    color: var(--text);
    font-family: inherit;
    font-size: .82rem;
    font-weight: 600;
    cursor: pointer;
    transition: background .15s ease, color .15s ease, border-color .15s ease, transform .15s ease;
  }
  .cat-chip:hover {
    border-color: var(--accent, var(--primary));
    transform: translateY(-1px);
  }
  .cat-chip.is-active {
    background: var(--accent, var(--primary));
    border-color: var(--accent, var(--primary));
    color: #fff;
  }
  .cat-cartridge {
    margin: .35rem 1rem 0;
    font-size: .76rem;
    font-weight: 600;
    color: var(--primary-dark);
  }
```

**Проверка:** строка поиска и кнопки брендов аккуратно вписаны в карточку каталога, на мобильных чипсы переносятся на новую строку.

---

## Этап 2. Целевое действие (CTA — кнопки связи) в карточках и модалках

Когда клиент дочитал описание услуги или нашёл свой принтер, кнопки звонка/мессенджеров должны быть прямо перед глазами, без скролла наверх.

### Задача 2.1. Создать переиспользуемый partial блока связи (`views/partials/cta-box.ejs`)
**Цель:** не дублировать разметку кнопок контактов на разных страницах.

**Файл (новый):** `views/partials/cta-box.ejs`

**Что сделать:**
Создать файл `views/partials/cta-box.ejs`:
```html
<% if (typeof contacts !== "undefined" && contacts && contacts.length > 0) { %>
  <div class="cta-box">
    <p class="cta-box-title"><%= typeof ctaTitle !== "undefined" && ctaTitle ? ctaTitle : "Нужна консультация или выезд мастера?" %></p>
    <div class="contacts cta-box-buttons" aria-label="Связаться с мастером">
      <% contacts.forEach(function(c) { %>
        <a class="btn"
           href="<%= c.url %>"
           style="background: <%= c.color %>; color: <%= c.textColor %>;"
           <% if (!c.url.startsWith("tel:") && !c.url.startsWith("mailto:")) { %>target="_blank" rel="noopener"<% } %>>
          <%= c.type %>
        </a>
      <% }); %>
    </div>
  </div>
<% } %>
```

**И добавить стили в `views/partials/head.ejs`:**
```css
  .cta-box {
    margin-top: 1.35rem;
    padding: 1rem 1.15rem;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(233, 237, 255, .75) 0%, rgba(244, 237, 255, .75) 100%);
    border: 1px solid rgba(76, 110, 245, .18);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: .75rem 1rem;
  }
  .cta-box-title {
    font-size: .92rem;
    font-weight: 700;
    color: var(--text);
  }
  .cta-box .contacts {
    margin-top: 0;
    justify-content: flex-start;
  }
  .cta-box .btn {
    padding: .48rem 1rem;
    font-size: .85rem;
  }
```

**Проверка:** файл создан, стили валидны.

---

### Задача 2.2. Подключить `cta-box` на детальных страницах принтера и услуги
**Цель:** закрыть «тупик» в конце страниц `/modeli/:slug` и `/uslugi/:slug`.

**Файлы:** `views/printer.ejs`, `views/service.ejs`

**Что сделать:**
1. В `views/printer.ejs` перед закрывающим `</div>` блока `.detail-card` (после таблицы характеристик, около строки 44) вставить:
   ```html
   <%- include('partials/cta-box', { ctaTitle: 'Заправить или отремонтировать ' + printer.brand + ' ' + printer.model + ':' }) %>
   ```
2. В `views/service.ejs` перед закрывающим `</div>` блока `.detail-card` (около строки 40) вставить:
   ```html
   <%- include('partials/cta-box', { ctaTitle: 'Заказать услугу или уточнить цену под вашу модель:' }) %>
   ```

**Проверка:** на `/modeli/hp-laserjet-p1102` и `/uslugi/zapravka-kartridzha` внизу карточки отображаются кнопки связи.

---

### Задача 2.3. Добавить компактную строку действий в низ модалок (`views/partials/services.ejs`, `views/partials/featured-printers.ejs`)
**Цель:** дать возможность позвонить/написать прямо из открытой модалки на главной, не нарушая фиксированную геометрию окна из `docs/ui-service-modal.md` и `docs/ui-carousel-modal.md`.

**Файлы:** `views/partials/services.ejs`, `views/partials/featured-printers.ejs`, `views/partials/head.ejs`

**Что сделать:**
1. В `views/partials/services.ejs` внутри `.service-modal-desc-block` заменить одиночную ссылку `<a class="modal-page-link" data-service-page href="/">Страница услуги</a>` на компактный футер действий:
   ```html
   <div class="modal-actions">
     <a class="modal-page-link" data-service-page href="/">Страница услуги →</a>
     <% if (contacts && contacts.length) { %>
       <div class="modal-contacts">
         <% contacts.forEach(function(c) { %>
           <a class="btn modal-contact-btn"
              href="<%= c.url %>"
              style="background: <%= c.color %>; color: <%= c.textColor %>;"
              <% if (!c.url.startsWith("tel:") && !c.url.startsWith("mailto:")) { %>target="_blank" rel="noopener"<% } %>>
             <%= c.type %>
           </a>
         <% }); %>
       </div>
     <% } %>
   </div>
   ```
2. Аналогично в `views/partials/featured-printers.ejs` внутри `.printer-modal-desc-block` рядом с `<a class="modal-page-link" data-modal-page href="/">Страница модели</a>` обернуть в `.modal-actions` или вынести компактный ряд кнопок в низ `.printer-modal-dialog` (после `.printer-modal-specs-block`).
3. В `views/partials/head.ejs` добавить стили:
   ```css
   .modal-actions {
     flex: 0 0 auto;
     margin-top: .55rem;
     padding-top: .55rem;
     border-top: 1px solid rgba(226, 232, 252, .85);
     display: flex;
     flex-wrap: wrap;
     align-items: center;
     justify-content: space-between;
     gap: .5rem;
   }
   .modal-actions .modal-page-link { margin-top: 0; }
   .modal-contacts { display: flex; flex-wrap: wrap; gap: .4rem; }
   .modal-contact-btn { padding: .34rem .78rem; font-size: .78rem; box-shadow: none; }
   ```

**Ограничение:** не менять `height` диалогов и блоков героя (400px в модалке услуги и 48% в модалке принтера), чтобы не нарушить требования `docs/ui-service-modal.md` и `docs/ui-carousel-modal.md`.

---

## Этап 3. Ориентир цены заправки на странице принтера

В описании каталога обещаны «характеристики, картридж и цены на заправку», но на странице модели цены нет.

### Задача 3.1. Передать базовую цену заправки на страницу модели и вывести плашку
**Цель:** показывать пользователю понятный ориентир стоимости заправки рядом с кодом картриджа.

**Файлы:** `server.js`, `views/printer.ejs`, `views/partials/head.ejs`

**Что сделать:**
1. В `server.js` в маршруте `app.get("/modeli/:slug", ...)` (около строки 1110) найти услугу заправки в `data.services`:
   ```js
   const refillService = data.services.find(s => s.kind === "refill");
   ```
   И передать `refillService` в `publicLocals(data, { ..., printer, refillService })`.
2. В `views/printer.ejs` после `<p class="detail-meta"><%= printer.brand %> · <%= printer.meta %></p>` добавить бейджи картриджа и цены заправки:
   ```html
   <div class="printer-badges">
     <% if (printer.cartridge_note) { %>
       <span class="detail-price">Картридж: <%= printer.cartridge_note %></span>
     <% } %>
     <% if (typeof refillService !== "undefined" && refillService) { %>
       <a class="detail-price detail-price-link" href="/uslugi/<%= refillService.slug %>">
         Заправка — от <%= refillService.priceFormatted %>
       </a>
     <% } %>
   </div>
   ```
3. В `views/partials/head.ejs` добавить:
   ```css
   .printer-badges {
     display: flex;
     flex-wrap: wrap;
     gap: .5rem;
     margin-bottom: .75rem;
   }
   .printer-badges .detail-price { margin-bottom: 0; }
   .detail-price-link { text-decoration: none; }
   .detail-price-link:hover { border-color: var(--primary); }
   ```

**Проверка:** на любой странице `/modeli/:slug` над заголовком видны пилюли с картриджем и ссылкой «Заправка — от ... ₽».

---

## Этап 4. Секция услуг, навигация и мобильная компактность

### Задача 4.1. Добавить заголовок секции услуг и визуальный индикатор кликабельности карточек
**Цель:** выровнять визуальную иерархию главной страницы (сейчас у «Популярных моделей» есть заголовок, а у списка услуг — нет) и показать, что карточки услуг кликабельны.

**Файлы:** `views/partials/services.ejs`, `views/partials/head.ejs`

**Что сделать:**
1. В `views/partials/services.ejs` внутри `<section class="section" id="uslugi" aria-label="Список услуг">` перед списком `<ul class="services">` добавить шапку секции:
   ```html
   <div class="section-head">
     <h2>Услуги и цены</h2>
     <p>Нажмите на услугу, чтобы посмотреть подробности, симптомы поломки и бренды расходников</p>
   </div>
   ```
2. В `views/partials/head.ejs` добавить стили `.section-head` (по аналогии с `.featured-head`):
   ```css
   .section-head {
     margin: 0 .5rem 1rem;
   }
   .section-head h2 {
     font-size: 1.3rem;
     font-weight: 800;
     letter-spacing: -.4px;
     background: var(--grad-main);
     -webkit-background-clip: text;
     background-clip: text;
     -webkit-text-fill-color: transparent;
     color: var(--primary);
   }
   .section-head p {
     margin-top: .3rem;
     color: var(--muted);
     font-size: .92rem;
     line-height: 1.45;
   }
   ```

**Проверка:** на главной странице над сеткой услуг появился заголовок «Услуги и цены» с пояснением.

---

### Задача 4.2. Не ломать однострочную раскладку карточек услуг на мобильных экранах
**Цель:** на экранах `< 480px` список из 12+ услуг сейчас растягивается вдвое из-за `flex-direction: column`. Название и пилюля с ценой лучше смотрятся в одну строку.

**Файл:** `views/partials/head.ejs` (строка ~1435, внутри `@media (max-width: 480px)`)

**Что сделать:**
Заменить правило:
```css
.service-card { flex-direction: column; align-items: flex-start; }
```
на более компактное:
```css
.service-card { padding: .9rem 1rem; gap: .65rem; }
.service-name { font-size: .93rem; }
.service-price { font-size: .92rem; padding: .26rem .7rem; }
```

**Проверка:** на ширине экрана 360–414px карточки услуг остаются компактными (название слева, цена справа).

---

### Задача 4.3. Не блокировать вертикальный скролл страницы над каруселью принтеров
**Цель:** когда пользователь крутит обычное колесо мыши вниз, чтобы дойти до цен на услуги, страница не должна «застревать» на карусели.

**Файл:** `views/partials/featured-printers.ejs` (строки 292–308)

**Что сделать:**
В обработчике `root.addEventListener("wheel", ...)` пропускать обычный вертикальный скролл страницы, если пользователь скроллит вертикально без зажатого `Shift` (оставив горизонтальный свайп трекпадом и `Shift + колесо`):
```js
  root.addEventListener("wheel", function (e) {
    if (modal && !modal.hidden) return;
    var dx = e.deltaX;
    var dy = e.deltaY;
    var isHorizontal = Math.abs(dx) > Math.abs(dy) || e.shiftKey;
    if (!isHorizontal) return;
    var delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
    if (!delta) return;
    e.preventDefault();
    var now = Date.now();
    if (now < wheelLock) return;
    wheelAcc += delta;
    if (Math.abs(wheelAcc) < 40) return;
    var dir = wheelAcc > 0 ? 1 : -1;
    wheelAcc = 0;
    wheelLock = now + 420;
    go(active + dir);
    startIdle();
  }, { passive: false });
```
*(При необходимости синхронно обновить формулировку в `docs/ui-carousel-modal.md`, строка 19).*

**Проверка:** вертикальная прокрутка страницы колесом мыши над каруселью плавно скроллит страницу вниз; жест двумя пальцами влево/вправо по трекпаду или `Shift + колесо` листает карточки карусели.

---

### Задача 4.4. Быстрые ссылки навигации в шапке и `page-top`
**Цель:** дать пользователю прямой переход к «Услугам и ценам» и «Каталогу моделей» из любой точки сайта.

**Файлы:** `views/partials/page-top.ejs`, `views/partials/hero.ejs`

**Что сделать:**
1. В `views/partials/page-top.ejs` (строки 3–5) добавить ссылку на услуги:
   ```html
   <nav class="page-top-nav" aria-label="Разделы">
     <a href="/#uslugi">Услуги и цены</a>
     <a href="/modeli">Каталог моделей</a>
   </nav>
   ```
2. В `views/partials/hero.ejs` добавить строку быстрых фактов/ссылок под `.lead` или внизу шапки (например, бейджи «Выезд в день обращения · Гарантия на работы · <a href="/modeli">Каталог 50+ моделей</a>»).

**Проверка:** из шапки внутренних страниц можно в один клик перейти как в каталог моделей, так и к прайсу услуг.

---

## Этап 5. Оформленная страница 404 вместо текста «Модель не найдена»

Сейчас при переходе по старой или неверной ссылке (`/modeli/unknown` или `/uslugi/unknown`) сервер отдаёт голую строку текста без шапки, контактов и ссылки на каталог.

### Задача 5.1. Создать шаблон `views/not-found.ejs` и подключить его в `server.js`
**Цель:** удерживать посетителя на сайте при ошибке в URL.

**Файлы:** `views/not-found.ejs` (новый), `server.js`

**Что сделать:**
1. Создать `views/not-found.ejs`:
   ```html
   <!DOCTYPE html>
   <html lang="ru">
   <head>
     <%- include('partials/head') %>
   </head>
   <body>
     <%- include('partials/page-top') %>

     <article class="detail">
       <div class="detail-card">
         <h1><%= heading %></h1>
         <p class="detail-desc">Страница не найдена или была перемещена. Посмотрите весь каталог моделей или список услуг на главной странице — либо сразу позвоните нам.</p>
         <p style="margin: 1rem 0;">
           <a class="featured-all" href="/">← На главную (услуги и цены)</a>
           &nbsp;·&nbsp;
           <a class="featured-all" href="/modeli">Каталог моделей →</a>
         </p>
         <%- include('partials/cta-box', { ctaTitle: 'Связаться с мастером:' }) %>
       </div>
     </article>

     <%- include('partials/footer') %>
   </body>
   </html>
   ```
2. В `server.js` в маршрутах `/uslugi/:slug` (строка ~1010) и `/modeli/:slug` (строка ~1114) вместо `return res.status(404).send(...)` рендерить `not-found`:
   ```js
   if (!service) {
     return res.status(404).render("not-found", publicLocals(data, {
       title: "Страница не найдена",
       description: HOME_DESC,
       heading: "Услуга не найдена",
       pageUrl: absUrl(req.path),
     }));
   }
   ```
   (и аналогично для `!printer`).

**Проверка:** переход на `/modeli/test-404` отдаёт статус 404 с полноценным дизайном сайта, ссылками на каталог/главную и кнопками связи.
