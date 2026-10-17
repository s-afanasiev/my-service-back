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

---
---

# Часть 2. Итоги UX-аудита и новые направления

> Дополнения после независимого UX-аудита (Этапы 1–5 выполнены — коммиты `ux1`…`ux5`).
> Правила 1–3 из начала документа действуют. Дополнительно:
> 4. Единый паттерн «модалка-карусель» (листание карточек, не выходя из модалки) — фирменная фича сайта. Геометрия и поведение закреплены в `docs/ui-carousel-modal.md` и `docs/ui-service-modal.md`; любое изменение геометрии модалок синхронно отражается в этих документах.
> 5. Схемы новых таблиц проектируются в `docs/printers-cartridges-schema.md`; реализация — вариант A (единая таблица `printers` + `cartridges` + связь `printer_cartridges`).

---

## 2.0. Что уже хорошо (не ломать при доработках)

- Живой поиск и фильтр по брендам в `/modeli`, липкая панель поиска, осмысленный empty-state.
- CTA-контакты есть в hero, шапке, футере, обеих модалках и в конце детальных страниц — тупиков нет.
- Прогрессивное усиление: без JS карточки остаются обычными ссылками (`<a href="/uslugi/...">`, `<a href="/modeli/...">`).
- 404 оформлена в стиле сайта; хлебные крошки на всех детальных страницах.
- Цены видны на всех уровнях (карточки, пилюли «Заправка — от N ₽», таблицы на страницах моделей).
- `prefers-reduced-motion` учитывается в карусели.

---

## 2.1. Бэклог по итогам аудита

| # | Приоритет | Проблема | Где | Статус |
|---|-----------|----------|-----|--------|
| A1 | критично | Клавиатура не открывает модалку принтера (Enter на карточке ничего не делает) | `views/partials/featured-printers.ejs` | ✅ готово |
| A2 | критично | Нет способа оставить заявку (только tel/мессенджеры) | сайт целиком | ✅ готово (MVP) |
| A3 | критично | Нет доверительных блоков: гарантия, график, адрес, отзывы/кейсы | главная, детальные страницы | ⚠️ частично (без отзывов) |
| A4 | важно | Разная шапка на главной и внутренних страницах; на мобильных `page-top` переносится в 2–3 ряда | `hero.ejs`, `page-top.ejs` | ✅ готово |
| A5 | важно | Автоскролл карусели 4.5 с без паузы (WCAG 2.2.2) + спам `aria-live` при авто-смене | `featured-printers.ejs` | ✅ готово |
| A6 | важно | В модалках нет focus trap; фокус не возвращается на карточку после закрытия | обе модалки | ✅ готово |
| A7 | важно | Поиск в `/modeli` буквальный: «hp 1102», «МФУ canon», «лазерный» не находятся | `models.ejs` | ✅ готово |
| A8 | важно | Состояние фильтра/поиска не сохраняется в URL | `models.ejs` | ✅ готово |
| A9 | мелочь | На `/modeli/:slug` пилюли с картриджем/ценой стоят выше `<h1>` | `printer.ejs` | ✅ готово |
| A10 | мелочь | `body { min-height: 100vh }` → лишний скролл на мобильных | `head.ejs` | ✅ готово |
| A11 | мелочь | Inline-цвета кнопок контактов из админки без контроля контраста | `head.ejs`, админка | ✅ готово |
| A12 | мелочь | Нет `prefers-reduced-motion` для CSS-трансформаций (hover, rotate крестика) | `head.ejs` | ✅ готово |
| A13 | мелочь | Стрелки `←/→` модалки принтера перекрывают контент на мобильных | `head.ejs` | ✅ готово |
| A14 | мелочь | Escape/стрелки перехватываются в capture-фазе глобально — ломают скролл таблиц | `featured-printers.ejs` | ✅ готово |
| A15 | мелочь | «Каталог 50+ моделей» захардкожено | `hero.ejs` | ✅ готово |

---

## Часть 2.2. Задачи по итогам аудита

### Этап 6. Критические исправления

#### ✅ Задача 6.1. Клавиатура открывает модалку принтера
**Цель:** Enter на карточке карусели открывает модалку (сейчас `preventDefault()` без действия — колонка 369–376).

**Файл:** `views/partials/featured-printers.ejs`

**Что сделать:**
1. В обработчике клика `.film-card-link` вызывать `openModal(card)` вместо пустого `preventDefault()` (по образцу `services.ejs:214-220`).
2. Модификаторы (`metaKey/ctrlKey/shiftKey/altKey`, средняя кнопка) — оставить «честный» переход на страницу модели.

