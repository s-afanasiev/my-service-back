# План: справочники принтеров и картриджей

Документ для обсуждения. Таблицы в БД ещё **не создаём** — сначала согласуем модель.

Связь с текущим проектом: сайт сервиса ремонта оргтехники / заправки картриджей. Справочники нужны, чтобы на сайте (и в админке) показывать «какой картридж подходит к какому принтеру», а не только прайс услуг из `services`.

---

## 1. Цели

1. Хранить **уникальные модели принтеров** (и родственной техники).
2. Хранить **уникальные модели картриджей**.
3. Отражать связь **многие-ко-многим**: на один принтер — несколько совместимых картриджей; один картридж — на несколько принтеров.
4. Уметь указать **картридж по умолчанию** для принтера.
5. Не загнать себя в угол с МФУ и сканерами.

---

## 2. Общая модель (предложение)

Три сущности:

| Таблица | Роль |
|--------|------|
| `printers` | Справочник устройств (принтер / МФУ; опционально сканер) |
| `cartridges` | Справочник картриджей |
| `printer_cartridges` | Совместимость (связь M:N) |

```
printers 1 ──< printer_cartridges >── 1 cartridges
              (многие совместимые)
```

Существующие таблицы `services` и `contacts` **не трогаем**. Связь прайса услуг с конкретным картриджем/принтером — отдельный вопрос на потом (если понадобится).

---

## 3. Философский вопрос: МФУ и сканеры — отдельные таблицы?

### Варианты

| Подход | Плюсы | Минусы |
|--------|-------|--------|
| **A. Одна таблица `printers` + поле `device_type`** | Проще админка и поиск «что подходит к модели»; МФУ почти всегда ищут как «принтер + картридж»; меньше JOIN | Часть полей нерелевантна для сканеров (скорость печати, картридж) |
| **B. Отдельные таблицы `printers` / `mfps` / `scanners`** | «Чистая» модель под каждый тип | Дублирование бренда/модели/года; совместимость с картриджами дублируется или усложняется; МФУ по сути тот же принтер + сканер |
| **C. Общая `devices` + узкие таблицы характеристик** | Академически красиво | Избыточно для текущего масштаба сайта |

### Рекомендация: **вариант A**

- **МФУ** — не отдельная таблица. Это тот же класс устройств с картриджами и печатью; отличие фиксируем полем `device_type = 'mfp'` и при необходимости полями сканирования.
- **Сканеры** — на первом этапе **не заводим** (или заводим позже тем же `device_type = 'scanner'` с пустыми print/cartridge-полями). Для сервиса заправки картриджей сканеры вторичны: у них нет расходников «картридж».
- Если позже понадобится полноценный каталог сканеров — либо тот же справочник с типом, либо отдельная таблица без связи с `cartridges`.

Итоговая терминология в БД: таблица может называться `printers` (привычно) или `devices`. Ниже используем **`printers`**, понимая что туда входят и МФУ.

---

## 4. Таблица `printers`

Справочник уникальных моделей устройств.

### Обязательные / важные поля (из запроса + дополнения)

| Колонка | Тип (черновик) | Описание |
|---------|----------------|----------|
| `id` | `SERIAL PK` | |
| `brand` | `VARCHAR(100) NOT NULL` | Производитель: HP, Canon, Brother… |
| `model` | `VARCHAR(150) NOT NULL` | Модель: LaserJet Pro M404dn |
| `name` | `VARCHAR(255)` | Полное отображаемое имя (можно собирать из brand+model, но удобно хранить готовое) |
| `device_type` | `VARCHAR(20) NOT NULL` | `printer` \| `mfp` (позже `scanner`) |
| `release_year` | `SMALLINT` | Год выпуска / выхода модели |
| `print_technology` | `VARCHAR(20) NOT NULL` | `laser` \| `inkjet` (позже `led` и т.п.) |
| `color_mode` | `VARCHAR(20) NOT NULL` | `mono` \| `color` |
| `resolution_dpi` | `VARCHAR(50)` | Напр. `1200x1200` — строка проще, чем два числа на старте |
| `print_speed_ppm` | `NUMERIC(5,1)` | Скорость печати, стр/мин (ч/б; для цветных можно позже разделить) |
| `is_ethernet` | `BOOLEAN NOT NULL DEFAULT false` | Сеть по Ethernet |
| `default_cartridge_id` | `INT NULL FK → cartridges(id)` | Картридж «по умолчанию» / основной |

### Дополнительные поля, которые стоит заложить

