"""
Generate narration audio for security training lessons.

Engines:
  chatterbox  Chatterbox TTS by Resemble AI (MIT). Fully local and the most natural-sounding.
              Slow on CPU. Optional --reference voice clip to clone (only use clips you have rights to).
  kokoro      Kokoro TTS (Apache-2.0). Fully local and fast, but less natural.
  azure       Microsoft Azure neural voices. Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION;
              lesson text is sent to Azure.

With --verify, every sentence is transcribed locally with Whisper (faster-whisper) and compared
with the script; sentences that come out wrong (skipped/extra words, acronyms read as words)
are regenerated, and anything still off is reported.

Reads the JSON written by export-narration.ts, synthesises each sentence, joins them with
short pauses into one MP3 per scene, and merges the timings into the audio manifest that
the app reads (lib/security/training-audio-manifest.json).

See README.md in this folder for how to run it in Docker.
"""

import argparse
import difflib
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable
from xml.sax.saxutils import escape

import numpy as np
import soundfile as sf

SAMPLE_RATE = 24000
LEAD_IN_S = 0.25
SENTENCE_GAP_S = 0.35
TAIL_S = 0.25
SILENCE_THRESHOLD = 0.01
KEEP_EDGE_S = 0.04

DEFAULT_VOICES = {"azure": "en-GB-SoniaNeural", "kokoro": "bf_emma", "chatterbox": "default"}

# Acronyms that must be spoken as letters (checked by --verify)
ACRONYMS = ["IT", "USB", "MFA", "VPN", "GDPR", "CEO"]

# Kokoro-only spoken-form fixes (never applied to captions). Leave acronyms as plain capitals:
# the phonemizer reads them as fluent letter sequences, and dotted forms add a pause per letter.
KOKORO_PRONUNCIATION = [
    # Otherwise read as "two thousand and twenty-five"
    (re.compile(r"\b20(1\d|2\d)\b"), r"twenty \1"),
]

# Synthesise(sentence, attempt) -> mono float32 samples at SAMPLE_RATE.
# Engines may vary seed or spelling between attempts so retries can produce a better take.
Synthesise = Callable[[str, int], np.ndarray]


def kokoro_engine(models_dir: str, voice: str, lang: str, speed: float) -> Synthesise:
    from kokoro_onnx import Kokoro

    models = Path(models_dir)
    kokoro = Kokoro(str(models / "kokoro-v1.0.fp16.onnx"), str(models / "voices-v1.0.bin"))

    def synthesise(sentence: str, attempt: int) -> np.ndarray:
        text = sentence
        for pattern, replacement in KOKORO_PRONUNCIATION:
            text = pattern.sub(replacement, text)
        samples, sample_rate = kokoro.create(text, voice=voice, speed=speed, lang=lang)
        if sample_rate != SAMPLE_RATE:
            raise RuntimeError(f"Unexpected Kokoro sample rate {sample_rate}")
        return samples.astype(np.float32)

    return synthesise


def chatterbox_engine(reference: str | None, exaggeration: float, cfg_weight: float) -> Synthesise:
    import torch
    from chatterbox.tts import ChatterboxTTS

    torch.set_num_threads(os.cpu_count() or 4)
    model = ChatterboxTTS.from_pretrained(device="cpu")
    if model.sr != SAMPLE_RATE:
        raise RuntimeError(f"Unexpected Chatterbox sample rate {model.sr}")
    if reference:
        model.prepare_conditionals(reference, exaggeration=exaggeration)

    def synthesise(sentence: str, attempt: int) -> np.ndarray:
        text = sentence
        # From the third attempt, spell acronyms with dots in case the plain form was read as a word
        if attempt >= 2:
            for acronym in ACRONYMS:
                text = re.sub(rf"\b{acronym}\b", ".".join(acronym) + ".", text)
            text = text.replace("..", ".")
        torch.manual_seed(1000 + attempt)
        with torch.inference_mode():
            wav = model.generate(text, exaggeration=exaggeration, cfg_weight=cfg_weight)
        return wav.squeeze(0).cpu().numpy().astype(np.float32)

    return synthesise


