"""Explicit exact-hash review. Not run by builds/tests; old freezes preserved."""
from goku_fury_art import ROOT,ART,read,write
import hashlib
base=read(ROOT/'art/goku/rebuild/physics-freeze.json')['files'];old=read(ROOT/'art/goku/specials/stage3/shared-engine-revisions.json')['files'];entries={}
reasons={
 'src/engine/combat.ts':'Add Goku-only motion priority, vulnerable startup/hit confirmation, fixed cinematic ownership/release and meter gain multiplier. Existing Road Roller/Samurai branches retained; regression checks required.',
 'src/engine/input.ts':'Add edge-sampled double quarter circle for Goku heavy only. Other motion recognizers and retained history bounds unchanged.',
 'src/engine/types.ts':'Add optional per-character meterGainScale. No other character data changed.',
 'src/engine/state.ts':'Explicit optional FuryState snapshot; no client-provided character data, no playable SSJ1 state.',
 'src/engine/bot.ts':'Pause bot plans during Fury and add delayed Goku-only normal-input Super command. Existing perception and opponent branches retained.'}
for name,digest in base.items():
 current=hashlib.sha256((ROOT/name).read_bytes()).hexdigest()
 if current==digest:continue
 if name in reasons:reason=reasons[name]
 else:assert name in old and old[name]['current']==current,name;reason=old[name]['reason']
 entries[name]={'baseline':digest,'current':current,'reason':reason}
write(ART/'shared-engine-revisions.json',{'stage':'Goku cinematic SSJ1, always returns to base','files':entries});print('Reviewed exact hashes:',list(entries))
