"""Encode captures from the real training arena as animated previews and a storyboard."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

parser = argparse.ArgumentParser()
parser.add_argument("captures", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--fallback", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
order = {
    "colossal_medium": "SALTO COLOSSAL",
    "car_light": "IMPACTO COM CARRO",
    "car_medium": "ARREMESSO DE CARRO",
    "storm_medium": "TEMPESTADE ELETRICA",
    "conductor_medium": "PRISAO ELETRICA",
    "discharge_light": "ESFERA ELETRICA",
    "discharge_medium": "FEIXE ELETRICO",
    "ghostCross_medium": "EMBOSCADA SUBTERRANEA",
    "spectralArms_medium": "CACADA ESPECTRAL",
    "ghostPhase_medium": "PESADELO DE ZS'SKAYR",
    "nightmare-guard": "PESADELO DEFENDIDO",
    "nightmare-evade": "PESADELO FORA DO ALCANCE",
    "thermal_medium": "NRG CONTIDO / FEIXE",
    "nrg-release-flight": "NRG LIBERADO / VOO E FEIXE",
    "nrg-reseal": "NRG / RECONTENCAO",
}
keyframes = {
    "colossal_medium": [11, 28, 46, 66],
    "car_light": [6, 12, 20, 25],
    "car_medium": [10, 24, 31, 44],
    "storm_medium": [24, 33, 45, 57],
    "ghostPhase_medium": [16, 27, "reveal", "attack"],
    "spectralArms_medium": [14, "capture", "attack", 0],
    "conductor_medium": [14, "capture", "attack", 0],
}
jobs = []
for name, title in order.items():
    for path in (args.captures, args.fallback):
        if path and (path / name / "events.json").is_file():
            jobs.append((name, title, path / name))
            break
canvas = Image.new("RGB", (1240, 48 + len(jobs) * 184), "#151923")
draw = ImageDraw.Draw(canvas)
draw.text((18, 16), "BEN 10 OMNIVERSE   /   COMBATE REAL CONTRA SAMURAI", fill="#d3ffd6")
for i, (name, title, source) in enumerate(jobs):
    frames = [Image.open(file).convert("RGB") for file in sorted(source.glob("*.png"))]
    events = json.loads((source / "events.json").read_text(encoding="utf-8"))
    durations = [b["t"] - a["t"] for a, b in zip(events, events[1:])] + [120]
    frames[0].save(args.output / f"{name}.webp", save_all=True, append_images=frames[1:],
                   loop=0, duration=durations, method=4, quality=85)
    positions = []
    for key in keyframes.get(name, []):
        if key == "reveal":
            match = next((j for j, event in enumerate(events) if event["sheet"].endswith("zs-skayr.png")), None)
        elif key in ("capture", "attack"):
            captured = [j for j, event in enumerate(events) if event["capture"]]
            match = captured[len(captured) * (2 if key == "attack" else 0) // 3] if captured else None
        else:
            match = next((j for j, event in enumerate(events) if event["move"] == name and
                          int(event["tick"] or -1) >= key), None)
        if match is not None:
            positions.append(match)
    if len(positions) != 4:
        positions = [round((len(frames) - 1) * t) for t in (.19, .35, .52, .68)]
    y = 48 + i * 184
    draw.rectangle((12, y, 1228, y + 174), fill="#252d3a")
    draw.text((20, y + 5), title, fill="#d3ffd6")
    for j, index in enumerate(positions):
        frame = frames[index].resize((292, 164), Image.Resampling.NEAREST)
        canvas.paste(frame, (20 + j * 302, y + 20))
canvas.save(args.output / "sequencias-arena.png", optimize=True)

