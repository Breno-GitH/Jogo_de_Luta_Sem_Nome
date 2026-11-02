"""Package actual exported sprites and Match/Renderer captures, not mockups."""
from pathlib import Path
import json,hashlib,zipfile,gc
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];ART=ROOT/'art/goku/combat';OUT=ROOT/'public/previews';SPR=ROOT/'public/sprites/goku/combat';QA=ART/'qa'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,v):p.write_text(json.dumps(v,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',18);small=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',14)
manifest=read(SPR/'manifest.json');normals=[k for k,v in manifest['clips'].items()if v['kind']=='normal']
for label,keys in [('contact',normals),('secondary-contact',[k for k in manifest['clips']if k not in normals])]:
 board=Image.new('RGB',(384*8,286*len(keys)),'#20303e');d=ImageDraw.Draw(board)
 for row,key in enumerate(keys):
  c=manifest['clips'][key]
  for i in range(c['count']):
   im=Image.open(SPR/f'{key}-{i:02}.png').convert('RGBA');x=i*384;y=row*286
   board.paste(im,(x,y+22),im);d.text((x+7,y+3),f'{key} / {i+1} / {c["durations"][i]} ticks',font=small,fill='#ffe0a6')
   d.line((x,y+246,x+383,y+246),fill='#67aeba');d.line((x+192,y+241,x+192,y+251),fill='#ffc371')
 board.save(OUT/f'goku-combat-{label}.png');board.close()
hero=Image.new('RGB',(1440,1200),'#20303e');d=ImageDraw.Draw(hero)
for n,key in enumerate(normals):
 c=manifest['clips'][key];i=next(i for i,p in enumerate(c['poses'])if p['phase']=='active');im=Image.open(SPR/f'{key}-{i:02}.png').convert('RGBA')
 b=im.getbbox();im=im.crop((b[0]-8,b[1]-8,b[2]+8,b[3]+8));im=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST)
 x=n%3*480;y=n//3*400;hero.paste(im,(x+(480-im.width)//2,y+330-im.height),im)
 d.text((x+20,y+18),key,font=font,fill='#ffbf69');d.text((x+20,y+355),f'{c["count"]} desenhos / {sum(c["durations"])} ticks',font=font,fill='#bad5df')
hero.save(OUT/'goku-combat-overview.png');hero.close()

trace=read(QA/'combat-trace.json');files=sorted((QA/'recording').glob('[0-9][0-9][0-9][0-9].png'));assert len(files)==len(trace)>100
# 20 FPS screenshots reduced by exact nearest-neighbor to a 10 FPS overview.
# Every original 1280x720 capture remains in qa/recording for close inspection.
indices=list(range(0,len(files),2));frames=[Image.open(files[i]).convert('RGBA').resize((640,360),Image.Resampling.NEAREST)for i in indices]
frames[0].save(OUT/'goku-combat-gameplay.png',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=0,blend=0)
paletteboard=Image.new('RGB',(640,360*9))
for n in range(9):paletteboard.paste(frames[round(n*(len(frames)-1)/8)].convert('RGB'),(0,n*360))
pal=paletteboard.quantize(colors=256,dither=Image.Dither.NONE)
gifs=[im.convert('RGB').quantize(palette=pal,dither=Image.Dither.NONE)for im in frames]
gifs[0].save(OUT/'goku-combat-gameplay.gif',save_all=True,append_images=gifs[1:],duration=100,loop=0,disposal=2,optimize=False)
for im in frames+gifs:im.close()
del frames,gifs;gc.collect()
report={'source':'real existing Match + Renderer canvas, fixed 60 Hz, scripted ordinary InputFrames','sourceFPS':20,'previewFPS':10,'sourceCaptures':len(files),'apngFrames':len(indices),'previewSize':[640,360],'resize':'exact nearest-neighbor 1/2','scenarios':list(dict.fromkeys(t['scene']for t in trace)),'silent':True}
write(OUT/'goku-combat-gameplay.json',report)
provenance={'tool':'built-in image_gen with approved whole-pose Goku reference','reference':'art/goku/rebuild/canonical-reference.png','import':'whole-figure source rectangle, one uniform nearest-neighbor scale per calibration sheet, 32-color palette, binary alpha, integer registration; explicit isolated-noise cleanup recorded below','forbiddenOperationsUsed':[],'clips':len(manifest['clips']),'celReferences':sum(c['count']for c in manifest['clips'].values()),'canvas':[384,256],'pivot':[192,224],'sourceFiles':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in ART.glob('*-source.png')},'limits':['AI-assisted whole-pose drawings retain small hair/face/cloth differences; not a claim of professional manual frame polish.','Pose-derived rectangular hurtbox bands are conservative; striking capsules follow real fists, shins and boots.','Goku is available in local modes; existing online protocol still supports Samurai only.','Goku specials and Super are not implemented in this stage.']}
write(ART/'provenance.json',provenance)
provenance['nativeCleanup']='Eight explicitly reviewed isolated dark noise pixels in stand_heavy only; every removed coordinate/color is recorded, checked to be disconnected from anatomy and independently reconstructed in tests.'
unique=set()
for key,c in manifest['clips'].items():
 for i in range(c['count']):
  im=Image.open(SPR/f'{key}-{i:02}.png').convert('RGBA');crop=im.crop(im.getbbox());unique.add(hashlib.sha256(str(crop.size).encode()+crop.tobytes()).hexdigest())
provenance['uniqueDrawingsIgnoringTranslation']=len(unique)
write(ART/'provenance.json',provenance)
with zipfile.ZipFile(ROOT/'public/downloads/goku-combat.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in SPR.glob('*'):z.write(p,'combat/'+p.name)
 for p in ART.glob('*-contact.png'):z.write(p,'contact/'+p.name)
 for p in ART.glob('prompts-*.json'):z.write(p,'audit/'+p.name)
 for name in ['sources.json','secondary-config.json','provenance.json','shared-engine-revisions.json']:z.write(ART/name,'audit/'+name)
 for name in ['goku-combat-animations.json','goku-normals.json','goku-combat.json']:z.write(ROOT/'src/data'/name,'data/'+name)
 for p in ART.glob('*-production.json'):z.write(p,'audit/production/'+p.name)
 for name in ['goku-combat-contact.png','goku-combat-secondary-contact.png','goku-combat-overview.png','goku-combat-gameplay.gif','goku-combat-gameplay.json']:z.write(OUT/name,'previews/'+name)
print(json.dumps({'art':provenance['celReferences'],'preview':report}))
