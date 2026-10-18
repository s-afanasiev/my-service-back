# План: каталог картриджей к принтерам + фото (600×600, белый фон)

> Самодостаточный план для нового контекста. Проект: `C:\CODE\MY_SERVICES\my-service-back`
> (Windows, Git Bash, Node 22 + Express + PostgreSQL). Сайт «Заправка-Курск».
> Принтеры уже есть: `docs/printers-catalog.csv` (56 позиций), фото всех моделей в
> `assets/printers/*.jpg`. Теперь нужен такой же каталог **картриджей**.

## Цель

1. Составить полный список картриджей (и чернил), подходящих к принтерам из каталога.
2. Найти для каждого картриджа фото: **600×600 px, белый фон, JPEG** — тем же способом,
   каким искали фото принтеров (MCP `image_search` + sharp).
3. Результат: `docs/cartridges-catalog.csv` + `assets/cartridges/<slug>.jpg` + проверка покрытия.
4. Интеграцию картриджей в БД/сайт НЕ делать — это отдельная задача.

## Конвенции (работают в проекте, не менять)

- Slug: `slugPart(name)` = lowercase, кириллица → транслит (таблица RU_SLUG в `server.js:581`),
  символы не из `a-z0-9` → `-`, края чистятся. Имя файла: `-` → `_`, плюс `.jpg`.
  Примеры: `hp_26a.jpg`, `canon_crt052h.jpg`, `kyocera_tk1170.jpg`.
- Обработка картинок (sharp, скрипт-образец `tmp_printer_images/process_services.js`):
  `flatten(белый) → trim(15) → resize(540×540 contain, белый) → extend(30, белый) → jpeg q88`.
  sharp ставился `npm i --no-save`; проверить `node -e "require('sharp')"` и доустановить при необходимости.
- MCP `image_search` (`mcp__plugin_image-search_image_search__search_image`, параметры
  `query/count/gl/rank`): вызывать **строго по одному**, параллельные валят сервер
  (`internal_error`) — тогда `sleep 30–180` и повтор. Квота дневная, тратить не жалко.
- Верификация фактов — WebSearch (нативный, квоту не тратит); вносить **только уверенные**
  данные, спорное оставлять пустым.
- Коммит/пуш — только по явной просьбе пользователя.

## Шаг 1. Составить список картриджей

Источник №1 — колонка `cartridge_note` в `docs/printers-catalog.csv` (уже заполнена).
Выгрузка на текущий момент:

| № | Принтер | Картридж (сыро) |
|---|---|---|
| 1 | HP LaserJet Pro MFP M428dw | 26A / CF226A |
| 2 | HP LaserJet MFP M141w | 106A / 107A |
| 3 | HP Neverstop Laser 1000w | резервуар, комплект W1100A/W1105A |
| 4 | HP LaserJet Pro MFP M227fdw | 30A / CF230A |
| 5 | HP LaserJet Pro 3003dw | 150A / W1500A |
| 6 | HP Laser 108w | 106A / W1106A |
| 7 | HP LaserJet M111w | 106A / W1106A |
| 8 | HP LaserJet M211dw | 107A / W1107A |
| 9 | Canon i-SENSYS MF446x | 052 / CRT-052H |
| 10 | Canon i-SENSYS MF445dw | 052 / CRT-052 |
| 11 | Canon i-SENSYS LBP122dw | 052 / CRT-052 |
| 12 | Canon i-SENSYS LBP2900 | 703 / CART-303 |
| 13 | Canon i-SENSYS MF4410 | 712 / CART-712 |
| 14 | Canon PIXMA G3430 | чернила GI-серии |
| 15 | Pantum P2200 | TL-4100 |
| 16 | Pantum P2207 | TL-4100 |
| 17 | Pantum M6500 | TL-4100X |
| 18 | Pantum M6506NW | (пусто) |
| 19 | Pantum BM5100ADN | TL-5100 |
| 20 | Pantum BM5220ADW | (пусто) |
| 21 | Pantum P2506W | (пусто) |
| 22 | Pantum M6550NW | (пусто) |
| 23 | Samsung Xpress M2020 | MLT-D111S |
| 24 | Samsung SL-M2875FD | MLT-D116S |
| 25 | Samsung ML-2160 | MLT-D101S |
| 26 | Samsung SCX-3400 | MLT-D101S |
| 27 | Samsung SCX-4200 | тонер-туба, заправка бункера |
| 28 | Samsung CLX-3305 | CLT-404S (4 цвета) |
| 29 | Xerox Phaser 3010 | 106R0218 |
| 30 | Xerox Phaser 3020 | 106R02773 |
| 31 | Xerox WorkCentre 5019 / 5021 | (пусто) |
| 32 | Xerox B225 | (пусто) |
| 33 | Xerox B305 | (пусто) |
| 34 | Xerox B235 | (пусто) |
| 35 | Brother HL-1110R | TN-1075 |
| 36 | Brother HL-1210WR | TN-1075 |
| 37 | Brother DCP-1512R | TN-1075 |
| 38 | Brother DCP-L2550DW | TN-2335 / TN-2375 |
| 39 | Brother MFC-L2700DWR | TN-2095 |
| 40 | Brother DCP-1602R | TN-1095 |
| 41 | Kyocera FS-1040 | TK-1140 |
| 42 | Kyocera FS-1060DN | TK-1140 |
| 43 | Kyocera FS-1120MFP | TK-1110 |
| 44 | Kyocera ECOSYS M2040dn | TK-1160 |
| 45 | Kyocera ECOSYS M2235dn | TK-1170 |
| 46 | Kyocera ECOSYS P2235dn | TK-1170 |
| 47–50 | Катюша M133 / P133 / P140 / P247ep | (пусто; брендовые чипованные — C-TK133, THM247 и т.п.) |
| 51–53 | Epson EcoTank L3250/L3210/L3550 | чернила 103 |
| 54 | Epson L210 | чернила T664 |
| 55 | Deli M1820W | (пусто) |
| 56 | Cactus CS-LP1120B | (пусто) |

