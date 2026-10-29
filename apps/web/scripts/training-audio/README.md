# Training lesson narration audio

Starter lessons play pre-recorded narration. Recordings live in
`public/training/audio/<course-key>/` and their timings in `lib/security/training-audio-manifest.json`.
Each recording is keyed by a hash of the narration it was made from, so a scene whose narration
has changed automatically falls back to the browser voice until the audio is regenerated.

`generate.py` supports three engines:

| Engine | Notes |
|---|---|
| `chatterbox` (default) | [Chatterbox](https://github.com/resemble-ai/chatterbox) by Resemble AI (MIT). Fully local, most natural. Slow on CPU (about 10–20 minutes per course). `--reference clip.wav` clones a voice; only use recordings you have the rights to. Output carries Resemble's inaudible Perth watermark. |
| `kokoro` | [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0) via kokoro-onnx. Fully local and fast, but less natural. Needs `--models`. |
| `azure` | Microsoft Azure neural voices (needs `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION`, e.g. via `--env-file azure-speech.env.example` filled in as `.env.local`). Lesson text is sent to Azure. |

Add `--verify` to transcribe every sentence locally with Whisper (faster-whisper `base.en`) and
compare it with the script. Sentences with skipped or extra words, or acronyms such as IT and USB
read as words, are regenerated (up to `--attempts`, default 4) and anything still off is listed.

## Regenerate after editing narration

1. One-time setup: a Docker volume with the tools (about 4 GB, CPU-only PyTorch):

   ```bash
   docker volume create idaraos-tts-chatterbox
   docker run --rm -e HF_HOME=/cb/hf -v idaraos-tts-chatterbox:/cb python:3.11-slim sh -c "python -m venv /cb/venv && /cb/venv/bin/pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu && /cb/venv/bin/pip install chatterbox-tts==0.1.7 soundfile faster-whisper"
   ```

2. Export the narration (inside the web container):

   ```bash
   docker exec idaraos-web-dev sh -c "cd /app/apps/web && npx tsx scripts/training-audio/export-narration.ts /tmp/narration.json social-engineering"
   docker cp idaraos-web-dev:/tmp/narration.json <folder>/narration.json
   ```

3. Generate and verify the audio:

   ```bash
   docker run --rm -w / -e HF_HOME=/cb/hf -v idaraos-tts-chatterbox:/cb -v <folder>:/in -v <repo>/apps/web:/web python:3.11-slim /cb/venv/bin/python -I /web/scripts/training-audio/generate.py --engine chatterbox --verify --input /in/narration.json --out-dir /web/public/training/audio --manifest /web/lib/security/training-audio-manifest.json
   ```

4. Update installed courses in the dev database: `pnpm db:seed-training --refresh-lessons`.
   In other environments, admins get the new version by reinstalling the starter course.