**Проверка:** Tab до карточки → Enter открывает модалку; Ctrl+Enter открывает страницу модели в новой вкладке.

---

#### ✅ Задача 6.2. Форма заявки / быстрый контакт
> **Статус: выполнено (MVP + уведомления).** Модалка заявки + `POST /api/lead` + таблица `leads` + раздел «Заявки» в админке + honeypot и лимит 5 заявок/час с IP. **Уведомления в Telegram — готово**: задайте `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` в `.env` (см. `.env.example`) — заявка сразу придёт в чат.
**Цель:** дать возможность оставить заявку без звонка (десктоп, нерабочие часы).

**Файлы:** `views/partials/cta-box.ejs` (расширить), `server.js`, `views/admin.ejs`, `head.ejs` (стили формы)

**Что сделать:**
1. Решить формат (минимум → максимум):
   - **MVP:** кнопка «Написать заявку» → компактная модалка «Имя + телефон + (опционально) модель принтера» с отправкой `POST /api/lead` (валидация + сохранение в таблицу `leads` + уведомление на email/Telegram-бот — по обсуждению);
   - **Альтернатива без бэкенда:** ссылка `https://t.me/...` / `wa.me/...` с предзаполненным текстом («Модель: HP LaserJet P1102, вопрос: заправка») — подставлять модель на страницах `/modeli/:slug`.
2. Контекстные подстановки: на странице модели — префикс с брендом/моделью, на странице услуги — с названием услуги.
3. После отправки — понятное подтверждение («Перезвоним в течение 15 минут в рабочее время» + график).

**Проверка:** заявка с детской страницы `/modeli/hp-laserjet-p1102` приходит с указанной моделью; повторный клик не создаёт дублей.

---

#### ✅ Задача 6.3. Доверительные блоки
> **Статус: выполнено.** Блок «Как мы работаем» (4 шага + факты), «Примеры работ» (реальные фото + цены), блок «Отзывы клиентов» — с инфраструктурой: таблица `reviews`, раздел «Отзывы» в админке (добавление/скрытие/удаление), на главной отзывов нет → блок автоматически скрыт. **Осталось только добавить реальные отзывы в админке** (выдумывать их нельзя).
**Цель:** закрыть обещания hero («Выезд в день обращения», «Гарантия на работы») конкретикой.

**Файлы:** `views/partials/` (новые partials: `trust.ejs`, `reviews.ejs`), `views/main.ejs`, `server.js` (данные), `views/admin.ejs`

**Что сделать:**
1. Блок «Как мы работаем» (3–4 шага: заявка → диагностика → согласование цены → ремонт/заправка + гарантия).
2. График работы и адрес/зона выезда (данные — в `contacts`/настройки; уже есть `serviceArea` для футера).
3. Отзывы/кейсы: на первое время — статические карточки «до/после» на основе `assets/services/*.jpg` + цитата; позже — управление из админки.
4. Плашка «Гарантия N дней на заправку и ремонт» — продублировать на детальных страницах услуг.

**Проверка:** на главной появляются блок доверия и отзывы; из hero факты ссылаются на них якорями.

---

### Этап 7. Единая шапка и мобильный CTA

#### ✅ Задача 7.1. Объединить шапку главной и внутренних страниц
**Цель:** убрать рассинхронизацию: с главной нет пути на `/stati` и «Услуги и цены», на внутренних — другой визуал.

**Файлы:** `views/partials/hero.ejs`, `views/partials/page-top.ejs`, `views/partials/head.ejs`

**Что сделать:**
1. В `hero.ejs` добавить те же nav-ссылки, что в `page-top.ejs` (`/#uslugi`, `/modeli`, `/stati`) — либо вынести навигацию в общий partial `site-nav.ejs`.
2. На мобильных (`max-width: 640px`) оставить в шапке бренд + 1–2 иконки контактов; nav-ссылки сворачивать (☰ или горизонтальный скролл-чипсы).

**Проверка:** с любой страницы в один клик доступны услуги, каталог и статьи; на 360px шапка занимает ≤1 строки.

---

#### ✅ Задача 7.2. Нижняя мобильная панель действий
**Цель:** на мобильных главный CTA всегда под большим пальцем.

**Файлы:** `views/partials/cta-bar.ejs` (новый), `views/main.ejs` + детальные страницы, `head.ejs`

