"""Package real engine captures and the usable exported transparent sheets."""
from pathlib import Path
import json,hashlib,zipfile,gc
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/specials/stage3';SPR=ROOT/'public/sprites/goku/specials';OUT=ROOT/'public/previews';QA=ART/'qa'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
m=read(SPR/'manifest.json');font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',16)
board=Image.new('RGB',(384*9,286*len(m['clips'])),'#20303e');d=ImageDraw.Draw(board);unique=set()
for row,(key,c)in enumerate(m['clips'].items()):
 for i in range(c['count']):
  im=Image.open(SPR/f'{key}-{i:02}.png').convert('RGBA');x=i*384;y=row*286;board.paste(im,(x,y+22),im);d.text((x+8,y+3),f'{key} / {i+1} / {c["durations"][i]} ticks',font=font,fill='#ffe0a6');d.line((x,y+246,x+383,y+246),fill='#67aeba');d.line((x+192,y+241,x+192,y+251),fill='#ffc371');crop=im.crop(im.getbbox());unique.add(hashlib.sha256(str(crop.size).encode()+crop.tobytes()).hexdigest())
board.save(OUT/'goku-specials-contact.png');board.close()
trace=read(QA/'trace.json');files=sorted((QA/'recording').glob('[0-9][0-9][0-9][0-9].png'));assert len(files)==len(trace)>200
frames=[Image.open(p).convert('RGBA').resize((640,360),Image.Resampling.NEAREST)for p in files[::2]]
frames[0].save(OUT/'goku-specials-gameplay.png',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=0,blend=0)
palette=Image.new('RGB',(640,360*9))
for n in range(9):palette.paste(frames[round(n*(len(frames)-1)/8)].convert('RGB'),(0,n*360))
palette=palette.quantize(colors=256,dither=Image.Dither.NONE);gif=[im.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)for im in frames]
gif[0].save(OUT/'goku-specials-gameplay.gif',save_all=True,append_images=gif[1:],duration=100,loop=0,disposal=2,optimize=False)
for im in frames+gif:im.close()
del frames,gif;gc.collect()
capture={'source':'real existing Match + Renderer Canvas, ordinary directional InputFrames, fixed 60 Hz','sourceFPS':20,'previewFPS':10,'sourceCaptures':len(files),'previewFrames':len(files[::2]),'previewSize':[640,360],'resize':'exact nearest-neighbor 1/2','silent':True,'scenarios':list(dict.fromkeys(t['scene']for t in trace))};write(OUT/'goku-specials-gameplay.json',capture)
provenance={'tool':'built-in image_gen','reference':'art/goku/rebuild/canonical-reference.png','bodyMethod':'complete original poses, one uniform nearest-neighbor scale per calibration sheet, 32-color palette, binary alpha, integer registration; no limb reconstruction, morphing or body deformation','bodyClips':len(m['clips']),'bodyCelReferences':sum(c['count']for c in m['clips'].values()),'uniqueBodyDrawingsIgnoringTranslation':len(unique),'fxClips':7,'fxDrawings':28,'cell':[384,256],'pivot':[192,224],'rejected':['teleport_air raw source cell 5: disconnected native component; not published'],'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in ART.glob('*-source.png')},'limitations':['AI-assisted whole drawings retain some small facial/hair/fabric differences; professional manual cleanup could refine the transitions.','Kamehameha strengths share body drawings with different timing and independently sized/animated beam layers.','Pose-based hurtboxes use conservative rectangles.','Goku remains local-only; the existing online selection remains Samurai.','SSJ1 transformation is not implemented.']};write(ART/'provenance.json',provenance)
with zipfile.ZipFile(ROOT/'public/downloads/goku-specials.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in SPR.glob('*'):z.write(p,'specials/'+p.name)
 for p in ART.glob('*-contact.png'):z.write(p,'contact/'+p.name)
 for name in ['goku-specials.json','goku-special-moves.json','goku-special-animations.json','goku-special-fx.json']:z.write(ROOT/'src/data'/name,'data/'+name)
 for name in ['prompts.json','fx-prompts.json','production.json','fx-production.json','provenance.json','shared-engine-revisions.json']:z.write(ART/name,'audit/'+name)
 for ext in ['png','gif','json']:z.write(OUT/f'goku-specials-gameplay.{ext}','previews/gameplay.'+ext)
 z.write(OUT/'goku-specials-contact.png','contact/all-clips.png')
print(json.dumps({'art':provenance,'capture':capture}))
