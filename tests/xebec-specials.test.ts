import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { pandemoniumConfig } from "../src/engine/xebec-pandemonium";
import { xebecGrapple, xebecProjectile, xebecSpecialArt } from "../src/engine/xebec-specials";

type Input = Partial<InputFrame>;
const specials = [
  ["xebecThrust", "xebecAscension", "xebecGatebreaker"],
  ["xebecCut", "xebecRift", "xebecTriple"],
  ["xebecBrutal", "xebecDominion", "xebecExplosion"],
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
    "$id consumes a full bar on either side and has authored timing",
    ({ id, i, j }) => {
      for (const side of [1, -1] as const) {
        const p = arena(i === 1 && j > 0 ? 300 : 70, side);
        p.a.domination!.charge = 100;
        p.motion(i,j);
        expect(p.a.moveId).toBe(id);
        expect(p.a.domination).toMatchObject({ charge: 0, powered: true });
        expect(p.a.meter).toBe(0);
        const animation = xebecSpecialArt[id];
        const move = p.a.move!;
        expect(new Set(animation.frames).size).toBeGreaterThan(2);
        expect(animation.durations.reduce((a,b) => a + b)).toBe(move.startup + move.active + move.recovery);
        p.advance(105);
        expect(p.a.domination!.charge).toBe(0);
        expect(p.a.domination!.powered).toBe(false);
        expect(p.hits.length).toBeGreaterThan(0);
      }
    },
  );

  it("keeps full charge through movement, a heavy normal, and a failed activation", () => {
    const p = arena(72);
    p.a.domination!.charge = 100;
    p.step({direction: -1}); p.advance(80);
    p.step({pressed:["heavy"]}); p.advance(45);
    p.a.setState("hitstun");
    p.a.stun = 25;
    expect(p.a.attack("xebecGatebreaker")).toBe(false);
    expect(p.a.domination!.charge).toBe(100);
    p.advance(30);
    p.motion(1,0);
    p.b.attack("stand_light");
    p.a.setState("hitstun");
    expect(p.a.domination).toMatchObject({charge:0,powered:false});
  });

  it.each([0,1,2])("separates the capture and blockable whiff wave for strength %s", strength => {
    const id = specials[2][strength];
    const capture = arena(64);
    capture.motion(2,strength);
    for (let t=0; t<25 && !capture.m.capture; t++) capture.step();
    expect(capture.m.capture?.xebec?.id).toBe(id);
    const live = restore(snapshot(capture.m));
    for (let t=0;t<85;t++) {
      capture.step(); live.step([neutral(),neutral()]);
      expect(hashState(snapshot(live))).toBe(hashState(snapshot(capture.m)));
    }
    expect(capture.hits).toMatchObject([{move:id,damage:xebecGrapple(id)!.grabDamage,blocked:false}]);
    const whiff = arena(430);
    whiff.motion(2,strength);
    while (whiff.a.stateFrame < xebecGrapple(id)!.to) whiff.step();
    whiff.b.x = whiff.a.x + Math.min(87, xebecGrapple(id)!.reach);
    for (let i=0;i<45;i++) {
      expect(whiff.m.capture).toBeUndefined();
      whiff.step({}, {direction:1});
    }
    expect(whiff.hits).toMatchObject([{move:id,blocked:true,damage:0}]);
    expect(whiff.a.domination!.charge).toBe(0);
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
    q.m.projectiles.push({ id: 101, owner: 1, move: "knives", x: q.a.x + 50, y: FLOOR - 113,
      previousX: q.a.x + 50, previousY: FLOOR - 113, vx: -12, vy: 0, facing: -1,
      age: 0, life: 20, sprite: 0, damage: 18, stun: 10, blockstun: 8 });
    q.step();
    expect(q.b.health).toBe(1000);
    expect(q.a.health).toBeLessThan(1000);
    expect(q.m.events.some(e => e.xebec?.move === "xebecClash")).toBe(false);
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
    expect(xebecProjectile("xebecLowWave")?.level).toBe("low");
    expect(p.a.domination!.charge).toBeLessThanOrEqual(18);
    const guard = arena(265);
    guard.motion(1,2,{direction:1,down:true});
    guard.advance(90,{direction:1,down:true});
    expect(guard.hits.length).toBeGreaterThan(1);
    expect(guard.hits.every(h=>h.blocked)).toBe(true);
  });

  it("cuts only eligible projectiles at active sword contact", () => {
    for (const [button, move, shouldBreak] of [
      [0,"ki",true], [0,"gokakyu",false], [2,"gokakyu",true], [2,"goryuka",false],
    ] as const) {
      const p = arena(600);
      p.motion(0,button);
      for (let i=0; i<p.a.move!.startup - 1; i++) p.step();
      p.m.kiProjectiles.push({
        id:1,owner:1,move,cast:0,x:p.a.x+109,y:FLOOR-114,previousX:p.a.x+109,previousY:FLOOR-114,
        vx:-7,vy:0,facing:-1,radius:15,age:0,life:12,state:"flight",impactAge:0,
      });
      p.advance(3);
      expect(p.m.kiProjectiles.length === 0, move + "/" + button).toBe(shouldBreak);
      expect(p.m.events.some(e=>e.xebec?.move==="xebecClash")).toBe(shouldBreak);
    }
  });

  it("permits a limited jump chase from Ruptura Ascendente and Domínio Absoluto", () => {
    for (const family of [0,2]) {
      const p = arena(70);
      p.motion(family,1);
      for (let t=0;t<70 && !p.a.canCancel("jump");t++) p.step();
      expect(p.a.canCancel("jump")).toBe(true);
      p.step({pressed:["jump"]});
      for (let t=0;t<15 && !p.a.airborne;t++) p.step();
      expect(p.a.airborne).toBe(true);
      p.step({pressed:["light"]});
      p.advance(30);
      expect(p.hits.some(h=>h.move==="air_light")).toBe(true);
    }
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
    const restored = restore(snapshot(p.m));
    for (let t=0;t<pandemoniumConfig.duration+24;t++) {
      p.step(); restored.step([neutral(),neutral()]);
      expect(hashState(snapshot(restored))).toBe(hashState(snapshot(p.m)));
    }
    expect(p.hits.map(h=>h.move)).toEqual(["pandemonium","pandemonium_ground"]);
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