**Что сделать:**
1. Липкая нижняя панель (`position: fixed; bottom: 0`) с 2 кнопками: «Позвонить» (tel) и «Написать» (мессенджер/форма из задачи 6.2). Показывать только на `max-width: 640px`.
2. Добавить `body { padding-bottom: ... }` под панель; скрывать при открытой модалке.

**Проверка:** панель не перекрывает контент и футер, исчезает в модалках.

---

### Этап 8. Карусель: пауза и доступность

#### ✅ Задача 8.1. Кнопка паузы и корректные анонсы
**Цель:** убрать нарушение WCAG 2.2.2 и «болтливый» `aria-live`.

**Файлы:** `views/partials/featured-printers.ejs`, `head.ejs`

**Что сделать:**
1. Кнопка «⏸ Пауза / ▶ Старт» рядом со стрелками карусели; состояние хранить в `localStorage`.
2. Автопрокрутка останавливается после **первого** взаимодействия пользователя (клик, свайп, клавиша, wheel) и не возобновляется автоматически.
3. `announce()` вызывать только по действию пользователя, не по тику автопрокрутки.

**Проверка:** карусель можно остановить; скринридер не озвучивает смену карточек без действий; `prefers-reduced-motion` по-прежнему отключает автопрокрутку.

---

### Этап 9. Модалки: focus trap и возврат фокуса

#### ✅ Задача 9.1. Общий хелпер модального фокуса
**Цель:** клавиатурный пользователь не «выпадает» из модалки и не теряет позицию.

**Файлы:** `views/partials/services.ejs`, `views/partials/featured-printers.ejs` (общий код вынести в `views/partials/modal-focus.js`-скрипт или общий partial), `head.ejs`

**Что сделать:**
1. Focus trap: Tab/Shift+Tab циклически зацикливают фокус внутри `.service-modal-dialog` / `.printer-modal-dialog`.
2. При закрытии — возврат фокуса на элемент, открывший модалку (карточку/ссылку).
3. Задача 14 из мелочей (A14): Escape/стрелки обрабатывать только когда фокус не внутри `.printer-modal-specs-scroll` и других скролл-областей.

**Проверка:** Tab не выходит за пределы модалки; после Escape фокус на исходной карточке.

---

### Этап 10. Поиск и фильтры каталога

#### ✅ Задача 10.1. Нормализация поиска + счётчик результатов
**Цель:** «hp 1102», «p-1102», «МФУ canon», «лазерный» находят свои модели.

**Файлы:** `views/models.ejs`, `server.js` (если нормализацию делаем на сервере в `data-search`)

**Что сделать:**
1. Нормализация строки: lowercase, выкинуть дефисы/пробелы/точки, добавить синонимы из `typeLabel`/`techLabel`/`colorLabel` («мфу/принтер», «лазер/струй», «цвет/чб»), учесть артикулы без дефисов (`tn1075` == `TN-1075`).
2. Счётчик «Найдено N из M» над сеткой; в empty-state — кнопка «Сбросить фильтр».

**Проверка:** запросы `hp 1102`, `85a`, `tn 1075`, `мфу canon` дают ожидаемые карточки.

---

#### ✅ Задача 10.2. Состояние фильтра в URL
**Цель:** шаринг и «назад» не сбрасывают выбор.

**Файлы:** `views/models.ejs`

**Что сделать:** `?brand=hp&q=85a` ↔ состояние чипсов/поиска (читать на load, писать через `history.replaceState`); кнопка «назад» браузера возвращает предыдущий фильтр.

**Проверка:** ссылка `…/modeli?brand=hp` открывается сразу с фильтром HP.

---

### ✅ Этап 11. Polish (чек-лист мелочей — A9…A15)

- [x] **11.1** `printer.ejs`: порядок `h1` → пилюли (картридж, цена) → фото.
- [x] **11.2** `head.ejs:75`: `min-height: 100vh` → `100dvh` (с fallback).
- [x] **11.3** Контраст кнопок контактов: `textColorFor()` переписан на точный подбор по WCAG (белый vs тёмный — берётся бо́льший контраст к фону).
- [x] **11.4** `@media (prefers-reduced-motion: reduce)` — трансформации и переходы отключены.
- [x] **11.5** Стрелки модалки принтера на мобильных: подняты над фото (`top: 22%`), текст не перекрывают.
- [x] **11.6** Escape/стрелки не перехватываются в полях ввода (общий контроллер модалки).
- [x] **11.7** `hero.ejs`: количество моделей в факте считается из данных.

---

## Часть 2.3. Новые фичи: динамика «не выходя из модалки»

