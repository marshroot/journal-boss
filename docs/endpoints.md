# Все эндпоинты journal.top-academy.ru

**Base URL:** `https://msapi.top-academy.ru/api/v2`  
**File Storage:** `https://fs.top-academy.ru/api/v1/files`

**Обязательные заголовки:**
```
Accept: application/json, text/plain, */*
Referer: https://journal.top-academy.ru/
Origin: https://journal.top-academy.ru
Authorization: Bearer <access_token>   (после авторизации)
```

> Источник: `app_bundle.js` — оригинальный бандл веб-приложения journal.top-academy.ru  
> Найдено: **155 эндпоинтов**

---

## 1. АВТОРИЗАЦИЯ (`/auth`) — 9 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 1 | POST | `/auth/login` | Авторизация студента |
| 2 | POST | `/auth/login-admin` | Авторизация администратора |
| 3 | POST | `/auth/login-as-child` | Авторизация как ребёнок (для родителей) |
| 4 | POST | `/auth/login-as-student` | Авторизация от имени студента |
| 5 | POST | `/auth/login-market-admin` | Авторизация администратора маркета |
| 6 | POST | `/auth/logout-as-student` | Выход из режима «от имени студента» |
| 7 | POST | `/auth/refresh` | Обновление access_token |
| 8 | POST | `/auth/reset-password` | Сброс пароля |
| 9 | POST | `/auth/file-token` | Получение токена для загрузки файлов |

---

## 2. НАСТРОЙКИ / ПРОФИЛЬ (`/settings`, `/profile`) — 14 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 10 | GET | `/settings/user-info` | Полная информация о пользователе |
| 11 | GET | `/settings/group-specs` | Список предметов группы |
| 12 | GET | `/settings/history-specs` | История предметов |
| 13 | GET | `/settings/public-forms` | Публичные формы обучения |
| 14 | GET | `/settings/public-specs` | Публичные специальности |
| 15 | GET | `/settings/admin-groups` | Группы (для администратора) |
| 16 | GET | `/settings/admin-group-students` | Студенты группы (для администратора) |
| 17 | POST | `/settings/change-current-group` | Сменить текущую группу |
| 18 | GET | `/profile/operations/settings` | Настройки профиля |
| 19 | POST | `/profile/operations/change-password` | Смена пароля |
| 20 | POST | `/profile/operations/change-personal-data` | Изменение персональных данных |
| 21 | GET | `/profile/statistic/student-achievements` | Достижения студента |
| 22 | GET | `/public/cities` | Список городов |
| 23 | GET | `/public/languages` | Список языков |

---

## 3. DASHBOARD — ГЛАВНАЯ (`/dashboard`) — 10 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 24 | GET | `/dashboard/progress/activity` | Лента активности |
| 25 | GET | `/dashboard/progress/attendance-statistic` | Статистика посещаемости |
| 26 | GET | `/dashboard/progress/academic-performance` | Академическая успеваемость |
| 27 | GET | `/dashboard/progress/leader-group` | Лидеры группы |
| 28 | GET | `/dashboard/progress/leader-group-points` | Лидеры группы (по очкам) |
| 29 | GET | `/dashboard/progress/leader-stream` | Лидеры потока |
| 30 | GET | `/dashboard/progress/leader-stream-points` | Лидеры потока (по очкам) |
| 31 | GET | `/dashboard/chart/progress` | Графики прогресса |
| 32 | GET | `/dashboard/chart/attendance` | Графики посещаемости |
| 33 | GET | `/dashboard/chart/average-progress` | График среднего прогресса |

---

## 4. РАСПИСАНИЕ (`/schedule`) — 4 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 34 | GET | `/schedule/operations/get-by-date` | Расписание на дату |
| 35 | GET | `/schedule/operations/get-month` | Расписание на месяц |
| 36 | GET | `/schedule/operations/get-by-date-range` | Расписание за период |
| 37 | GET | `/schedule/operations/month-events` | События за месяц |

---

