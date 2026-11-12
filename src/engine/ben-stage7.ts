import { benObjectMove, type BenObject } from "./ben-moves";
import type { Fighter } from "./combat";
import { shapeHitsRect } from "./geometry";
import type { AttackShape, Rect } from "./types";

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const cloneLife = 236;
const emergeTicks = 8;
const fadeTicks = 9;

export interface EchoClone {
  id: number;
  slot: 0 | 1;
  x: number;
  facing: number;
  age: number;
  fading: number;
  cooldown: number;
  moving: boolean;
  action?: { kind: "jab" | "wave"; tick: number; aim: number };
}

export function echoCloneHurtbox(clone: EchoClone, floor: number): Rect {
  return { x: clone.x - 18, y: floor - 94, w: 36, h: 94 };
}

export function hitEchoClones(owner: Fighter, shapes: readonly AttackShape[], floor: number,
  reachable: (shape: AttackShape, x: number) => boolean) {
  let hit = false;
  for (const clone of owner.omnitrix?.echoClones ?? []) {
    if (clone.fading || clone.age < emergeTicks ||
        !shapes.some(shape => reachable(shape, clone.x) && shapeHitsRect(shape, echoCloneHurtbox(clone, floor)))) continue;
    clone.fading = fadeTicks;
    delete clone.action;
    hit = true;
  }
  return hit;
}

export function clearStage7(owner: Fighter) {
  const watch = owner.omnitrix;
  if (!watch) return;
  delete watch.echoClones;
  watch.objects = watch.objects.filter(({ id }) => {
    const type = benObjectMove(id)?.ben?.field?.type;
    return type !== "gravityWell" && type !== "gravityPulse" && type !== "gravityStone" && type !== "sonic" && type !== "sonicAssist";
  });
}

export function gravityAt(owner: Fighter, x: number, y: number, floor: number) {
  if (owner.omnitrix?.active !== "gravattack") return;
  return owner.omnitrix.objects.find(object => {
    const field = benObjectMove(object.id)?.ben?.field;
    return field?.type === "gravityWell" && object.age > 0 && object.age < field.life &&
      Math.abs(x - object.x) < field.width / 2 && y >= floor - field.height && y <= floor;
  });
}

export function planetoid(f: Fighter) {
  return f.state === "attack" && f.moveId === "gravityDomain_medium" && f.stateFrame >= 13 && f.stateFrame < 37;
}

export function drivePlanetoid(f: Fighter) {
  if (f.state !== "attack" || f.moveId !== "gravityDomain_medium") return;
  const tick = f.stateFrame;
  if (tick < 14 || tick > 40) {
    f.vx = 0;
    return;
  }
  if (tick >= 37 || f.connected) {
    f.vx *= .59;
    return;
  }
  const speed = Math.min(17, 2 + (tick - 14) * 1.33);
  const next = f.x + f.facing * speed;
  if (next < f.stageInset || next > 1280 - f.stageInset) {
    f.stateFrame = 37;
    f.vx = -f.facing * Math.min(4.8, speed * .46);
    return;
  }
  f.vx = speed * f.facing;
}

export function spawnGravityStones(owner: Fighter, frame: number, floor: number) {
  const medium = owner.moveId === "gravityRepel_medium";
  const offsets = medium ? [-29, 38, 73, 15] : [28, 57];
  const id = medium ? "gravityStone_medium" : "gravityStone_light";
  const watch = owner.omnitrix!;
  for (const [index, offset] of offsets.entries()) {
    watch.objects.push({
      id, fragment: index, age: 0, spent: false, cast: frame,
      x: clamp(owner.x + offset * owner.facing, 18, 1262), y: floor - 8,
      direction: owner.facing, vy: -(medium ? 5.1 : 4.3) - index * .45,
    });
  }
}

export function gravityStoneLaunch(object: BenObject) {
  const medium = object.id === "gravityStone_medium";
  return (medium ? 16 : 10) + (object.fragment ?? 0) * (medium ? 5 : 3);
}