> Опорная идея: пользователь ни разу не возвращается в список, чтобы сменить объект просмотра.
> Референс — карусель «Популярные модели»: клик по карточке → модалка → стрелки ←/→ листают принтеров.

### Этап 12. Листание принтеров прямо в каталоге `/modeli`

#### ✅ Задача 12.1. API каталога принтеров
**Цель:** клиент мог получать данные принтера для модалки без перезагрузки страницы.

**Файлы:** `server.js`

**Что сделать:**
1. `GET /api/printers` — лёгкий список (id, slug, brand, model, meta, imageUrl, brandSlug, cartridge_note, type/tech/color-лейблы) в порядке каталога (бренд → модель).
2. `GET /api/printers/:slug` — полные данные для модалки: description, specRows, priceServices, refillPrice, cartridge.
3. Ответ кэшировать в памяти на время жизни процесса (данные меняются редко).

**Проверка:** оба эндпоинта отдают JSON; 404 на неизвестном slug.

---

#### ✅ Задача 12.2. Модалка принтера на `/modeli` со стрелками ←/→
**Цель:** открыв карточку в каталоге, листать всех принтеров стрелками, как в карусели главной.

**Файлы:** `views/models.ejs`, `views/partials/printer-modal.ejs` (вынести из `featured-printers.ejs`), `head.ejs`, `docs/ui-carousel-modal.md` (обновить описание)

**Что сделать:**
1. Вынести разметку `.printer-modal` и её JS в общий partial, переиспользовать на главной и в каталоге (геометрия — по `docs/ui-carousel-modal.md`).
2. Клик по `.cat-card` → `preventDefault()` → модалка с данными карточки + дозагрузка `GET /api/printers/:slug` (спеки, цены).
3. Стрелки ←/→ и клавиши Arrow листают **по порядку каталога** (с учётом активного фильтра из задач 10.1–10.2: листать только видимые карточки).
4. `history.replaceState` меняет URL на `/modeli/:slug` (шаринг/обновление страницы не теряют место); «Страница модели →» остаётся полным переходом.
5. Модификаторы клика — честный переход (как в задаче 6.1).

**Проверка:** из `/modeli` открывается HP P1102, стрелками перебираются все видимые модели, Escape закрывает, F5 на `/modeli/hp-laserjet-p1102` открывает ту же модель обычной страницей.

---

#### ✅ Задача 12.3. Где ещё применить паттерн «листать не выходя»
> **Статус: выполнено полностью (все 6 пунктов).** См. журнал.
**Цель:** системная динамика между разделами. Кандидаты (по убыванию пользы):

1. **Картридж ↔ принтеры:** клик по картриджу на странице модели → карточка картриджа (Этап 13) со списком совместимых принтеров, по нему — листание принтеров этого картриджа.
2. **Листание услуг в модалке услуг** (`services.ejs`): стрелки ←/→ как у принтеров — смена услуги без закрытия.
3. **Предыдущая/следующая** внизу детальных страниц: `/modeli/:slug` (соседи каталога), `/uslugi/:slug`, `/stati/:slug`.
4. **«Похожие модели»** на странице принтера: лента 3–5 моделей того же класса (та же технология/цветность) — клик открывает ту же модалку со стрелками.
5. **Быстрый переход (cmd/ctrl+K или поле в шапке):** ввод «P1102» → переход к модели/картриджу/услуге.
6. **Модалка картриджа** — листание картриджей внутри каталога картриджей (симметрично Этапу 12).

**Проверка:** сценарий «нашёл принтер → открыл картридж → выбрал аналог → вернулся к принтеру» проходится без возврата в списки и без потери контекста.

---

### Этап 13. Каталог картриджей

#### ✅ Задача 13.1. Данные: `cartridges` + `printer_cartridges`
**Цель:** вместо текстового `cartridge_note` — нормальная сущность картриджа (проект: `docs/printers-cartridges-schema.md`, вариант A).

**Файлы:** `server.js`, `docs/printers-cartridges-schema.md` (актуализировать), импорт-скрипт в `scripts/`

**Что сделать:**
1. Создать таблицы `cartridges` (brand, model, name, color, cartridge_type: toner/ink/drum/waste, resource_pages, analog_note) и `printer_cartridges` (M:N, с флагом `is_default`).
2. Миграция-заполнение: разобрать существующие `cartridge_note` («85A / CE285A», «106A / 107A (W1106A / W1107A)») в записи картриджей и связи; ручная доводка в админке.
3. Оставить `cartridge_note` как display-строку до полного переключения.