## 5. ОЦЕНКИ / ПРОГРЕСС (`/progress`) — 5 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 38 | GET | `/progress/operations/student-visits` | Посещения и оценки |
| 39 | GET | `/progress/operations/student-exams` | Результаты экзаменов |
| 40 | POST | `/progress/operations/student-exams-file` | Файл экзаменов |
| 41 | GET | `/progress/operations/plan-url` | URL учебного плана |
| 42 | GET | `/progress/operations/school-quarterly-grades` | Четвертные оценки (школа) |

---

## 6. ДОМАШНИЕ ЗАДАНИЯ (`/homework`) — 8 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 43 | GET | `/homework/operations/list` | Список домашних заданий |
| 44 | POST | `/homework/operations/create` | Создание/отправка домашнего задания |
| 45 | POST | `/homework/operations/delete` | Удаление домашнего задания |
| 46 | POST | `/homework/operations/has-material` | Проверка наличия материала |
| 47 | GET | `/homework/evaluation/operations/get` | Получить оценку домашнего задания |
| 48 | GET | `/homework/evaluation/operations/get-tags` | Теги оценки домашнего задания |
| 49 | POST | `/homework/evaluation/operations/save` | Сохранить оценку домашнего задания |
| 50 | GET | `/homework/settings/group-history` | История домашних заданий группы |

### Параметры эндпоинта `/homework/operations/list`:

* **`status`** (Фильтр по статусу задания):
  * `0` — **Просрочено** (дедлайн истек, работа не сдана или требует доработки)
  * `1` — **Проверено** (работа оценена преподавателем)
  * `2` — **На проверке** (работа сдана студентом, ожидает оценки)
  * `3` — **Текущие** (активные задания, у которых не истек дедлайн)
  * `4` — **Все** (запрос всех заданий)
  * `5` — **Удалено преподавателем** (задания, которые были скрыты/архивированы преподавателем)

* **`type`** (Тип задания):
  * `0` — **Домашняя работа** (отображается в виджете домашней работы на главной MyStat)
  * `1` — **Лабораторная работа** (отображается на отдельной вкладке лабораторных в журнале MyStat)

---

### Детали эндпоинта `/homework/operations/create` (сдача ДЗ):

Отправка ответа на домашнее задание происходит строго в формате **`multipart/form-data`** (запросы в формате JSON возвращают ошибку или не сохраняют поля).

* **Метод:** `POST`
* **Заголовки:**
  * `Authorization: Bearer <access_token>`
  * `Content-Type: multipart/form-data`
* **Поля формы (`form-data`):**
  * **`id`** (string/number, обязательно): ID домашнего задания (не сдачи, а самого задания).
  * **`file`** (file, обязательно): Поле файла. При отправке *только текста* без файла передается пустое файловое поле: `filename=""`, `Content-Type: application/octet-stream` с нулевым размером.
  * **`answerText`** (string, обязательно для текстового ответа): Текст ответа студента на задание. Содержимое этого поля сохраняется в журнале в `stud_answer`.
  * **`spentTimeHour`** (string, необязательно): Часы, потраченные на выполнение (например, `"00"`, `"01"`).
  * **`spentTimeMin`** (string/number, необязательно): Минуты, потраченные на выполнение (например, `"00"`, `30`).
  * **`filename`** (string, необязательно): Токен загруженного на файловый сервер файла.
  * **`answer`** (string, необязательно): Токен загруженного на файловый сервер файла (обычно дублирует `filename`).
  * **`file_path`** (string, необязательно): Токен или путь к файлу.

* **Пример успешного ответа (JSON, HTTP 201 Created):**
  ```json
  {
    "id": 43371,
    "filename": null,
    "file_path": null,
    "stud_answer": "Текст ответа на задание",
    "auto_mark": false
  }
  ```
  *(Здесь `id` в ответе — это `homework_stud_id`, ID созданной записи сдачи ДЗ. Он используется для удаления сданной работы).*

---

### Детали эндпоинта `/homework/operations/delete` (удаление сданного ДЗ):

Удаление отправленного ответа студента (сдачи домашней работы).

