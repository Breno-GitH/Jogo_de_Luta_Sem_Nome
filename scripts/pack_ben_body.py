"""Register the three bodies to arena pivots using anatomical, not cel, measurements."""
import json
from collections import defaultdict

import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

from inspect_ben_body import ROOT, SPRITES, FORMS, cels
from pack_ben_stage6_combat import plate

SOURCE = ROOT / "art/ben-body-audit"
OUT = ROOT / "public/previews/ben/anatomia"
DATA = ROOT / "src/data/ben-body-art.json"
PIVOT = (224, 255)
SIZE = (460, 275)
SHEETS = {
    "feedback": "ben/feedback/anatomia-v3.png",
    "nrg": "ben/nrg/stage6-calibrated.png",
    "nrgReleased": "ben/nrgReleased/stage6-calibrated.png",
}


def colors(image):
    return np.asarray(image).astype(np.int16).transpose(2, 0, 1)


def components(mask):
    remaining = set(zip(*np.where(mask)))
    result = []
    while remaining:
        component = [remaining.pop()]
        for y, x in component:
            for pixel in ((y-1, x), (y+1, x), (y, x-1), (y, x+1)):
                if pixel in remaining:
                    remaining.remove(pixel)
                    component.append(pixel)
        result.append(np.asarray(component))
    return sorted(result, key=len, reverse=True)


def feedback_landmarks(image):
    r, g, b, a = colors(image)
    stripe = (a >= 210) & (g >= 55) & (g >= r + 18) & (g >= b + 14)
    gold = (a >= 210) & (r >= 138) & (g >= 83) & (r >= g + 15) & (g >= b + 35)
    neutral = (a >= 210) & (r >= 164) & (g >= 164) & (b >= 155) & (np.abs(r-g) < 25) & (np.abs(g-b) < 24)
    green = np.concatenate([c for c in components(stripe) if len(c) > 4])
    center = np.median(green, axis=0)
    teeth = next((c for c in components(neutral) if 2 <= len(c) < 450 and
                  (c.mean(0)[0] <= center[0]+10 or center[0] > image.height * .7) and
                  abs(c.mean(0)[1] - center[1]) < image.width * .4), None)
    if teeth is None:
        return None
    face = teeth.mean(0)
    nearby = (green[:, 0] < face[0]+1) & (np.abs(green[:, 1]-face[1]) < max(10, image.height*.08))
    torso = green[~nearby]
    if len(torso) < 8:
        return None
    basis = np.linalg.eigh(np.cov(torso.T))[1]
    proj = torso @ basis
    away = np.sign(np.mean(proj[:,1]) - face @ basis[:,1])
    axial = proj[:,1] * away
    hips = np.median(torso[axial >= np.quantile(axial, .88)], axis=0)
    upper = np.median(torso[axial <= np.quantile(axial, .14)], axis=0)
    gold_parts = [c for c in components(gold) if len(c) >= 3]
    return {"face": face, "hips": hips, "collar": upper, "span": float(np.ptp(axial)),
            "width": float(np.ptp(proj[:,0])), "gold": gold_parts}


def cleaned(image):
    alpha = image.getchannel("A").point(lambda a: 255 if a >= 218 else 0)
    image = image.copy()
    image.putalpha(alpha)
    return image


def register(image, pivot, scale=1, dx=0, dy=0, *, clean_alpha=True):
    x = round(PIVOT[0] - pivot["x"] * scale + dx)
    y = round(PIVOT[1] - pivot["y"] * scale + dy)
    if clean_alpha:
        image = cleaned(image)
    cel = image.resize((round(image.width*scale), round(image.height*scale)), Image.Resampling.NEAREST)
    b = cel.getbbox()
    assert b and x+b[0] >= 0 and y+b[1] >= 0 and x+b[2] <= SIZE[0] and y+b[3] <= SIZE[1], (b,x,y)
    result = Image.new("RGBA", SIZE)
    result.alpha_composite(cel, (x,y))
    return result


ANTENNAE = json.loads((DATA.parent / "feedback-antennae.json").read_text(encoding="utf8"))