**Проверка:** для каждой модели каталога известны её картриджи (включая драм-юниты Brother/ Kyocera).

---

#### ✅ Задача 13.2. Страница `/kartridzhi`
**Цель:** пользователь приходит с запросом «картридж 85A» и находит свой.

**Файлы:** `views/cartridges.ejs` (новый), `server.js`, `views/partials/page-top.ejs`, `head.ejs`

**Что сделать:**
1. Список картриджей с группировкой по брендам + живой поиск (по номеру/названию) — по образцу `/modeli` (задачи 1.2, 10.1).
2. На карточке: номер, тип (тонер/чернила/барабан), цвет, «подходит к N моделям», цена заправки.
3. Ссылка «Каталог картриджей» в `page-top`, футере и `sitemap.xml`.

**Проверка:** поиск `85a` находит картридж и ведёт на карточку с принтерами.

---

#### ✅ Задача 13.3. Страница `/kartridzhi/:slug` + клик из принтера
**Цель:** связка «принтер → картридж → другие принтеры на этом картридже».

**Файлы:** `views/cartridge.ejs` (новый), `views/printer.ejs`, `server.js`

**Что сделать:**
1. Карточка картриджа: характеристики, цена заправки, блок «Совместимые принтеры» (карточки-ссылки, открывающие модалку принтера из задачи 12.2).
2. В `printer.ejs` пилюлю «Картридж: …» сделать ссылкой на карточку картриджа.
3. Breadcrumbs: Главная / Каталог картриджей / CE285A.

**Проверка:** с `/modeli/hp-laserjet-p1102` клик по «85A» открывает карточку картриджа, оттуда — модалку другой модели на том же картридже.

---

### Этап 14. Картридж-аналог и раздел «картридж неоригинальный»

#### ✅ Задача 14.1. Плашка «Есть аналог — дешевле»
**Цель:** показать альтернативу в момент, когда пользователь видит номер картриджа.

**Файлы:** `views/printer.ejs`, `views/cartridge.ejs`, `views/partials/printer-modal.ejs`, `head.ejs`

**Что сделать:**
1. Рядом с пилюлей картриджа — плашка «Аналог дешевле: совместимые картриджи от N ₽» со ссылкой на `/uslugi/kartridzh-neoriginalnyy` (или сразу на раздел брендов-аналогов — задача 14.2).
2. Тот же блок — в модалку принтера (лента каталога) и на карточку картриджа.
3. Формулировка честная: «оригинал vs аналог» — 1 строка о разнице (ресурс, чипы, гарантия).

**Проверка:** на странице любой модели с картриджом видна плашка про аналог; клик ведёт в раздел неоригинальных картриджей.

---

#### ✅ Задача 14.2 (а). Лента брендов-аналогов на странице услуги
**Цель:** удобная прокрутка брендов-аналогов (панель `.service-modal-side` уже есть, нужен упрощённый вариант на самой странице).

**Файлы:** `views/service.ejs`, `head.ejs`, `server.js` (передать `service.panel` в страницу — уже есть)

**Что сделать:**
1. На `/uslugi/kartridzh-neoriginalnyy` вместо вертикального списка `.brand-article` — горизонтальная лента чипсов брендов с логотипами (`assets/brands/*`) и панелью описания выбранного бренда (клик/тап по чипсу → карточка бренда, без модалки).
2. Поведение проще модалки услуг: без вложенных состояний, только переключение бренда + свайп-скролл ленты (`overflow-x: auto`, `scroll-snap`).
3. Доступность: чипсы — `role="tab"`/`aria-selected`, стрелки клавиатуры листают бренды.

**Проверка:** на мобильных лента брендов свайпается одной рукой, описание меняется по тапу, модалка услуг (docs) не задета.

---

#### ✅ Задача 14.3 (б). Плашка на главной со ссылкой на аналоги
**Цель:** показать подборку брендов-аналогов с главной — там интересный контент по каждому бренду.

**Файлы:** `views/main.ejs`, `views/partials/` (новый partial `analogs-teaser.ejs`), `head.ejs`

**Что сделать:**
1. Компактная «угловая» плашка-тизер: например, правый верхний угол секции «Услуги и цены» или отдельная bento-плитка рядом с hero-фактами: «Не оригинал, но дешевле: 12 брендов картриджей-аналогов →» с логотипами 3–4 брендов (`assets/brands/`).
2. Клик → `/uslugi/kartridzh-neoriginalnyy#brands` (якорь на ленту из задачи 14.2).
3. Не перегружать главную: плашка компактная, уважает существующую bento-сетку.