* **Метод:** `POST`
* **Заголовки:**
  * `Authorization: Bearer <access_token>`
  * `Content-Type: application/json`
* **Тело запроса (JSON):**
  * **`id`** (number, обязательно): ID записи сдачи задания (это `id` из ответа метода `create` или из поля `id` в списке заданий, а не ID самого домашнего задания!).
* **Пример тела запроса:**
  ```json
  {
    "id": 43371
  }
  ```
* **Ответ:** `HTTP 204 No Content` при успешном удалении.

---

### Загрузка файлов на файловое хранилище (MyStat Storage):

Для сдачи домашнего задания с файлом необходимо сначала загрузить файл на отдельный сервер хранения.

1. **Получить токен загрузки:**
   * **Метод / URL:** `POST /auth/file-token`
   * **Тело запроса:** `json={}`
   * **Ответ:**
     ```json
     {
       "token": "JWT_TOKEN_FOR_FILE_STORAGE",
       "dir": {
         "homeworkDirId": {
           "src": "homework/subfolder/..."
         }
       }
     }
     ```
2. **Загрузить файл на файловый сервер:**
   * **Метод / URL:** `POST https://fs.top-academy.ru/api/v1/files`
   * **Заголовки:** `Authorization: Bearer JWT_TOKEN_FOR_FILE_STORAGE`
   * **Формат:** `multipart/form-data`
   * **Поля формы:**
     * `files`: Выбираемый файл (имя файла, байты, Content-Type).
     * `directory`: Значение из ответа первого шага (`dir.homeworkDirId.src`).
   * **Ответ:**
     ```json
     [
       {
         "token": "fs_file_token_here",
         "name": "filename.zip",
         "size": 12345
       }
     ]
     ```
3. **Отправить домашнее задание:**
   * Отправить POST-запрос на `/homework/operations/create` (как описано выше), указав в полях `filename` и `answer` полученный `"fs_file_token_here"`.

---

## 7. СЧЁТЧИКИ (`/count`) — 4 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 51 | GET | `/count/page-counters` | Общие счётчики страниц |
| 52 | GET | `/count/homework` | Счётчики домашних заданий |
| 53 | GET | `/count/library` | Счётчики библиотеки |
| 54 | POST | `/count/set-view-materials` | Пометить материалы просмотренными |

---

## 8. НОВОСТИ (`/news`) — 4 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 55 | GET | `/news/operations/latest-news` | Последние новости |
| 56 | GET | `/news/operations/detail-news` | Детали новости |
| 57 | GET | `/news/operations/count-unread` | Количество непрочитанных новостей |
| 58 | POST | `/news/operations/set-view` | Пометить новость прочитанной |

---

## 9. БИБЛИОТЕКА / КВИЗЫ (`/library`) — 10 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 59 | GET | `/library/operations/list` | Список материалов (с параметрами) |
| 60 | GET | `/library/operations/list-all` | Все материалы |
| 61 | POST | `/library/operations/check-url` | Проверка URL материала |
| 62 | POST | `/library/operations/set-use-material` | Отметить использование материала |
| 63 | GET | `/library/operations/quizzes-academic-debt` | Академическая задолженность по квизам |
| 64 | POST | `/library/quiz/run` | Запуск квиза |
| 65 | POST | `/library/quiz/finish` | Завершение квиза |
| 66 | GET | `/library/quiz/opened-interview` | Открытое интервью (квиз) |
| 67 | POST | `/library/quiz/delay-interview` | Отложить интервью |
| 68 | GET | `/library/quiz/get-time-between-retries` | Время между повторными попытками |

---

