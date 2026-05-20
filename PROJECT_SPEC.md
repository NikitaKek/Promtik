# PROJECT_SPEC.md

## Название

**Promptik**

Slug: `promptik`

## Визуальная концепция

Promptik выглядит как премиальная темная AI-панель: глубокий графитовый фон, стеклянные полупрозрачные поверхности, мягкие тени, крупная центральная кнопка записи с аудио-пульсом, тонкие акценты cyan и mint. Логотип минималистичный: аудиоволна переходит в текстовый курсор.

Интерфейс полностью на русском языке и не похож на стандартную Windows-форму.

## Архитектура

Приложение состоит из двух частей:

- Electron app:
  - окно приложения;
  - React UI;
  - мини-оверлей записи справа снизу для свернутого режима;
  - tray-поведение Windows: закрытие окна скрывает приложение, выход доступен через меню трея;
  - запись с микрофона через renderer MediaRecorder;
  - global hotkey `Ctrl + Alt + Space`;
  - clipboard;
  - история и настройки;
  - запуск Python child process.
- Python ML backend:
  - локальная транскрибация через faster-whisper;
  - lazy loading модели;
  - JSON stdin/stdout протокол;
  - без сетевых запросов.

Тяжелые операции асинхронны. Renderer не должен зависать во время записи или транскрибации.

## Структура файлов

```text
project-root/
  AGENTS.md
  PROJECT_SPEC.md
  README.md
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  run.bat
  assets/
    logo.svg
    icon.svg
  src/
    main/
      main.ts
      preload.ts
      ipc.ts
      miniOverlay.ts
      pythonBridge.ts
      hotkeys.ts
      fileSystem.ts
      settings.ts
    renderer/
      main.tsx
      App.tsx
      MiniRecorder.tsx
      styles.css
      components/
        RecordButton.tsx
        StatusBadge.tsx
        TranscriptEditor.tsx
        HistoryPanel.tsx
        SettingsPanel.tsx
        TopBar.tsx
      lib/
        types.ts
        formatting.ts
        clipboard.ts
  python/
    transcriber.py
    requirements.txt
  data/
    history.json
    settings.json
  temp/
```

## Electron main process

`main.ts` создает окно, подключает preload, создает системные папки `data` и `temp`, регистрирует IPC handlers и globalShortcut.

`ipc.ts` содержит обработчики:

- сохранение временного аудио;
- транскрибация файла;
- копирование текста;
- загрузка/сохранение настроек;
- загрузка/сохранение истории.

`pythonBridge.ts` запускает `python/transcriber.py` как child process, отправляет JSON-команду одной строкой, читает JSON-ответ из stdout, собирает stderr отдельно и возвращает понятные ошибки при отсутствии Python, venv или зависимостей.

После загрузки настроек renderer проверяет локальный cache моделей и фоново вызывает `warmup` для выбранной модели, если она уже скачана. Это уменьшает задержку первой транскрибации после перезапуска без неожиданной загрузки модели.

`hotkeys.ts` регистрирует выбранный пользователем globalShortcut и отправляет событие `hotkey-pressed` в renderer. Renderer решает, начать запись или остановить ее, потому что доступ к микрофону живет в Chromium renderer. Дефолт: `Ctrl + Alt + Space`.

`miniOverlay.ts` создает маленькое always-on-top окно справа снизу. Оно не забирает фокус, показывает статус записи/транскрибации/копирования и помогает использовать hotkey, когда основное окно свернуто. Во время записи renderer передает в overlay реальный уровень микрофона по interval, поэтому волна работает даже когда основное окно скрыто в трей и затихает при молчании.

После успешной транскрибации и копирования renderer показывает внутреннюю минималистичную toast-плашку в окне Promptik. Если основное окно скрыто, статус копирования отображается через мини-оверлей, без системного Windows notification.

`tray.ts` создает иконку Promptik в системном трее Windows. Кнопка закрытия основного окна скрывает окно, не завершает процесс. Пункт `Открыть Promptik` возвращает окно, пункт `Выход` завершает приложение.

`fileSystem.ts` отвечает за безопасные пути проекта и создание папок.

`settings.ts` читает/пишет `data/settings.json` и подставляет дефолты.

## Preload API

Через `contextBridge` доступно `window.promptik`:

- `startRecording()`
- `stopRecording()`
- `saveRecording(buffer, extension)`
- `transcribeFile(filePath, settings)`
- `copyText(text)`
- `loadSettings()`
- `saveSettings(settings)`
- `loadHistory()`
- `saveHistory(history)`
- `onHotkeyPressed(callback)`
- `getOverlayState()`
- `updateOverlay(state)`
- `onOverlayState(callback)`

`startRecording` и `stopRecording` являются renderer workflow hooks: они фиксируют IPC-событие намерения, а реальная запись выполняется MediaRecorder в React.

## Renderer UI

React + TypeScript UI:

- `TopBar`: логотип, название, статус локальности ML, подсказка hotkey.
- `MiniRecorder`: компактный экран для мини-оверлея записи со статусом и анимацией аудио.
- `RecordButton`: большая центральная кнопка записи/остановки с визуальным состоянием.
- `StatusBadge`: статусы "Готово", "Идет запись", "Загрузка ML-модели", "Транскрибация", "Текст скопирован", "Ошибка".
- `TranscriptEditor`: большое поле результата, автоселект после транскрибации и действие копирования.
- `HistoryPanel`: последние 50 транскрибаций, клик возвращает текст и segments.
- `SettingsPanel`: модель, язык, пресеты качества, словарь терминов, auto-copy и формат для ИИ.

