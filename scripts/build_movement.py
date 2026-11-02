"""Articulated native-pixel cutout rig. Never writes the approved Idle files.

Face pixels are copied rigidly; clothes/limbs come from the same approved base.
Two-bone legs preserve lengths, boots pivot at ankles, torso pivots at the hip,
and the two-hand katana guard follows its wrist. No smooth resampling or new AI.
"""
from pathlib import Path
import hashlib
import json
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from build_samurai import palette_swap, checker, smooth

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/samurai'
OUT=ROOT/'public/sprites/samurai'
CELL=256
PIVOT={'x':128,'y':224}
BASE=Image.open(ART/'base-native.png').convert('RGBA')


def polygon(points):
    image=Image.new('L',(CELL,CELL))
    ImageDraw.Draw(image).polygon(points,fill=255)
    return np.array(image)>0


def layers():
    y,x=np.mgrid[:CELL,:CELL]
    source=np.array(BASE)
    reds=['360f1c','5c1325','89192b','b42132','d83740','ef5a50']
    red=np.zeros((CELL,CELL),bool)
    for color in reds:
        red |= np.all(source[:,:,:3]==list(bytes.fromhex(color)),axis=2)
    near_red=np.array(Image.fromarray(red.astype('uint8')*255).filter(ImageFilter.MaxFilter(5)))>0
    cloth_color=red | (near_red & (np.max(source[:,:,:3],axis=2)<120))
    labels=np.full((CELL,CELL),'body',dtype='U10')
    labels[(y>=166)&(x<130)]='left'
    labels[(y>=171)&(x>=130)]='right'
    labels[(y>=157)&(y<205)&(x<128)&cloth_color]='tails'
    labels[polygon([(123,166),(134,167),(137,190),(132,205),(122,201),(119,185)]) & cloth_color]='front'
    labels[polygon([(94,91),(153,91),(154,126),(143,127),(139,125),(135,125),
                    (131,128),(127,127),(127,124),(120,124),(119,121),(102,121),(94,118)])]='head'
    labels[polygon([(127,161),(145,159),(153,171),(153,177),(137,175),(127,174)]) |
           ((x>=151)&(np.abs(y-(.48*(x-151)+175))<=5))]='weapon'
    data=np.array(BASE)
    result={}
    for name in ['body','left','right','tails','front','head','weapon']:
        pixels=data.copy()
        pixels[labels!=name]=0
        result[name]=Image.fromarray(pixels)
    # Extend joint caps only within each leg's existing pixels to avoid seams.
    for side in ['left','right']:
        pixels=np.array(result[side])
        knee=195
        for name,mask in [('thigh',y<=knee+4),('shin',(y>=knee-4)&(y<=215)),('boot',y>=211)]:
            part=pixels.copy();part[~mask]=0
            result[f'{side}_{name}']=Image.fromarray(part)
    source_dir=ART/'movement-layers'
    source_dir.mkdir(exist_ok=True)
    for name,layer in result.items():
        layer.save(source_dir/f'{name}.png')
    return result


def rigid(origin,angle,offset=(0,0)):
    a=math.radians(angle)
    m=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])
    o=np.array(origin,float)
    return m,o+np.array(offset)-m@o


def point(transform,p):
    return transform[0]@np.array(p,float)+transform[1]


def warp(image,transform):
    m,t=transform
    inv=np.linalg.inv(m)
    offset=-inv@t
    values=(inv[0,0],inv[0,1],offset[0],inv[1,0],inv[1,1],offset[1])
    return image.transform((CELL,CELL),Image.Transform.AFFINE,values,Image.Resampling.NEAREST)


def bone(a,b,c,d):
    a,b,c,d=[np.array(p,float) for p in [a,b,c,d]]
    u=b-a;v=d-c
    angle=math.atan2(v[1],v[0])-math.atan2(u[1],u[0])
    length=np.linalg.norm(v)/np.linalg.norm(u)
    # Keep the transverse volume, only solve along the bone at a joint.
    along=u/np.linalg.norm(u);across=np.array([-along[1],along[0]])
    r=np.array([[math.cos(angle),-math.sin(angle)],[math.sin(angle),math.cos(angle)]])
    m=r@(np.outer(along,along)*length+np.outer(across,across))
    return m,c-m@a