def curve(nodes):
    """Sample the existing antenna shape at sub-pixel intervals before rasterizing."""
    pads = [nodes[0], *nodes, nodes[-1]]
    result = []
    for i in range(len(nodes)-1):
        a,b,c,d = (np.array(p,dtype=float) for p in pads[i:i+4])
        for t in np.linspace(0, 1, 6, endpoint=False):
            p = .5 * ((2*b) + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t**3)
            result.append(tuple(p))
    return [*result, nodes[-1]]


def attach_antennae(body, anchor, lift=0):
    paths = [curve([(anchor[0]+x+(tx-x)*lift, anchor[1]+y+(ty-y)*lift)
                    for (x,y),(tx,ty) in zip(rest,up)])
             for rest,up in zip(ANTENNAE["rest"], ANTENNAE["raised"])]
    return draw_antennae(body, paths)


def draw_antennae(body, paths):
    layer = Image.new("RGBA",body.size)
    draw = ImageDraw.Draw(layer)
    plugs = Image.new("RGBA",body.size)
    hardware = ImageDraw.Draw(plugs)
    tips = []
    for points in paths:
        draw.line(points, fill="#090b14", width=5, joint="curve")
        draw.line([(x,y-1) for x,y in points], fill="#4b5775", width=2, joint="curve")
        x,y = points[-1]
        dx,dy = x-points[-6][0],y-points[-6][1]
        length = max(.01, (dx*dx+dy*dy)**.5)
        ux,uy = dx/length,dy/length

        def face(coords, color):
            hardware.polygon([(round(x+a*ux-b*uy),round(y+a*uy+b*ux))
                              for a,b in coords], fill=color)

        face([(-6,-4),(3,-4),(6,-2),(6,3),(2,4),(-6,4)], "#342216")
        face([(-5,-3),(2,-3),(4,-2),(4,2),(1,3),(-5,3)], "#b68432")
        face([(-4,-3),(2,-3),(4,-2),(2,0),(-4,0)], "#ffdc7d")
        for side in (-2,2):
            face([(4,side-.5),(10,side-.5),(10,side+.5),(4,side+.5)], "#eec56a")
        tips.append({"x":round(x+10*ux-PIVOT[0]),"y":round(y+10*uy-PIVOT[1])})
    layer.alpha_composite(body)
    layer.alpha_composite(plugs)
    return layer, tips


def raw_pivot(image, hips_x):
    return {"x": hips_x, "y": image.height}


def feedback_scale(clip):
    # Ratios are measured on the chest/abdomen stripe against the same idle
    # model. A short vertical silhouette in crouch or flight is intentional.
    if clip.startswith("storm"): return .77
    if clip.startswith("discharge"): return .84
    if clip.startswith(("cables", "conductor")): return .77
    if clip.startswith(("walk", "stand", "throw", "grab", "air_light")): return .94
    if clip.startswith(("absorb", "feedback_counter")): return .90
    return 1