Пробелы в заметках (№18, 20, 21, 22, 31–34, 47–50, 55, 56) закрыть WebSearch-ом по
«<бренд> <модель> картридж тонер какой» и внести в CSV колонку `cartridge_note`
(заодно, точечно). Ожидания для самопроверки: Pantum M6506NW/M6550NW — семейство
TL-4100X; P2506W — TL-4100X/NT-C216B; Xerox B225/B305/B235 — тонер 006R04376/77/78
(разные объёмы); WC 5019/5021 — тонер CWAA07229 + драм 013R00690; Катюша M133/P133 —
C-TK133, P247ep — THM247; Deli M1820W — Deli-картридж ~T109; Cactus CS-LP1120B —
клон Pantum P2207 (TL-4100-совместимый).

Нормализация: «26A / CF226A» — это ОДИН картридж с двумя именами (маркетинговое и
 OEM). Ключ = OEM-имя (CF226A), алиасы — через запятую. Один картридж → много принтеров
 (например, TN-1075 → HL-1110R + HL-1210WR + DCP-1512R). Пустые/спорные клетки CSV
 дозаполнить, точечно обновив `cartridge_note`.

## Шаг 2. Формат `docs/cartridges-catalog.csv`

Разделитель `;`, кодировка UTF-8, колонки:

```
cartridge;brand;aliases;color;type;printers;image_file
```

- `cartridge` — OEM-имя (CF226A, TL-4100, TN-1075, 103-BK…)
- `brand` — HP / Canon / Pantum / Samsung / Xerox / Brother / Kyocera / Катюша / Epson / Deli / Cactus
- `aliases` — маркетинговые и совместимые имена через запятую
- `color` — mono / c / m / y / bk (для чернил — по цвету, CMYK = 4 строки? НЕТ:
  для чернил одна строка на комплект, color=color)
- `type` — toner / drum / ink / reservoir / chip / tube
- `printers` — slugs принтеров из `docs/printers-catalog.csv` через запятую
- `image_file` — `<slug>.jpg` (заполняется на шаге 4)

## Шаг 3. Поиск фото

Для каждого картриджа: `image_search` с `query="<бренд> <OEM> картридж тонер"`,
`gl=ru`, `count=6–8`, `rank=true`. Критерии годного кадра (по-caption):
реальный картридж (не коробка, не чип крупным планом, не «с.Features текстом»),
белый фон, без вотермарок/рекламных баннеров. Скачать 2–3 кандидата в
`tmp_cartridge_images/<slug>/`, просмотреть через Read, выбрать.

Особенности:
- Чернила (GI/103/T664) — фото комплекта бутылок или одной бутылки; допустимо.
- Цветные CLT-404S — искать именно 4-цветный комплект.
- «Резервуары» Neverstop (W1100A) — фото комплекта дозаправки.
- Если чистого кадра нет после 2–3 запросов — оставить без фото и записать в отчёт
  (как с Cactus CS-LP1120B у принтеров).

## Шаг 4. Обработка в 600×600

Скрипт-образец `tmp_printer_images/process_services.js`. Класть в
`assets/cartridges/<slug>.jpg`. Тот же конвейер: flatten(белый) → trim(15) →
resize(540×540 contain) → extend(30) → jpeg q88.

## Шаг 5. Проверка покрытия

Скрипт-аналог `tmp_printer_images/check.js`: каждый картридж из
`docs/cartridges-catalog.csv` ↔ файл в `assets/cartridges/`. Отчёт: сколько
картриджей, сколько с фото, список без фото.

## Шаг 6. Отчёт и коммит

Отчёт пользователю: таблица картриджей, источники, что не нашлось. Коммит/пуш —
только по явной команде «комит и пуш» (сообщение: lowercase, короткое, англ.,
например `cartridges: catalog csv + photos`).

## Подводные камни (опыт фото принтеров)

- Параллельные вызовы image_search → internal_error. Только последовательно.
- В результатах много картриджных коробок и рекламных баннеров — читать caption,
  качать 2–3 кандидата и смотреть глазами (Read), не брать первый попавшийся.
- У ряда брендов (Pantum/Катюша/Deli) картридж часто = белый/чёрный бокс —
  следить, чтобы на фото был именно картридж нужного семейства.
- Nenames «Катюша C-TK133» и т.п. могут отсутствовать в индексе — тогда искать
  по базовому Pantum-аналогу и помечать в отчёте.
- Копирование одного файла на два картриджа НЕ делать: у каждого своя картинка;
  если картридж один (алиасы) — одна запись, один файл.
