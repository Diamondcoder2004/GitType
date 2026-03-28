# GitType

Тренажёр слепой печати на коде из GitHub-репозиториев.

## Проекты

### 1. CLI-версия (терминал)

```bash
cd c:\Users\almaz\GitType
npm install
npm run build
npm start
```

### 2. Веб-версия (браузер, стиль Monkeytype)

```bash
cd c:\Users\almaz\GitType\web
npm install
npm run dev
```

## Настройка

### GitHub Token

Создайте Personal Access Token: https://github.com/settings/tokens

- Для CLI: сохраните в файле `.env`
- Для Web: введите в поле в интерфейсе (сохраняется в localStorage)

## Возможности

| Функция | CLI | Web |
|---------|-----|-----|
| Подключение к GitHub | ✅ | ✅ |
| Выбор репозитория | ✅ | ✅ |
| Выбор файла | ✅ | ✅ |
| Фильтр по языкам | ❌ | ✅ |
| WPM статистика | ✅ | ✅ |
| Точность | ✅ | ✅ |
| Подсветка ошибок | ✅ | ✅ |
| Сохранение токена | ❌ | ✅ |
| Monkeytype UI | ❌ | ✅ |
