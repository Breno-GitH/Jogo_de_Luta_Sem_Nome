"""Build native motion contact sheets and a montage of the real browser captures."""
import json

from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import ROOT, PREVIEW, PIVOT, SIZE, NEAREST

FONT = "C:/Windows/Fonts/consola.ttf"
BOLD = "C:/Windows/Fonts/consolab.ttf"
LABEL = ImageFont.truetype(FONT, 14)
TITLE = ImageFont.truetype(BOLD, 25)
INK = "#e8f3ec"
LIME = "#b7f86e"
PANEL = "#172530"
DARK = "#101920"
FORMS = {"xlr8": "XLR8", "fourArms": "QUATRO BRAÇOS", "heatblast": "CHAMA"}
ACTIONS = [
    ("idle", "POSTURA"), ("walkForward", "AVANÇO"), ("walkBack", "RECUO"),
    ("dashForward", "DASH"), ("backdash", "BACKDASH"), ("crouchStart", "AGACHAR"),
    ("crouchIdle", "AGACHADO"), ("crouchEnd", "LEVANTAR"), ("jumpStart", "PREPARAR SALTO"),
    ("jumpRise", "SUBIDA"), ("jumpApex", "ÁPICE"), ("jumpFall", "QUEDA"),
    ("landing", "POUSO"),
]


def motion():
    manifests = json.loads((ROOT / "src/data/ben-alien-art.json").read_text("utf-8"))
    for id, title in FORMS.items():
        rows = manifests[id]["clips"]
        row_h = 196
        proof = Image.new("RGB", (1308, 59 + row_h * len(ACTIONS)), DARK)
        draw = ImageDraw.Draw(proof)
        draw.text((18, 15), f"{title} / QUADROS DE MOVIMENTO", font=TITLE, fill=LIME)
        for i, (key, label) in enumerate(ACTIONS):
            clip = rows[key]
            sheet = Image.open(ROOT / "public/sprites" / clip["sheet"]).convert("RGBA")
            y = 52 + i * row_h
            draw.rectangle((12, y, 1294, y + row_h - 7), fill=PANEL)
            draw.text((24, y + 13), f"{label} · {len(clip['frames'])}", font=LABEL, fill=LIME)
            draw.line((24, y + row_h - 20, 1284, y + row_h - 20), fill="#3c5559")
            for j, frame in enumerate(clip["frames"]):
                col, row = frame % clip["columns"], frame // clip["columns"]
                cel = sheet.crop((col * SIZE, row * SIZE, (col + 1) * SIZE, (row + 1) * SIZE))
                bounds = cel.getbbox()
                assert bounds is not None and bounds[3] == PIVOT[1]
                assert bounds[0] > 0 and bounds[2] < SIZE and bounds[1] > 0, (id, key, bounds)
                x = 260 + j * 181
                proof.paste(cel, (x - PIVOT[0], y + row_h - 20 - PIVOT[1]), cel)
                draw.text((x, y + row_h - 18), f"{j + 1:02}", anchor="mt", font=LABEL, fill=INK)
        proof.save(PREVIEW / f"movimento-{id}.png")


def arena():
    source = ROOT / "test-results/ben-forms"
    if not (source / "espelho-heatblast.png").exists():
        return
    proof = Image.new("RGB", (1346, 871), DARK)
    draw = ImageDraw.Draw(proof)
    draw.text((18, 16), "OMNITRIX / TROCAS E ORIENTAÇÃO NA ARENA", font=TITLE, fill=LIME)
    previous = "BEN"
    for row, (id, name) in enumerate(FORMS.items()):
        y = 56 + 268 * row
        for col, (key, heading) in enumerate([
            ("troca", f"{previous} → {name}"), ("arena", f"{name} → DIREITA"), ("espelho", f"{name} → ESQUERDA"),
        ]):
            x = 17 + col * 442
            shot = Image.open(source / f"{key}-{id}.png").convert("RGB")
            draw.rectangle((x, y, x + 429, y + 253), fill=PANEL)
            draw.text((x + 8, y + 6), heading, font=LABEL, fill=INK)
            proof.paste(shot.resize((420, 236), NEAREST), (x + 5, y + 22))
        previous = name
    proof.save(PREVIEW / "arena-etapa-3.png")


if __name__ == "__main__":
    motion()
    arena()