def knee(hip,ankle,a,b,hint,side):
    hip,ankle,hint=[np.array(p,float) for p in [hip,ankle,hint]]
    vector=ankle-hip;distance=np.linalg.norm(vector)
    unit=vector/max(distance,.001)
    distance=min(distance,a+b-.1)
    run=(a*a-b*b+distance*distance)/(2*distance)
    height=math.sqrt(max(0,a*a-run*run))
    normal=np.array([-unit[1],unit[0]])
    options=[hip+unit*run+normal*height,hip+unit*run-normal*height]
    # Bend away from the centreline, never fold the knee underneath the floor.
    return min(options,key=lambda p:p[0]) if side=='left' else max(options,key=lambda p:p[0])


def secondary(image,amount,root_x):
    y,x=np.mgrid[:CELL,:CELL].astype(float)
    weight=np.clip((root_x-x)/55,0,1)
    sy=np.clip(np.rint(y-amount*weight*np.sin((x-40)/25)),0,255).astype(int)
    return Image.fromarray(np.array(image)[sy,x.astype(int)])


LAYERS=layers()


def normalize_legs(source):
    """Keep planted ankles on their floor line without stretching either bone.

    Slide an unreachable target toward the hip along that line; only airborne
    or pre-rotation floor poses with an impossible vertical span need lifting.
    This solves targets before both art and collision geometry are exported.
    """
    p=dict(source)
    body=rigid((128,167),p.get('lean',0),(p.get('x',0),p.get('hip',0)))
    for side,hip0,knee0,ankle0 in [('left',(125,170),(100,195),(89,216)),('right',(132,173),(151,195),(159,215))]:
        correction=np.array([0,2 if side=='right' else 0])
        target=np.array(ankle0,float)+p.get(side,[0,0])+correction
        hip=point(body,hip0);v=target-hip
        length=np.linalg.norm(np.array(knee0)-hip0)+np.linalg.norm(np.array(ankle0)-knee0)-.15
        if np.linalg.norm(v)>length:
            if abs(v[1])<=length:
                target[0]=hip[0]+np.sign(v[0])*math.sqrt(max(0,length*length-v[1]*v[1]))
            else:target=hip+v*length/np.linalg.norm(v)
        p[side]=(target-np.array(ankle0)-correction).tolist()
    return p


