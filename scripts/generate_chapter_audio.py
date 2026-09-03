#!/usr/bin/env python3
"""Generate the original, deterministic chapter ambience and music loops.

The game deliberately ships these small PCM WAV files instead of downloading
audio at runtime. Re-running this script with Python 3 reproduces every file.
"""

from __future__ import annotations

import math
import random
import hashlib
import json
import struct
import wave
from pathlib import Path


SAMPLE_RATE = 16_000
DURATION_SECONDS = 12
FRAME_COUNT = SAMPLE_RATE * DURATION_SECONDS
TAU = math.tau
ROOT = Path(__file__).resolve().parents[1] / "public" / "assets" / "chapters"


CHAPTERS = [
    # root MIDI, tempo, ambience profile
    (48, 62, "dawn-room"),
    (50, 58, "paper-room"),
    (45, 72, "three-receivers"),
    (47, 54, "rain-window"),
    (52, 76, "memorial-lights"),
    (50, 64, "hill-wind"),
    (55, 60, "qsl-desk"),
    (43, 56, "blackout-net"),
    (45, 68, "relay-grid"),
    (52, 92, "contest-room"),
    (47, 48, "silent-watch"),
    (43, 58, "coastal-storm"),
    (50, 52, "night-windows"),
    (45, 50, "old-log"),
    (48, 66, "sunrise-room"),
]

MELODIES = [
    (0, 4, 7, 4, 2, 4, 9, 7, 0, 4, 7, 11, 9, 7, 4, 2),
    (0, 2, 5, 7, 5, 2, 0, -3, 0, 2, 7, 5, 2, 0, -3, -5),
    (0, 7, 3, 10, 5, 12, 7, 3, 0, 3, 7, 10, 12, 10, 7, 5),
    (0, 3, 7, 5, 3, 0, -2, 0, 0, 5, 7, 10, 7, 5, 3, 0),
    (0, 4, 7, 12, 11, 9, 7, 4, 0, 7, 9, 12, 9, 7, 4, 2),
    (0, 2, 7, 9, 7, 4, 2, 0, -3, 0, 4, 7, 9, 7, 4, 2),
    (0, 5, 9, 7, 4, 2, 4, 0, 0, 4, 7, 9, 12, 9, 7, 4),
    (0, 3, 5, 10, 7, 5, 3, 0, -2, 0, 3, 7, 5, 3, 0, -2),
    (0, 7, 10, 7, 3, 5, 7, 3, 0, 3, 7, 12, 10, 7, 5, 3),
    (0, 4, 7, 9, 12, 9, 7, 4, 2, 5, 9, 14, 12, 9, 7, 5),
    (0, 3, 7, 3, 0, -2, 0, 3, 0, 5, 7, 5, 3, 0, -2, -5),
    (0, 3, 7, 10, 7, 5, 3, -2, 0, 5, 10, 12, 10, 7, 5, 3),
    (0, 4, 9, 7, 4, 2, 0, 2, 4, 7, 11, 9, 7, 4, 2, 0),
    (0, 3, 7, 10, 12, 10, 7, 3, 0, -2, 0, 3, 7, 5, 3, 0),
    (0, 4, 7, 11, 12, 9, 7, 4, 2, 4, 9, 12, 11, 9, 7, 4),
]


def midi_frequency(note: int) -> float:
    return 440.0 * (2.0 ** ((note - 69) / 12.0))


def soft_triangle(phase: float) -> float:
    return 2.0 * abs(2.0 * (phase - math.floor(phase + 0.5))) - 1.0


def fade_loop(samples: list[float], fade_seconds: float = 0.16) -> None:
    fade_frames = int(SAMPLE_RATE * fade_seconds)
    for index in range(fade_frames):
        gain = math.sin((index / fade_frames) * math.pi / 2.0) ** 2
        samples[index] *= gain
        samples[-1 - index] *= gain


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    peak = max(0.001, max(abs(value) for value in samples))
    scale = min(1.0, 0.88 / peak) * 32767
    frames = b"".join(struct.pack("<h", round(max(-1.0, min(1.0, value)) * scale)) for value in samples)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(frames)


def add_tone(samples: list[float], start: float, length: float, frequency: float, amplitude: float, wobble: float = 0.0) -> None:
    first = max(0, int(start * SAMPLE_RATE))
    last = min(FRAME_COUNT, int((start + length) * SAMPLE_RATE))
    span = max(1, last - first)
    for index in range(first, last):
        position = (index - first) / span
        envelope = math.sin(math.pi * position) ** 2
        time = index / SAMPLE_RATE
        phase = TAU * frequency * time + wobble * math.sin(TAU * 0.35 * time)
        samples[index] += amplitude * envelope * math.sin(phase)


def generate_music(chapter: int, root_note: int, bpm: int) -> list[float]:
    samples = [0.0] * FRAME_COUNT
    melody = MELODIES[chapter - 1]
    beat = 60.0 / bpm
    phrase = DURATION_SECONDS / len(melody)
    chord_steps = (0, 5, 3, 7)

    for index in range(FRAME_COUNT):
        time = index / SAMPLE_RATE
        chord_index = min(3, int(time / (DURATION_SECONDS / 4)))
        chord_root = root_note + chord_steps[chord_index]
        pad = 0.0
        for interval, weight in ((0, 0.55), (7, 0.32), (12, 0.18)):
            frequency = midi_frequency(chord_root + interval - 12)
            pad += weight * math.sin(TAU * frequency * time + 0.08 * math.sin(TAU * 0.11 * time))
        pulse = soft_triangle(midi_frequency(root_note - 24) * time)
        samples[index] = 0.082 * pad + 0.025 * pulse

    for step, interval in enumerate(melody):
        start = step * phrase
        length = min(phrase * 0.82, beat * 0.9)
        frequency = midi_frequency(root_note + 12 + interval)
        first = int(start * SAMPLE_RATE)
        last = min(FRAME_COUNT, int((start + length) * SAMPLE_RATE))
        for index in range(first, last):
            position = (index - first) / max(1, last - first)
            envelope = min(1.0, position / 0.08) * ((1.0 - position) ** 1.8)
            time = index / SAMPLE_RATE
            voice = 0.7 * soft_triangle(frequency * time) + 0.3 * math.sin(TAU * frequency * 2 * time)
            samples[index] += 0.075 * envelope * voice

    fade_loop(samples)
    return samples


