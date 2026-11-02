"""Package usable sprites and a recording of the real Match/Renderer."""
from goku_fury_art import *
import zipfile,gc
from PIL import ImageFont
QA=ART/'qa';PRE=ROOT/'public/previews';PRE.mkdir(exist_ok=True);m=read(OUT/'manifest.json')['clips'];font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',14)
rows=sum(math.ceil(c['count']/6)for c in m.values());board=Image.new('RGB',(2304,280*rows),'#20303e');d=ImageDraw.Draw(board);row=0;unique=set()
for key,c in m.items():
 for i in range(c['count']):
  im=Image.open(OUT/f'{key}-{i:02}.png').convert('RGBA');x=i%6*384;y=(row+i//6)*280;board.paste(im,(x,y+18),im);d.text((x+4,y+2),f'{key} / {i+1} / {c["durations"][i]} ticks',font=font,fill='#ffe29a');d.line((x,y+242,x+383,y+242),fill='#67aeba');d.line((x+192,y+236,x+192,y+248),fill='#ffc371');crop=im.crop(im.getbbox());unique.add(hashlib.sha256(str(crop.size).encode()+crop.tobytes()).hexdigest())
 row+=math.ceil(c['count']/6)
board.save(PRE/'goku-fury-contact.png');board.close()
trace=read(QA/'trace.json');files=sorted((QA/'recording').glob('[0-9][0-9][0-9][0-9].png'));assert len(files)==len(trace)>=190
frames=[Image.open(p).convert('RGBA').resize((640,360),Image.Resampling.NEAREST)for p in files[::2]]
frames[0].save(PRE/'goku-fury-gameplay.png',save_all=True,append_images=frames[1:],duration=100,loop=0,disposal=0,blend=0)
palette=Image.new('RGB',(640,360*10))
for i in range(10):palette.paste(frames[round(i*(len(frames)-1)/9)].convert('RGB'),(0,i*360))
palette=palette.quantize(colors=256,dither=Image.Dither.NONE);gif=[im.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE)for im in frames]
gif[0].save(PRE/'goku-fury-gameplay.gif',save_all=True,append_images=gif[1:],duration=100,loop=0,disposal=2,optimize=False)
for im in frames+gif:im.close()
del frames,gif;gc.collect()
indices=[8,24,33,40,48,60,68,78,91,112,130,148,158,163,172,178]
overview=Image.new('RGB',(1280*2,720*math.ceil(len(indices)/2)),'#162734')
for n,i in enumerate(indices):
 im=Image.open(files[i]).convert('RGB');overview.paste(im,(n%2*1280,n//2*720))
overview.save(PRE/'goku-fury-sequence.png');overview.close()
small=Image.new('RGB',(1280,720));d=ImageDraw.Draw(small)
keys=[('furySuperActivationStart',0),('furyTransformationTransition',1),('furyTransformationFinish',1),('furySecondStrike',2),('furyUppercut',2),('furyAirKick',2),('furyDownwardBeam',2),('furyHairColorTransition',3)]
for i,(key,n)in enumerate(keys):
 im=Image.open(OUT/f'{key}-{n:02}.png').convert('RGBA');crop=im.crop((84,55,300,232)).resize((256,210),Image.Resampling.NEAREST);x=i%4*320+32;y=i//4*350+80;small.paste(crop,(x,y),crop);d.text((i%4*320+8,i//4*350+20),key,font=font,fill='#ffe29a')
small.save(PRE/'goku-fury-overview.png')
provenance={'tool':'built-in image_gen','references':['art/goku/rebuild/canonical-reference.png','art/goku/fury/ssj-reference.png'],'bodyMethod':'complete poses; connected-component segmentation of whole source actors excludes neighbouring actors only; one uniform nearest-neighbor scale per source; limited palette and binary alpha; no morphing, mesh warping or limb assembly','bodyClips':len(m),'bodyCelReferences':sum(c['count']for c in m.values()),'uniqueBodyDrawingsIgnoringTranslation':len(unique),'fxClips':14,'cell':[384,256],'pivot':[192,224],'capture':{'source':'real Match + Renderer Canvas, real directional InputFrames','simulationHz':60,'sourceFPS':20,'previewFPS':10,'sourceCaptures':len(files),'previewSize':[640,360],'silent':True,'resize':'nearest-neighbor'},'rejectedSources':['descent-rejected: only eight whole actors, final cell absent','ending-rejected: insufficient top margin','blue-rejected: opaque gradient backdrop','golden-rejected: overlapping row boundaries; replacement uses individually inspected full-effect rectangles'],'limitations':['AI-assisted whole drawings retain small contour/face/fabric differences; hand cleanup can improve continuity further.','Integer 1x/2x cinematic framing uses deliberate shot changes rather than a smooth fractional zoom.','Initial transformation is deliberately vulnerable: cancelling a normal into the Super does not guarantee its first punch.','A few attack drawings are deliberately reused across ground/air/teleport phase clips; cels are not invented to fill ticks.','Goku remains local-only; the existing online roster remains Samurai.'],'sources':{p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in (ART/'raw').glob('*.png')}}
write(ART/'provenance.json',provenance);write(PRE/'goku-fury-gameplay.json',provenance['capture'])
with zipfile.ZipFile(ROOT/'public/downloads/goku-fury.zip','w',zipfile.ZIP_DEFLATED)as z:
 for p in OUT.glob('*'):z.write(p,'fury/'+p.name)
 for p in (ROOT/'src/data').glob('goku-fury*.json'):z.write(p,'data/'+p.name)
 for p in ART.glob('prompts-*.json'):z.write(p,'audit/'+p.name)
 for name in ['sources.json','validation.json','fx-validation.json','provenance.json','shared-engine-revisions.json']:
  if(ART/name).exists():z.write(ART/name,'audit/'+name)
 for ext in ['png','gif','json']:z.write(PRE/f'goku-fury-gameplay.{ext}','previews/gameplay.'+ext)
 z.write(PRE/'goku-fury-contact.png','contact/all-clips.png')
print(__import__('json').dumps(provenance,ensure_ascii=False))