def azure_engine(voice: str, lang: str, rate_percent: int) -> Synthesise:
    key = os.environ.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION")
    if not key or not region:
        raise SystemExit("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set (see README.md)")
    url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"

    def synthesise(sentence: str, attempt: int) -> np.ndarray:
        ssml = (
            f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{lang}">'
            f'<voice name="{escape(voice)}"><prosody rate="{rate_percent:+d}%">{escape(sentence)}</prosody></voice>'
            "</speak>"
        )
        request = urllib.request.Request(
            url,
            data=ssml.encode("utf-8"),
            method="POST",
            headers={
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm",
                "User-Agent": "idaraos-training-audio",
            },
        )
        # The free tier allows 20 requests per minute, so back off and retry when throttled
        for retry in range(8):
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    pcm = response.read()
                return np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
            except urllib.error.HTTPError as error:
                if error.code in (401, 403):
                    raise SystemExit(f"Azure rejected the key or region (HTTP {error.code})") from None
                if error.code == 400:
                    raise SystemExit(f"Azure rejected the request (HTTP 400). Is the voice name '{voice}' valid?") from None
                if error.code not in (429, 500, 502, 503, 504):
                    raise
                wait = float(error.headers.get("Retry-After") or 2 ** min(retry + 1, 5))
                print(f"    Azure HTTP {error.code}, retrying in {wait:.0f}s")
                time.sleep(wait)
            except urllib.error.URLError as error:
                wait = 2 ** min(retry + 1, 5)
                print(f"    Network error ({error.reason}), retrying in {wait}s")
                time.sleep(wait)
        raise SystemExit("Azure synthesis kept failing; try again later")

    return synthesise


# Words that sound identical, so a transcript can't tell them apart (transcribed -> scripted)
HOMOPHONES = {"bite": "byte", "sofie": "sophie", "sophy": "sophie", "labeled": "labelled"}


class Verifier:
    """Transcribes synthesised speech locally and compares it with the script"""

    def __init__(self, model_name: str):
        from faster_whisper import WhisperModel

        self.model = WhisperModel(model_name, device="cpu", compute_type="int8")

    @staticmethod
    def _words(text: str) -> list[str]:
        text = text.lower().replace("-", " ").replace("’", "'")
        text = re.sub(r"\b([a-z])\.(?=[a-z]\.)", r"\1", text)  # i.t. -> it.
        return [HOMOPHONES.get(word, word) for word in re.findall(r"[a-z0-9']+", text)]

    def check(self, samples: np.ndarray, expected: str) -> tuple[float, list[str], str]:
        import librosa

        audio16k = librosa.resample(samples, orig_sr=SAMPLE_RATE, target_sr=16000)
        segments, _ = self.model.transcribe(audio16k, language="en", beam_size=5, vad_filter=False)
        transcript = " ".join(s.text.strip() for s in segments).strip()

        score = difflib.SequenceMatcher(None, self._words(expected), self._words(transcript)).ratio()
        problems = []
        for acronym in ACRONYMS:
            if re.search(rf"\b{acronym}\b", expected):
                letters = r"\.?\s?".join(acronym)
                if not re.search(rf"\b{letters}\.?(?![a-z])", transcript):
                    problems.append(f"{acronym} not heard as letters")
        if score < 0.9:
            problems.append(f"transcript differs (match {score:.0%})")
        return score, problems, transcript


def trim_silence(samples: np.ndarray) -> np.ndarray:
    """Trim leading/trailing silence so the pauses between sentences are consistent"""
    loud = np.flatnonzero(np.abs(samples) > SILENCE_THRESHOLD)
    if loud.size == 0:
        return samples
    keep = int(KEEP_EDGE_S * SAMPLE_RATE)
    return samples[max(0, loud[0] - keep): min(len(samples), loud[-1] + keep)]


