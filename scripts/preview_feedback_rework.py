"""Build Feedback review sheets from the real game renderer."""
from PIL import Image, ImageDraw, ImageFont

from pack_ben_aliens import NEAREST, PREVIEW, ROOT
from pack_ben_stage5_models import BOLD, FONT

SOURCE = ROOT / "test-results/feedback-proof"
PANELS = (
    ("idle", "IDLE · SAMURAI"),
    ("shot-j", "DESCARGA J"),
    ("shot-k", "DESCARGA K"),
    ("shot-power", "DESCARGA K · 50 DE CARGA"),
    ("absorb", "ABSORÇÃO J · KI DE GOKU"),
    ("counter", "CONTRA-ATAQUE K · SAMURAI"),
    ("horizontal", "CHICOTE HORIZONTAL J"),
    ("upper", "CHICOTE ANTIAÉREO K"),
    ("basic", "COMBO · J → K → DESCARGA J"),
    ("aerial", "COMBO AÉREO · CHICOTE K"),
    ("mirrored", "IDLE ESPELHADO · SAMURAI"),
)


def shot(key):
    return Image.open(SOURCE / f"{key}.png").convert("RGB")


def action_board():
    image = Image.new("RGB", (1312, 964), "#0e181d")
    draw = ImageDraw.Draw(image)
    draw.text((18, 16), "FEEDBACK / TREINAMENTO", font=ImageFont.truetype(BOLD, 25), fill="#c7ef91")
    label = ImageFont.truetype(FONT, 15)
    for i, (key, name) in enumerate(PANELS):
        x, y = 16 + i % 3 * 432, 52 + i // 3 * 225
        draw.rectangle((x, y, x + 415, y + 214), fill="#1b2b32")
        draw.text((x + 6, y + 5), name, font=label, fill="#ebf3da")
        frame = shot(key)
        if key == "mirrored":
            crop = (412, 317, 990, 581)
        elif key == "aerial":
            crop = (285, 263, 863, 527)
        else:
            crop = (360, 317, 938, 581)
        image.paste(frame.crop(crop).resize((410, 187), NEAREST), (x + 3, y + 24))
        if key in ("absorb", "shot-power", "horizontal"):
            hud = frame.crop((49, 110, 350, 218)).resize((195, 70), NEAREST)
            image.paste(hud, (x + 5, y + 25))
    image.save(PREVIEW / "feedback-rework.png", optimize=True)


def cable_board():
    image = Image.new("RGB", (1180, 555), "#0e181d")
    draw = ImageDraw.Draw(image)
    draw.text((18, 12), "FEEDBACK / CHICOTES COM EFEITOS DESLIGADOS",
              font=ImageFont.truetype(BOLD, 23), fill="#c7ef91")
    label = ImageFont.truetype(FONT, 15)
    phases = ("PREPARAÇÃO", "EXTENSÃO", "ATAQUE", "RECUPERAÇÃO")
    for row, (key, route) in enumerate((("horizontal", "J · HORIZONTAL"), ("upper", "K · ANTIAÉREO"))):
        y = 50 + row * 247
        draw.text((18, y), route, font=label, fill="#c7ef91")
        for i, phase in enumerate(phases):
            x = 16 + i * 290
            draw.text((x, y + 23), phase, font=label, fill="#ebf3da")
            frame = shot(f"{key}-{i}").crop((359, 312, 697, 585))
            image.paste(frame.resize((250, 197), NEAREST), (x, y + 43))
    image.save(PREVIEW / "feedback-chicotes.png", optimize=True)


def videos():
    for key in ("walk", "combo", "air-combo"):
        frames = [Image.open(file).convert("RGB") for file in sorted(SOURCE.glob(f"video-{key}-*.webp"))]
        assert len(frames) > 6, key
        frames[0].save(PREVIEW / f"feedback-{key}.webp", save_all=True, append_images=frames[1:],
                       duration=[50] * (len(frames) - 1) + [350], loop=0, quality=89, method=4)


if __name__ == "__main__":
    action_board()
    cable_board()
    videos()
