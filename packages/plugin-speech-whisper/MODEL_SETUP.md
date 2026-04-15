# Downloading and Configuring the Whisper Model

This package does **not** include the Whisper GGML model file due to its large size. You must download it manually and provide its path when configuring the plugin.

## 1. Download the Model

- Visit the official Whisper model repository: https://huggingface.co/ggerganov/whisper.cpp
- Download the desired GGML model file (e.g., `ggml-base.bin`).
- Place the file anywhere on your system. A common convention is:
  - `your-app-root/models/ggml-base.bin`
  - or inside this package: `packages/plugin-speech-whisper/models/ggml-base.bin`

## 2. Configure the Model Path

When registering the plugin in your Electron main process, set the `modelPath` option to the absolute path of your downloaded model file:

```ts
import { registerSpeechWhisperMain } from '@ozymandros/electron-message-bridge-plugin-speech-whisper';

const stt = registerSpeechWhisperMain({
  whisperBin: '/absolute/path/to/whisper.cpp/build/bin/whisper-cli',
  modelPath: '/absolute/path/to/ggml-base.bin', // <--- set this to your model location
});
```

- You can store the model anywhere, as long as the path is correct and readable by your Electron process.
- For cross-platform compatibility, consider using `path.join(app.getAppPath(), 'models', 'ggml-base.bin')` or similar logic.

## 3. Error Handling

If the model file is missing or the path is incorrect, the plugin will return `hasModel: false` and a helpful error message in `getStatus()`. Update your configuration or move the file as needed.

## 4. Why Manual Download?

- Model files are large and change infrequently.
- Manual download avoids bloating your app and keeps install times fast.
- Users can choose the model variant and location that best fits their needs.

---

For more details, see the main README and the Whisper.cpp documentation.
