"""Compose the native-engine combat captures into the requested proof."""
from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import ROOT, PREVIEW, NEAREST

SOURCE = ROOT / "test-results/ben-combat"
ENTRIES = [
    ("turbo", "XLR8 · TURBO RUSH K"), ("ciclone", "XLR8 · CICLONE K"),
    ("combo-xlr8", "XLR8 · J → K → TURBO J"),
    ("quadruplo", "QUATRO BRAÇOS · AGARRÃO QUÁDRUPLO K"),
    ("sismica", "QUATRO BRAÇOS · PALMA SÍSMICA K"),
    ("combo-fourArms", "QUATRO BRAÇOS · J → K → INVESTIDA J"),
    ("bola", "CHAMA · BOLA DE FOGO K"), ("pilar", "CHAMA · PILAR DE CHAMAS K"),
    ("propulsao", "CHAMA · PROPULSÃO K"),
    ("combo-heatblast", "CHAMA · J → K → BOLA DE FOGO J"),
    ("troca", "XLR8 → QUATRO BRAÇOS · TROCA EM COMBO"),
]

if __name__ == "__main__":
    art = Image.new("RGB", (1340, 1104), "#101820")
    draw = ImageDraw.Draw(art)
    title = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 26)
    label = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 15)
    draw.text((20, 16), "OMNITRIX / COMBATE NA ARENA", font=title, fill="#b7f86e")
    for i, (key, name) in enumerate(ENTRIES):
        x, y = 16 + i % 3 * 440, 55 + i // 3 * 258
        draw.rectangle((x, y, x+427, y+250), fill="#1b2932")
        draw.text((x+8, y+4), name, font=label, fill="#e0eee6")
        shot = Image.open(SOURCE / (key + ".png")).convert("RGB")
        action = shot.crop((340, 322, 950, 653))
        art.paste(action.resize((420, 228), NEAREST), (x+4, y+22))
    x, y = 16 + 2 * 440, 55 + 3 * 258
    draw.rectangle((x, y, x+427, y+250), fill="#1b2932")
    draw.text((x+8, y+4), "TRÊS ESTILOS · MESMA ESCALA", font=label, fill="#e0eee6")
    draw.line((x+12, y+211, x+415, y+211), fill="#41515d")
    for column, (form, move, cel, style) in enumerate([
        ("xlr8", "turbo", 1, "VELOCIDADE"),
        ("fourArms", "quad", 1, "CAPTURA"),
        ("heatblast", "fireball", 2, "CONTROLE"),
    ]):
        sheet = Image.open(ROOT / f"public/sprites/ben/{form}/combat/{move}.png")
        pose = sheet.crop((cel * 352, 0, (cel + 1) * 352, 224))
        pose = pose.crop(pose.getbbox())
        center = x + 71 + 142 * column
        art.paste(pose, (center - pose.width//2, y+211-pose.height), pose)
        draw.text((center, y+225), style, font=label, anchor="mt", fill="#b7f86e")
    PREVIEW.mkdir(exist_ok=True, parents=True)
    art.save(PREVIEW / "combate-etapa-4.png")
    for key in ["xlr8", "fourArms", "heatblast", "troca"]:
        frames = [Image.open(path).convert("RGB").resize((800, 450), NEAREST)
                  for path in sorted(SOURCE.glob(f"video-{key}-*.webp"))]
        assert len(frames) > 8, key
        frames[0].save(PREVIEW / f"combo-{key}-etapa-4.webp", save_all=True,
                       append_images=frames[1:], duration=[50] * (len(frames)-1) + [360],
                       loop=0, quality=86, method=4)

