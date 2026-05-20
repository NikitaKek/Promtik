# Promptik

Promptik (`promptik`) - локальное desktop speech-to-text приложение для быстрого превращения голоса в готовый промпт для ИИ. Нажмите `Ctrl + Alt + Space`, продиктуйте запрос, нажмите горячую клавишу еще раз, и текст будет распознан локально, показан в интерфейсе и скопирован в буфер обмена.

## Идея

Promptik превращает голос в готовый текст для ChatGPT, Claude, Codex, Cursor и любых других AI-чатов. Аудио не отправляется на серверы: Electron управляет окном, записью, буфером обмена, историей и экспортом, а Python локально запускает `faster-whisper`.

## Архитектура

- Electron main process: окно приложения, мини-оверлей записи, `Ctrl + Alt + Space`, IPC, clipboard, история, настройки.
- React renderer: запись микрофона через `MediaRecorder`, интерфейс на русском языке, история, настройки, результат.
- Python backend: `python/transcriber.py`, локальная транскрибация через `faster-whisper`, JSON через stdin/stdout.
- Данные: `data/history.json`, `data/settings.json`.
- Временные записи: `temp/`.

## Установка Node.js

Установите Node.js LTS с [nodejs.org](https://nodejs.org/). После установки проверьте:

```powershell
node -v
npm -v
```

## Установка Python 3.11+

Установите Python 3.11 или новее с [python.org](https://www.python.org/downloads/). На Windows включите опцию добавления Python в `PATH`.

Проверьте:

```powershell
python --version
```

## Установка JS-зависимостей

```powershell
npm install
```

## Установка Python-зависимостей

```powershell
cd python
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

## ffmpeg

`faster-whisper` использует ffmpeg для чтения многих аудио и видео форматов. Если транскрибация файлов `.mp4`, `.m4a`, `.webm` или `.mp3` не работает, установите ffmpeg и добавьте его в `PATH`.

Проверка:

```powershell
ffmpeg -version
```

## CUDA GPU

Promptik может работать через CUDA GPU. Для Windows проект использует NVIDIA pip-пакеты из `python/requirements.txt`:

- `nvidia-cublas-cu12`
- `nvidia-cudnn-cu12`
- `nvidia-cuda-runtime-cu12`

После `pip install -r requirements.txt` приложение автоматически добавляет DLL-папки из `python/.venv` в search path Python. В настройках по умолчанию используется `Auto - GPU, затем CPU`: если CUDA доступна, будет GPU; если нет, приложение откатится на CPU int8 без падения.

## Пресеты качества

В настройках есть три пресета распознавания. Все они рассчитаны на приемлемое качество, без маленьких моделей `tiny/base/small`, которые плохо подходят для твоего сценария.

| Пресет | Модель | Точность | Разделение фраз | Рекомендуемая система |
| --- | --- | ---: | ---: | --- |
| Быстро | `large-v3-turbo` | 3 | 850 мс | NVIDIA GPU 8 ГБ VRAM, 16 ГБ RAM. |
| Баланс | `large-v3` | 5 | 900 мс | NVIDIA GPU 12-16 ГБ VRAM, 32 ГБ RAM. |
| Максимум | `large-v3` | 12 | 1100 мс | NVIDIA GPU 16 ГБ VRAM, 32 ГБ RAM. |

Параметр `Точность поиска` делает распознавание внимательнее, но медленнее. `Баланс` соответствует прежнему хорошо работающему максимальному режиму, а `Максимум` сравнивает больше вариантов распознавания и использует более строгие параметры декодирования.

Поле `Словарь терминов` помогает модели с именами, названиями продуктов и английскими словами. Добавляйте туда слова, которые Whisper часто путает: названия проектов, фамилии, “Codex”, “Cursor”, технические термины.

## Запуск

```powershell
npm run dev
```

Или через Windows helper:

```powershell
run.bat
```

`run.bat` проверяет наличие `node_modules` и `python/.venv`, затем запускает `npm run dev`.

## Как пользоваться

1. Нажмите `Ctrl + Alt + Space` или большую кнопку записи.
2. Говорите.
3. Нажмите `Ctrl + Alt + Space` еще раз или кнопку остановки.
4. Promptik локально распознает речь.
5. Текст появится в интерфейсе и при включенном auto-copy будет скопирован в буфер обмена.
6. Вставьте текст в любой ИИ-чат.

Горячая клавиша работает и когда основное окно свернуто. Во время записи Promptik показывает маленькое окно справа снизу с анимацией, которая реагирует на реальный уровень микрофона; повторное нажатие hotkey завершает запись.

Hotkey можно поменять в настройках. Доступные пресеты: `Ctrl + Alt + Space`, `Ctrl + Shift + Space`, `Ctrl + Alt + R`, `Ctrl + Shift + R`, `Ctrl + →`, Ctrl + <kbd>`</kbd>.

Кнопка закрытия прячет Promptik в трей Windows. Чтобы открыть окно снова, нажмите на иконку Promptik в трее или выберите пункт `Открыть Promptik`. Для полного выхода используйте пункт `Выход` в меню трея.

Когда Promptik работает из трея, мини-оверлей продолжает показывать реальный уровень микрофона. После транскрибации приложение копирует текст в буфер обмена и показывает уведомление внутри интерфейса Promptik. Если основное окно скрыто, статус копирования отображается в мини-оверлее.

## Модели Whisper

Модель меняется в настройках приложения:

- `large-v3-turbo` - ускоренная версия large-v3, быстрее основного режима.
- `large-v3` - основной режим качества, лучше запускать на CUDA GPU.

В настройках рядом с моделями показываются значки:

- `скачана` - модель уже есть в локальном HuggingFace cache;
- `не скачана` - при первом использовании модель будет скачана;
- `проверка` - приложение сейчас читает локальный cache;
- `неизвестно` - Python backend или cache недоступен для проверки.

После запуска Promptik тихо прогревает выбранную модель, если она уже скачана в локальный cache. Это уменьшает задержку первой транскрибации после перезапуска. Если модель еще не скачана, автоматический прогрев не стартует, чтобы не начинать большую загрузку без действия пользователя.

## Разделение фраз

В настройках есть ползунок "Разделение фраз". Он управляет VAD-сегментацией faster-whisper: сколько тишины приложение считает границей между фразами.

- меньшее значение чаще режет запись на отдельные фразы;
- большее значение склеивает фразы и лучше терпит паузы внутри одной мысли.

## Формат для ИИ

Если включить "Формат для ИИ", auto-copy будет копировать текст так:

```text
Ответь на следующий голосовой запрос пользователя:

{transcribed_text}
```

Если настройка выключена, копируется только чистая транскрибация.

## Проверки

```powershell
npm run typecheck
npm run build
```

Python dependency check:

```powershell
python\.venv\Scripts\python.exe -m py_compile python\transcriber.py
```

## Windows release `.exe`

Promptik можно собрать в установщик для GitHub Releases:

```powershell
npm run dist:win
```

Готовый файл появится в `release/`, например `Promptik-Setup-0.1.5.exe`.

Ярлык в меню Пуск и установленный `.exe` используют иконку `assets/icon.ico`.

Для быстрой проверки без установщика можно собрать unpacked-папку:

```powershell
npm run dist:win:dir
```

Важно: установщик пакует Electron-приложение, Python backend-файлы `python/transcriber.py` / `python/requirements.txt`, helper `install-ml.bat` и, если заранее подготовлена папка `python/wheelhouse`, локальные Python wheels. После установки на машине пользователя нужно один раз запустить из папки установки:

```powershell
cd "<папка установки Promptik>"
.\install-ml.bat
```

Скрипт создаст `python\.venv` и установит `faster-whisper` с зависимостями. Если рядом есть `python/wheelhouse`, установка пройдет локально без PyPI. Вручную онлайн-установка эквивалентна:

```powershell
python -m venv python\.venv
python\.venv\Scripts\python.exe -m pip install -r python\requirements.txt
```

Если сеть или антивирус подменяет HTTPS-сертификаты PyPI и pip показывает `SSLCertVerificationError`, `install-ml.bat` сначала попробует обычную установку, затем очистит pip cache, отключит proxy-переменные `HTTP_PROXY` / `HTTPS_PROXY` / `ALL_PROXY` и повторит установку с `--no-cache-dir`. Последний fallback использует trusted PyPI hosts. Это также помогает при ошибке `THESE PACKAGES DO NOT MATCH THE HASHES`, если pip успел сохранить поврежденный `.whl.metadata` в кэше. Если hash mismatch остается даже после `--no-cache-dir`, сеть или прокси ломает скачанный файл; для такого случая лучше собирать release с локальной папкой `python/wheelhouse`.

Для подготовки офлайн-зависимостей перед сборкой релиза:

```powershell
npm run prepare:wheelhouse
npm run dist:win
```

`prepare:wheelhouse` скачивает Windows wheels для Python 3.11, 3.12, 3.13 и 3.14. Поэтому `install-ml.bat` сначала ищет установленный Python через `py -3.14`, `py -3.13`, `py -3.12`, `py -3.11`, а затем уже пробует обычный `python`.

Whisper-модель скачивается при первом использовании выбранного пресета. Для полноценного self-contained release в будущем можно отдельно собрать Python backend через PyInstaller или подготовить отдельный архив с portable Python и зависимостями, но такой релиз будет значительно тяжелее.

## Open Source Hygiene

- Не коммитьте локальные записи из `temp/`, историю из `data/history.json`, настройки из `data/settings.json`, `node_modules/`, `dist/`, `release/` и `python/.venv/`.
- Перед публикацией на GitHub проверьте `git status --short`.
- Лицензия проекта: MIT.

## Публикация на GitHub

```powershell
git init
git add .
git commit -m "Initial open source release"
git branch -M main
git remote add origin https://github.com/<user-or-org>/promptik.git
git push -u origin main
```

## Ручное переименование папки

Codex работает внутри текущей root-папки, поэтому приложение не пытается переименовать ее автоматически. Если нужно переименовать папку проекта вручную после закрытия Codex и терминалов, выполните из родительской директории:

```powershell
Rename-Item -Path ".\speech-to-text" -NewName "promptik"
```