## Python ML bridge

`python/transcriber.py` принимает JSON-команду:

```json
{
    "action": "transcribe",
  "file_path": "...",
  "model_size": "large-v3",
  "language": "ru",
  "device": "cuda",
  "vad_silence_ms": 700,
  "beam_size": 5,
  "hotwords": "ChatGPT, Claude, Codex"
}
```

Для фонового прогрева уже скачанной модели доступна команда:

```json
{
  "action": "warmup",
  "model_size": "large-v3",
  "device": "cuda"
}
```

Возвращает:

```json
{
  "ok": true,
  "text": "...",
  "segments": [
    {
      "start": 0.0,
      "end": 4.2,
      "text": "..."
    }
  ]
}
```

При ошибке:

```json
{
  "ok": false,
  "error": "..."
}
```

Требования:

- lazy loading модели;
- faster-whisper;
- model size: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`, `large-v3`;
- language: `auto`, `ru`, `en`;
- device auto: `cuda`, если доступно, иначе `cpu`;
- compute_type: `float16` для cuda, `int8` для cpu;
- logs/errors не ломают JSON stdout.

## Запись аудио

Renderer использует `navigator.mediaDevices.getUserMedia({ audio: true })` и `MediaRecorder`. После остановки Blob конвертируется в ArrayBuffer, передается через preload в main process и сохраняется в `temp/recording-*.webm`. Затем main вызывает Python transcriber.

## История

`data/history.json` хранит последние 50 записей:

- `id`
- `datetime`
- `text`
- `source`: `microphone` или `file`
- `language`
- `model`
- `segments`

Клик по истории возвращает `text` и `segments` в главное поле.

## Настройки

`data/settings.json`:

```json
{
  "qualityPreset": "balanced",
  "modelSize": "large-v3",
  "language": "ru",
  "deviceMode": "auto",
  "autoCopy": true,
  "aiFormat": false,
  "vadSilenceMs": 1100,
  "beamSize": 12,
  "termHints": "ChatGPT, Claude, Codex, Cursor, OpenAI",
  "hotkey": "CommandOrControl+Alt+Space"
}
```

Модель: `tiny`, `base`, `small`, `medium`, `large-v3-turbo`, `large-v3`. В UI пресетов показаны только `large-v3-turbo` и `large-v3`, потому что маленькие модели дают недостаточное качество для основного сценария.

Язык: `auto`, `ru`, `en`.

Ползунок "Разделение фраз": `vadSilenceMs` от 200 до 2000 мс. Значение передается в faster-whisper как `vad_parameters.min_silence_duration_ms` и управляет тем, сколько тишины считать концом фразы.

Ползунок "Точность поиска": `beamSize` от 1 до 12. Значение передается в faster-whisper как `beam_size`: меньше быстрее, больше точнее и медленнее. Для `beamSize >= 10` Python backend включает более высокий `patience`.

Поле "Словарь терминов": `termHints` до 2000 символов. Значение передается в Python как `hotwords` и добавляется в `initial_prompt`, чтобы повысить точность имен, названий продуктов, английских слов и технических терминов.

Настройка "Горячая клавиша": `hotkey`. Доступные значения: `CommandOrControl+Alt+Space`, `CommandOrControl+Shift+Space`, `CommandOrControl+Alt+R`, `CommandOrControl+Shift+R`, `CommandOrControl+Right`, <code>CommandOrControl+`</code>. При сохранении настроек Electron перерегистрирует globalShortcut без перезапуска приложения.

Пресеты качества:

| Пресет | Модель | Beam | Разделение фраз | Устройство | Рекомендуемая система |
| --- | --- | ---: | ---: | --- | --- |
| Быстро | `large-v3-turbo` | 3 | 850 мс | `auto` | NVIDIA GPU 8 ГБ VRAM, 16 ГБ RAM |
| Баланс | `large-v3` | 5 | 900 мс | `auto` | NVIDIA GPU 12-16 ГБ VRAM, 32 ГБ RAM |
| Максимум | `large-v3` | 12 | 1100 мс | `auto` | NVIDIA GPU 16 ГБ VRAM, 32 ГБ RAM |

UI настроек показывает локальный статус моделей `large-v3-turbo/large-v3`: `скачана`, `не скачана`, `проверка`, `неизвестно`. Проверка выполняется без скачивания модели, через чтение HuggingFace cache.

Блок "Поведение" показывает пояснения:

- Auto-copy: после распознавания текст сразу копируется в буфер обмена.
- Формат для ИИ: в буфер попадает готовая формулировка запроса для AI-чата.

## Критерии готовности

- Приложение запускается через `npm run dev`.
- Горячая клавиша `Ctrl + Alt + Space` переключает запись.
- Запись с микрофона сохраняется в `temp/`.
- Python локально транскрибирует файл через faster-whisper.
- Результат отображается, выделяется, сохраняется в историю и копируется при включенном auto-copy.
- Настройки сохраняются между запусками.
- Ошибки Python/зависимостей показываются пользователю понятным текстом.
- README описывает установку, запуск, ffmpeg и ручное переименование папки.
