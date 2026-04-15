# ============================================
# ИСПРАВЛЕНИЕ РЕГИСТРАЦИИ НА UBUNTU SERVER
# ============================================

## ЧТО БЫЛО ИСПРАВЛЕНО:
✅ Регистрация пользователей
✅ Просмотр заявок администратором  
✅ Принятие/отклонение заявок
✅ Автоматическое создание файлов данных
✅ Проверка прав доступа
✅ Подробное логирование

## ФАЙЛЫ ДЛЯ РАЗВЕРТЫВАНИЯ:

### Основные файлы проекта:
📁 MNnews-main/
├── 📄 README.md - основная документация
├── 📄 DEPLOYMENT.md - полное руководство по развертыванию
├── 📄 QUICK_FIX.md - быстрое исправление проблем
├── 📄 ИНСТРУКЦИЯ_ДЛЯ_СЕРВЕРА.txt - шпаргалка для сервера
├── 📄 REPORT_REGISTRATION_FIX.md - отчет об исправлениях
├── 📁 server/
│   ├── 📄 index_fixed.js - улучшенная версия сервера
│   ├── 📄 setup_permissions.sh - скрипт настройки прав
│   ├── 📄 test_api.sh - скрипт тестирования API
│   └── 📄 mnnews.service - файл для systemd
└── 📁 data/ (создается автоматически)
    ├── news.json
    └── users.json

# ============================================
# БЫСТРЫЙ СТАРТ (3 КОМАНДЫ)
# ============================================

# На Ubuntu сервере выполните:
cd ~/mnnews/MNnews-main/server
bash setup_permissions.sh
npm start

# Готово! Сервер запущен на порту 3000

# ============================================
# ПОЛНАЯ ИНСТРУКЦИЯ
# ============================================

## ШАГ 1: Копирование файлов на сервер

### Способ 1: Через SCP (из Windows)
```powershell
scp -r "C:\Users\PC\Documents\MNnews-main (2)\MNnews-main" ivan@192.168.1.55:~/mnnews/
```

### Способ 2: Через Git
```bash
# На сервере
git clone <ваш-repo-url> ~/mnnews
cd ~/mnnews/MNnews-main
```

### Способ 3: Через WinSCP/FileZilla
- Подключитесь к серверу
- Скопируйте папку MNnews-main в ~/mnnews/

## ШАГ 2: Настройка на сервере

```bash
# Подключение к серверу
ssh ivan@192.168.1.55

# Переход в директорию сервера
cd ~/mnnews/MNnews-main/server

# Запуск скрипта настройки
chmod +x setup_permissions.sh
bash setup_permissions.sh

# Скрипт автоматически:
# ✓ Создаст директорию data/
# ✓ Создаст файлы news.json и users.json
# ✓ Установит права доступа (755/644)
# ✓ Проверит Node.js и npm
# ✓ Установит зависимости npm
```

## ШАГ 3: Замена серверного файла (рекомендуется)

```bash
# В директории server/
cp index.js index.js.backup      # резервная копия
cp index_fixed.js index.js       # новый файл
```

Новый файл включает:
- Автоматическое создание файлов данных
- Проверку прав доступа
- Расширенное логирование
- Подробные сообщения об ошибках

## ШАГ 4: Запуск сервера

### Вариант A: Простой запуск (для тестирования)
```bash
npm start
```

### Вариант B: Через PM2 (для production)
```bash
# Установка PM2
sudo npm install -g pm2

# Запуск приложения
pm2 start index.js --name mnnews
pm2 save
pm2 startup systemd

# Полезные команды:
pm2 status           # статус
pm2 logs mnnews      # логи
pm2 restart mnnews   # перезапуск
pm2 stop mnnews      # остановка
```

### Вариант C: Через systemd
```bash
# Копирование service файла
sudo cp mnnews.service /etc/systemd/system/mnnews.service

# Активация
sudo systemctl daemon-reload
sudo systemctl enable mnnews
sudo systemctl start mnnews

# Проверка
sudo systemctl status mnnews
sudo journalctl -u mnnews -f
```

# ============================================
# ПРОВЕРКА РАБОТОСПОСОБНОСТИ
# ============================================

## Тест 1: Health Check
```bash
curl http://localhost:3000/api/health
```

Ожидаемый ответ:
```json
{
  "ok": true,
  "date": "2026-04-15T...",
  "platform": "linux",
  "nodeVersion": "v18.x.x",
  "dataDir": "/home/ivan/mnnews/MNnews-main/data"
}
```

## Тест 2: Регистрация пользователя
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123"}'
```

Ожидаемый ответ:
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "isAdmin": false,
  "status": "pending",
  "hasProfile": false,
  "profile": null
}
```

## Тест 3: Полный тест API
```bash
chmod +x test_api.sh
bash test_api.sh http://localhost:3000
```

# ============================================
# ПРОВЕРКА В БРАУЗЕРЕ
# ============================================