def prepare_form(key, data, support, models):
    slots = cels(data)
    frames, raw, keys = [], [], {}
    heads, tips = {}, {}
    for (sheet, frame), (name, image, pivot) in slots.items():
        scale, dx, dy = 1, 0, 0
        if key == "feedback":
            scale = feedback_scale(name)
            anatomy = feedback_landmarks(image)
            if anatomy and name.startswith(("air_", "jumpRise", "jumpApex", "jumpFall", "dash", "backdash")):
                # Anchor hips, not the visually lowest tail plug or a swinging fist.
                hips = anatomy["hips"]
                dx = np.clip((pivot["x"] - hips[1]) * scale + 2, -85, 80)
                if name.startswith("air_"):
                    dy = np.clip(-57 - (hips[0] - pivot["y"]) * scale, -26, 29)
            elif name.startswith("walk"):
                contact = support[name][frame]
                dx = contact * (1 - scale)
            elif anatomy and name not in ("idle", "downed"):
                hips = anatomy["hips"]
                dx = np.clip((pivot["x"] - hips[1]) * scale + 4, -28, 27)
        elif key == "nrg" and name == "thermal_light" and frame == 15:
            scale = .9
        elif key == "nrgReleased" and name in ("radiantWave_light", "radiantShot_mediumAir"):
            # The attack plane was calibrated independently of the flight plane.
            scale = .96
        result = register(image, pivot, scale, dx, dy)
        keys[sheet, frame] = len(frames)
        frames.append(result)
        raw.append(register(image, pivot, clean_alpha=False))
        if key == "feedback":
            if sheet in data.get("heads", {}) and data["heads"][sheet][frame]:
                p = data["heads"][sheet][frame]
                heads[len(frames)-1] = {"x": round(p["x"]*scale+dx), "y": round(p["y"]*scale+dy)}
            if name.startswith("storm"):
                anatomy = feedback_landmarks(result)
                if anatomy:
                    face_y = anatomy["face"][0]
                    ends = [c.mean(0) for c in anatomy["gold"] if len(c) >= 4 and c.mean(0)[0] < face_y-4]
                    if ends:
                        tips[len(frames)-1] = [dict(x=round(float(x)-PIVOT[0]), y=round(float(y)-PIVOT[1]))
                                               for y,x in sorted(ends, key=lambda p:p[0])[:2]]
    clips = {}
    for name, clip in data["clips"].items():
        seq = [keys[clip.get("sheet", data["sheet"]), i] for i in clip["frames"]]
        clips[name] = {k:v for k,v in clip.items() if k in ("ticks","durations","loop")} | {"frames":seq}

    def install(name, indexes, durations, loop=False):
        clips[name] = {"frames": indexes, "durations": durations, "ticks": 1, "loop": loop}

    if key == "feedback":
        source = models["feedback"]
        anatomy = [feedback_landmarks(im) for im in source]
        scale = 45 / np.median([a["span"] for a in anatomy[4:]])
        extra = []
        for i, (image, a) in enumerate(zip(source, anatomy)):
            h, x = a["hips"]
            position = raw_pivot(image, x)
            if i < 4:
                position["y"] = h + 59/scale
            extra.append(len(frames))
            frames.append(register(image, position, scale))
            y, x = a["face"]
            heads[extra[-1]] = {"x": round((x-position["x"])*scale-9),
                                 "y": round((y-position["y"])*scale-10)}

        def composed(index, lift=0):
            point = heads[index]
            return attach_antennae(frames[index],(PIVOT[0]+point["x"],PIVOT[1]+point["y"]),lift)

        # The airborne clip uses full cels. The capture clip uses the same
        # full anatomy with the two conductors articulated over its body layer.
        air = []
        full = [composed(index, i/28) for i,index in enumerate(extra)]
        for image,emitters in full[:4]:
            air.append(len(frames))
            tips[len(frames)] = emitters
            frames.append(image)
        install("air_medium", air, [4,3,7,19])
        _,_,_,_,e,f,g,h = extra

        storm = []
        parts = models["storm"]
        marks = [feedback_landmarks(im) for im in parts]
        scale = 45 / np.median([a["span"] for a in marks])
        for image,a,lift in zip(parts,marks,(0,.17,.55,.93,1,.13)):
            position = raw_pivot(image, a["hips"][1])
            body = register(image,position,scale)
            y,x = a["face"]
            anchor = (PIVOT[0]+round((x-position["x"])*scale-9),
                      PIVOT[1]+round((y-position["y"])*scale-10))
            complete, emitters = attach_antennae(body,anchor,lift)
            storm.append(len(frames))
            tips[len(frames)] = emitters
            frames.append(complete)
        for name in ("storm_light","storm_medium"):
            clips[name]["frames"] = storm
        export_feedback_poses([image for image,_ in full], 4, "feedback-poses-com-antenas")
        export_feedback_poses([frames[i] for i in storm], 3, "feedback-tempestade-com-antenas")
        install("conductor_light", [e,f,f,h], [3,5,8,24])
        install("conductor_medium", [e,f,g,h], [7,8,10,33])
        install("conductorHold", [f,g,h], [8,6,7])
        install("conductorHoldK", [g,f,g,h], [8,12,8,5])
    if key == "nrgReleased":
        source = models[key]
        scale = 160 / source[0].height
        indexes = []
        for image in source:
            # Locate the waist across the authored flight poses. Existing air
            # boxes are measured from the same waist-to-floor datum.
            r,g,b,a = colors(image)
            green = (a>=218)&(g>r+13)&(g>b+29)
            ys,xs = np.where(green)
            waist = (ys >= image.height*.36) & (ys <= image.height*.57)
            center = float(np.median(xs[waist])) if np.any(waist) else image.width/2
            indexes.append(len(frames))
            frames.append(register(image, raw_pivot(image,center),scale))
        f = indexes
        for name, cels_, times in (
            ("flyIdle",[0,1],[7,7]), ("flyUp",[1,2],[5,5]), ("flyDown",[3,9],[5,5]),
            ("flyForward",[4,10],[5,5]), ("flyBack",[5,11],[5,5]),
            ("flyForwardUp",[6,10],[5,5]), ("flyBackUp",[5,7],[5,5]),
            ("flyForwardDown",[4,8],[5,5]), ("flyBackDown",[5,9],[5,5]),
        ):
            install(name, [f[i] for i in cels_], times, True)
        install("nrgSeal_light", [f[3],f[6],f[2],f[0]], [4,8,5,17])

    bounds = [f.getbbox() for f in frames]
    area = min(b[0] for b in bounds)-1, min(b[1] for b in bounds)-1, max(b[2] for b in bounds)+1, max(PIVOT[1]+1,max(b[3] for b in bounds)+1)
    width, height = area[2]-area[0], area[3]-area[1]
    cols = 8
    atlas = Image.new("RGBA",(cols*width, ((len(frames)+cols-1)//cols)*height))
    for i, image in enumerate(frames):
        atlas.paste(image.crop(area), (i % cols * width, i // cols * height))
    atlas.save(SPRITES / SHEETS[key], optimize=True)
    result = dict(sheet=SHEETS[key], frameWidth=width, frameHeight=height, columns=cols,
                  pivot=dict(x=PIVOT[0]-area[0], y=PIVOT[1]-area[1]), scale=1, clips=clips)
    if heads:
        result["heads"] = heads
    if tips:
        result["tips"] = tips
    return result, frames, raw, keys


def export_feedback_poses(poses, cols, name):
    """Show the complete silhouette with both head cables in every cel."""
    left = min(im.getbbox()[0] for im in poses)-6
    top = min(im.getbbox()[1] for im in poses)-6
    right = max(im.getbbox()[2] for im in poses)+6
    bottom = max(im.getbbox()[3] for im in poses)+6
    w,h = right-left,bottom-top
    sheet = Image.new("RGBA",(w*cols,h*((len(poses)+cols-1)//cols)))
    for i,im in enumerate(poses):
        sheet.alpha_composite(im.crop((left,top,right,bottom)),(i%cols*w,i//cols*h))
    sheet.save(OUT/(name+".png"),optimize=True)


def comparison(key, data, result, frames, raw, keys):
    pairs = {
        "feedback": ["idle","walkForward","dashForward","jumpApex","storm_medium","conductor_medium",
                     "discharge_light","discharge_medium","air_medium","idle"],
        "nrg": ["idle","walkForward","walkBack","dashForward","jumpStart","landing","thermal_light","nrgLock"],
        "nrgReleased": ["idle","walkForward","flyIdle","flyUp","flyForward","flyForwardDown","radiantShot_mediumAir",
                        "radiantWave_light","nrgSeal_medium"],
    }[key]
    w,h,cols = 330, 505, 5
    origin_x = 155
    img = Image.new("RGB",(cols*w, 46 + ((len(pairs)+cols-1)//cols)*h),"#202835")
    d=ImageDraw.Draw(img)
    font=ImageFont.truetype("C:/Windows/Fonts/consola.ttf",14)
    title = {"feedback":"FEEDBACK","nrg":"NRG CONTIDO","nrgReleased":"NRG LIBERADO"}[key]
    d.text((18,10),f"{title} / ANTES E DEPOIS / ESCALA NATIVA",fill="#e5f6c0",font=font)
    d.text((18,29),"Guias do chão para cima: 0, 55, 95, 128 e 158 px. Eixo vertical: pivô.",
           fill="#b9cbdc",font=font)
    for i,name in enumerate(pairs):
        x,y=(i%cols)*w,46+(i//cols)*h
        mirror=key=="feedback" and i==len(pairs)-1
        d.text((x+8,y+4),"Idle espelhado" if mirror else name, fill="#ffe6ae",font=font)
        old=data["clips"].get(name, data["clips"].get("flyDown"))
        if old is None:
            old = data["clips"]["idle"]
        j=len(old["frames"])//2
        if name.startswith("discharge"): j=1 if name.endswith("light") else 2
        if name=="conductor_medium": j=2
        prior=keys[old.get("sheet",data["sheet"]),old["frames"][j]]
        new = result["clips"][name]["frames"]
        index=new[min(j,len(new)-1)]
        for row,im in enumerate((raw[prior],frames[index])):
            top=y+26+row*232
            floor=top+201
            for level in (0,-55,-95,-128,-158):
                d.line((x+8,floor+level,x+w-8,floor+level),fill="#566578",width=1)
            d.line((x+origin_x,top+6,x+origin_x,floor+4),fill="#64728b",width=1)
            if mirror:
                im=ImageOps.mirror(im)
                left=x+origin_x-(im.width-PIVOT[0])
            else:
                left=x+origin_x-PIVOT[0]
            tile=Image.new("RGBA",(w,218))
            tile.alpha_composite(im,(left-x, floor-top-PIVOT[1]))
            img.paste(tile,(x,top),tile)
            d.text((x+8,top+202),"Antes" if row==0 else "Depois",fill="#bfd2e7",font=font)
            if key=="feedback" and not mirror:
                shape=feedback_landmarks(im)
                if shape:
                    for label,color in (("face","#ecac82"),("collar","#ebec85"),("hips","#95e8d5")):
                        point=shape[label]
                        ax,ay=round(left+point[1]),round(floor-PIVOT[1]+point[0])
                        d.ellipse((ax-2,ay-2,ax+2,ay+2),fill=color)
    img.save(OUT / (key + "-comparacao.png"),optimize=True)


def baseline():
    src = ROOT / "src/data"
    read = lambda name: json.loads((src / name).read_text(encoding="utf8"))
    stage5, stage6 = read("ben-stage5-art.json"), read("ben-stage6-combat.json")
    feedback = read("feedback-rework-art.json")
    reform = read("ben-reform-art.json")["clips"]
    # The archived runtime selection before anatomical calibration.
    forms = {
        "feedback": feedback | {"clips": stage5["forms"]["feedback"]["clips"] | feedback["clips"] | reform["feedback"]},
        "nrg": stage6["nrg"],
        "nrgReleased": stage6["nrgReleased"] | {"clips": stage6["nrgReleased"]["clips"] | reform["nrgReleased"]},
    }
    clips = forms["feedback"]["clips"]
    clips["conductor_light"] = clips["cables_light"] | {"durations":[3,5,8,24]}
    clips["conductor_medium"] = clips["cables_medium"] | {"durations":[6,9,10,33]}
    return forms, feedback["supports"]


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    data, support = baseline()
    models = {"feedback": plate(SOURCE / "feedback-combat.png",4,2), "storm": plate(SOURCE / "feedback-storm.png",3,2),
              "nrgReleased": plate(SOURCE / "nrg-flight.png",6,2)}
    all_forms={}
    for key in FORMS:
        result, frames, raw, keys=prepare_form(key,data[key],support,models)
        all_forms[key]=result
        comparison(key,data[key],result,frames,raw,keys)
        print(key,len(frames),result["frameWidth"],result["frameHeight"])
    DATA.write_text(json.dumps(all_forms,indent=2)+"\n",encoding="utf8")

