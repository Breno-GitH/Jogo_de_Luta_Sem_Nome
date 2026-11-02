"""Import two separate generated bases using the Samurai's native-pixel pipeline.

No smooth resize, no dithering, no composited Stand inside Dio's PNG. Sources
remain available for inspection; these one-cell atlases do not claim animation.
"""
from pathlib import Path
import hashlib
import json
import zipfile
import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
COMMON=['#0c0d15','#141621','#202331','#303547','#444c62',
        '#63342b','#92513c','#be7853','#e7a776','#ffd0a0','#ffe3b8',
        '#49341f','#77502c','#ac7940','#deb65d','#f1d38a',
        '#fff0d4','#f1f5f5']
GOLD=['#3e2b13','#664116','#8e5b16','#b47c18','#d9a523','#f4c944','#ffe36c']
GREEN=['#112c24','#174735','#226248','#398554','#69a75a']
PALETTES={
    'dio':COMMON+GOLD+GREEN+['#602028','#a43134','#ef7254','#82745a','#b6a17a'],
    'the-world':COMMON+GOLD+GREEN+['#414331','#64674b','#939578','#babe98','#e0dfb7'],
}


def clean_components(data):
    points=set(map(tuple,np.argwhere(data[:,:,3]>0)))
    groups=[]
    while points:
        start=points.pop();group=[start];stack=[start]
        while stack:
            y,x=stack.pop()
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    n=(y+dy,x+dx)
                    if n in points:points.remove(n);group.append(n);stack.append(n)
        groups.append(group)
    # Drop only isolated import specks. Do not invent an opaque matte.
    for group in groups:
        if len(group)<3:
            for y,x in group:data[y,x]=0
    return data


def build(name,height,clip):
    art=ROOT/'art'/name;out=ROOT/'public/sprites'/name
    if (out/'movement.json').exists():
        raise ValueError('Bases already imported and animated. Use npm run art:dio; reimport would overwrite approved movement atlases.')
    out.mkdir(parents=True,exist_ok=True)
    source=Image.open(art/'generated-base.png').convert('RGBA')
    source.putalpha(source.getchannel('A').point(lambda a:255 if a>=180 else 0))
    bounds=source.getbbox()
    if not bounds:raise ValueError(f'{name} has no visible pixels')
    crop=source.crop(bounds)
    native=crop.resize((round(crop.width*height/crop.height),height),Image.Resampling.NEAREST)
    palette=Image.new('P',(1,1));colors=PALETTES[name]
    values=[v for c in colors for v in bytes.fromhex(c[1:])]
    palette.putpalette(values+values[:3]*(256-len(colors)))
    reduced=native.convert('RGB').quantize(palette=palette,dither=Image.Dither.NONE).convert('RGBA')
    reduced.putalpha(native.getchannel('A'))
    data=np.array(reduced);data[data[:,:,3]==0]=0;reduced=Image.fromarray(clean_components(data))
    # Feet/pelvis centre, independent of a fist's reach. Pivots match Samurai.
    cell=Image.new('RGBA',(256,256));cell.paste(reduced,(128-reduced.width//2,224-height))
    cell.save(art/'base-native.png');cell.save(out/'base.png');cell.save(out/f'{clip}.png')
    (art/'palette.json').write_text(json.dumps(colors,indent=2)+'\n')
    (out/'palette.json').write_text(json.dumps(colors,indent=2)+'\n')
    config={'sheet':f'{name}/{clip}.png','frameWidth':256,'frameHeight':256,'columns':1,
            'pivot':{'x':128,'y':224},'scale':1,'clips':{clip:{'frames':[0],'durations':[60],'ticks':60,'loop':True}}}
    (ROOT/f'src/data/{name}-animations.json').write_text(json.dumps(config,indent=2)+'\n')
    (out/'animations.json').write_text(json.dumps(config,indent=2)+'\n')
    info={'id':name,'visibleHeight':height,'cell':[256,256],'pivot':[128,224],'facing':'right',
          'baseOnly':True,'drawnFrames':1,'sourceBounds':bounds,'exportedBounds':cell.getbbox(),
          'paletteSize':len(colors),'sourceSha256':hashlib.sha256((art/'generated-base.png').read_bytes()).hexdigest(),
          'method':'generated source, native nearest-neighbor import, palette quantization without dithering; not hand-drawn animation'}
    (out/'manifest.json').write_text(json.dumps(info,indent=2)+'\n')
    (art/'import.json').write_text(json.dumps(info,indent=2)+'\n')
    preview=Image.new('RGBA',(256,256),'#626e7e');preview.alpha_composite(cell)
    preview.resize((1024,1024),Image.Resampling.NEAREST).save(out/'base-preview-4x.png')
    return cell


if __name__=='__main__':
    dio=build('dio',130,'idle');world=build('the-world',155,'hover')
    board=Image.new('RGBA',(640,256),'#344451')
    # The same anchors/order used by the runtime: World behind and hovering.
    board.alpha_composite(world,(55,-18));board.alpha_composite(dio,(90,0))
    samurai=Image.open(ROOT/'public/sprites/samurai/idle-00.png').convert('RGBA')
    board.alpha_composite(samurai,(370,0))
    draw=ImageDraw.Draw(board);draw.line((0,224,639,224),fill='#88999d')
    draw.text((12,238),'DIO + THE WORLD / BASES',fill='#fff0d4');draw.text((410,238),'SAMURAI / COMPARISON',fill='#fff0d4')
    board.resize((1920,768),Image.Resampling.NEAREST).save(ROOT/'art/dio/duo-preview-3x.png')
    target=ROOT/'public/downloads';target.mkdir(exist_ok=True)
    with zipfile.ZipFile(target/'dio-the-world-bases.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name in ['dio','the-world']:
            for file in (ROOT/f'public/sprites/{name}').glob('*'):archive.write(file,f'{name}/{file.name}')
            archive.write(ROOT/f'src/data/{name}-visual.json',f'metadata/{name}-visual.json')
        archive.writestr('LEIA-ME.txt','Dio + The World: bases visuais independentes.\nUma pose desenhada por entidade; 130/155 px; celulas256x256; pivo128,224.\nSem golpes ou combate de Dio implementados.\nFlutuacao/avanco/retorno de The World: teste de posicionamento a60ticks, nao animacao de soco.\nAssets gerados com imagegen e importados em grade/paleta sem suavizacao.\nPrompts e fontes preservados em art/dio e art/the-world no projeto.\n')
    print(json.dumps({'dioHeight':130,'worldHeight':155,'cell':[256,256],'independentAtlases':True,'drawnFramesEach':1}))