def pose(p):
    p=normalize_legs(p)
    body=rigid((128,167),p.get('lean',0),(p.get('x',0),p.get('hip',0)))
    cell=Image.new('RGBA',(CELL,CELL))
    # Small dark pelvis underlap hides only newly exposed hip joints.
    pelvis=Image.new('RGBA',(CELL,CELL));draw=ImageDraw.Draw(pelvis)
    draw.polygon([(119,164),(135,165),(143,181),(122,187),(112,179)],fill='#202331')
    cell.alpha_composite(warp(pelvis,body))
    for side,hip0,knee0,ankle0 in [
        ('left',(125,170),(100,195),(89,216)),
        ('right',(132,173),(151,195),(159,215)),
    ]:
        hip=point(body,hip0)
        target=np.array(ankle0,float)+np.array(p.get(side,[0,0]))
        # The approved three-quarter base has its front sole two pixels higher.
        # New poses place either supporting foot on the common floor at y224.
        if side=='right':target[1]+=2
        length1=np.linalg.norm(np.array(knee0)-hip0)
        length2=np.linalg.norm(np.array(ankle0)-knee0)
        joint=knee(hip,target,length1,length2,np.array(knee0)+[p.get('knee',0),p.get('hip',0)*.6],side)
        thigh=bone(hip0,knee0,hip,joint)
        shin=bone(knee0,ankle0,joint,target)
        cell.alpha_composite(warp(LAYERS[f'{side}_thigh'],thigh))
        cell.alpha_composite(warp(LAYERS[f'{side}_shin'],shin))
        boot=rigid(ankle0,p.get(f'{side}Angle',0),target-np.array(ankle0))
        cell.alpha_composite(warp(LAYERS[f'{side}_boot'],boot))
    cell.alpha_composite(warp(secondary(LAYERS['tails'],p.get('cloth',0),126),body))
    cell.alpha_composite(warp(LAYERS['body'],body))
    cell.alpha_composite(warp(secondary(LAYERS['front'],p.get('cloth',0)*.35,135),body))
    # Head is a rigid native-pixel translation, never a scaled/sheared face.
    head_offset=np.rint(point(body,(130,125))-np.array([130,125]))
    head=secondary(LAYERS['head'],p.get('hair',0),125)
    cell.alpha_composite(warp(head,(np.eye(2),head_offset)))
    wrist=rigid((137,164),p.get('wrist',0))
    weapon=(body[0]@wrist[0],body[0]@wrist[1]+body[1])
    cell.alpha_composite(warp(LAYERS['weapon'],weapon))
    # Fill transparent RGB with zero, preserving a binary alpha channel.
    data=np.array(cell);data[data[:,:,3]==0]=0
    # Drop detached cut-boundary specks, retaining diagonal pixel clusters.
    points=set(map(tuple,np.argwhere(data[:,:,3]>0)))
    while points:
        start=points.pop();component=[start];stack=[start]
        while stack:
            py,px=stack.pop()
            for oy in (-1,0,1):
                for ox in (-1,0,1):
                    neighbor=(py+oy,px+ox)
                    if neighbor in points:
                        points.remove(neighbor);stack.append(neighbor);component.append(neighbor)
        if len(component)<6:
            for py,px in component:data[py,px]=0
    return Image.fromarray(data)


