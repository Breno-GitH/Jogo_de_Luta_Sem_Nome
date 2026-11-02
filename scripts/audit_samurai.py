"""Inspect the actual exported pixels, not just the rig's declared frame count.

The JSON is evidence, not an automated artistic score. Run before and after an
art correction; snapshots preserve the earlier source and PNGs for comparison.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import zipfile
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/sprites/samurai'
QA = ROOT / 'art/samurai/qa/audit'


def transformed(p, point):
    angle = math.radians(p.get('lean', 0))
    m = np.array([[math.cos(angle), -math.sin(angle)], [math.sin(angle), math.cos(angle)]])
    origin = np.array([128, 167])
    return m @ (np.array(point) - origin) + origin + [p.get('x', 0), p.get('hip', 0)]


def measure():
    clips = {}
    for file in ['movement.json', 'attacks.json', 'complete.json']:
        clips.update(json.loads((OUT / file).read_text())['clips'])
    report = {'clips': {}, 'invalidAlpha': [], 'dirtyTransparentRGB': [], 'edgeClipping': [],
              'identicalWithinClip': [], 'translationOnlyWithinClip': [], 'nearAdjacent': [],
              'bladeLengthPixels': [], 'activeBladeLengthPixels': [], 'activeBladeCoverage': [], 'armReachRatio': [], 'legReachRatio': [], 'walkContact': {}}
    global_hashes = {}
    for name, clip in clips.items():
        sheet = Image.open(OUT / clip['sheet']).convert('RGBA')
        frames = [np.array(sheet.crop((i*256, 0, (i+1)*256, 256))) for i in range(clip['count'])]
        hashes = []
        shapes = []
        colors = set()
        for i, cell in enumerate(frames):
            tag = f'{name}:{i}'
            if not set(np.unique(cell[:, :, 3])).issubset({0, 255}): report['invalidAlpha'].append(tag)
            if np.any(cell[cell[:, :, 3] == 0] != 0): report['dirtyTransparentRGB'].append(tag)
            if np.any(cell[[0, -1], :, 3]) or np.any(cell[:, [0, -1], 3]): report['edgeClipping'].append(tag)
            hashes.append(hashlib.sha256(cell.tobytes()).hexdigest())
            image = Image.fromarray(cell)
            crop = image.crop(image.getbbox())
            shapes.append(hashlib.sha256(str(crop.size).encode() + crop.tobytes()).hexdigest())
            colors.update(map(tuple, cell[cell[:, :, 3] != 0, :3]))
            global_hashes.setdefault(hashes[-1], []).append(tag)
        identical = [[a, b] for a in range(len(hashes)) for b in range(a+1, len(hashes)) if hashes[a] == hashes[b]]
        translated = [[a, b] for a in range(len(shapes)) for b in range(a+1, len(shapes)) if shapes[a] == shapes[b] and hashes[a] != hashes[b]]
        if identical: report['identicalWithinClip'].append({'clip': name, 'pairs': identical, 'loop': clip['loop']})
        if translated: report['translationOnlyWithinClip'].append({'clip': name, 'pairs': translated})
        ratios = []
        for i in range(len(frames)-1):
            a, b = frames[i:i+2]
            union = (a[:, :, 3] != 0) | (b[:, :, 3] != 0)
            ratio = float(np.count_nonzero(np.any(a != b, axis=2) & union) / max(1, np.count_nonzero(union)))
            ratios.append(round(ratio, 4))
            if ratio < .03: report['nearAdjacent'].append({'clip': name, 'pair': [i, i+1], 'changedFraction': round(ratio, 4)})
        report['clips'][name] = {'count': len(frames), 'unique': len(set(hashes)), 'loop': clip['loop'], 'colors': len(colors), 'adjacentChangedFraction': ratios}
        for i, pose in enumerate(clip.get('combat', {}).get('poses', [])):
            blade = pose['blade']
            a = np.array([blade['a']['x']+128, blade['a']['y']+224])
            b = np.array([blade['b']['x']+128, blade['b']['y']+224])
            report['bladeLengthPixels'].append(round(float(np.linalg.norm(b-a)), 3))
            if pose['phase'] != 'active': continue
            report['activeBladeLengthPixels'].append(round(float(np.linalg.norm(b-a)), 3))
            # Sample the full segment, allowing one source pixel for raster rounding.
            samples = a + np.linspace(0, 1, 100)[:, None] * (b-a)
            cell = frames[i]
            steel = np.zeros((256, 256), bool)
            for color in ['f1f5f5', 'd3d8df', 'a5a4ae', '777280']:
                steel |= np.all(cell[:, :, :3] == list(bytes.fromhex(color)), axis=2) & (cell[:, :, 3] > 0)
            points = np.argwhere(steel)[:, ::-1]
            nearest = np.linalg.norm(samples[:, None, :] - points[None, :, :], axis=2).min(axis=1)
            report['activeBladeCoverage'].append({'clip': name, 'frame': i, 'fractionWithin2px': round(float(np.mean(nearest <= 2)), 3)})
    report['sharedFramesAcrossClips'] = [v for v in global_hashes.values() if len({t.split(':')[0] for t in v}) > 1]
    for file in ['attack-rig.json', 'complete-rig.json']:
        for name, clip in json.loads((ROOT / 'art/samurai' / file).read_text()).items():
            for i, pose in enumerate(clip['poses']):
                grip = np.array(pose['grip'])
                angle = math.radians(pose['angle'])
                near_hand = grip - np.array([math.cos(angle), math.sin(angle)]) * 7 if pose.get('two') else transformed(pose, pose.get('free', [124, 165]))
                # Current pipeline may declare anatomical arm lengths explicitly.
                for side, shoulder, hand, length in [('far', [141, 140], grip, pose.get('farReach', 27)), ('near', [110, 132], near_hand, 43)]:
                    ratio = float(np.linalg.norm(hand - transformed(pose, shoulder)) / length)
                    report['armReachRatio'].append({'clip': name, 'frame': i, 'arm': side, 'ratio': round(ratio, 3)})
    movement = json.loads((ROOT/'art/samurai/movement-rig.json').read_text())
    rig_clips=dict(movement)
    for file in ['attack-rig.json','complete-rig.json']:
        rig_clips.update(json.loads((ROOT/'art/samurai'/file).read_text()))
    for name,clip in rig_clips.items():
        for i,p in enumerate(clip['poses']):
            for side,hip,knee,ankle in [('left',[125,170],[100,195],[89,216]),('right',[132,173],[151,195],[159,215])]:
                target=np.array(ankle)+np.array(p.get(side,[0,0]))+[0,2 if side=='right' else 0]
                length=np.linalg.norm(np.array(knee)-hip)+np.linalg.norm(np.array(ankle)-knee)
                ratio=float(np.linalg.norm(target-transformed(p,hip))/length)
                report['legReachRatio'].append({'clip':name,'frame':i,'leg':side,'ratio':round(ratio,3)})
    speed = json.loads((ROOT/'src/data/samurai.json').read_text())['speed']
    for name, direction in [('walkForward', 1), ('walkBack', -1)]:
        clip = movement[name]
        clock = np.cumsum([0] + clip['durations'][:-1])
        slips = []
        for side in ['left', 'right']:
            for i in range(len(clip['poses'])-1):
                a, b = clip['poses'][i:i+2]
                va, vb = a.get(side, [0, 0]), b.get(side, [0, 0])
                if va[1] == 0 and vb[1] == 0:
                    slips.append(abs(float((clock[i+1]-clock[i])*speed*direction + vb[0]-va[0])))
        report['walkContact'][name] = {'cycleTicks': sum(clip['durations']), 'groundedKeyframeSlipPx': slips,
            'meanSlipPx': round(float(np.mean(slips)), 3) if slips else None,
            'maxSlipDuringHeldCellPx': (max(clip['durations'])-1)*speed}
    report['summary'] = {'clips': len(clips), 'frames': sum(c['count'] for c in clips.values()),
        'exactDuplicatePairs': sum(len(c['pairs']) for c in report['identicalWithinClip']),
        'translationOnlyPairs': sum(len(c['pairs']) for c in report['translationOnlyWithinClip']),
        'nearAdjacentPairsUnder3Percent': len(report['nearAdjacent']),
        'maxArmReachRatio': max(r['ratio'] for r in report['armReachRatio']),
        'maxLegReachRatio': max(r['ratio'] for r in report['legReachRatio']),
        'minActiveBladeCoverage': min(r['fractionWithin2px'] for r in report['activeBladeCoverage']),
        'bladeLengthRange': [min(report['bladeLengthPixels']), max(report['bladeLengthPixels'])],
        'activeBladeLengthRange': [min(report['activeBladeLengthPixels']), max(report['activeBladeLengthPixels'])]}
    return report


def previews(label):
    # All pictures are actual exported cells, never re-rendered rig approximations.
    names = ['idle', 'walkForward', 'stand_light', 'stand_medium', 'stand_heavy', 'crouch_medium', 'air_heavy', 'damageHeavy', 'downed', 'victory']
    board = Image.new('RGB', (6*190, len(names)*185), '#18202b')
    d = ImageDraw.Draw(board)
    for row, name in enumerate(names):
        sheet = Image.open(OUT/f'{name}.png').convert('RGBA')
        count = sheet.width//256
        d.text((8, row*185+4), name, fill='#efdbbd')
        for j in range(min(6, count)):
            index = round(j*(count-1)/max(1, min(6,count)-1))
            tile = Image.new('RGBA', (190, 165), '#505b69')
            tile.alpha_composite(sheet.crop((256*index+35, 64, 256*index+225, 229)))
            ImageDraw.Draw(tile).line((0, 160, 189, 160), fill='#8e9caa')
            board.paste(tile.convert('RGB'), (190*j, row*185+20))
    board.resize((board.width*2, board.height*2), Image.Resampling.NEAREST).save(QA/f'{label}-contact.png')
    if label!='before':
        faces=Image.new('RGB',(4*176,200),'#202936');d=ImageDraw.Draw(faces)
        definitions=json.loads((ROOT/'art/samurai/complete-rig.json').read_text())
        for col,(name,index) in enumerate([('idle',0),('damageLight',1),('damageMedium',2),('damageHeavy',3)]):
            image=Image.open(OUT/f'{name}-{index:02}.png').convert('RGBA')
            offset=np.array([0,0]) if name=='idle' else np.rint(transformed(definitions[name]['poses'][index],(130,125))-[130,125]).astype(int)
            x,y=offset
            face=image.crop((126+x,109+y,146+x,130+y))
            tile=Image.new('RGBA',face.size,'#5a6675');tile.alpha_composite(face)
            faces.paste(tile.resize((160,168),Image.Resampling.NEAREST).convert('RGB'),(col*176+8,8))
            d.text((col*176+8,181),f'{name} / {index+1}',fill='#efdbbd')
        faces.save(QA/'faces-8x.png')


def export_pack():
    clips={}
    for name in ['movement','attacks','complete']:clips.update(json.loads((OUT/f'{name}.json').read_text())['clips'])
    target=ROOT/'public/downloads';target.mkdir(exist_ok=True)
    with zipfile.ZipFile(target/'samurai-audited-pngs.zip','w',zipfile.ZIP_DEFLATED) as archive:
        for name,clip in clips.items():
            for file in [clip['sheet'],clip['player2Sheet']]:archive.write(OUT/file,f'sheets/{file}')
            for i in range(clip['count']):
                file=f'{name}-{i:02}.png';archive.write(OUT/file,f'cells/{file}')
        for name in ['movement','attacks','complete']:archive.write(OUT/f'{name}.json',f'metadata/{name}.json')
        for name in ['animations','samurai','fx']:archive.write(ROOT/f'src/data/{name}.json',f'metadata/{name}.json')
        archive.write(ROOT/'public/sprites/fx/samurai-fx.png','fx/samurai-fx.png')
        archive.writestr('LEIA-ME.txt','Samurai auditado em 29/10/2026.\n58 clipes; 293 celulas P1; 116 sheets P1/P2.\nCelulas 256x256, pivo (128,224), PNG RGBA sem suavizacao.\nAs imagens de sheets/cells/fx tem transparencia real.\nMesma pose de retorno e variantes de especiais podem compartilhar quadros entre clipes.\n293 celulas NAO significa 293 desenhos exclusivos.\nArte articulada a partir da base aprovada; nao e uma producao redesenhada manualmente quadro a quadro.\nPersistem limitacoes de giro do tronco, costas, poses no chao e deslizamento dentro das exposicoes.\nConsulte AUDITORIA-SAMURAI.md no projeto para limites e testes.\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--label', default='current')
    parser.add_argument('--snapshot', action='store_true')
    parser.add_argument('--record-correction', choices=['movement', 'normal'])
    parser.add_argument('--export-pack',action='store_true')
    args = parser.parse_args()
    QA.mkdir(parents=True, exist_ok=True)
    if args.record_correction:
        # Explicit migration only. Ordinary generators still reject unexpected
        # art changes; the archived pre-audit exports remain independently usable.
        lock=ROOT/f'art/samurai/{args.record_correction}-lock.json'
        old=json.loads(lock.read_text())
        new={name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in old}
        baseline=QA/'before-source-and-exports.zip'
        if not baseline.exists():raise ValueError('Create --label before --snapshot before recording art corrections')
        with zipfile.ZipFile(baseline) as archive:
            original={name:hashlib.sha256(archive.read(f'public/sprites/samurai/{name}')).hexdigest() for name in old}
        changes={name:{'before':original[name],'after':new[name]} for name in old if original[name]!=new[name]}
        (QA/f'{args.record_correction}-revision.json').write_text(json.dumps(changes,indent=2)+'\n')
        lock.write_text(json.dumps(new,indent=2)+'\n')
        print(json.dumps({'recordedCorrection':args.record_correction,'changedFiles':len(changes),'baselineArchive':'before-source-and-exports.zip'}))
        raise SystemExit(0)
    if args.snapshot:
        with zipfile.ZipFile(QA/f'{args.label}-source-and-exports.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
            for folder in ['public/sprites/samurai', 'src/data', 'scripts']:
                for file in (ROOT/folder).glob('*'):
                    if file.suffix in ['.png', '.json', '.py']: archive.write(file, file.relative_to(ROOT))
            for file in (ROOT/'art/samurai').glob('*.json'): archive.write(file, file.relative_to(ROOT))
    report = measure()
    (QA/f'{args.label}.json').write_text(json.dumps(report, indent=2)+'\n')
    previews(args.label)
    if args.export_pack:export_pack()
    print(json.dumps({**report['summary'], 'walkContact': report['walkContact'], 'duplicates': report['identicalWithinClip'], 'nearAdjacent': report['nearAdjacent']}))
