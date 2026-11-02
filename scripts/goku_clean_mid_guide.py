"""Planning-only skeletons for eight NEW complete drawings per walk.

Reads native shoe annotations, never old sprite pixels. These diagrams are
references for imagegen, not production frames, rig output or raster morphs.
"""
from pathlib import Path
import argparse
import json
import math

import numpy as np
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'art/goku/walk-v4'
FLOOR=223
SCALE=3.0
COLORS={'near':'#ffc16f','far':'#7aafe5','body':'#ece1c5','support':'#6ce0a9','swing':'#e58b9e'}


def plan_midposes(records,back=False):
    poses=[]
    for i,source in enumerate(records):
        nxt=records[(i+1)%8];phase=(i+.5)/8
        # Source annotations are planning references; no painted image is read.
        ankles={side:((np.array(source['ankle'][side],float)+np.array(nxt['ankle'][side],float))*.5) for side in ['near','far']}
        support=['near','far'] if i in (3,7) else ['near' if i<4 else 'far']
        for side in ['near','far']:
            if side in support:ankles[side][1]=213
            else:
                # A modest foot clearance, not a high-knee march. Occluded
                # ankle annotations are uncertain, so cap their inferred lift.
                ankles[side][1]=max(205 if back else 206,min(210,ankles[side][1]))
        bob=1.1*math.sin(4*math.pi*phase)
        twist=math.sin(2*math.pi*phase)
        centre=128+max(-2.5,min(2.5,(np.mean([p[0] for p in ankles.values()])-128)*.16))
        hips={'near':np.array([centre-5,159+bob]),'far':np.array([centre+5,159+bob])}
        knees={}
        for side in ['near','far']:
            hip=hips[side];ankle=ankles[side]
            # Projected joint placement: coherent knee flexion without forcing
            # the overlong old two-bone rig or inventing hidden shoe pixels.
            bend=3.5 if side in support else 6.0
            knee=hip*.48+ankle*.52+np.array([bend,-1 if side in support else -2])
            knees[side]=knee
        shoulders={'near':[110+1.7*twist,136+.6*bob],'far':[146-1.4*twist,137-.4*bob]}
        arms={
            'near':[shoulders['near'],[107+1.5*twist,151+.3*bob],[123+1.5*twist,146-.3*bob]],
            'far':[shoulders['far'],[153-.8*twist,151-.3*bob],[160-1.2*twist,137+.3*bob]],
        }
        poses.append(dict(sourceFrame=i,nextFrame=(i+1)%8,midPhase=i+.5,
                          support=support,ankle={s:ankles[s].tolist() for s in ankles},
                          hip={s:hips[s].tolist() for s in hips},knee={s:knees[s].tolist() for s in knees},
                          arms=arms,neck=[133,129+.2*bob],head=[134,114+.2*bob],
                          note='New whole-pose drawing reference only; ankle lift is a planning estimate, not a production warp.'))
    return poses


def draw_guide(name,poses,path):
    image=Image.new('RGB',(2048,1024),'#152534');d=ImageDraw.Draw(image)
    for i,p in enumerate(poses):
        ox=(i%4)*512;oy=(i//4)*512
        def pt(q):return (round(ox+256+(q[0]-128)*SCALE),round(oy+450+(q[1]-FLOOR)*SCALE))
        def line(points,color,width=4):d.line([pt(v) for v in points],fill=color,width=width,joint='curve')
        def dot(q,color,r=4):
            x,y=pt(q);d.ellipse((x-r,y-r,x+r,y+r),fill=color)
        d.text((ox+18,oy+12),f'{name} / NEW MID {i+1}: base {i+1} -> base {(i+1)%8+1}',fill='#f7dda0')
        d.text((ox+18,oy+30),'FULL BODY / TWO FISTS / LOW STEP / FACE RIGHT',fill='#bed2d6')
        d.line((ox+32,oy+450,ox+480,oy+450),fill='#5d9da6',width=2)
        # Far leg first, as a depth cue; both are entirely new guide geometry.
        for side in ['far','near']:
            hip=p['hip'][side];knee=p['knee'][side];ankle=np.array(p['ankle'][side])
            color=COLORS[side];line([hip,knee,ankle],color,6)
            for q in [hip,knee,ankle]:dot(q,color,5)
            v=ankle-np.array(knee);v/=max(.001,float(np.linalg.norm(v)));cuff=ankle-v*11
            line([cuff,ankle],color,9)
            shoe=[ankle+q for q in np.array([[-5,1],[4,1],[6,5],[13,8],[13,10],[-7,10],[-7,5],[-5,1]])]
            line(shoe,color,3)
            state=COLORS['support'] if side in p['support'] else COLORS['swing']
            dot(ankle+[1,10],state,6)
            if side in p['support']:line([ankle+[-6,10],ankle+[12,10]],state,5)
        # Pelvis and rib cage: asymmetry suggests weight transfer, not scaling.
        line([p['hip']['near'],p['hip']['far']],COLORS['body'],5)
        line([p['arms']['near'][0],p['neck'],p['arms']['far'][0]],COLORS['body'],5)
        line([p['arms']['near'][0],p['hip']['near'],p['hip']['far'],p['arms']['far'][0]],COLORS['body'],4)
        line([p['neck'],[(p['hip']['near'][0]+p['hip']['far'][0])/2,159]],'#a7b7bf',3)
        for side in ['far','near']:
            arm=p['arms'][side];line(arm,COLORS[side],6)
            for q in arm:dot(q,COLORS[side],5)
            # Separate fists remain in a live guard; no relaxed dangling hand.
            wrist=np.array(arm[-1]);line([wrist,wrist+[1,-4]],COLORS[side],6)
            x,y=pt(wrist+[1,-5]);d.rounded_rectangle((x-11,y-12,x+11,y+10),radius=4,outline=COLORS['body'],width=3)
        line([p['neck'],p['head']],COLORS['body'],5)
        hx,hy=pt(p['head']);d.ellipse((hx-27,hy-35,hx+27,hy+31),outline=COLORS['body'],width=4)
        d.line((hx+13,hy-5,hx+36,hy-5),fill='#ffd980',width=4)
        d.text((ox+18,oy+476),'GREEN = planted sole; PINK = lifted. Skeleton is planning only.',fill='#bbd1d6')
    image.save(path)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--landmarks',default=str(ART/'landmarks.json'))
    parser.add_argument('--out-dir',default=str(ART))
    args=parser.parse_args();records=json.loads(Path(args.landmarks).read_text(encoding='utf-8'))
    target=Path(args.out_dir);target.mkdir(parents=True,exist_ok=True)
    result={'purpose':'planning only; no production pixels or pose deformation','forward':plan_midposes(records['walkForward']),'back':plan_midposes(records['walkBack'],True)}
    for key in ['forward','back']:draw_guide(key.upper(),result[key],target/f'{key}-mid-guide.png')
    (target/'mid-guide.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'guides':[str(target/'forward-mid-guide.png'),str(target/'back-mid-guide.png')],'canvas':[2048,1024],'newFullDrawingsPlanned':16,'productionImagesRead':0}))


if __name__=='__main__':main()