def sequences():
    clips={}
    def add(name,label,durations,poses,loop=False,ground=True):
        clips[name]={'label':label,'durations':durations,'poses':poses,'loop':loop,'grounded':ground}
    def p(**kw):return kw
    # At 5.5 px/tick a three-tick key moves the planted ankle -16.5 px.
    # The old 28/34-tick shuffle dragged planted feet ~30 px per key.
    # Bring the feet under the hips in passing poses, rather than shuffling
    # forever in the base's wide fighting stance. Alternate support and lift.
    add('walkForward','Walk Forward',[3]*6,[
        p(hip=3,lean=2,left=[50.75,0],right=[-48.75,-4],cloth=0,hair=0,wrist=-1),
        p(hip=2,lean=3,left=[34.25,0],right=[-32.25,-10],cloth=2,hair=-1,wrist=0),
        p(hip=3,lean=2,left=[17.75,0],right=[-15.75,-4],cloth=3,hair=0,wrist=1),
        p(hip=4,lean=1,left=[1.25,-4],right=[.75,0],cloth=1,hair=1,wrist=2),
        p(hip=3,lean=2,left=[17.75,-10],right=[-15.75,0],cloth=-2,hair=2,wrist=1),
        p(hip=2,lean=3,left=[34.25,-4],right=[-32.25,0],cloth=-3,hair=1,wrist=0)],True)
    add('walkBack','Walk Back',[3]*6,[
        p(hip=3,lean=-3,left=[1.25,0],right=[.75,-4],cloth=1,hair=0,wrist=-2),
        p(hip=2,lean=-4,left=[17.75,0],right=[-15.75,-9],cloth=0,hair=1,wrist=-1),
        p(hip=3,lean=-3,left=[34.25,0],right=[-32.25,-4],cloth=-2,hair=2,wrist=0),
        p(hip=4,lean=-2,left=[50.75,-4],right=[-48.75,0],cloth=-3,hair=1,wrist=1),
        p(hip=3,lean=-3,left=[34.25,-9],right=[-32.25,0],cloth=0,hair=0,wrist=0),
        p(hip=2,lean=-4,left=[17.75,-4],right=[-15.75,0],cloth=2,hair=-1,wrist=-1)],True)
    add('dashForward','Dash Forward',[2,2,3,3,3],[
        p(hip=5,lean=9,left=[-3,0],right=[3,0],cloth=1,hair=-1,wrist=-2),
        p(hip=7,lean=20,left=[-5,-2],right=[6,0],cloth=3,hair=-2,wrist=-5),
        p(hip=8,lean=28,left=[-6,-5],right=[4,0],cloth=5,hair=-3,wrist=-8),
        p(hip=6,lean=22,left=[-4,-3],right=[2,0],cloth=4,hair=-2,wrist=-5),
        p(hip=3,lean=10,left=[-2,0],right=[1,0],cloth=2,hair=-1,wrist=-2)])
    add('backdash','Backdash',[2,2,3,3,3],[
        p(hip=5,lean=-8,left=[-3,0],right=[-1,0],cloth=-1,hair=1,wrist=-3),
        p(hip=1,lean=-14,left=[-5,-2],right=[-4,-4],cloth=-3,hair=2,wrist=-5),
        p(hip=-1,lean=-17,left=[-4,-3],right=[-7,-4],cloth=-4,hair=3,wrist=-7),
        p(hip=2,lean=-11,left=[-3,-1],right=[-4,-2],cloth=-2,hair=2,wrist=-4),
        p(hip=4,lean=-4,left=[-1,0],right=[-1,0],cloth=1,hair=0,wrist=-1)])
    crouch=p(hip=22,lean=7,left=[-2,0],right=[3,0],cloth=-1,hair=1,wrist=-9,knee=4)
    add('crouchStart','Crouch Start',[3,3],[p(hip=9,lean=3,cloth=1,hair=-1,wrist=-3),crouch])
    add('crouchIdle','Crouch Idle',[18,20],[crouch,{**crouch,'hip':23,'hair':2,'cloth':1,'wrist':-8}],True)
    add('crouchEnd','Crouch End',[3,3],[p(hip=13,lean=4,cloth=2,hair=1,wrist=-5),p(hip=2,lean=1,cloth=1,hair=0,wrist=-1)])
    add('jumpStart','Jump Start',[1,1,2],[p(hip=6,lean=1,cloth=-1),p(hip=14,lean=3,cloth=-2,hair=1,wrist=-3),p(hip=-1,lean=2,left=[2,0],right=[-2,0],cloth=1,hair=-1,wrist=-5)])
    add('jumpRise','Jump Rise',[4,4],[
        p(hip=-2,lean=6,left=[7,-4],right=[-5,-2],cloth=3,hair=2,wrist=-8),
        p(hip=0,lean=8,left=[13,-14],right=[-7,-9],cloth=5,hair=3,wrist=-11)],False,False)
    add('jumpApex','Jump Apex',[8],[p(hip=1,lean=5,left=[15,-16],right=[-10,-12],cloth=3,hair=2,wrist=-12)],False,False)
    add('jumpFall','Jump Fall',[4,4],[
        p(hip=0,lean=3,left=[10,-10],right=[-6,-7],cloth=-2,hair=-1,wrist=-9),
        p(hip=1,lean=1,left=[3,-2],right=[-2,-1],cloth=-4,hair=-2,wrist=-4)],False,False)
    add('landing','Landing',[2,2,2],[
        p(hip=8,lean=3,cloth=-3,hair=-2,wrist=-4),
        p(hip=13,lean=4,cloth=-1,hair=1,wrist=-5),
        p(hip=3,lean=1,cloth=2,hair=2,wrist=-1)])
    for name,clip in clips.items():
        for item in clip['poses']:
            if name=='dashForward':
                item['wrist']=-item['lean']-6
            elif item.get('hip',0)>=8:
                item['wrist']=min(item.get('wrist',0),-item['hip']*.8-4)
        clip['poses']=[normalize_legs(item) for item in clip['poses']]
    return clips