## 10. СИГНАЛЫ (`/signal`) — 12 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 69 | GET | `/signal/operations/signals-list` | Список сигналов |
| 70 | GET | `/signal/operations/signals-comments` | Комментарии к сигналу |
| 71 | GET | `/signal/operations/count-unread` | Количество непрочитанных сигналов |
| 72 | GET | `/signal/operations/problems-list` | Список проблем |
| 73 | GET | `/signal/operations/get-reference-data` | Справочные данные |
| 74 | GET | `/signal/operations/get-reference-status` | Справочные статусы |
| 75 | POST | `/signal/operations/create` | Создать сигнал |
| 76 | POST | `/signal/operations/update` | Обновить сигнал |
| 77 | POST | `/signal/operations/delete` | Удалить сигнал |
| 78 | POST | `/signal/operations/approve` | Подтвердить сигнал |
| 79 | POST | `/signal/operations/set-view` | Пометить сигнал просмотренным |
| 80 | POST | `/signal/operations/set-to-work` | Взять сигнал в работу |

---

## 11. ПОРТФОЛИО (`/portfolio`) — 6 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 81 | GET | `/portfolio/operations/list` | Список работ портфолио |
| 82 | POST | `/portfolio/operations/create` | Создать работу |
| 83 | POST | `/portfolio/operations/delete` | Удалить работу |
| 84 | GET | `/portfolio/operations/history` | История портфолио |
| 85 | GET | `/portfolio/operations/design-specs` | Специальности дизайна |
| 86 | GET | `/portfolio/operations/design-teachers` | Преподаватели дизайна |

---

## 12. ОПЛАТА (`/payment`) — 8 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 87 | GET | `/payment/operations/index` | Информация об оплате |
| 88 | GET | `/payment/operations/history` | История оплат |
| 89 | GET | `/payment/operations/schedule` | График оплат |
| 90 | GET | `/payment/operations/check-cancellation` | Проверка расторжения договора |
| 91 | GET | `/payment/operations/download-requisites` | Скачать реквизиты |
| 92 | POST | `/payment/operations/contract` | Договор |
| 93 | POST | `/payment/operations/link` | Ссылка на оплату |
| 94 | POST | `/payment/epay/link` | Ссылка на электронную оплату |

---

## 13. ВАКАНСИИ (`/vacancy`) — 4 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 95 | GET | `/vacancy/operations/available-vacancies` | Доступные вакансии |
| 96 | GET | `/vacancy/operations/settings` | Настройки вакансий |
| 97 | GET | `/vacancy/operations/count-unread` | Количество непрочитанных вакансий |
| 98 | POST | `/vacancy/operations/set-view` | Пометить вакансию просмотренной |

---

## 14. КОНТАКТЫ / РАССЫЛКИ / SMS (`/contacts`) — 11 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 99 | GET | `/contacts/operations/index` | Список контактов |
| 100 | POST | `/contacts/operations/send-ceo` | Отправить сообщение руководству |
| 101 | POST | `/contacts/operations/send-teach` | Отправить сообщение преподавателю |
| 102 | GET | `/contacts/mailing/emails-list` | Список email-рассылок |
| 103 | POST | `/contacts/mailing/send-confirmation` | Отправить подтверждение email |
| 104 | GET | `/contacts/mailing/check-confirmation` | Проверить подтверждение email |
| 105 | POST | `/contacts/mailing/confirm` | Подтвердить email |
| 106 | POST | `/contacts/mailing/delay-confirmation` | Отложить подтверждение |
| 107 | POST | `/contacts/mailing/unsubscribe` | Отписаться от рассылки |
| 108 | GET | `/contacts/mailing/check-unsubscription-key` | Проверить ключ отписки |
| 109 | POST | `/contacts/sms/send-code` | Отправить SMS-код |
| 110 | POST | `/contacts/sms/verified-phone` | Подтвердить телефон |

---

## 15. ОБРАТНАЯ СВЯЗЬ (`/feedback`) — 6 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 111 | GET | `/feedback/social-review/get-review-list` | Список отзывов |
| 112 | POST | `/feedback/social-review/screen-review` | Скрыть/показать отзыв |
| 113 | GET | `/feedback/students/evaluate-academy-day` | Оценка дня в академии |
| 114 | POST | `/feedback/students/comment-academy-day` | Комментарий к дню |
| 115 | POST | `/feedback/students/evaluate-lesson` | Оценить занятие |
| 116 | GET | `/feedback/students/evaluate-lesson-list` | Список занятий для оценки |

---

