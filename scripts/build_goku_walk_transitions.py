"""Goku-only eight-tick planted steps from every painted walk phase to Idle.

Call build_transitions(animation_data, movement_manifest) after exporting the
36 walking cells. This adds internal atlas entries to those in-memory dicts,
and writes only new stop atlases/cells and dedicated transition geometry JSON.
The existing Idle and every other character PNG remain untouched.
"""
from pathlib import Path
import copy
import json
import math

import numpy as np
from PIL import Image,ImageDraw
from goku_walk_mesh import warp_painted
from goku_anatomy import box

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/sprites/goku'
TICKS=8
COLUMNS=16
SIDES=('near','far')

def compact_atlases(data,manifest):
    """Trim empty cell padding without scaling a single painted pixel."""
    crop=(56,80,216,240);width=height=160
    for name in ['walkStopForward','walkStopBack']:
        count=manifest['clips'][name]['count'];rows=math.ceil(count/COLUMNS)
        atlas=Image.new('RGBA',(COLUMNS*width,rows*height))
        for index in range(count):
            image=Image.open(OUT/f'{name}-{index:02}.png').convert('RGBA');b=image.getbbox()
            assert b[0]>=crop[0] and b[1]>=crop[1] and b[2]<=crop[2] and b[3]<=crop[3],(name,index,b)
            atlas.paste(image.crop(crop),((index%COLUMNS)*width,(index//COLUMNS)*height))
        atlas.save(OUT/f'{name}.png')
        for clip in [data['clips'][name],manifest['clips'][name]]:
            clip.update(frameWidth=width,frameHeight=height,pivot={'x':72,'y':144})


def _ease(t):
    t=max(0.,min(1.,float(t)))
    return t*t*(3-2*t)


def _cell(name,index,data):
    individual=OUT/f'{name}-{index:02}.png'
    if individual.exists():return Image.open(individual).convert('RGBA')
    clip=data['clips'][name];columns=clip.get('columns',len(clip['frames']))
    image=Image.open(ROOT/'public/sprites'/clip['sheet']).convert('RGBA')
    x=(index%columns)*256;y=(index//columns)*256
    return image.crop((x,y,x+256,y+256))


def _support(clip,phase):
    current=clip['support'][phase]
    if len(current)==1:return current[0]
    # At contact both feet touch: keep the old support until it lifts.
    for back in range(1,clip['count']+1):
        previous=clip['support'][(phase-back)%clip['count']]
        if len(previous)==1 and previous[0] in current:return previous[0]
    return current[0] if current else 'near'


def _goal(source,idle):
    result=copy.deepcopy(idle)
    src=source['anchors']['legs'];dst=idle['anchors']['legs']
    def cost(order):
        return sum(np.sum((np.array(src[s][2])-dst[d][2])**2) for s,d in zip(SIDES,order))
    order=min([SIDES,SIDES[::-1]],key=cost)
    result['anchors']['legs']={side:copy.deepcopy(dst[target]) for side,target in zip(SIDES,order)}
    return result,list(order)


def _interpolate(source,goal,step,pin):
    u=_ease(step/(TICKS-1));anchors={}
    for kind in ('legs','arms'):
        anchors[kind]={side:(np.array(source['anchors'][kind][side])*(1-u)+np.array(goal['anchors'][kind][side])*u).tolist() for side in SIDES}
    other='far' if pin=='near' else 'near'
    for side in SIDES:
        travel=_ease(step/3) if side==other else _ease((step-3)/4)
        start=np.array(source['anchors']['legs'][side][2]);end=np.array(goal['anchors']['legs'][side][2])
        ankle=start*(1-travel)+end*travel
        ankle[1]-=3*math.sin(math.pi*travel)
        anchors['legs'][side][2]=ankle.tolist()
    return anchors,[pin] if step<4 else [other]


def _head_mask(offset,idle=False):
    image=Image.new('L',(256,256));d=ImageDraw.Draw(image)
    dx,dy=map(int,offset)
    if idle:
        # Exact mask used by the preserved Idle source importer.
        d.rectangle((104+dx,dy,255,122+dy),fill=255)
        d.polygon([(123+dx,119+dy),(147+dx,119+dy),(144+dx,130+dy),(138+dx,131+dy),(126+dx,128+dy)],fill=255)
    else:
        d.rectangle((105+dx,dy,255,123+dy),fill=255)
        d.polygon([(119+dx,118+dy),(147+dx,118+dy),(145+dx,130+dy),(127+dx,132+dy),(119+dx,126+dy)],fill=255)
    return np.array(image)>0


def _paint(source_image,source_pose,goal_pose,anchors,step,idle_head=False):
    if step==0:return source_image.copy()
    src=[];dst=[]
    for kind in ('legs','arms'):
        for side in SIDES:
            src.extend(source_pose['anchors'][kind][side]);dst.extend(anchors[kind][side])
    # Four extra shoe points keep the sole flat instead of rotating it with
    # the calf. They move as one shoe, retaining the actual painted pixels.
    for side in SIDES:
        ankle=np.array(source_pose['anchors']['legs'][side][2]);target=np.array(anchors['legs'][side][2])
        for delta in [(-7,3),(14,3),(-7,10),(14,10)]:
            src.append((ankle+delta).tolist());dst.append((target+delta).tolist())
    source_head=np.array(source_pose.get('headOffset',[0,0]),float)
    target_head=np.rint(source_head*(1-_ease(step/7))+np.array(goal_pose.get('headOffset',[0,0]))*_ease(step/7)).astype(int)
    head_region=_head_mask(source_head,True)
    pixels=np.array(source_image);head=pixels.copy();head[~head_region]=0
    pixels[head_region]=0
    # Head pixels are copied with an integer shift, never deformed by MLS.
    for point in [(119,116),(144,116),(123,130),(142,130)]:
        src.append((np.array(point)+source_head).tolist());dst.append((np.array(point)+target_head).tolist())
    result=warp_painted(Image.fromarray(pixels),src,dst,.65)
    shift=target_head-source_head.astype(int)
    moved=Image.new('RGBA',(256,256));moved.paste(Image.fromarray(head),(int(shift[0]),int(shift[1])))
    result.alpha_composite(moved)
    a=np.array(result);a[224:]=0;a[a[:,:,3]==0]=0
    return Image.fromarray(a)


def _pose_meta(source,goal,idle,step,pin,phase,order):
    if step==TICKS-1:
        anchors=copy.deepcopy(idle['anchors'])
        # The endpoint painting restores Idle's near/far names. Continue to
        # round from the same physical loaded foot after that relabelling.
        other='far' if pin=='near' else 'near'
        support=[order[SIDES.index(other)]]
        head=list(idle.get('headOffset',[0,0]))
    else:
        anchors,support=_interpolate(source,goal,step,pin)
        head=np.rint(np.array(source.get('headOffset',[0,0]))*(1-_ease(step/7))+np.array(goal.get('headOffset',[0,0]))*_ease(step/7)).astype(int).tolist()
    feet=[anchors['legs'][s][2][0] for s in SIDES]
    hurt=[box([[118,108+head[1]],[144,132+head[1]]]),box([[108,128],[148,159]])]
    for kind in ('legs','arms'):
        for points in anchors[kind].values():
            for a,b in zip(points,points[1:]):hurt.append(box([a,b],5))
    return dict(ticks=1,phase='settle',sourceFrame=phase,step=step,pinnedFoot=pin,targetLegs=order,
                anchors=anchors,feet=feet,pixelFeet=np.rint(feet).astype(int).tolist(),support=support,
                headOffset=head,hurtboxes=hurt,hitboxes=[],settled=step==TICKS-1)


def build_transitions(data,manifest,reuse_idle_endpoint=False):
    """Add both internal atlases; return dedicated geometry for caller QA."""
    idle=manifest['clips']['idle']['poses'][0]
    idle_image=_cell('idle',0,data)
    geometry=dict(version=1,ticks=TICKS,clips={})
    previous_path=OUT/'walk-transitions.json'
    previous=json.loads(previous_path.read_text()) if reuse_idle_endpoint and previous_path.exists() else {'clips':{}}
    for source_name,stop_name in [('walkForward','walkStopForward'),('walkBack','walkStopBack')]:
        source_clip=manifest['clips'][source_name]
        count=source_clip['count']
        if count!=36:raise ValueError(f'{source_name}: expected36 painted per-tick cells, got{count}')
        frames_count=count*TICKS;rows=math.ceil(frames_count/COLUMNS)
        atlas=Image.new('RGBA',(COLUMNS*256,rows*256));poses=[];bounds=[]
        for phase in range(count):
            source_pose=source_clip['poses'][phase];source_image=_cell(source_name,phase,data)
            goal,order=_goal(source_pose,idle);pin=_support(source_clip,phase)
            for step in range(TICKS):
                index=phase*TICKS+step
                pose=_pose_meta(source_pose,goal,idle,step,pin,phase,order)
                if step==TICKS-1:image=idle_image.copy()
                elif step<4:image=_paint(source_image,source_pose,goal,pose['anchors'],step)
                elif (reuse_idle_endpoint and
                      step>=4 and
                      stop_name in previous['clips'] and
                      previous['clips'][stop_name]['poses'][index]==pose and
                      (OUT/f'{stop_name}-{index:02}.png').exists() and
                      _cell(stop_name,phase*TICKS+7,data).tobytes()==idle_image.tobytes()):
                    # Only the walk painting changed. This half depends solely
                    # on identical preserved Idle pixels and identical poses.
                    image=_cell(stop_name,index,data)
                else:
                    # The close-foot walk may hide a whole calf. Do not stretch
                    # those occluded source pixels into the wide Idle stance:
                    # approach the same intermediate geometry from the actual
                    # preserved endpoint painting during the second footstep.
                    image=_paint(idle_image,goal,goal,pose['anchors'],step,idle_head=True)
                atlas.paste(image,((index%COLUMNS)*256,(index//COLUMNS)*256))
                image.save(OUT/f'{stop_name}-{index:02}.png')
                poses.append(pose);bounds.append(image.getbbox())
        atlas.save(OUT/f'{stop_name}.png')
        geometry['clips'][stop_name]=dict(sourceClip=source_name,phaseCount=count,framesPerSource=TICKS,columns=COLUMNS,poses=poses)
        data['clips'][stop_name]=dict(sheet=f'goku/{stop_name}.png',columns=COLUMNS,frames=list(range(frames_count)),ticks=1,durations=[1]*frames_count,loop=False,internal=True)
        manifest['clips'][stop_name]=dict(label='Parar avanço' if source_name=='walkForward' else 'Parar recuo',sheet=stop_name+'.png',columns=COLUMNS,count=frames_count,durations=[1]*frames_count,loop=False,grounded=True,internal=True,externalGeometry='walk-transitions.json',geometryClip=stop_name,sourceClip=source_name,framesPerSource=TICKS,phaseCount=count,bounds=bounds,support=[p['support'] for p in poses],poses=[])
    compact_atlases(data,manifest)
    for path in [OUT/'walk-transitions.json',ROOT/'src/data/goku-walk-transitions.json']:
        path.write_text(json.dumps(geometry,indent=2)+'\n',encoding='utf-8')
    return geometry