def build():
    locks=json.loads((ART/'idle-lock.json').read_text())
    for name,digest in locks.items():
        if hashlib.sha256((OUT/name).read_bytes()).hexdigest()!=digest.replace(' ',''):
            raise ValueError(f'Approved Idle changed: {name}')
    clips=sequences()
    (ART/'movement-rig.json').write_text(json.dumps(clips,indent=2)+'\n',encoding='utf-8')
    config_path=ROOT/'src/data/animations.json'
    config=json.loads(config_path.read_text(encoding='utf-8'))
    manifest={'pivot':PIVOT,'cell':[256,256],'clips':{'idle':{'label':'Idle','sheet':'idle.png','player2Sheet':'idle-p2.png','durations':[16,14,14,16,14,16],'loop':True,'grounded':True,'count':6}}}
    contact_rows=[]
    for name,clip in clips.items():
        frames=[pose(p) for p in clip['poses']]
        if clip['grounded']:
            # Cloth hems can touch the floor but never penetrate it. Ankles
            # remain where IK put them; this does not recenter a frame.
            for frame in frames:
                frame.paste((0,0,0,0),(0,224,256,256))
        if len({f.tobytes() for f in frames})!=len(frames):raise ValueError(f'Duplicate frames in {name}')
        sheet=Image.new('RGBA',(CELL*len(frames),CELL))
        for i,frame in enumerate(frames):
            sheet.paste(frame,(i*CELL,0))
            frame.save(OUT/f'{name}-{i:02}.png')
        sheet.save(OUT/f'{name}.png')
        palette_swap(sheet).save(OUT/f'{name}-p2.png')
        manifest['clips'][name]={k:v for k,v in clip.items() if k!='poses'}
        manifest['clips'][name].update({'sheet':f'{name}.png','player2Sheet':f'{name}-p2.png','count':len(frames),
            'bounds':[f.getbbox() for f in frames],
            'headOffsets':[np.rint(point(rigid((128,167),p.get('lean',0),(p.get('x',0),p.get('hip',0))),(130,125))-np.array([130,125])).astype(int).tolist() for p in clip['poses']]})
        config['clips'][name]={'sheet':f'samurai/{name}.png','player2Sheet':f'samurai/{name}-p2.png','frames':list(range(len(frames))),
            'ticks':clip['durations'][0],'durations':clip['durations'],'frameWidth':256,'frameHeight':256,
            'columns':len(frames),'pivot':PIVOT,'scale':1,'loop':clip['loop']}
        # Fixed crop and floor for each preview: never recenter each frame.
        row=Image.new('RGBA',(180*len(frames),180))
        previews=[]
        for i,frame in enumerate(frames):
            tile=checker((180,180));tile.alpha_composite(frame.crop((45,55,225,235)))
            draw=ImageDraw.Draw(tile);draw.line((0,169,179,169),fill='#627777')
            row.paste(tile,(i*180,0));previews.append(tile.resize((540,540),Image.Resampling.NEAREST))
        row.resize((row.width*3,540),Image.Resampling.NEAREST).save(OUT/f'{name}-preview.png')
        previews[0].save(OUT/f'{name}-animated.png',save_all=True,append_images=previews[1:],loop=0,
            duration=[round(d*1000/60) for d in clip['durations']],disposal=0,blend=0)
        contact_rows.append((name,row))
    manifest['clips']['idle']['bounds']=[Image.open(OUT/f'idle-{i:02}.png').getbbox() for i in range(6)]
    (OUT/'movement.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    config_path.write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')
    overview=Image.new('RGBA',(180*6,200*len(contact_rows)), '#111923')
    draw=ImageDraw.Draw(overview)
    for i,(name,row) in enumerate(contact_rows):
        draw.text((8,i*200+5),name,fill='#e7b777');overview.paste(row,(0,i*200+20))
    overview.save(OUT/'movement-overview.png')
    print(json.dumps({'newClips':len(clips),'newFrames':sum(len(c['poses']) for c in clips.values()),'idlePreserved':True}))


if __name__=='__main__':build()
