import json
import os
import subprocess
import wave
import numpy as np

LINES = [
    ("hook", "A 14-inch drill bit once drained an entire 1,125-acre lake in three hours.", 0.16),
    ("setting", "On the surface, Lake Peigneur in Louisiana looked like a calm, three-foot-deep fishing pond.", 0.14),
    ("hidden", "But directly underneath the mud sat a massive underground salt mine, 1,300 feet deep, with 55 miners working inside.", 0.16),
    ("fail1", "On November 20, 1980, an oil rig on the lake drilled straight down.", 0.12),
    ("fail2", "At 1,228 feet, the 14-inch bit got stuck.", 0.14),
    ("fail3", "Two and a half hours later, the rig started to tilt. It had punched straight through the ceiling of the salt mine.", 0.18),
    ("analogy", "Now, fresh water dissolves salt. So every gallon pouring through that tiny hole ate away the walls, turning a 14-inch puncture into a half-mile-wide whirlpool.", 0.14),
    ("swallow", "It pulled the plug on the whole lake, swallowing the oil rig, 11 barges, a tugboat, and 65 acres of land.", 0.16),
    ("climax", "The suction was so strong it reversed a 12-mile canal, pulling the Gulf of Mexico backward into a 164-foot waterfall, while 400-foot geysers blasted out of the mine shafts.", 0.18),
    ("escape", "Somehow, every single person escaped. All 55 miners rode one elevator out just in time.", 0.14),
    ("twist", "And days later, nine of the eleven sunken barges popped right back up like corks.", 0.25),
]

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.abspath(os.path.join(OUT_DIR, "..", "..", ".piper-voices", "en_US-ryan-medium.onnx"))
PIPER = os.path.abspath(os.path.join(OUT_DIR, "..", "..", ".venv", "bin", "piper"))

SR = 48000
LEAD_IN = 0.06  # voice starts at frame ~2


def synth_line(text: str, tmp_wav: str) -> np.ndarray:
    subprocess.run(
        [PIPER, "-m", MODEL, "--length-scale", "0.86", "--sentence-silence", "0.08", "-f", tmp_wav],
        input=text.encode("utf-8"),
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    tmp_48 = tmp_wav + ".48k.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", tmp_wav, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", tmp_48],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    with wave.open(tmp_48, "rb") as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    os.remove(tmp_wav)
    os.remove(tmp_48)
    # Trim leading/trailing silence
    thr = 0.012
    idx = np.where(np.abs(data) > thr)[0]
    if len(idx) > 0:
        a = max(0, idx[0] - int(0.015 * SR))
        b = min(len(data), idx[-1] + int(0.025 * SR))
        data = data[a:b]
    return data


def main():
    chunks = [np.zeros(int(LEAD_IN * SR), dtype=np.float32)]
    t = LEAD_IN
    beats = []
    words_out = []

    for i, (key, text, gap) in enumerate(LINES):
        tmp = os.path.join(OUT_DIR, f"_tmp_{i}.wav")
        audio = synth_line(text, tmp)
        dur = len(audio) / SR
        start = t
        end = t + dur
        beats.append({"id": key, "start": round(start, 3), "end": round(end, 3), "text": text})

        # Approximate word timings weighted by character length
        words = text.split()
        weights = [max(2, len(w.strip(".,!?"))) for w in words]
        total_w = sum(weights)
        wt = start
        for w, weight in zip(words, weights):
            wd = dur * (weight / total_w)
            words_out.append({"word": w, "start": round(wt, 3), "end": round(wt + wd, 3), "beat": key})
            wt += wd

        chunks.append(audio)
        chunks.append(np.zeros(int(gap * SR), dtype=np.float32))
        t = end + gap

    full = np.concatenate(chunks)
    # Normalize peak to -1 dBFS
    peak = np.max(np.abs(full))
    if peak > 0:
        full = full * (0.89 / peak)

    out_wav = os.path.join(OUT_DIR, "voice.wav")
    pcm = np.clip(full * 32767.0, -32768, 32767).astype(np.int16)
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    meta = {
        "duration": round(len(full) / SR, 3),
        "frames_30fps": int(np.ceil((len(full) / SR) * 30)),
        "beats": beats,
        "words": words_out,
    }
    with open(os.path.join(OUT_DIR, "words.json"), "w") as f:
        json.dump(meta, f, indent=2)

    print(f"Generated voice.wav: {meta['duration']}s ({meta['frames_30fps']} frames @ 30fps)")
    for b in beats:
        print(f"  {b['id']:8s}: {b['start']:6.2f}s -> {b['end']:6.2f}s  (f{int(b['start']*30):4d}..f{int(b['end']*30):4d})")


if __name__ == "__main__":
    main()