export function tickGravityStone(object: BenObject) {
  const launch = gravityStoneLaunch(object);
  const index = object.fragment ?? 0;
  if (object.age < launch) {
    object.vy = (object.vy ?? 0) * .8;
    object.y += object.vy;
    return false;
  }
  if (object.age === launch) object.vy = [-.62, -2.8, 1.4, -1.8][index];
  object.y += object.vy ?? 0;
  object.vy = (object.vy ?? 0) + .045;
  const speed = object.id === "gravityStone_medium" ? 13 : 9;
  object.x += object.direction * Math.min(speed + index * .7, 3 + (object.age - launch) * 3);
  return true;
}

export function tickEchoClones(owner: Fighter, target: Fighter, frame: number, floor: number,
  obstructed: (x: number) => boolean) {
  const watch = owner.omnitrix;
  if (watch?.active !== "echoEcho") return;
  const move = owner.state === "attack" ? owner.move : undefined;
  const age = owner.stateFrame;
  const clones = watch.echoClones ??= [];
  const split = move?.ben?.echoSplit;
  if (move && split && (age === move.startup || split === 2 && age === move.startup + 7) && clones.length < 2) {
    const slot = clones.some(clone => clone.slot === 0) ? 1 : 0;
    const positions = slot === 0 ? [-66, 70, -99, 104] : [77, -116, 116, -89];
    const x = positions.map(offset => clamp(owner.x + offset * owner.facing, 26, 1254))
      .find(point => Math.abs(point - owner.x) >= 36 && Math.abs(point - target.x) >= 26 &&
        clones.every(clone => Math.abs(clone.x - point) >= 41) && !obstructed(point));
    if (x !== undefined) clones.push({ id: frame * 2 + slot, slot, x, age: 0, fading: 0, cooldown: 0,
      facing: owner.facing, moving: false });
    watch.echoCooldown = 93;
  }
  const ready = clones.filter(clone => clone.age >= emergeTicks && !clone.fading && !clone.cooldown && !clone.action);
  if (move && age === move.startup && owner.moveId === "stand_light") {
    const helper = ready.find(clone => Math.abs(clone.x - target.x) <= 63 &&
      Math.abs(target.y - floor) <= 45);
    if (helper) helper.action = { kind: "jab", tick: -4, aim: target.x };
  }
  if (move?.ben?.echoHarmony && age === move.startup) {
    const range = move.ben.echoHarmony === 2 ? 245 : 173;
    const center = clamp(owner.x + owner.facing * (move.ben.echoHarmony === 2 ? 127 : 83), 30, 1250);
    ready.filter(clone => Math.abs(clone.x - owner.x) < range).forEach((clone, i) => {
      clone.action = { kind: "wave", tick: -6 - i * 6, aim: center };
    });
  }
  watch.echoClones = clones.filter(clone => {
    clone.moving = false;
    if (clone.fading) return --clone.fading > 0;
    if (++clone.age >= cloneLife) {
      clone.fading = fadeTicks;
      delete clone.action;
      return true;
    }
    if (clone.cooldown > 0) clone.cooldown--;
    if (clone.age < emergeTicks) return true;
    if (clone.action) {
      const action = clone.action;
      clone.facing = action.aim >= clone.x ? 1 : -1;
      if (++action.tick === 4) {
        const id = action.kind === "jab" ? "echoCopyJab" : "echoCopyWave";
        const field = benObjectMove(id).ben!.field!;
        watch.objects.push({ id, sourceClone: clone.id, x: clamp(clone.x + clone.facing * field.offset, 12, 1268),
          y: floor - field.height, direction: clone.facing, age: 0, spent: false, cast: frame });
        clone.cooldown = action.kind === "jab" ? 35 : 29;
      }
      if (action.tick >= 14) delete clone.action;
      return true;
    }
    const desired = clamp(owner.x + (clone.slot === 0 ? -65 : 76) * owner.facing, 26, 1254);
    const next = clone.x + clamp(desired - clone.x, -4, 4);
    if (Math.abs(next - owner.x) >= 25 && Math.abs(next - target.x) >= 25 &&
        clones.every(other => other === clone || other.fading || Math.abs(other.x - next) >= 31) && !obstructed(next)) {
      clone.moving = Math.abs(next - clone.x) > 1;
      clone.x = next;
    }
    clone.facing = target.x < clone.x ? -1 : 1;
    return true;
  });
}
