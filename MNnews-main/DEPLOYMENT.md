# Инструкция по развертыванию MNnews на Ubuntu Server

## Проблема
Регистрация и принятие заявок не работают на сервере. Это связано с:
1. Неправильными правами доступа к файлам данных
2. Отсутствием директории `data/` или файлов в ней
3. Проблемами с путями при переносе с Windows на Linux

## Решение

### Шаг 1: Подготовка сервера

Подключитесь к вашему Ubuntu серверу:
```bash
ssh ivan@192.168.1.55
```

### Шаг 2: Установка Node.js (если еще не установлен)

```bash
# Обновление пакетов
sudo apt update
sudo apt upgrade -y

# Установка Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка установки
node --version
npm --version
```

### Шаг 3: Копирование файлов на сервер

Если вы еще не скопировали файлы проекта:

```bash
# На локальной машине (Windows)
# Используйте scp или WinSCP для копирования
scp -r "C:\Users\PC\Documents\MNnews-main (2)\MNnews-main" ivan@192.168.1.55:~/mnnews/
```

Или через git:
```bash
# На сервере
cd ~
git clone <your-repo-url> mnnews
cd mnnews/MNnews-main
```

### Шаг 4: Настройка прав доступа

```bash
# Переход в директорию проекта
cd ~/mnnews/MNnews-main/server

# Делаем скрипт настройки исполняемым
chmod +x setup_permissions.sh

# Запускаем скрипт настройки
bash setup_permissions.sh
```

Скрипт автоматически:
- Создаст директорию `data/` если её нет
- Создаст файлы `news.json` и `users.json` если их нет
- Установит правильные права доступа (755 для директорий, 644 для файлов)
- Установит зависимости npm
- Проверит доступность порта 3000

### Шаг 5: Ручная настройка (альтернатива скрипту)

Если скрипт не работает, выполните команды вручную:

```bash
# Переход в директорию проекта
cd ~/mnnews/MNnews-main

# Создание директории data
mkdir -p data

# Создание файлов данных с правильным содержимым
echo '[]' > data/news.json
echo '[]' > data/users.json

# Установка прав доступа
chmod 755 data
chmod 644 data/news.json
chmod 644 data/users.json

# Установка владельца
chown -R ivan:ivan data

# Переход в директорию сервера
cd server

# Установка зависимостей
npm install
```

### Шаг 6: Замена файла сервера на исправленный

```bash
# Переход в директорию сервера
cd ~/mnnews/MNnews-main/server

# Создаем резервную копию старого файла
cp index.js index.js.backup

# Копируем исправленный файл
cp index_fixed.js index.js

# Или переименовываем
mv index_fixed.js index_new.js
# Затем отредактируйте package.json чтобы использовать новый файл
```

Или просто замените содержимое `index.js` на содержимое `index_fixed.js`.

### Шаг 7: Тестовый запуск

```bash
# В директории server
cd ~/mnnews/MNnews-main/server

# Запуск сервера
npm start
```

Вы должны увидеть:
```
================================================================================
Starting MNnews server...
================================================================================
✓ Data directory exists: /home/ivan/mnnews/MNnews-main/data
✓ File exists: news.json
✓ File exists: users.json

Checking file permissions...
✓ Data directory is readable and writable

Server configuration:
  Platform: linux
  Node version: v18.x.x
  Port: 3000
  Root directory: /home/ivan/mnnews/MNnews-main
  Data directory: /home/ivan/mnnews/MNnews-main/data
================================================================================

✓ Server is running on http://localhost:3000
✓ Press Ctrl+C to stop the server
```

### Шаг 8: Проверка работы API

Откройте другой терминал и проверьте:

```bash
# Проверка health endpoint
curl http://localhost:3000/api/health

# Должны получить ответ:
# {"ok":true,"date":"...","platform":"linux",...}
```

Проверка регистрации:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123"}'
```

### Шаг 9: Настройка автоматического запуска (PM2)

Для production использования рекомендуется PM2:

```bash
# Установка PM2 глобально
sudo npm install -g pm2

# Переход в директорию сервера
cd ~/mnnews/MNnews-main/server

# Запуск приложения через PM2
pm2 start index.js --name mnnews

# Сохранение конфигурации
pm2 save

# Настройка автозапуска при перезагрузке
pm2 startup systemd

# Выполните команду, которую покажет PM2 (от root)
# Например:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ivan --hp /home/ivan
```

Полезные команды PM2:
```bash
pm2 status          # Статус приложений
pm2 logs mnnews     # Логи приложения
pm2 restart mnnews  # Перезапуск
pm2 stop mnnews     # Остановка
pm2 delete mnnews   # Удаление из списка
```

### Шаг 10: Настройка systemd (альтернатива PM2)

Если предпочитаете systemd:

```bash
# Копирование service файла
sudo cp ~/mnnews/MNnews-main/server/mnnews.service /etc/systemd/system/

