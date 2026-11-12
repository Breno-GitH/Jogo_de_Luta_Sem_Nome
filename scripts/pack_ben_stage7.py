"""Build native-resolution battle atlases for the two approved Stage 7 forms."""
import json
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from inspect_ben_body import ROOT, SPRITES
from pack_ben_stage6_combat import plate

SRC = ROOT / "art/ben-stage7-source"
OUT = ROOT / "public/previews/ben/etapa-7"
DATA = ROOT / "src/data/ben-stage7-art.json"
NEAREST = Image.Resampling.NEAREST
SIZE = (548, 338)
ROOT_POINT = (266, 317)
SPECS = {"gravattack": ("gravattack", 180), "echoEcho": ("eco-eco", 101)}


def tuning():
    script = """import { benForms } from './src/engine/ben-forms.ts';
    console.log(JSON.stringify({gravattack:benForms.gravattack,echoEcho:benForms.echoEcho}));"""
    command = "eval(require('esbuild').buildSync({stdin:{contents:" + json.dumps(script) + ",resolveDir:process.cwd()},platform:'node',bundle:true,write:false}).outputFiles[0].text)"
    return json.loads(subprocess.check_output(["node", "-e", command], cwd=ROOT))


def anchor(image, alien):
    pixels = np.asarray(image).astype(np.int16)
    r,g,b,a = pixels.transpose(2,0,1)
    green = (a == 255) & (g >= 97) & (g >= r + 17) & (g >= b + 22)
    yy, xx = np.where(green)
    sel = yy < image.height*.23 if alien == "gravattack" else (yy > image.height*.40) & (yy < image.height*.65)
    if sel.any():
        return float(np.median(xx[sel]))
    ys,xs = np.where(a == 255)
    valid = (ys > image.height*.22) & (ys < image.height*.45)
    return float(np.median(xs[valid]))


def feet(image):
    a = np.asarray(image.getchannel("A"))
    return np.where(np.count_nonzero(a[-6:], axis=0) > 0)[0]


