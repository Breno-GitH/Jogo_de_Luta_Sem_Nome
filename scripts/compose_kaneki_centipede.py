"""Compose stage captures and the supplied rejected version for comparison."""
from pathlib import Path
from sys import argv

from PIL import Image, ImageDraw, ImageFont
from pack_kaneki_combat import ROOT, grid

captures = Path(argv[1])
output = ROOT / "public/previews/kaneki"
background = "#17151e"
label = "#f4cebd"
nn = Image.Resampling.NEAREST

def font(size):
    try:
        return ImageFont.truetype("consolab.ttf", size)
    except OSError:
        return ImageFont.load_default(size=size)

def heading(img, xy, text, size=21):
    ImageDraw.Draw(img).text(xy, text, fill=label, font=font(size))

shots = [
    (16, "01 · Despertar"),
    (58, "02 · Kakuja desenvolvida"),
    (82, "03 · Primeira investida"),
    (143, "04 · Ataque em zigue-zague"),
    (226, "05 · Apoio na parede"),
    (275, "06 · Captura dupla"),
    (313, "07 · Ascensão"),
    (336, "08 · Preparação do Crash"),
    (354, "09 · Descida"),
    (367, "10 · Centipede Crash"),
    (411, "11 · Pose final"),
    (549, "12 · Retorno à forma base"),
]
phases = Image.new("RGB", (1884, 1660), background)
heading(phases, (22, 18), "CENTIPEDE · FRENESI DA KAKUJA", 26)
for i, (tick, title) in enumerate(shots):
    x, y = 20 + (i % 3) * 624, 64 + (i // 3) * 396
    arena = Image.open(captures / f"{tick}.png").convert("RGB")
    phases.paste(arena.resize((608,342),nn), (x,y+36))
    heading(phases,(x,y),title)
phases.save(output / "centipede-fases.png", optimize=True)

old_sheet = Image.open(ROOT / "art/kaneki-centipede-source/comparacao-rejeitada.png").convert("RGBA")
old = grid(old_sheet,5,3,2)
bounds = old.getchannel("A").point(lambda a: 255 if a >= 190 else 0).getbbox()
if bounds:
    old = old.crop(bounds)
old = old.resize((round(old.width*114/old.height),114),nn)
comparison = Image.new("RGB",(1150,500),background)
heading(comparison,(20,18),"KAKUJA INCOMPLETA · ANTES E DEPOIS",26)
heading(comparison,(20,65),"A · Referência rejeitada")
heading(comparison,(367,65),"B · Transformação no jogo")
left = Image.new("RGB",(326,365),"#302735")
ImageDraw.Draw(left).line((0,338,326,338),fill="#7a6e6d",width=2)
left.paste(old,((326-old.width)//2,338-old.height),old)
comparison.paste(left,(20,100))
new = Image.open(captures / "58.png").convert("RGB")
comparison.paste(new.crop((225,217,986,582)),(367,100))
comparison.save(output / "centipede-comparacao.png", optimize=True)