| Колонка | Тип | Зачем |
|---------|-----|-------|
| `paper_format` | `VARCHAR(20)` | `A4`, `A3` — частый фильтр |
| `is_duplex` | `BOOLEAN` | Двусторонняя печать |
| `is_wifi` | `BOOLEAN` | Wi‑Fi |
| `is_usb` | `BOOLEAN DEFAULT true` | USB |
| `scan_resolution_dpi` | `VARCHAR(50) NULL` | Для МФУ; для обычного принтера `NULL` |
| `has_adf` | `BOOLEAN` | Автоподатчик (важно для МФУ) |
| `status` | `VARCHAR(20) DEFAULT 'active'` | `active` / `discontinued` — снята с производства |
| `notes` | `TEXT` | Произвольные заметки мастера |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Аудит |

### Индексы и ограничения (набросок)

- `UNIQUE (brand, model)` — уникальность модели в справочнике.
- Индекс по `brand`, `device_type`, `print_technology`, `color_mode` — для фильтров на сайте.

### Открытые вопросы по принтерам

1. **Скорость печати**: одно поле `print_speed_ppm` или пара `print_speed_mono_ppm` / `print_speed_color_ppm`?
2. **Разрешение**: одна строка или `resolution_x` / `resolution_y`?
3. Нужен ли **фото/изображение** модели (`image_path`), как у hero на главной?

---

## 5. Таблица `cartridges`

Справочник уникальных картриджей (оригинальные артикулы и/или общепринятые обозначения).

| Колонка | Тип (черновик) | Описание |
|---------|----------------|----------|
| `id` | `SERIAL PK` | |
| `brand` | `VARCHAR(100) NOT NULL` | Бренд картриджа / линейки (часто совпадает с брендом принтера) |
| `model` | `VARCHAR(100) NOT NULL` | Артикул/модель: `CE285A`, `725`, `TN-2375` |
| `name` | `VARCHAR(255)` | Отображаемое имя |
| `color` | `VARCHAR(20) NOT NULL` | `black` \| `cyan` \| `magenta` \| `yellow` \| `tri-color` … |
| `cartridge_type` | `VARCHAR(20) NOT NULL` | `toner` \| `ink` \| `drum` \| `waste` (бункер/отход — если понадобится) |
| `page_yield` | `INT NULL` | Ресурс, стр. (ISO) — критично для заправки/продажи |
| `is_high_yield` | `BOOLEAN DEFAULT false` | XL / увеличенный ресурс |
| `has_chip` | `BOOLEAN` | Есть ли чип (важно для прошивки/заправки) |
| `notes` | `TEXT` | |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | |

### Индексы

- `UNIQUE (brand, model)` — один артикул один раз.
- Индекс по `color`, `cartridge_type`.

### Открытые вопросы по картриджам

1. Нужно ли поле **«оригинал / совместимый»**? Обычно в справочнике хранят **оригинальный артикул**, а «совместимый аналог» — это уже товар в прайсе (`services` или будущая таблица товаров). Рекомендация: в справочнике — каноническая модель; совместимость с принтером не зависит от «оригинал vs аналог».
2. **Фотокартридж / барабан** как отдельный `cartridge_type` — да, лучше сразу заложить enum-значениями, даже если сначала заполним только тонер/чернила.
3. Связь с ценой заправки — **не в этой таблице** на первом этапе (остаётся в `services` или появится позже).

---

## 6. Таблица совместимости `printer_cartridges`

Факт «картридж X подходит к принтеру Y».

| Колонка | Тип | Описание |
|---------|-----|----------|
| `id` | `SERIAL PK` | |
| `printer_id` | `INT NOT NULL FK → printers(id) ON DELETE CASCADE` | |
| `cartridge_id` | `INT NOT NULL FK → cartridges(id) ON DELETE RESTRICT` | |
| `is_default` | `BOOLEAN NOT NULL DEFAULT false` | Альтернатива/дополнение к `printers.default_cartridge_id` |
| `notes` | `TEXT` | Напр. «только с прошивкой чипа» |
| `created_at` | `TIMESTAMPTZ` | |

### Ограничения

- `UNIQUE (printer_id, cartridge_id)` — одна пара один раз.
- Опционально: частичный уникальный индекс «не больше одного default на принтер»:
  ```sql
  CREATE UNIQUE INDEX printer_cartridges_one_default
    ON printer_cartridges (printer_id)
    WHERE is_default = true;
  ```

### Зачем отдельная таблица, а не массив в JSON

- Нормальный поиск в обе стороны: «что подходит к принтеру» и «на какие принтеры встаёт картридж».
- Целостность через FK.
- Простые отчёты и админка.

---

## 7. Где хранить «картридж по умолчанию»?

Два рабочих варианта — выбрать один.

| Вариант | Как | Плюсы | Минусы |
|---------|-----|-------|--------|
| **1. FK на `printers`** | `printers.default_cartridge_id` | Просто читать карточку принтера | Нужно следить, что этот картридж **есть** в `printer_cartridges` (иначе рассинхрон) |
| **2. Флаг в связи** | `printer_cartridges.is_default` | Default всегда из списка совместимых; один источник правды | Чуть сложнее запрос «принтер + default» |