def generate_ambience(chapter: int, profile: str) -> list[float]:
    rng = random.Random(0xC0DE + chapter * 8191)
    samples = [0.0] * FRAME_COUNT
    low = 0.0
    medium = 0.0
    profile_gain = 0.24 if profile == "silent-watch" else 1.0
    rain = profile in {"rain-window", "coastal-storm"}
    wind = profile in {"hill-wind", "coastal-storm", "night-windows"}
    electrical = profile in {"three-receivers", "memorial-lights", "blackout-net", "relay-grid", "contest-room"}

    for index in range(FRAME_COUNT):
        time = index / SAMPLE_RATE
        white = rng.uniform(-1.0, 1.0)
        low += 0.0017 * (white - low)
        medium += 0.035 * (white - medium)
        room = 0.018 * medium + 0.014 * math.sin(TAU * 50 * time) + 0.006 * math.sin(TAU * 100 * time)
        value = room
        if rain:
            value += (0.065 if profile == "coastal-storm" else 0.04) * (white - medium)
        if wind:
            gust = 0.45 + 0.35 * math.sin(TAU * 0.09 * time + chapter) + 0.2 * math.sin(TAU * 0.17 * time)
            value += (0.14 if profile == "coastal-storm" else 0.065) * low * max(0.1, gust)
        if electrical:
            value += 0.008 * math.sin(TAU * (92 + chapter * 3) * time)
        samples[index] = value * profile_gain

    events: dict[str, list[tuple[float, float, float, float]]] = {
        "dawn-room": [(1.1, .24, 1800, .055), (5.0, .18, 2250, .045), (9.0, .25, 1950, .05)],
        "paper-room": [(2.0, .34, 210, .025), (7.1, .42, 260, .024)],
        "three-receivers": [(1.0, .18, 390, .045), (4.1, .22, 470, .045), (7.3, .2, 545, .045), (10.2, .16, 430, .04)],
        "rain-window": [(3.0, .3, 410, .03), (8.0, .22, 360, .025)],
        "memorial-lights": [(1.2, .3, 330, .03), (4.0, .3, 390, .03), (7.0, .3, 450, .03), (10.0, .3, 510, .03)],
        "hill-wind": [(2.5, .12, 1250, .025), (8.3, .15, 1480, .022)],
        "qsl-desk": [(2.2, .34, 190, .028), (6.1, .25, 235, .025), (9.7, .3, 205, .025)],
        "blackout-net": [(1.6, .16, 310, .035), (5.0, .16, 310, .035), (8.4, .16, 310, .035)],
        "relay-grid": [(1.0, .12, 360, .035), (3.0, .12, 420, .035), (5.0, .12, 480, .035), (7.0, .12, 420, .035), (9.0, .12, 360, .035)],
        "contest-room": [(0.8 + i * 1.3, .09, 300 + (i % 4) * 55, .03) for i in range(9)],
        "silent-watch": [(3.0, .15, 270, .012), (9.0, .15, 270, .012)],
        "coastal-storm": [(2.0, .7, 58, .11), (8.0, .9, 51, .13)],
        "night-windows": [(1.2 + i * .24, .08, 2200 + i * 45, .022) for i in range(7)] + [(7.5 + i * .22, .08, 2350 + i * 40, .02) for i in range(8)],
        "old-log": [(3.2, .4, 170, .024), (8.6, .3, 195, .022)],
        "sunrise-room": [(1.0, .22, 1700, .05), (4.5, .18, 2050, .04), (8.2, .24, 2300, .045), (10.4, .18, 1900, .04)],
    }
    for event in events[profile]:
        add_tone(samples, *event, wobble=0.6 if event[2] > 1000 else 0.15)

    fade_loop(samples)
    return samples


def main() -> None:
    for chapter, (root_note, bpm, profile) in enumerate(CHAPTERS, start=1):
        chapter_dir = ROOT / f"{chapter:02d}"
        write_wav(chapter_dir / "ambience.wav", generate_ambience(chapter, profile))
        write_wav(chapter_dir / "music.wav", generate_music(chapter, root_note, bpm))
        print(f"chapter {chapter:02d}: {profile}, {bpm} BPM")

    manifest = {
        "schemaVersion": 1,
        "visualProvenance": "Original AI-assisted artwork generated for CWGame",
        "audioProvenance": "Original deterministic synthesis from scripts/generate_chapter_audio.py",
        "audioFormat": {"codec": "PCM", "channels": 1, "sampleRate": SAMPLE_RATE, "bitsPerSample": 16, "durationSeconds": DURATION_SECONDS},
        "chapters": [],
    }
    for chapter in range(1, 16):
        assets = {}
        for kind, filename in (
            ("scene", "scene.png"), ("portrait", "portrait.png"),
            ("illustration", "illustration.png"), ("ambience", "ambience.wav"), ("music", "music.wav"),
        ):
            path = ROOT / f"{chapter:02d}" / filename
            content = path.read_bytes()
            assets[kind] = {
                "path": f"./assets/chapters/{chapter:02d}/{filename}",
                "bytes": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        manifest["chapters"].append({"chapter": chapter, "assets": assets})
    (ROOT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