def pack(alien, config):
    key, height = SPECS[alien]
    approved = Image.open(OUT / (key+"-base.png")).convert("RGBA")
    left,top,right,bottom = approved.getbbox()
    base = approved.crop((left,top,right,bottom))
    reference_x = anchor(base, alien) - (144-left)
    frames, groups, clips = [], {}, {}
    original = Image.new("RGBA", SIZE)
    original.alpha_composite(approved,(ROOT_POINT[0]-144,ROOT_POINT[1]-202))
    frames.append(original)
    for name, cols, rows, reference in (
        ("move", 5, 5, range(5)), ("walk", 4, 4, range(16)),
        ("combat", 5, 5, (0,1,2,3,4,15,19)), ("special", 4, 4, range(8)),
    ):
        images = plate(SRC / f"{key}-{name}.png", cols, rows)
        factor = height / np.median([images[i].height for i in reference])
        groups[name] = []
        for i, source in enumerate(images):
            scale = factor
            if alien == "gravattack" and name == "special" and i >= 12:
                scale = height*.68 / np.median([im.height for im in images[12:16]])
            im = source.resize((round(source.width*scale), round(source.height*scale)), NEAREST)
            im = im.crop(im.getbbox())
            x = round(ROOT_POINT[0] + reference_x - anchor(im,alien))
            if name == "walk":
                planted = feet(im)
                center = float(np.median(planted)) if len(planted) else im.width/2
                phase = i % 4
                direction = 1 if i < 8 else -1
                nominal = direction*(12-phase*7) * (height/130)
                x += round(np.clip(ROOT_POINT[0]+nominal-(x+center), -height*.10, height*.10))
            elif alien == "gravattack" and name == "special" and i >= 12:
                x = ROOT_POINT[0] - im.width//2
            y = ROOT_POINT[1] - im.height
            if name == "move" and i < 5:
                # Preserve the registered lower part of the stance for the idle loop.
                # The same source draw supplies both ankles and soles of every idle cel.
                y = min(y, ROOT_POINT[1] - round(height*.84))
            canvas = Image.new("RGBA", SIZE)
            assert 0 <= x and x+im.width <= SIZE[0] and 0 <= y and y+im.height < SIZE[1], (alien,name,i,im.size,x,y)
            canvas.alpha_composite(im, (x,y))
            if name == "move" and i < 5:
                cut = ROOT_POINT[1] - round(height*.11)
                canvas.paste(original.crop((0,cut,SIZE[0],SIZE[1])), (0,cut))
            groups[name].append(len(frames))
            frames.append(canvas)
    a,w,c,s = (groups[k] for k in ("move","walk","combat","special"))

    def clip(name, indexes, times, loop=False):
        assert len(indexes) == len(times) and min(times)>0, (name,times)
        clips[name] = {"frames": indexes, "durations": times, "ticks":1, "loop":loop}

    clip("idle",[0,*a[:5]],[10,10,10,10,10,10],True)
    clip("walkForward",w[:8], [4]*8 if alien=="gravattack" else [3]*8,True)
    clip("walkBack",w[8:],[5]*8 if alien=="gravattack" else [4]*8,True)
    clip("dashForward",a[5:10],[2,2,3,2,3])
    clip("backdash",a[10:15],[2,2,2,2,3])
    clip("crouchStart",a[15:17],[3,3])
    clip("crouchIdle",a[15:17][::-1],[9,9],True)
    clip("crouchEnd",[a[16],0],[3,2])
    clip("jumpStart",[a[15],a[17],a[18]],[2,2,2])
    clip("jumpRise",a[18:20],[1,1])
    clip("jumpApex",[a[19]],[1])
    clip("jumpFall",[a[20],c[12]],[1,1])
    clip("landing",[a[21],a[22],0],[3,4,4])
    clip("guardStand",[a[23]],[8])
    clip("guardCrouch",[c[22]],[8])
    clip("damage",c[20:22],[4,9])
    clip("downed",[a[24]],[9])
    clip("getup",[c[23],c[24],0],[5,5,7])

    moves = config["moves"]
    for i,name in enumerate(("stand_light","stand_medium","crouch_light","crouch_medium","air_light","air_medium")):
        prep = (i//2)*5 + (i%2)*2
        m = moves[name]
        clip(name, [c[prep],c[prep+1],c[(i//2)*5+4]], [m["startup"],m["active"],m["recovery"]])
    throw = moves["throw"]
    grab = config["grab"]
    clip("throw",[c[15],c[16],c[19]],[throw["startup"],throw["active"],throw["recovery"]])
    clip("grabHold",[c[16],c[17],c[18],c[19]], [5,grab["hitTick"]-5,3,grab["duration"]-grab["hitTick"]-3])
    clip("throwRecover",[c[19],0],[7,6])
    groups_by_move = (
        {"gravityPull":s[:4], "gravityRepel":s[4:8], "gravityDomain":s[8:12]}
        if alien=="gravattack" else {"sonicCry":s[:4],"echoSplit":s[4:8],"echoHarmony":s[8:12]}
    )
    for family, poses in groups_by_move.items():
        for strength in ("light","medium"):
            name=family+"_"+strength
            m=moves[name]
            start=m["startup"]
            if name == "gravityDomain_medium":
                clip(name,[s[8],s[10],s[11],*s[12:16],*s[12:16],*s[12:16],s[11],s[10],s[8],0],
                     [4,5,4,*([2]*12),4,5,8,8])
                continue
            order = poses if strength=="medium" else [poses[0],poses[1],poses[1],poses[3]]
            clip(name,order,[start//3,start-start//3,m["active"]+6,m["recovery"]-6])
    if alien == "echoEcho":
        for name, indices, times in (
            ("cloneArrival",[s[12],0],[5,4]), ("cloneJab",[c[0],s[13],c[4]],[4,5,5]),
            ("cloneWave",[s[8],s[14],s[11]],[4,5,5]), ("cloneFade",[s[15],c[21]],[5,4]),
        ): clip(name,indices,times)

    boxes = [im.getbbox() for im in frames]
    crop = (min(b[0] for b in boxes)-2,min(b[1] for b in boxes)-2,max(b[2] for b in boxes)+2,max(b[3] for b in boxes)+2)
    width, height = crop[2]-crop[0], crop[3]-crop[1]
    cols = 8
    atlas = Image.new("RGBA",(cols*width,((len(frames)+cols-1)//cols)*height))
    core = {}
    for i, frame in enumerate(frames):
        atlas.paste(frame.crop(crop),(i%cols*width,i//cols*height))
        if alien == "gravattack":
            pix=np.asarray(frame).astype(np.int16)
            r,g,b,alpha=pix.transpose(2,0,1)
            y,x=np.where((alpha==255)&(r>193)&(g<89)&(b<103)&(r>g*2.6))
            if len(x)>6:
                core[i] = dict(x=round(float(np.median(x)))-ROOT_POINT[0],y=round(float(np.median(y)))-ROOT_POINT[1])
    name = f"ben/{alien}/stage7.png"
    dest = SPRITES / name
    dest.parent.mkdir(exist_ok=True,parents=True)
    atlas.save(dest,optimize=True)
    print(alien, len(frames), dest)
    for label, names in (("idle",["idle"]),("passos",["walkForward","walkBack"])):
        preview(alien,label,[frames[i] for name in names for i in clips[name]["frames"]])
    return {"sheet":name,"frameWidth":width,"frameHeight":height,"columns":cols,"scale":1,
            "pivot":{"x":ROOT_POINT[0]-crop[0],"y":ROOT_POINT[1]-crop[1]},"clips":clips,"core":core}


def preview(alien, label, frames):
    key, height = SPECS[alien]
    width, tile_height, cols = (250 if alien=="gravattack" else 146), height+40, (4 if label=="passos" else 6)
    out=Image.new("RGB",(width*cols,tile_height*((len(frames)+cols-1)//cols)+30),"#1d2935")
    draw=ImageDraw.Draw(out)
    font=ImageFont.truetype("C:/Windows/Fonts/consola.ttf",15)
    draw.text((12,7),f"{'Gravattack' if alien=='gravattack' else 'Eco Eco'}  /  {label.upper()}  /  SPRITES DA ARENA",font=font,fill="#e2f4b8")
    for i, frame in enumerate(frames):
        x,y=(i%cols)*width,30+(i//cols)*tile_height
        ground=y+height+16
        draw.line((x+4,ground,x+width-4,ground),fill="#4a665f")
        crop=frame.crop((ROOT_POINT[0]-width//2,ROOT_POINT[1]-height-11,ROOT_POINT[0]+(width+1)//2,ROOT_POINT[1]))
        out.paste(crop,(x,ground-height-11),crop)
        draw.text((x+9,ground+4),str(i+1),font=font,fill="#adbed0")
    out.save(OUT/f"{key}-{label}.png",optimize=True)


if __name__ == "__main__":
    data = tuning()
    result = {name:pack(name,data[name]) for name in SPECS}
    DATA.write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