def render_sentence(sentence: str, synthesise: Synthesise, verifier: Verifier | None, attempts: int, warnings: list[str]) -> np.ndarray:
    best: tuple[float, np.ndarray, list[str], str] | None = None
    for attempt in range(attempts if verifier else 1):
        samples = trim_silence(synthesise(sentence, attempt))
        if not verifier:
            return samples
        score, problems, transcript = verifier.check(samples, sentence)
        # Prefer takes with no acronym problems, then the closest transcript
        rank = score - len([p for p in problems if "letters" in p])
        if best is None or rank > best[0]:
            best = (rank, samples, problems, transcript)
        if not problems:
            break
        print(f"    retry {attempt + 1}: {', '.join(problems)} -> heard: {transcript!r}")
    assert best is not None
    if best[2]:
        warnings.append(f"{sentence!r}: {', '.join(best[2])}; heard {best[3]!r}")
    return best[1]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--engine", choices=["chatterbox", "kokoro", "azure"], default="chatterbox")
    parser.add_argument("--input", required=True, help="JSON from export-narration.ts")
    parser.add_argument("--out-dir", required=True, help="public/training/audio")
    parser.add_argument("--manifest", required=True, help="lib/security/training-audio-manifest.json")
    parser.add_argument("--voice", help="kokoro/azure voice name (defaults: bf_emma, en-GB-SoniaNeural)")
    parser.add_argument("--lang", default="en-GB")
    parser.add_argument("--speed", type=float, default=1.0, help="kokoro: speed factor; azure: 1.0 = normal rate")
    parser.add_argument("--models", help="kokoro only: folder with kokoro-v1.0.fp16.onnx and voices-v1.0.bin")
    parser.add_argument("--reference", help="chatterbox only: voice clip (5-15s WAV) to clone")
    parser.add_argument("--exaggeration", type=float, default=0.45, help="chatterbox only: expressiveness")
    parser.add_argument("--cfg-weight", type=float, default=0.5, help="chatterbox only: pacing/adherence")
    parser.add_argument("--verify", action="store_true", help="transcribe and check every sentence")
    parser.add_argument("--whisper-model", default="base.en")
    parser.add_argument("--attempts", type=int, default=4, help="max takes per sentence with --verify")
    args = parser.parse_args()

    if args.engine == "chatterbox":
        voice = Path(args.reference).stem if args.reference else "default"
        synthesise = chatterbox_engine(args.reference, args.exaggeration, args.cfg_weight)
    elif args.engine == "azure":
        voice = args.voice or DEFAULT_VOICES["azure"]
        synthesise = azure_engine(voice, args.lang, round((args.speed - 1.0) * 100))
    else:
        if not args.models:
            raise SystemExit("--models is required for the kokoro engine")
        voice = args.voice or DEFAULT_VOICES["kokoro"]
        synthesise = kokoro_engine(args.models, voice, args.lang.lower(), args.speed)
    verifier = Verifier(args.whisper_model) if args.verify else None

    courses = json.loads(Path(args.input).read_text(encoding="utf-8"))
    manifest_path = Path(args.manifest)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    warnings: list[str] = []

    for course in courses:
        key = course["key"]
        course_dir = Path(args.out_dir) / key

        # Synthesise everything before touching existing files, so a failure leaves them intact
        rendered = []
        for scene in course["scenes"]:
            started = time.time()
            parts = [np.zeros(int(LEAD_IN_S * SAMPLE_RATE), dtype=np.float32)]
            starts_ms = []
            position_s = LEAD_IN_S
            for i, sentence in enumerate(scene["sentences"]):
                if i > 0:
                    parts.append(np.zeros(int(SENTENCE_GAP_S * SAMPLE_RATE), dtype=np.float32))
                    position_s += SENTENCE_GAP_S
                samples = render_sentence(sentence, synthesise, verifier, args.attempts, warnings)
                starts_ms.append(round(position_s * 1000))
                parts.append(samples)
                position_s += len(samples) / SAMPLE_RATE
            parts.append(np.zeros(int(TAIL_S * SAMPLE_RATE), dtype=np.float32))

            audio = np.concatenate(parts)
            # Normalise peaks so every scene plays at a similar volume
            peak = float(np.max(np.abs(audio))) or 1.0
            audio = (audio / peak * 0.9).astype(np.float32)
            rendered.append((scene, audio, starts_ms))
            print(f"  {key} scene {scene['index'] + 1}: {len(audio) / SAMPLE_RATE:.1f}s, "
                  f"{len(starts_ms)} sentences ({time.time() - started:.0f}s to render)", flush=True)

        course_dir.mkdir(parents=True, exist_ok=True)
        for stale in course_dir.glob("*.mp3"):
            stale.unlink()

        scenes = []
        for scene, audio, starts_ms in rendered:
            # A fingerprint of the audio in the name means browsers never replay a cached old take
            buffer = io.BytesIO()
            sf.write(buffer, audio, SAMPLE_RATE, format="MP3")
            data = buffer.getvalue()
            file_name = f"scene-{scene['index'] + 1:02d}-{scene['narrationHash']}-{hashlib.sha1(data).hexdigest()[:8]}.mp3"
            (course_dir / file_name).write_bytes(data)
            scenes.append({
                "narrationHash": scene["narrationHash"],
                "file": file_name,
                "durationMs": round(len(audio) / SAMPLE_RATE * 1000),
                "sentenceStartsMs": starts_ms,
            })

        manifest[key] = {"voice": f"{args.engine}:{voice}", "scenes": scenes}

    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {manifest_path}")
    if warnings:
        print(f"\n{len(warnings)} sentence(s) may need a listen:")
        for warning in warnings:
            print(f"  - {warning}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
