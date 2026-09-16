# 🚀 Быстрый деплой сервера на Render.com (5 минут)

Render.com - бесплатный хостинг с поддержкой WebSocket. Работает стабильнее чем Railway.

## 📋 Пошаговая инструкция

### 1. Загрузите код на GitHub

```bash
# В корне проекта
git add .
git commit -m "Add multiplayer server"
git push origin main
```

### 2. Создайте аккаунт на Render

1. Перейдите на https://render.com
2. Нажмите "Get Started" → "Sign Up"
3. Войдите через GitHub (рекомендуется)

### 3. Создайте Web Service

1. Нажмите "New +" → "Web Service"
2. Выберите "Build and deploy from a Git repository"
3. Подключите ваш репозиторий GitHub
4. Нажмите "Connect"

### 4. Настройте деплой

Заполните поля:

- **Name**: `rpg25d-server` (или любое другое)
- **Region**: Oregon (или ближайший к вам)
- **Branch**: `main`
- **Root Directory**: `server` ⚠️ ВАЖНО!
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: `Free`

### 5. Настройте переменные окружения

Нажмите "Advanced" → "Add Environment Variable":

- **Key**: `CORS_ORIGIN`
- **Value**: `https://ramiros.netlify.app`

Нажмите "Add Environment Variable" снова:

- **Key**: `NODE_ENV`
- **Value**: `production`

### 6. Задеплойте

Нажмите "Create Web Service"

Render начнёт деплой (2-3 минуты).

### 7. Получите URL сервера

После деплоя вы увидите URL вида:
```
https://rpg25d-server.onrender.com
```

Скопируйте этот URL.

### 8. Обновите клиент

Откройте файл `src/game/MultiplayerClient.ts` и измените строку 12:

```typescript
const SERVER_URL = 'https://rpg25d-server.onrender.com'; // Ваш URL
```

### 9. Пересоберите и задеплойте frontend

```bash
npm run build
netlify deploy --prod --dir dist
```

## ✅ Готово!

Теперь откройте https://ramiros.netlify.app на двух устройствах:
- ПК
- Android телефон

Введите разные имена и увидите друг друга!

## 🐛 Решение проблем

### "Server not found"
- Убедитесь что деплой на Render завершён
- Проверьте URL в `MultiplayerClient.ts`
- Проверьте логи на Render (должны быть "Server is running")

### Игроки не видят друг друга
- Откройте консоль браузера (F12) на обоих устройствах
- Проверьте что оба подключены к серверу
- Проверьте логи на Render

### Медленная синхронизация
- Бесплатный тир Render может "засыпать" после 15 минут неактивности
- Первый запрос может быть медленным (5-10 секунд)
- Это нормально для бесплатного хостинга

## 💰 Стоимость

Render.com бесплатный тир:
- 750 часов/месяц
- Автоматический деплой из GitHub
- Поддержка WebSocket
- Бесплатный SSL

Для вашей игры этого более чем достаточно!

## 📊 Мониторинг

После деплоя вы можете:
- Видеть логи в реальном времени на Render
- Проверять статус сервера: `https://rpg25d-server.onrender.com/`
- Видеть список игроков: `https://rpg25d-server.onrender.com/players`

## 🎯 Альтернатива: Локальный тест

Если не хотите деплоить, можете тестировать локально:

```bash
# Терминал 1: Сервер
cd server
npm start

# Терминал 2: Frontend
npm run dev -- --host

# На телефоне откройте: http://YOUR_IP:5173
```

Но это работает только в локальной сети.

## 🎮 Готово!

Теперь у вас рабочий мультиплеер:
- Frontend: https://ramiros.netlify.app
- Backend: https://rpg25d-server.onrender.com
- Работает на ПК и Android
- Бесплатно