**Проверка:** плашка видна на главной без скролла (или в первом экране секции услуг), ведёт сразу к ленте брендов-аналогов.

---

## Порядок выполнения (рекомендуемый)

1. **Этап 6** (6.1 → 6.2 → 6.3) — критичное.
2. **Этап 12** (12.1 → 12.2) — ядро новой динамики; 12.3 — после.
3. **Этап 13** (13.1 → 13.2 → 13.3) — каталог картриджей (зависит от 12.2 для модалок).
4. **Этап 14** (14.1 → 14.2 → 14.3) — аналоги (зависит от 13).
5. **Этапы 7–11** — параллельно, независимыми шагами.

---

## Журнал выполнения

### 2026-10-17 — Этап 6 (критические исправления) — готово

- **6.1 ✅** `views/partials/featured-printers.ejs`: клик/Enter по карточке карусели открывает модалку (модификаторы клавиш/средняя кнопка — честный переход на страницу модели).
- **6.2 ✅ (MVP)**
  - `server.js`: таблица `leads` (initDB), `POST /api/lead` (валидация имени/телефона, honeypot `website`, лимит 5 заявок/час с IP), `POST /admin/leads/:id/delete`, выдача заявок в `renderAdmin`;
  - `views/partials/lead-modal.ejs` (новый): модалка «Написать заявку» (имя, телефон, модель/вопрос) — подключена через `footer.ejs` на всех публичных страницах; успех/ошибки, отправка через `fetch`;
  - кнопки-триггеры `data-lead-open`: в `cta-box.ejs` (с контекстом страницы), `hero.ejs`, `page-top.ejs`; стиль `.btn-lead`;
  - `views/admin.ejs`: раздел «Заявки с сайта» (дата, имя, телефон — ссылка `tel:`, контекст, сообщение, страница, удаление);
  - уведомления (email/Telegram) — не реализованы (по договорённости — заявки в админке).
- **6.3 ✅ частично**
  - `views/partials/trust.ejs` (новый): «Как мы работаем» — 4 шага + факты (выезд/гарантия/график/ориентир по цене), якорь `#kak-rabotaem`;
  - `views/partials/cases.ejs` (новый): «Примеры работ» — 4 карточки на реальных фото `assets/services/*` со ссылками на услуги (цена берётся из данных);
  - `views/partials/hero.ejs`: факты героя стали ссылками на `#kak-rabotaem`;
  - `views/main.ejs`: порядок hero → trust → витрина → услуги → примеры работ;
  - **отзывы не делали**: выдумывать отзывы нельзя; нужны реальные + управление в админке (в бэклоге).
  - Просьба владельцу: проверить тексты «Как мы работаем» (сроки, гарантия) на соответствие реальным условиям.

### 2026-10-17 — Этап 12 (динамика «не выходя из модалки») — готово

- **12.1 ✅** `server.js`: `GET /api/printers` (лёгкий список) и `GET /api/printers/:slug` (описание, specRows, цены услуг, refill) с кэшем в памяти на 60 с.
- **12.2 ✅**
  - модалка принтера вынесена в общие partials: `views/partials/printer-modal.ejs` (DOM) + `views/partials/printer-modal-js.ejs` (контроллер `window.PrinterModal`: open/update/close/setNav, Escape/стрелки, возврат фокуса);
  - `views/partials/featured-printers.ejs` переведён на общий контроллер (поведение карусели не менялось);
  - `views/models.ejs`: клик/Enter по карточке каталога → модалка; стрелки ←/→ листают **видимые** карточки с учётом поиска и фильтра бренда; URL синхронизируется `history.replaceState` (`/modeli/:slug` → обратно); описание/характеристики/цена дозагружаются из `/api/printers/:slug` (с кэшем на клиенте);
  - в модалку добавлена пилюля цены заправки (`.printer-modal-price`), геометрия окна не изменена; `docs/ui-carousel-modal.md` обновлён.
- **12.3** — список идей (листание услуг, статей, «похожие модели», Ctrl+K) — остаётся в плане, не реализовано.

### Смоук-тесты (локально, Postgres)

- `/`, `/modeli`, `/modeli/:slug`, `/stati` → 200; несуществующая модель → 404 с оформленной страницей.
- `/api/printers` → 61 модель; `/api/printers/:slug` → 12 строк характеристик.
- `POST /api/lead`: корректная заявка → `{"ok":true}` (попадает в админку), некорректная → 400.
- Админка `/home`: раздел «Заявки» отображается.
- Примечание: в локальной БД нет услуги с kind=`refill` («Заправка картриджа») — пилюля цены в модалке корректно скрывается; при наличии услуги заправки она появится автоматически.

