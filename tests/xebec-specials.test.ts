import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { justiceBeats, pandemoniumBeats, pandemoniumConfig, pandemoniumScene } from "../src/engine/xebec-pandemonium";
import { pandemoniumPrelude, pandemoniumBladeClips } from "../src/engine/xebec-pandemonium-acts";
import { kingWill, xebecPressure, xebecProjectile, xebecReleases, xebecSpecialArt } from "../src/engine/xebec-specials";

import { kingWillFronts } from "../src/render/xebec-king-will";
import { compatibleConquerorReleases } from "../src/engine/conqueror-haki";

type Input = Partial<InputFrame>;
const specials = [
  ["xebecFangs", "xebecDance", "xebecCarnage"],
  ["xebecCut", "xebecRift", "xebecTriple"],
  ["xebecPulse", "xebecSovereign", kingWill],
] as const;
const buttons = ["light", "medium", "heavy"] as const;
function arena(gap = 62, side: 1 | -1 = 1) {
  const m = new Match(characters.xebec, {}, characters.samurai);
  m.phase = "fight";
  const [a,b] = m.fighters;
  a.x = 640 - side * gap / 2; b.x = 640 + side * gap / 2;
  a.facing = side; b.facing = -side;
  const hits: { move: string; blocked: boolean; damage: number }[] = [];
  const step = (i: Input = {}, j: Input = {}) => {
    m.step([{ ...neutral(), ...i }, { ...neutral(), ...j }]);
    hits.push(...m.hits);
  };
  const advance = (ticks: number, j?: Input) => { for (let i=0; i<ticks; i++) step({}, j); };
  function motion(row: number, button: number, j?: Input) {
    step({ down: true },j);
    if (row === 2) {
      step({},j); step({ down: true, pressed: [buttons[button]] },j);
    } else {
      const direction = (row === 0 ? a.facing : -a.facing) as 1 | -1;
      step({ down: true, direction },j);
      step({ direction, pressed: [buttons[button]] },j);
    }
  }
  return { m, a, b, step, advance, motion, hits };
}

