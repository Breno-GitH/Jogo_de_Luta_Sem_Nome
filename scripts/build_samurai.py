"""Build the Samurai's six-frame Idle from the checked-in native pixel base.

Pillow + numpy only. The animation uses an articulated inverse pixel mesh:
rigid face, anchored feet, breathing chest/shoulders, secondary motion in the
ponytail and coat, and coherent hand/sword motion. Integer nearest sampling;
no interpolation, smoothing, dithering or AI calls in this reproducible build.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art/samurai"
OUT = ROOT / "public/sprites/samurai"


def smooth(a, b, values):
    t = np.clip((values-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def animate(base, pose):
    y, x = np.mgrid[0:256, 0:256].astype(float)
    # Face/head travel rigidly; the spine tapers to a stationary pelvis.
    spine = 1-smooth(126,169,y)
    dy = pose["breath"] * spine
    # Chest expansion changes the contour as well as its vertical position.
    chest = (1-smooth(12,25,np.abs(x-126))) * (1-smooth(9,21,np.abs(y-143)))
    dx = pose["chest"] * chest * np.clip((x-126)/12,-1,1)
    # Secondary motion lags the torso. Hair-root and sash-root remain attached.
    ponytail = (1-smooth(112,127,x)) * (1-smooth(115,121,y)) * smooth(91,99,y)
    dy += pose["hair"] * ponytail
    coat = (1-smooth(85,122,x)) * smooth(153,166,y) * (1-smooth(195,204,y))
    dy += pose["cloth"] * coat * (0.75+0.25*np.cos((x-55)/16))
    dx += pose["cloth"] * 0.4 * coat
    # Keep katana, hilt and fingers together. Blend only near the elbow.
    wrist = smooth(131,145,x) * smooth(150,166,y) * (1-smooth(202,213,y))
    dy += pose["wrist"] * wrist
    # The planted boots are never translated or rescaled.
    foot_lock = 1-smooth(204,215,y)
    dx *= foot_lock
    dy *= foot_lock
    sx = np.clip(np.rint(x-dx),0,255).astype(int)
    sy = np.clip(np.rint(y-dy),0,255).astype(int)
    return Image.fromarray(np.array(base)[sy,sx])


def palette_swap(image):
    # Selective remap: skin, hair, steel and ivory stay the same for Player 2.
    mapping = {
        "#360f1c":"#0e252b", "#5c1325":"#163d49", "#89192b":"#205d6b",
        "#b42132":"#2a8791", "#d83740":"#53b2b6", "#ef5a50":"#8bd5cf",
    }
    data = np.array(image)
    original = data.copy()
    for source,target in mapping.items():
        rgb = np.array(list(bytes.fromhex(source[1:])))
        match = np.all(original[:,:,:3]==rgb,axis=2) & (original[:,:,3]==255)
        data[match,:3] = list(bytes.fromhex(target[1:]))
    return Image.fromarray(data)


def validate(frames, rig):
    if len(frames)!=6:
        raise ValueError("Exactly six frames are required")
    hashes = [hashlib.sha256(frame.tobytes()).hexdigest() for frame in frames]
    if len(set(hashes))!=6:
        raise ValueError("Every frame must be distinct")
    normalized = []
    for frame in frames:
        if frame.size!=(256,256):
            raise ValueError("Cell must be 256x256")
        alpha = np.array(frame)[:,:,3]
        if not set(np.unique(alpha)).issubset({0,255}):
            raise ValueError("Soft alpha is not allowed")
        bounds = frame.getbbox()
        if bounds is None or not 126 <= bounds[3]-bounds[1] <= 134:
            raise ValueError("Visible height must stay close to 130 pixels")
        if bounds[3]!=rig["pivot"]["y"]:
            raise ValueError("The grounded baseline drifted")
        if not np.array_equal(np.array(frame)[215:],np.array(frames[0])[215:]):
            raise ValueError("The planted feet must not slide")
        normalized.append(hashlib.sha256(frame.crop(bounds).tobytes()).hexdigest())
    if len(set(normalized))!=6:
        raise ValueError("Frames must not be copies translated in their cells")
    return hashes


def checker(size):
    bg = Image.new("RGBA",size,"#343e4d")
    draw = ImageDraw.Draw(bg)
    for y in range(0,size[1],8):
        for x in range(0,size[0],8):
            if (x//8+y//8)%2==0:
                draw.rectangle((x,y,x+7,y+7),fill="#29303d")
    return bg


def build():
    OUT.mkdir(parents=True,exist_ok=True)
    rig=json.loads((ART/"rig.json").read_text(encoding="utf-8"))
    base=Image.open(ART/"base-native.png").convert("RGBA")
    frames=[animate(base,pose) for pose in rig["frames"]]
    hashes=validate(frames,rig)
    base.save(OUT/"base.png")
    palette_swap(base).save(OUT/"base-p2.png")
    sheet=Image.new("RGBA",(1536,256))
    for i,frame in enumerate(frames):
        frame.save(OUT/f"idle-{i:02}.png")
        sheet.paste(frame,(i*256,0))
    sheet.save(OUT/"idle.png")
    palette_swap(sheet).save(OUT/"idle-p2.png")
    colors=sorted({tuple(pixel[:3]) for frame in frames for pixel in np.array(frame).reshape(-1,4).tolist() if pixel[3]})
    if len(colors)>36:
        raise ValueError("Unexpected colors outside the native palette")
    union=Image.new("L",(256,256))
    for frame in frames:
        union=Image.fromarray(np.maximum(np.array(union),np.array(frame)[:,:,3]))
    x0,y0,x1,y1=union.getbbox()
    box=(x0-8,y0-8,x1+8,y1+8)
    w,h=box[2]-box[0],box[3]-box[1]
    contact=Image.new("RGBA",(w*3,h*2))
    previews=[]
    for i,frame in enumerate(frames):
        bg=checker((w,h))
        bg.alpha_composite(frame.crop(box))
        contact.paste(bg,((i%3)*w,(i//3)*h))
        previews.append(bg.resize((w*4,h*4),Image.Resampling.NEAREST))
    contact.resize((w*3*4,h*2*4),Image.Resampling.NEAREST).save(OUT/"preview-4x.png")
    previews[0].save(OUT/"idle-preview.png",save_all=True,append_images=previews[1:],
                     duration=[round(t*1000/60) for t in rig["durations"]],loop=0,disposal=0,blend=0)
    # Runtime sprite geometry and human-readable provenance beside the actual PNG.
    metadata={"character":"samurai","animation":"idle","sheet":"idle.png",
              "frameWidth":256,"frameHeight":256,"columns":6,"pivot":rig["pivot"],
              "scale":1,"durations":rig["durations"],"facing":"right","alpha":"binary",
              "palette":["#"+bytes(color).hex() for color in colors],
              "frames":[{"index":i,"name":pose["name"],"bounds":frame.getbbox(),"sha256":hashes[i]}
                        for i,(frame,pose) in enumerate(zip(frames,rig["frames"]))]}
    (OUT/"idle.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf-8")
    animation_file=ROOT/"src/data/animations.json"
    data=json.loads(animation_file.read_text(encoding="utf-8"))
    data["clips"]["idle"]={"sheet":"samurai/idle.png","player2Sheet":"samurai/idle-p2.png",
                           "frames":list(range(6)),"ticks":16,"durations":rig["durations"],
                           "frameWidth":256,"frameHeight":256,"columns":6,"pivot":rig["pivot"],"scale":1}
    animation_file.write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"frames":6,"sheet":[1536,256],"visibleHeights":[f.getbbox()[3]-f.getbbox()[1] for f in frames],
                      "colors":len(colors),"pivot":rig["pivot"],"uniqueFrames":len(set(hashes)),"feetLocked":True}))


if __name__=="__main__":
    build()