### 2026-10-17 — Этапы 7–11, 13–14 — готово

**Этап 7. Шапка и мобильный CTA ✅**
- 7.1: единая навигация («Услуги и цены», «Каталог моделей», «Картриджи», «Статьи») и в `hero.ejs`, и в `page-top.ejs`; на мобильных (≤640px) nav превращается в горизонтально скроллящиеся чипсы (2-я строка шапки), контакты ужимаются.
- 7.2: `views/partials/cta-bar.ejs` — липкая нижняя панель на мобильных: «Позвонить» (tel), мессенджер, «Заявка» (открывает лид-форму); скрывается при открытой модалке, `body { padding-bottom }` под панель.

**Этап 8. Карусель ✅**
- 8.1: кнопка «⏸ Пауза / ▶ Старт» (состояние в `localStorage`), автопрокрутка останавливается после первого взаимодействия и не возобновляется сама, `aria-live` озвучивает только действия пользователя.

**Этап 9. Модалки ✅**
- 9.1: `views/partials/modal-focus.ejs` (хелпер `ModalFocus.trap`) — Tab зациклен внутри всех трёх модалок (принтер, услуга, заявка); модалка услуги получила возврат фокуса после закрытия (у принтера и заявки уже был).

**Этап 10. Поиск каталога ✅**
- 10.1: поиск по токенам с нормализацией (нижний регистр, ё→е, игнор дефисов/пробелов): «hp 1102», «p-1102», «85a», «tn 1075», «мфу canon» находят модели; в `data-search` добавлены синонимы (мфу/принтер/лазерный/струйный/цветной/чб); счётчик «Найдено N из M», кнопка «Сбросить фильтр». Аналогичный поиск — в каталоге картриджей.
- 10.2: состояние фильтра в URL (?brand=&q=), восстанавливается при загрузке; модалка каталога при закрытии возвращает URL с фильтром (`window.__CATALOG_STATE_URL`).

**Этап 11. Polish ✅**
- 11.1 порядок на странице модели: h1 → пилюли → фото; 11.2 `100dvh` с fallback; 11.3 `textColorFor()` переписан на WCAG-подбор цвета текста кнопок; 11.4 глобальный `prefers-reduced-motion`; 11.5 стрелки модалки на мобильных подняты над фото (`top: 22%`); 11.6 стрелки/Escape не перехватываются в полях ввода; 11.7 «Каталог N моделей» считается из данных.

**Этап 13. Каталог картриджей ✅**
- 13.1: таблицы `cartridges` + `printer_cartridges` (M:N, `is_default`), автозаполнение из `cartridge_note` (`seedCartridges()` при старте: разбор вида «85A / CE285A», «TK-133 + барабан DR-133» → тип toner/ink/drum). `cartridge_note` остаётся display-строкой.
- 13.2: страница `/kartridzhi` — группировка по брендам, живой поиск, чипсы брендов, счётчик, карточки «тип + N совместимых моделей».
- 13.3: страница `/kartridzhi/:slug` — характеристики картриджа, блок «Оригинал или аналог?», «Подходит к моделям» — сетка принтеров с **модалкой-листанием** (общий контроллер `views/partials/printer-catalog-js.ejs`, переиспользован из `/modeli`); пилюля картриджа на странице модели — ссылка на карточку картриджа. Ссылки «Картриджи» — в шапке, футере и sitemap.

**Этап 14. Картридж-аналог ✅**
- 14.1: плашка «Аналог дешевле» на страницах модели и картриджа + ссылка «Аналог дешевле →» в модалке принтера (данные — `analogUrl` в `/api/printers/:slug`).
- 14.2: на `/uslugi/kartridzh-neoriginalnyy` вместо вертикального списка — горизонтальная лента чипсов брендов-аналогов с логотипами (свайп, `role=tab`, стрелки клавиатуры) и панель выбранного бренда (переиспользованы стили `.service-brand-*`), якорь `#brands`.
- 14.3: на главной — bento-плитка «Не оригинал, но дешевле» с логотипами 5 брендов и ссылкой `/uslugi/<slug>#brands`.

**Из идей 12.3 сделано частично:** «← предыдущая / следующая →» внизу страниц моделей (соседи каталога, `.pager`). Остальные идеи (листание услуг/статей, Ctrl+K, «похожие модели») остаются в бэклоге.