1. Откройте: http://192.168.1.55:3000
2. Зарегистрируйте нового пользователя
3. Войдите как администратор (admin/admin123)
4. Перейдите в "Заявки на регистрацию"
5. Одобрите заявку тестового пользователя

# ============================================
# ДИАГНОСТИКА ПРОБЛЕМ
# ============================================

## Проблема: Ошибка прав доступа

```bash
# Проверка прав
ls -la ~/mnnews/MNnews-main/data/

# Исправление
cd ~/mnnews/MNnews-main
chmod -R 755 data
chown -R ivan:ivan data
```

## Проблема: Порт 3000 занят

```bash
# Кто использует порт
sudo lsof -i :3000

# Остановка процесса
sudo kill -9 <PID>

# Или смените порт в index.js:
# const PORT = process.env.PORT || 3001;
```

## Проблема: Node.js не установлен

```bash
# Установка Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка
node --version
npm --version
```

## Проблема: Не видно логов

```bash
# Если используете PM2
pm2 logs mnnews --lines 100

# Если используете systemd
sudo journalctl -u mnnews -n 100 -f

# Если запустили вручную
# Смотрите вывод в терминале
```

# ============================================
# БЕЗОПАСНОСТЬ
# ============================================

## 1. Измените пароль администратора!

```bash
# Создайте нового админа через API
curl -X POST http://localhost:3000/api/auth/users \
  -H "Content-Type: application/json" \
  -d '{"actor":"admin","username":"newadmin","password":"новый_сложный_пароль"}'
```

## 2. Настройте брандмауэр

```bash
# Разрешить только необходимые порты
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (если есть nginx)
sudo ufw allow 443/tcp   # HTTPS (если есть nginx)
sudo ufw allow 3000/tcp  # Приложение (или уберите если есть nginx)

# Включение брандмауэра
sudo ufw enable
sudo ufw status
```

## 3. Настройте Nginx (опционально)

```bash
# Установка
sudo apt install nginx -y

# Конфигурация /etc/nginx/sites-available/mnnews
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Активация
sudo ln -s /etc/nginx/sites-available/mnnews /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

# ============================================
# БЕКАПЫ
# ============================================

## Создание бэкапа

```bash
# Архивация данных
cd ~/mnnews/MNnews-main
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/

# Копирование на локальную машину
scp ivan@192.168.1.55:~/mnnews/MNnews-main/backup-*.tar.gz ./
```

## Восстановление из бэкапа

```bash
# Распаковка
cd ~/mnnews/MNnews-main
tar -xzf backup-20260415-120000.tar.gz

# Перезапуск
pm2 restart mnnews
```

## Автоматический бэкап (cron)

```bash
# Редактирование crontab
crontab -e

# Добавление задачи (бэкап каждый день в 3:00)
0 3 * * * cd ~/mnnews/MNnews-main && tar -czf backup-$(date +\%Y\%m\%d).tar.gz data/
```

# ============================================
# ОБНОВЛЕНИЕ ПРИЛОЖЕНИЯ
# ============================================

```bash
# 1. Остановить сервис
pm2 stop mnnews

# 2. Скопировать новые файлы
scp -r "новые_файлы" ivan@192.168.1.55:~/mnnews/MNnews-main/

# 3. На сервере
cd ~/mnnews/MNnews-main/server
npm install  # если изменились зависимости

# 4. Запустить сервис
pm2 start mnnews

# 5. Проверить логи
pm2 logs mnnews
```

# ============================================
# ДОКУМЕНТАЦИЯ
# ============================================

Полные инструкции в файлах:

📖 DEPLOYMENT.md
   - Полное руководство по развертыванию
   - Настройка Nginx
   - Диагностика проблем
   - Бэкапы и восстановление

📖 QUICK_FIX.md
   - Быстрое исправление за 5 минут
   - Решение конкретных ошибок
   - Полезные команды

📖 REPORT_REGISTRATION_FIX.md
   - Отчет об исправлениях
   - Технические детали
   - Результаты тестирования

📖 README.md
   - Общая информация о проекте
   - API документация
   - Быстрый старт

# ============================================
# КОНТАКТЫ И ПОДДЕРЖКА
# ============================================

Если возникли проблемы:

1. Проверьте логи:
   pm2 logs mnnews
   # или
   sudo journalctl -u mnnews -f

2. Проверьте права доступа:
   ls -la ~/mnnews/MNnews-main/data/

3. Запустите тесты:
   bash test_api.sh http://localhost:3000

4. Обратитесь к документации:
   - QUICK_FIX.md - быстрые решения
   - DEPLOYMENT.md - полная инструкция

# ============================================
# СТАТУС: ✅ ГОТОВО К РАЗВЕРТЫВАНИЮ
# ============================================

Все проблемы исправлены. Проект готов к работе на Ubuntu Server.

Дата создания инструкции: 15 апреля 2026 г.
Версия: 2.1
