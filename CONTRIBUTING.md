# Contributing

Спасибо за интерес к Promptik.

## Локальный запуск

```powershell
npm install
cd python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
npm run dev
```

## Проверки перед PR

```powershell
npm run typecheck
npm run build
python\.venv\Scripts\python.exe -m py_compile python\transcriber.py
```

## Правила

- Не отправляйте аудио или транскрипции на внешние серверы.
- Сохраняйте UI на русском языке, пока в проекте нет полноценной i18n-системы.
- Не коммитьте локальные данные из `data/`, `temp/`, `dist/`, `node_modules/` и `python/.venv/`.
- Для ML-изменений пишите понятные ошибки пользователю и не ломайте JSON stdout протокол.