**Общие рефакторинги:** контроллер каталога вынесен в `views/partials/printer-catalog-js.ejs` (работает везде, где карточки размечены `li[data-model-item]`); модалка принтера — `printer-modal.ejs` + `printer-modal-js.ejs` (общие для витрины, каталога и картриджей).

### Смоук-тесты (2026-10-17, повторно)

- `/`, `/modeli`, `/modeli/:slug`, `/kartridzhi`, `/kartridzhi/:slug`, `/uslugi/kartridzh-neoriginalnyj`, `/stati` → 200; `/kartridzhi/unknown`, `/modeli/unknown` → 404.
- `/kartridzhi`: 56 картриджей из `cartridge_note`; карточка картриджа: `data-model-item`, модалка, блок аналога.
- `/api/printers/hp-laserjet-p1102`: 2 картриджа (85A, CE285A), `analogUrl` заполнен.
- Страница модели: ссылки на картриджи, плашка аналога, `.pager` (пред/след).
- Главная: тизер аналогов (5 логотипов) → `/uslugi/kartridzh-neoriginalnyj#brands`; на странице услуги — лента чипсов и якорь `#brands`.
- `node --check server.js` и компиляция всех 27 EJS-шаблонов — без ошибок.

### 2026-10-17 — Завершение плана: отзывы, уведомления, идеи 12.3, админка картриджей — готово

**Отзывы (6.3, финал)**
- Таблица `reviews` (автор, город, оценка, текст, is_active), раздел «Отзывы» в админке: добавление, показ/скрытие, удаление.
- `views/partials/reviews.ejs` — блок «Отзывы клиентов» на главной (после «Примеров работ»); показывается **только при наличии активных отзывов**. Выдуманных отзывов нет — добавьте реальные в админке.

**Уведомления о заявках (6.2, финал)**
- `notifyLead()` в `server.js`: при заявке уходит сообщение в Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` в `.env`, описано в `.env.example`). Без настройки — просто пишется в админку, ошибки уведомления не ломают отправку формы.

**Идеи 12.3 — все реализованы**
1. Картридж ↔ принтеры: клик по картриджу → карточка картриджа → совместимые принтеры (было в Этапе 13).
2. **Листание услуг в модалке услуг**: стрелки ←/→ и клавиши листают услуги, не закрывая модалку (`.service-modal-nav`, геометрия окна не изменена).
3. **«Предыдущая/следующая»** внизу страниц: `/modeli/:slug` (соседи каталога), `/uslugi/:slug` (соседние услуги), `/stati/:slug` (соседние статьи).
4. **«Похожие модели»** на странице принтера: 4 модели того же класса (технология + цветность) — клик открывает ту же модалку со стрелками листания.
5. **Быстрый переход Ctrl+K** (и кнопка «🔍 Поиск» в шапке): поиск по моделям, картриджам и услугам через `GET /api/search`; стрелки ↑/↓ + Enter, focus trap.
6. **Модалка картриджа с листанием** в `/kartridzhi`: клик по карточке картриджа → модалка (тип, цвет, совместимость, цена заправки, ссылка на аналог) со стрелками по каталогу; данные — `GET /api/kartridzhi/:slug` (контроллер каталога обобщён: `data-api-base`, `data-page-label`).

**Админка картриджей (13.1, финал)**
- Раздел «Картриджи» в админке: правка названия/типа/цвета, добавление вручную, удаление (удалённый вернётся при перезапуске, если указан в `cartridge_note` модели — описано в подсказке раздела).

**Смоук-тесты (финал)**
- Главная: быстрый поиск, стрелки модалки услуг; блок отзывов скрыт при пустой таблице, появляется после добавления в админке (проверено, тестовые данные удалены).
- `/modeli/:slug`: «Похожие модели» + пейджер; `/uslugi/:slug`, `/stati/:slug`: пейджеры.
- `/kartridzhi`: модалка картриджа с `data-api-base`; `GET /api/kartridzhi/hp-85a` → 3 строки характеристик, `analogUrl`.
- `GET /api/search?q=85a` → 3 результата (модели и картриджи); `q=заправка` → услуги.
- Админка: разделы «Заявки», «Картриджи», «Отзывы» на месте.
- `node --check server.js` + компиляция всех EJS — чисто.

**Итог: план выполнен целиком.** Остаётся только контентная работа владельца: реальные отзывы, настройка Telegram-бота, проверка текстов «Как мы работаем».
