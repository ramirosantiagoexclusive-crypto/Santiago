# 🎮 Деплой 2.5D RPG с мультиплеером

## 📦 Структура проекта

```
project/
├── src/                    # Frontend (Vite + React)
│   ├── App.tsx            # Главный компонент
│   ├── game/
│   │   ├── GameEngine.ts  # Игровой движок
│   │   ├── MultiplayerClient.ts  # Socket.io клиент
│   │   └── ...
│   └── components/        # UI компоненты
├── server/                # Backend (Node.js + Socket.io)
│   ├── server.js         # WebSocket сервер
│   └── package.json
├── netlify.toml          # Конфиг Netlify
└── railway.json          # Конфиг Railway
```

## 🚀 Деплой Backend (Railway)

### 1. Создайте аккаунт на Railway
- Перейдите на https://railway.app
- Войдите через GitHub

### 2. Создайте новый проект
- Нажмите "New Project"
- Выберите "Deploy from GitHub repo"
- Выберите ваш репозиторий

### 3. Настройте деплой
Railway автоматически обнаружит `railway.json` и использует его.

Или вручную укажите:
- **Root Directory**: `server`
- **Start Command**: `npm start`

### 4. Получите URL сервера
После деплоя Railway даст URL вида:
```
https://your-app-name.up.railway.app
```

### 5. Настройте переменные окружения (опционально)
В настройках Railway добавьте:
```
CORS_ORIGIN=https://ramiros.netlify.app
```

## 🌐 Деплой Frontend (Netlify)

### 1. Обновите URL сервера
Откройте `src/game/MultiplayerClient.ts` и измените:
```typescript
const SERVER_URL = 'https://your-app-name.up.railway.app'; // Ваш URL
```

### 2. Задеплойте на Netlify
```bash
# Соберите проект
npm run build

# Задеплойте
netlify deploy --prod --dir dist
```

Или через GitHub:
- Подключите репозиторий к Netlify
- Build command: `npm run build`
- Publish directory: `dist`

## 🔧 Локальный запуск

### Backend:
```bash
cd server
npm install
npm start
# Сервер запустится на http://localhost:3001
```

### Frontend:
```bash
npm install
npm run dev
# Откройте http://localhost:3000
```

Для локального теста измените в `MultiplayerClient.ts`:
```typescript
const SERVER_URL = 'http://localhost:3001';
```

## 📋 Проверка работы

1. Откройте сайт на двух устройствах (ПК + телефон)
2. Введите разные имена
3. Вы должны увидеть друг друга на карте
4. Двигайтесь - позиции синхронизируются в реальном времени
5. Используйте чат для общения

## 🎯 Возможности мультиплеера

✅ Синхронизация позиций в реальном времени  
✅ Отображение других игроков с интерполяцией  
✅ Имена над головами  
✅ Уникальные цвета курток  
✅ Синхронизация анимаций и эмоций  
✅ Текстовый чат  
✅ Системные уведомления  
✅ Автоматическое переподключение  
✅ Rate limiting (защита от спама)  
✅ Валидация данных  

## 💰 Стоимость

- **Railway**: $5 бесплатных кредитов/месяц (хватит для теста)
- **Netlify**: Бесплатно для статических сайтов
- **Итого**: $0 для начала

## 🔒 Безопасность

- CORS настроен только для вашего домена
- Rate limiting: 60 сообщений/сек на клиента
- Валидация всех данных на сервере
- Heartbeat для обнаружения отключений

## 🐛 Решение проблем

### "Сервер недоступен"
- Проверьте URL сервера в `MultiplayerClient.ts`
- Убедитесь что сервер запущен на Railway
- Проверьте CORS настройки

### Игроки не видят друг друга
- Проверьте консоль браузера (F12) на ошибки
- Убедитесь что оба клиента подключены к одному серверу
- Проверьте логи сервера на Railway

### Лаги в синхронизации
- Уменьшите `updateInterval` в `MultiplayerClient.ts`
- Увеличьте `lerpFactor` для более плавной интерполяции

## 📊 Мониторинг

Сервер предоставляет endpoints для мониторинга:
- `GET /` - статус сервера и количество игроков
- `GET /players` - список всех игроков
- `GET /health` - проверка здоровья

## 🎮 Готово!

Теперь у вас полноценная 2.5D RPG с мультиплеером:
- Frontend на Netlify: https://ramiros.netlify.app
- Backend на Railway: ваш URL
- Все игроки в одном мире
- Работает на ПК и мобильных устройствах