describe("Xebec's redesigned specials", () => {
  it.each(specials.flatMap((row, i) => row.map((id, j) => ({ id, i, j }))))(
    "$id is mirrored and reserves the charge for King Will", ({ id, i, j }) => {
      for (const facing of [1, -1] as const) {
        const p = arena(i === 1 ? 370 : 69, facing);
        p.a.domination!.charge = 100;
        p.motion(i, j);
        expect(p.a.moveId).toBe(id);
        expect(p.a.domination!.charge).toBe(id === kingWill ? 0 : 100);
        expect(p.a.meter).toBe(0);
        const m = p.a.move!, clip = xebecSpecialArt[id];
        expect(new Set(clip.frames).size).toBeGreaterThan(2);
        expect(clip.durations.reduce((a,b)=>a+b,0)).toBe(m.startup+m.active+m.recovery);
        p.advance(150);
        expect(p.a.domination!.charge).toBe(id === kingWill ? 0 : 100);
        expect(p.m.capture).toBeUndefined();
        expect(p.hits.length).toBeGreaterThan(0);
        if (i === 0) expect(p.hits.filter(hit=>hit.move===id)).toHaveLength(j + 2);
        if (i === 2) expect(p.hits.filter(hit=>hit.move===id)).toHaveLength(1);
      }
    },
  );

  it("rejects the incomplete double-down L without issuing an alternative", () => {
    const p = arena(90);
    p.a.domination!.charge = 99;
    p.a.meter = 100;
    p.motion(2,2);
    expect(p.a.moveId).toBe("");
    expect(p.a.domination!.charge).toBe(99);
    p.advance(80);
    expect(p.hits).toHaveLength(0);
    p.a.domination!.charge = 100;
    p.a.setState("hitstun");
    p.a.stun = 10;
    expect(p.a.attack(kingWill)).toBe(false);
    expect(p.a.domination!.charge).toBe(100);
  });

  it.each([0,1,2])("blast %i is blockable, finite and can strike from behind", button => {
    const id = specials[2][button as 0 | 1 | 2];
    const guard = arena(75);
    guard.a.x = 1164; guard.b.x = 1239;
    guard.a.domination!.charge = 100;
    guard.motion(2,button,{direction:1});
    guard.advance(100,{direction:1});
    expect(guard.hits).toMatchObject([{move:id, blocked:true, damage:0}]);
    const rear = arena(130);
    rear.a.domination!.charge = 100;
    rear.motion(2,button);
    const spec = xebecPressure(id)!;
    rear.b.x = rear.a.x - (button === 0 ? 96 : 167);
    const replay = restore(snapshot(rear.m));
    for (let i=0; i<110; i++) {
      rear.step(); replay.step([neutral(),neutral()]);
      expect(hashState(snapshot(replay))).toBe(hashState(snapshot(rear.m)));
    }
    expect(rear.hits).toHaveLength(1);
    expect(rear.b.health).toBeLessThan(1000);
    expect(spec.radius).toBe([116,196,373][button]);
  });

  it("gives King Will a short pressure reaction and a distinct legitimate KO", () => {
    for (const hp of [1000,100]) {
      const p = arena(205);
      p.b.health = hp;
      p.a.domination!.charge = 100;
      p.a.meter = 59;
      p.motion(2,2);
      while (!p.hits.length && p.a.stateFrame < 49) p.step();
      expect(p.b.hakiReaction).toBe(hp===100 ? "collapse" : "pressure");
      expect(p.a.meter).toBe(59);
      expect(p.a.domination!.charge).toBe(0);
      expect(p.b.health).toBe(hp===100 ? 0 : 877);
      if (hp === 100) expect(p.a.domination!.finishingPressure?.tick).toBeGreaterThanOrEqual(34);
      p.advance(100);
      if (hp===1000) {
        expect(p.b.hakiReaction).toBeUndefined();
        expect(p.b.state).toBe("idle");
      }
    }
  });

  it("only identifies simultaneous pure releases for a future confrontation", () => {
    const m = new Match(characters.xebec, {}, characters.xebec);
    const [a,b] = m.fighters;
    b.x = a.x + 78;
    for (const f of [a,b]) { f.domination!.charge=100; expect(f.attack(kingWill)).toBe(true); f.stateFrame=34; }
    expect(compatibleConquerorReleases(b,a)?.map(x=>x.fighter)).toEqual([0,1]);
    b.stateFrame = 33;
    expect(compatibleConquerorReleases(a,b)).toBeUndefined();
    b.stateFrame = 34;
    b.x = a.x + 700;
    expect(compatibleConquerorReleases(a,b)).toBeUndefined();
  });

  it("expands three cosmetic pressure fronts over one authoritative strike", () => {
    const release = xebecPressure(kingWill)!.release;
    expect(kingWillFronts(release - 1)).toHaveLength(0);
    expect(kingWillFronts(release + 3)).toHaveLength(1);
    expect(kingWillFronts(release + 12)).toHaveLength(2);
    const fronts = kingWillFronts(release + 22);
    expect(fronts).toHaveLength(3);
    expect(new Set(fronts.map(front => front.rx)).size).toBe(3);
    expect(fronts.every(front => front.alpha > 0 && front.ry < front.rx)).toBe(true);
    expect(kingWillFronts(release + 60)).toEqual([]);
    const battle = arena(230);
    battle.a.domination!.charge = 100;
    battle.motion(2,2);
    battle.advance(110);
    expect(battle.hits).toMatchObject([{ move: kingWill, damage: 123 }]);
    expect(battle.a.domination!.charge).toBe(0);
    const outside = arena(440);
    outside.a.domination!.charge = 100;
    outside.motion(2,2);
    outside.advance(110);
    expect(outside.hits).toHaveLength(0);
    expect(outside.a.domination!.charge).toBe(0);
  });

  it("leaves special waves vulnerable to projectiles and does not cut in recovery", () => {
    const p = arena(770);
    p.motion(1,1);
    while (!p.m.kiProjectiles.length) p.step();
    const wave = p.m.kiProjectiles[0];
    p.m.kiProjectiles.push({ ...wave, id: 101, owner: 1, move: "ki",
      facing: -1, x: wave.x + 30, previousX: wave.x + 30,
      vx: -14, radius: 13 });
    p.step();
    expect(p.m.kiProjectiles.map(p => p.state)).toEqual(["impact","impact"]);
    expect(p.m.events.at(-1)?.xebec?.move).toBe("xebecClash");
    const q = arena(770);
    q.motion(0,0);
    while (q.a.attackPhase !== "recovery") q.step();
    q.m.projectiles.push({ id: 101, owner: 1, move: "knives", x: q.a.x + 90, y: FLOOR - 103,
      previousX: q.a.x + 90, previousY: FLOOR - 103, vx: -24, vy: 0, facing: -1,
      age: 0, life: 20, sprite: 0, damage: 18, stun: 10, blockstun: 8 });
    q.advance(3);
    expect(q.b.health).toBe(1000);
    expect(q.m.events.some(e => e.xebec?.move === "xebecClash")).toBe(false);
  });

  it.each([0, 1, 2])("releases exactly %i + 1 moving waves on distinct sword poses", strength => {
    const fight = arena(740);
    fight.motion(1, strength);
    const attack = specials[1][strength];
    const ids = xebecReleases[attack]!;
    const released = new Map<string, { x: number; tick: number }>();
    const animation = xebecSpecialArt[attack];
    for (let tick = 0; tick < 100; tick++) {
      fight.step();
      for (const shot of fight.m.kiProjectiles)
        if (!released.has(shot.move)) released.set(shot.move, { x: shot.x, tick: fight.a.stateFrame });
    }
    expect([...released.keys()]).toEqual(ids);
    expect(ids).toHaveLength(strength + 1);
    const cels = [...released].map(([id, shot]) => {
      expect(shot.x).toBeGreaterThan(fight.a.x);
      expect(shot.tick).toBe(xebecProjectile(id)!.tick);
      let remaining = shot.tick;
      return animation.frames.find((_, i) => (remaining -= animation.durations[i]) < 0);
    });
    expect(new Set(cels).size).toBe(ids.length);
    const stopped = arena(740);
    stopped.motion(1, strength);
    stopped.advance(xebecProjectile(ids[0])!.tick - 2);
    stopped.a.setState("hitstun");
    stopped.a.stun = 40;
    stopped.advance(90);
    expect(stopped.m.kiProjectiles).toHaveLength(0);
  });

  it("keeps three independently timed, blockable waves under one cast credit", () => {
    const p = arena(685);
    p.motion(1,2);
    const ids = new Map<string, { tick: number; height: number; velocity: number }>();
    for (let i=0;i<73;i++) {
      p.step();
      for (const shot of p.m.kiProjectiles)
        if (shot.state === "flight" && !ids.has(shot.move)) ids.set(shot.move,{tick:i,height:shot.y,velocity:shot.vy});
    }
    expect([...ids.keys()]).toEqual(["xebecLowWave","xebecMidWave","xebecHighWave"]);
    expect(new Set([...ids.values()].map(w=>w.tick)).size).toBe(3);
    expect(new Set([...ids.values()].map(w=>w.height)).size).toBe(3);
    expect(ids.get("xebecHighWave")?.velocity).toBeLessThan(0);
    expect(xebecProjectile("xebecLowWave")?.level).toBe("mid");
    expect(p.a.domination!.charge).toBeLessThanOrEqual(18);
    const guard = arena(265);
    guard.motion(1,2,{direction:1,down:true});
    guard.advance(90,{direction:1,down:true});
    expect(guard.hits.length).toBeGreaterThan(1);
    expect(guard.hits.every(h=>h.blocked)).toBe(true);
  });

  it("allows only a confirmed third cut to open a limited aerial chase", () => {
    const p = arena(69);
    p.motion(0,1);
    for (let t=0;t<75 && !p.a.canCancel("jump");t++) p.step();
    expect(p.a.canCancel("jump")).toBe(true);
    p.step({pressed:["jump"]});
    for (let t=0;t<15 && !p.a.airborne;t++) p.step();
    expect(p.a.airborne).toBe(true);
  });

  it.each([1, -1] as const)("choreographs the Rocks relay without moving through a cut, side %s", facing => {
    const beats = pandemoniumBeats;
    const state = { attacker: 0, victim: 1, facing, originX: 640 - 96 * facing,
      targetX: 640, targetY: 580, scale: 1, hold: 0, tick: 0 };
    const at = (tick: number) => pandemoniumScene({ ...state, tick });
    const active = (tick: number) => at(tick).rocks.filter(a => a.opacity > .5);
    expect(active(beats.newgate - 1)).toHaveLength(0);
    expect(pandemoniumPrelude.map(({ tick }) => at(tick).phase)).toEqual(["horizontal", "diagonal", "cross", "rising"]);
    expect(at(beats.uppercut + 10).victim.y).toBeLessThan(500);
    expect(at(beats.apex).victim.y).toBeLessThan(at(beats.lift).victim.y);
    expect(at(beats.lift).victim.y).toBeLessThan(at(beats.cut).victim.y);
    expect(at(beats.lift).attacker.clip).toBe("pandemoniumDescent");
    expect(Math.abs(at(beats.lift).attacker.x - at(beats.lift).victim.x)).toBeLessThan(70);
    expect(at(beats.cut).attacker.tick).toBe(
      pandemoniumBladeClips.pandemoniumDescent.durations.slice(0, 5).reduce((a, b) => a + b, 0),
    );
    expect(at(beats.cut).victim.tick).toBe(0);
    expect(at(beats.reveal - 1).prometheus).toBeUndefined();
    const sun = at(beats.soul).prometheus!;
    expect(sun.jet).toBe(1);
    expect(sun.cel).toBeGreaterThanOrEqual(5);
    expect(sun.size).toBeGreaterThan(at(beats.reveal + 10).prometheus!.size * 1.5);
    expect(sun.aimX).toBe(at(beats.soul).victim.x);
    expect(sun.aimY).toBe(at(beats.soul).victim.y - 94);
    expect(at(beats.regroup).prometheus).toBeUndefined();
    expect(active(beats.quake).map(a => a.member)).toEqual(["newgate"]);
    expect(active(beats.club).map(a => a.member)).toEqual(["kaido"]);
    expect(active(beats.soul).map(a => a.member)).toEqual(["linlin"]);
    expect(active(beats.regroup + 23)).toHaveLength(3);
    for (const [t, yDirection] of [[beats.quake, -1], [beats.club, 1], [beats.soul, -1]]) {
      expect((at(t + 8).victim.y - at(t).victim.y) * yDirection).toBeGreaterThan(8);
      expect(Math.abs(at(t - 1).victim.x - at(t).victim.x)).toBeLessThan(10);
      expect(Math.abs(at(t - 1).victim.y - at(t).victim.y)).toBeLessThan(10);
    }
    const before = at(beats.gates - 1), after = at(beats.gates);
    expect(Math.abs(before.victim.x - after.victim.x)).toBeLessThan(3);
    expect(Math.abs(before.victim.y - after.victim.y)).toBeLessThan(3);
    expect(Math.abs(before.attacker.x - after.attacker.x)).toBeLessThan(3);
    expect(after.justiceTick).toBe(justiceBeats.gates);
    expect(at(beats.rush + 38).attacker.clip).toBe("pandemoniumGate");
    expect(at(beats.rupture).justiceTick).toBe(justiceBeats.rupture);
    expect(at(beats.rupture + 37).fracture).toBeGreaterThan(.3);
    expect(at(pandemoniumConfig.duration).camera.scale).toBe(1);
  });

  it("stages Pandemonium only if R lands, independently from Domination", () => {
    const p = arena(135);
    p.step({pressed:["ultimate"]});
    expect(p.a.moveId).toBe("");
    p.a.domination!.charge = 100;
    p.a.meter = 100;
    p.step({pressed:["ultimate"]});
    p.advance(20);
    expect(p.a.meter).toBe(0);
    expect(p.a.domination!.charge).toBe(100);
    expect(p.m.pandemonium).toBeDefined();
    expect(p.hits).toHaveLength(0);
    expect(p.b.health).toBe(1000);
    const restored = restore(snapshot(p.m));
    const holds = [...pandemoniumPrelude, ...pandemoniumConfig.hits].reduce((sum, beat) => sum + beat.hold, 4);
    for (let t = 0; t < pandemoniumConfig.duration + holds; t++) {
      p.step(); restored.step([neutral(),neutral()]);
      expect(hashState(snapshot(restored))).toBe(hashState(snapshot(p.m)));
      const tick = p.m.pandemonium?.tick;
      if (tick !== undefined && tick < pandemoniumBeats.cut) expect(p.b.health).toBe(1000);
      if (tick !== undefined && tick >= pandemoniumBeats.cut && tick < pandemoniumBeats.rupture)
        expect(p.b.health).toBe(868);
    }
    expect(p.hits).toEqual([
      { move: "pandemonium_cleave", blocked: false, damage: 132 },
      { move: "pandemonium_ground", blocked: false, damage: 202 },
    ].map(hit => expect.objectContaining(hit)));
    expect(p.b.health).toBe(666);
    expect(p.m.cinematicActive).toBe(false);
    expect(p.a.state).toBe("idle");
    for (const guard of [true,false]) {
      const q = arena(guard ? 90 : 630);
      q.a.meter=100;
      q.step({pressed:["ultimate"]},guard ? {direction:1} : {});
      q.advance(80,guard ? {direction:1} : {});
      expect(q.m.pandemonium).toBeUndefined();
      expect(q.b.health).toBe(1000);
      expect(q.hits).toHaveLength(guard ? 1 : 0);
      if (guard) expect(q.hits[0].blocked).toBe(true);
    }
  });
});