### Детали эндпоинта `/feedback/students/evaluate-lesson-list` (список занятий для оценки):

Возвращает список прошедших занятий, по которым студент может выставить оценку преподавателю.

* **Метод:** `GET`
* **Заголовки:**
  * `Authorization: Bearer <access_token>`
* **Пример ответа (JSON):**
  ```json
  [
    {
      "key": "1UpDkT2CxSv_V-6P",
      "date_visit": "2026-06-16",
      "fio_teach": "Тоницой Владислав Андреевич",
      "spec_name": "Поддержка и тестирование программных модулей",
      "teach_photo": null
    }
  ]
  ```
  *Пояснение полей:*
  * **`key`** (string): Уникальный ключ/токен занятия (используется для отправки оценки в эндпоинте `/evaluate-lesson`).
  * **`date_visit`** (string): Дата занятия в формате `YYYY-MM-DD`.
  * **`fio_teach`** (string): ФИО преподавателя.
  * **`spec_name`** (string): Название дисциплины/урока.
  * **`teach_photo`** (string | null): Уникальный ключ фотографии преподавателя (для скачивания с файлового сервера: `https://fs.top-academy.ru/api/v1/files/{teach_photo}/public`). Если фото нет, возвращается `null`.

---

### Детали эндпоинта `/feedback/students/evaluate-lesson` (оценить занятие):

Отправляет оценку студента за занятие.

* **Метод:** `POST`
* **Заголовки:**
  * `Authorization: Bearer <access_token>`
  * `Content-Type: application/json`
* **Тело запроса (JSON):**
  * **`key`** (string, обязательно): Уникальный ключ занятия из списка `/evaluate-lesson-list`.
  * **`rate`** или аналогичные поля оценки (например, `comment` для отзыва).

---

## 16. РЕФЕРАЛЬНАЯ ПРОГРАММА (`/referral`) — 4 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 117 | GET | `/referral/operations/list` | Список рефералов |
| 118 | POST | `/referral/operations/create` | Создать реферал |
| 119 | GET | `/referral/operations/check-new-reward` | Проверить новую награду |
| 120 | POST | `/referral/operations/read-new-reward` | Прочитать новую награду |

---

## 17. МАРКЕТ — ПОКУПАТЕЛЬ (`/market/customer`) — 5 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 121 | GET | `/market/customer/product/list` | Список товаров |
| 122 | POST | `/market/customer/product/restore-cart-products-list` | Восстановить товары корзины |
| 123 | POST | `/market/customer/order/create` | Создать заказ |
| 124 | GET | `/market/customer/order/list` | Список заказов |
| 125 | GET | `/market/customer/order/info` | Информация о заказе |

---

## 18. МАРКЕТ — АДМИНИСТРАТОР (`/market/admin`) — 14 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 126 | GET | `/market/admin/product/list` | Список товаров |
| 127 | GET | `/market/admin/product/info` | Информация о товаре |
| 128 | POST | `/market/admin/product/create` | Создать товар |
| 129 | POST | `/market/admin/product/update` | Обновить товар |
| 130 | POST | `/market/admin/product/delete` | Удалить товар |
| 131 | POST | `/market/admin/product/delete-image` | Удалить изображение товара |
| 132 | GET | `/market/admin/order/list` | Список заказов |
| 133 | GET | `/market/admin/order/info` | Информация о заказе |
| 134 | POST | `/market/admin/order/set-status` | Изменить статус заказа |
| 135 | GET | `/market/admin/common/instruction-url` | URL инструкции |
| 136 | GET | `/market/admin/promo-settings/streams` | Потоки для промо |
| 137 | GET | `/market/admin/promo-settings/study-forms` | Формы обучения для промо |
| 138 | POST | `/market/admin/promo-settings/change-visibility-form` | Изменить видимость формы |
| 139 | POST | `/market/admin/promo-settings/change-visibility-stream` | Изменить видимость потока |

---

## 19. ДОКУМЕНТЫ (`/documents`) — 3 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 140 | POST | `/documents/save` | Сохранить документ |
| 141 | POST | `/documents/set-field-value` | Установить значение поля |
| 142 | POST | `/documents/delete-field-value` | Удалить значение поля |

