# cutieTlgrmBot
Бот для ежедневного выбора пользователя в чате

## Переменные окружения
- `ADMIN_USERNAME` telegram username администратора бота
- `BOT_DOMAIN` адрес бота
- `BOT_TOKEN` токен бота
- `DATABASE_URL` строка подключения к базе
- `ADMIN_USER_ID` telegram user_id администратора бота (*deprecated*)

## Установка
```
npm i
```
В текущем виде настроен на использование postgress и устанавливает пакеты для него

## Запуск
```
npm start
```