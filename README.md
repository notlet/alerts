# Alerts

Простий бот для Телеграм, який сповіщає про повітряні тривоги.

Додати для себе: https://t.me/ioairraidbot

---
## Як користуватися
 - `/alerts` - дізнатися активні тривоги
 - `/areas` - дізнатися статус і індекси всіх регіонів
 - `/subscribe` - підписати канал до сповіщень про тривоги
 - `/unsubscribe` - перестати отримувати сповіщення
 - `/subscribeall` - отримувати сповіщення про всі регіони
 - `/subscribed` - дізнатися, на які регіони підписаний канал

---
## Налаштування власного бота
1. Завантажити [compose](https://github.com/notlet/alerts/blob/main/docker-compose.yml), [.env](https://github.com/notlet/alerts/blob/main/example.env), і, за бажанням, [update.sh](https://github.com/notlet/alerts/blob/main/update.sh) для оновлень.
2. Заповнити необхідні значення в `.env`
3. `docker compose up -d`
