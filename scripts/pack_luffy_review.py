from pathlib import Path
from argparse import ArgumentParser
from PIL import Image, ImageDraw

parser = ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--polish', action='store_true')
args = parser.parse_args()

root = Path.cwd()
out = root / 'public/sprites/luffy'
out.mkdir(parents=True, exist_ok=True)
source = Image.open(args.source).convert('RGBA')
alpha = source.getchannel('A').point(lambda value: 255 if value >= 128 else 0)
source.putalpha(alpha)
body = source.crop(alpha.getbbox())
body = body.resize((round(body.width * 130 / body.height), 130), Image.Resampling.NEAREST)
sprite = Image.new('RGBA', (256, 256))
sprite.alpha_composite(body, ((256-body.width)//2,94))
assert sprite.getbbox()[1::2] == (94,224)
assert set(sprite.getchannel('A').tobytes()) == {0,255}
new = out / ('base-polished.png' if args.polish else 'base-review.png')
sprite.save(new)

def lineup(items, path):
    panel = Image.new('RGBA',(len(items)*145,156),'#202d39')
    draw = ImageDraw.Draw(panel)
    draw.line((0,132,panel.width-1,132),fill='#70cbbd')
    for i,(label,sprite_path) in enumerate(items):
        cell = Image.open(sprite_path).convert('RGBA')
        x = (cell.width-145)//2
        pivot_y = 224
        if cell.height != 256:
            raise ValueError(sprite_path)
        panel.alpha_composite(cell.crop((x,pivot_y-132,x+145,pivot_y)), (i*145,0))
        draw.text((i*145+8,139),label,fill='#f7e4cb')
    panel.resize((panel.width*3,panel.height*3), Image.Resampling.NEAREST).save(path)

if args.polish:
    lineup([('Luffy - anterior',out/'base-review.png'),('Luffy - corrigido',new)],
           out/'before-after-polish.png')
    lineup([('Samurai',out.parent/'samurai/base.png'),('Dio',out.parent/'dio/base.png'),
            ('Goku',out.parent/'goku/base.png'),('Luffy - corrigido',new)],
           out/'lineup-polished.png')
    raise SystemExit(0)

lineup([('Samurai',out.parent/'samurai/base.png'),('Dio',out.parent/'dio/base.png'),
        ('Goku',out.parent/'goku/base.png'),('Luffy - novo',new)],out/'lineup-review.png')
lineup([('Luffy - descartado',root/'deployment/archive/luffy-rejected/sprites/base.png'),
        ('Luffy - novo',new)],root/'deployment/archive/luffy-rejected/comparacao.png')
lineup([('Luffy - novo',new)],out/'preview-review.png')

