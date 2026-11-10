"""Compose Stage 5 previews from frames captured by the real renderer."""
from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import NEAREST, PREVIEW, ROOT
from pack_ben_stage5_models import BOLD, FONT

SOURCE = ROOT / "test-results/ben-stage5"
PANELS = [
    ("spikes", "DIAMANTE · ESPINHOS K"), ("wall", "DIAMANTE · MURALHA K"),
    ("shards", "DIAMANTE · FRAGMENTOS K"),
    ("colossal", "ENORMOSSAURO · INVESTIDA K"), ("normal", "ENORMOSSAURO · ESCALA NORMAL"),
    ("growth", "ENORMOSSAURO · CRESCIMENTO K"),
    ("discharge", "FEEDBACK · DESCARGA K"), ("absorb", "FEEDBACK · ABSORÇÃO DE KI"),
    ("cables", "FEEDBACK · CABOS K"),
    ("combo-diamondhead", "DIAMANTE · J → K → ESPINHOS J"),
    ("combo-humungousaur", "ENORMOSSAURO · J → K → INVESTIDA J"),
    ("combo-feedback", "FEEDBACK · J → K → DESCARGA J"),
    ("tail", "ENORMOSSAURO · CAUDA K"),
    ("charged", "FEEDBACK · DESCARGA COM CARGA"),
    ("swap", "DIAMANTE → XLR8 · TROCA CONFIRMADA"),
]

if __name__ == "__main__":
    title = ImageFont.truetype(BOLD, 25)
    label = ImageFont.truetype(FONT, 15)
    image = Image.new("RGB", (1340, 1278), "#101820")
    draw = ImageDraw.Draw(image)
    draw.text((20, 18), "OMNITRIX / MECÂNICAS DA ETAPA 5", font=title, fill="#b7f86e")
    for i, (key, name) in enumerate(PANELS):
        x, y = 16 + i % 3 * 440, 57 + i // 3 * 242
        draw.rectangle((x, y, x + 427, y + 234), fill="#1b2932")
        draw.text((x + 7, y + 5), name, font=label, fill="#e0eee6")
        full = Image.open(SOURCE / f"{key}.png").convert("RGB")
        shot = full.crop((345, 315, 975, 630)).resize((420, 210), NEAREST)
        image.paste(shot, (x + 4, y + 23))
        if key in ("absorb", "charged"):
            dial = full.crop((49, 133, 340, 218)).resize((202, 59), NEAREST)
            image.paste(dial, (x + 6, y + 25))
    PREVIEW.mkdir(exist_ok=True, parents=True)
    image.save(PREVIEW / "combate-etapa-5.png")
    for key in ("diamondhead", "humungousaur", "feedback", "swap"):
        frames = [Image.open(path).convert("RGB") for path in sorted(SOURCE.glob(f"video-{key}-*.webp"))]
        assert len(frames) > 5, key
        frames[0].save(PREVIEW / f"combo-{key}-etapa-5.webp", save_all=True,
                       append_images=frames[1:], duration=[50] * (len(frames) - 1) + [300],
                       loop=0, quality=87, method=4)