### Рекомендация

Предпочтительно **вариант 2** (`is_default` в таблице совместимости) + при желании денормализованный FK на `printers` позже.

Если хочется именно как в исходной формулировке («ссылка в таблице принтеров») — берём **вариант 1**, но при сохранении админки проверяем наличие строки в `printer_cartridges`.

В черновике DDL ниже заложены **оба** поля для обсуждения; перед реализацией оставим один.

---

## 8. Черновик DDL (не выполнять, пока не согласуем)

```sql
-- Справочник картриджей (сначала он, если FK default смотрит сюда)
CREATE TABLE cartridges (
  id              SERIAL PRIMARY KEY,
  brand           VARCHAR(100)  NOT NULL,
  model           VARCHAR(100)  NOT NULL,
  name            VARCHAR(255),
  color           VARCHAR(20)   NOT NULL,
  cartridge_type  VARCHAR(20)   NOT NULL,
  page_yield      INT,
  is_high_yield   BOOLEAN       NOT NULL DEFAULT false,
  has_chip        BOOLEAN,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (brand, model)
);

CREATE TABLE printers (
  id                   SERIAL PRIMARY KEY,
  brand                VARCHAR(100)  NOT NULL,
  model                VARCHAR(150)  NOT NULL,
  name                 VARCHAR(255),
  device_type          VARCHAR(20)   NOT NULL,  -- printer | mfp
  release_year         SMALLINT,
  print_technology     VARCHAR(20)   NOT NULL,  -- laser | inkjet
  color_mode           VARCHAR(20)   NOT NULL,  -- mono | color
  resolution_dpi       VARCHAR(50),
  print_speed_ppm      NUMERIC(5,1),
  is_ethernet          BOOLEAN       NOT NULL DEFAULT false,
  paper_format         VARCHAR(20),
  is_duplex            BOOLEAN       NOT NULL DEFAULT false,
  is_wifi              BOOLEAN       NOT NULL DEFAULT false,
  is_usb               BOOLEAN       NOT NULL DEFAULT true,
  scan_resolution_dpi  VARCHAR(50),
  has_adf              BOOLEAN       NOT NULL DEFAULT false,
  default_cartridge_id INT REFERENCES cartridges(id) ON DELETE SET NULL,
  status               VARCHAR(20)   NOT NULL DEFAULT 'active',
  notes                TEXT,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (brand, model)
);

CREATE TABLE printer_cartridges (
  id            SERIAL PRIMARY KEY,
  printer_id    INT NOT NULL REFERENCES printers(id)   ON DELETE CASCADE,
  cartridge_id  INT NOT NULL REFERENCES cartridges(id) ON DELETE RESTRICT,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (printer_id, cartridge_id)
);

CREATE UNIQUE INDEX printer_cartridges_one_default
  ON printer_cartridges (printer_id)
  WHERE is_default = true;
```

Порядок создания при реализации: `cartridges` → `printers` → `printer_cartridges`.

---

## 9. Что сознательно не делаем сейчас

- Отдельные таблицы для МФУ и сканеров.
- Таблица брендов (`brands`) — пока строки `VARCHAR`; вынести в справочник можно позже, если брендов станет много и понадобится единообразие.
- Связь с `services` (цена заправки конкретной модели).
- Полнотекстовый поиск / синонимы моделей («HP 85A» = «CE285A»).
- Миграционный фреймворк — решить отдельно (сырой SQL в `initDB` vs файлы миграций).

---

## 10. Решения, которые нужно утвердить

- [ ] Одна таблица устройств с `device_type` (рекомендация) vs отдельные таблицы МФУ/сканеров.
- [ ] Сканеры: пропускаем v1 или сразу закладываем тип.
- [ ] Default-картридж: только FK на `printers` / только `is_default` / оба.
- [ ] Список доп. полей принтера: что обязательное в v1, что отложить (`is_wifi`, `has_adf`, `status`…).
- [ ] Enum-значения: фиксируем набор строк (`laser`/`inkjet`) или PostgreSQL `ENUM` / `CHECK`.
- [ ] Нужны ли `created_at`/`updated_at` сразу.

---

## 11. Следующий шаг после согласования

1. Зафиксировать финальные колонки (убрать спорное).
2. Добавить создание таблиц в `initDB()` (или отдельный SQL-файл миграции).
3. Продумать экраны админки: CRUD принтеров, картриджей, матрица совместимости.
4. (Опционально) публичная страница/поиск «подберите картридж по модели».

---

*Черновик для обсуждения. Правки вносим в этот файл, пока не перейдём к созданию таблиц в БД.*
