# MNnews

Статический фронтенд + backend API на Express для новостей Minecraft-сервера MineNilla.

## Что добавлено
- `server/` - backend сервер (`Express`)
- `data/news.json` - данные новостей
- `data/users.json` - локальные пользователи и статусы заявок (`pending/approved/rejected`)
- `js/news-list.js` - загрузка и рендер списка новостей
- `js/news-detail.js` - загрузка и рендер подробной страницы новости
- `pages/News/detail.html?id=<id>` - универсальная detail-страница
- `pages/menu_pages/registration_requests.html` - админ-страница заявок на регистрацию

## Установка и запуск
1. Перейдите в папку сервера:
   `cd "server"`
2. Установите зависимости:
   `npm install`
3. Запустите сервер:
   `npm start`
4. Откройте в браузере:
   `http://localhost:3000`

## Тестовые аккаунты
- Администратор: `admin` / `admin123`
- Игрок: `player1` / `player123`

## Логика регистрации
- Пользователь регистрируется с `username + password + email`
- Аккаунт создаётся со статусом `pending`
- Пока заявка не одобрена, пользователь может войти в аккаунт, но профиль недоступен
- Администратор рассматривает заявки на странице `registration_requests.html`
- Повторные заявки блокируются по `username` и по `email`
- Пароли не хранятся в открытом виде: сервер использует `passwordHash` (`scrypt`)

## API новостей
- `GET /api/health` - проверка сервера
- `GET /api/news` - все новости
- `GET /api/news?category=current|archive1|archive2` - новости по категории
- `GET /api/news/:id` - одна новость по ID

## API авторизации и заявок
- `POST /api/auth/login` - вход
- `POST /api/auth/register` - регистрация (создает `pending` заявку)
- `GET /api/auth/profile/:username` - профиль пользователя
- `GET /api/auth/registration-requests?actor=<admin>` - список pending-заявок
- `POST /api/auth/registration-requests/:username/approve` - одобрить заявку
- `POST /api/auth/registration-requests/:username/reject` - отклонить заявку
- `POST /api/auth/users` - создать пользователя админом (сразу approved)
- `PATCH /api/auth/profile/:username` - редактирование профиля approved-пользователя