# Редактирование файла под ваши пути (если нужно)
sudo nano /etc/systemd/system/mnnews.service

# Перезагрузка systemd
sudo systemctl daemon-reload

# Включение сервиса
sudo systemctl enable mnnews

# Запуск сервиса
sudo systemctl start mnnews

# Проверка статуса
sudo systemctl status mnnews

# Просмотр логов
sudo journalctl -u mnnews -f
```

### Шаг 11: Настройка брандмауэра

```bash
# Разрешение порта 3000
sudo ufw allow 3000/tcp

# Или если используете nginx как reverse proxy, разрешите 80/443
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Перезагрузка брандмауэра
sudo ufw reload
```

### Шаг 12: Настройка Nginx (опционально, для production)

```bash
# Установка nginx
sudo apt install nginx -y

# Создание конфигурации
sudo nano /etc/nginx/sites-available/mnnews
```

Содержимое конфигурации:
```nginx
server {
    listen 80;
    server_name your-domain.com;  # Или IP адрес

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активация конфигурации:
```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/mnnews /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации (опционально)
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезагрузка nginx
sudo systemctl restart nginx
```

## Диагностика проблем

### Проблема: Регистрация не работает

Проверьте логи сервера:
```bash
# Если используете PM2
pm2 logs mnnews

# Если используете systemd
sudo journalctl -u mnnews -f

# Если запустили вручную
# Смотрите вывод в терминале
```

Проверьте права доступа:
```bash
ls -la ~/mnnews/MNnews-main/data/
```

Должно быть примерно так:
```
drwxr-xr-x 2 ivan ivan 4096 Apr 15 12:00 .
drwxr-xr-x 8 ivan ivan 4096 Apr 15 12:00 ..
-rw-r--r-- 1 ivan ivan  123 Apr 15 12:00 news.json
-rw-r--r-- 1 ivan ivan  456 Apr 15 12:00 users.json
```

### Проблема: Ошибка "EACCES: permission denied"

```bash
# Исправление прав
cd ~/mnnews/MNnews-main
chmod -R 755 data
chown -R ivan:ivan data
```

### Проблема: Файлы данных не создаются

```bash
# Проверка существования директории
ls -la ~/mnnews/MNnews-main/

# Создание вручную
mkdir -p ~/mnnews/MNnews-main/data
echo '[]' > ~/mnnews/MNnews-main/data/news.json
echo '[]' > ~/mnnews/MNnews-main/data/users.json
chmod 644 ~/mnnews/MNnews-main/data/*.json
```

### Проблема: Порт 3000 уже занят

```bash
# Проверка кто использует порт
sudo lsof -i :3000

# Или
sudo netstat -tuln | grep 3000

# Остановка процесса
sudo kill -9 <PID>

# Или измените порт в index.js
# const PORT = process.env.PORT || 3001;
```

## Проверка работоспособности

### 1. Проверка регистрации

Откройте браузер и перейдите на:
```
http://192.168.1.55:3000
```

Попробуйте зарегистрировать нового пользователя.

### 2. Проверка входа администратора

Используйте учетные данные из `data/users.json`:
- Username: `admin`
- Password: (проверьте в файле users.json или установите новый пароль)

### 3. Проверка просмотра заявок

После входа как администратор:
1. Перейдите в админ-панель
2. Нажмите "Заявки на регистрацию"
3. Должны отобразиться все ожидающие заявки

### 4. Проверка одобрения заявки

1. Выберите заявку
2. Нажмите "Принять"
3. Пользователь должен получить статус "approved"

## Важные замечания

1. **Безопасность**: Измените пароль администратора по умолчанию!
2. **Бэкапы**: Регулярно делайте резервные копии `data/users.json` и `data/news.json`
3. **Логи**: Следите за логами сервера для выявления проблем
4. **Обновления**: При обновлении кода не забывайте перезапускать сервер

## Бэкап данных

```bash
# Создание бэкапа
cd ~/mnnews/MNnews-main
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/

# Копирование на локальную машину
scp ivan@192.168.1.55:~/mnnews/MNnews-main/backup-*.tar.gz ./
```

## Восстановление из бэкапа

```bash
# Распаковка бэкапа
cd ~/mnnews/MNnews-main
tar -xzf backup-20260415-120000.tar.gz

# Перезапуск сервера
pm2 restart mnnews
# или
sudo systemctl restart mnnews
```

## Контакты и поддержка

Если возникли проблемы:
1. Проверьте логи: `pm2 logs mnnews` или `sudo journalctl -u mnnews -f`
2. Проверьте права доступа к файлам
3. Убедитесь что Node.js установлен корректно
4. Проверьте что порт 3000 доступен

---

**Дата создания инструкции**: 15 апреля 2026
**Версия**: 1.0