---

## 20. ПИТАНИЕ (`/nutrition`) — 6 эндпоинтов

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 143 | GET | `/nutrition/parent/get-balance` | Баланс питания (родитель) |
| 144 | GET | `/nutrition/parent/get-list-transaction` | Список транзакций (родитель) |
| 145 | GET | `/nutrition/parent/get-order-menu` | Меню для заказа (родитель) |
| 146 | POST | `/nutrition/parent/order-food` | Заказать еду (родитель) |
| 147 | POST | `/nutrition/parent/cancellation-order` | Отменить заказ (родитель) |
| 148 | GET | `/nutrition/student/get-qr-code` | QR-код студента |

---

## 21. ИНДИВИДУАЛЬНОЕ ОБУЧЕНИЕ (`/individual`) — 3 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 149 | GET | `/individual/operations/get-list-voucher` | Список ваучеров |
| 150 | GET | `/individual/operations/info-payments` | Информация об оплатах |
| 151 | POST | `/individual/operations/create-order` | Создать заказ |

---

## 22. ОТЗЫВЫ (`/reviews`) — 2 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 152 | GET | `/reviews/index/list` | Список отзывов |
| 153 | GET | `/reviews/index/instruction` | Инструкция по отзывам |

---

## 23. ИСТОРИИ (`/story`) — 1 эндпоинт

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 154 | GET | `/story/operations/get-stories` | Получить истории |

---

## 24. МАТЕРИАЛЫ (`/material`) — 1 эндпоинт

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 155 | GET | `/material/operations/get-material` | Получить материал |

---

## 25. ПУБЛИЧНЫЕ ДАННЫЕ (`/public`) — 3 эндпоинта

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 156 | GET | `/public/cities` | Список городов |
| 157 | GET | `/public/tags` | Список тегов |
| 158 | GET | `/public/translations` | Переводы интерфейса |

---

## 26. ЭКЗАМЕНЫ (`/dashboard/info`) — 1 эндпоинт

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 159 | GET | `/dashboard/info/future-exams` | Будущие экзамены |

---

## 27. ФАЙЛОВОЕ ХРАНИЛИЩЕ (отдельный сервер)

| # | Метод | Endpoint | Описание |
|---|-------|----------|----------|
| 160 | POST | `https://fs.top-academy.ru/api/v1/files` | Загрузка файлов |

---

## Сводка по разделам

| Раздел | Кол-во | GET | POST |
|--------|--------|-----|------|
| Авторизация | 9 | 0 | 9 |
| Настройки / Профиль | 14 | 11 | 3 |
| Dashboard | 10 | 10 | 0 |
| Расписание | 4 | 4 | 0 |
| Оценки / Прогресс | 5 | 4 | 1 |
| Домашние задания | 8 | 4 | 4 |
| Счётчики | 4 | 3 | 1 |
| Новости | 4 | 3 | 1 |
| Библиотека / Квизы | 10 | 5 | 5 |
| Сигналы | 12 | 6 | 6 |
| Портфолио | 6 | 4 | 2 |
| Оплата | 8 | 5 | 3 |
| Вакансии | 4 | 3 | 1 |
| Контакты / SMS | 11 | 3 | 8 |
| Обратная связь | 6 | 3 | 3 |
| Реферальная программа | 4 | 2 | 2 |
| Маркет (покупатель) | 5 | 3 | 2 |
| Маркет (админ) | 14 | 6 | 8 |
| Документы | 3 | 0 | 3 |
| Питание | 6 | 4 | 2 |
| Индивидуальное обучение | 3 | 2 | 1 |
| Отзывы | 2 | 2 | 0 |
| Истории | 1 | 1 | 0 |
| Материалы | 1 | 1 | 0 |
| Публичные данные | 3 | 3 | 0 |
| Экзамены | 1 | 1 | 0 |
| Файловое хранилище | 1 | 0 | 1 |
| **ИТОГО** | **160** | **93** | **67** |
