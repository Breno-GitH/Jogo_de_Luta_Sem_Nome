import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import {
  astaSwords,
  practiceSword,
  commitAstaSword,
} from "../src/engine/asta-stances";
import {
  astaSpecialIds,
  astaSpecialMoves,
  astaTechniques,
  astaCells,
  astaSpecialBlade,
  astaSpecialGrip,
  astaReach,
} from "../src/engine/asta-specials";
import {
  stepAstaAntimagic,
  neutralizableEnergy,
} from "../src/engine/asta-antimagic";
import { snapshot, restore, hashState } from "../src/engine/state";
import { astaAnimation } from "../src/render/asta-animations";
import { Animator } from "../src/render/animator";
function arena(side: 1 | -1 = 1, gap = 85, opponent = "samurai") {
  const m = new Match(
    characters.asta,
    { training: true },
    characters[opponent as keyof typeof characters],
  );
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 640 - (side * gap) / 2;
  b.x = 640 + (side * gap) / 2;
  a.facing = side;
  b.facing = -side;
  const hits: typeof m.hits = [];
  function step(i: Partial<InputFrame> = {}, j: Partial<InputFrame> = {}) {
    m.step([
      { ...neutral(), ...i },
      { ...neutral(), ...j },
    ]);
    hits.push(...m.hits);
  }
  return { m, a, b, step, hits };
}
describe("Asta nine attack-integrated sword techniques", () => {
  it.each(astaSpecialIds)(
    "%s reads relative commands from all four swords and both sides",
    (id) => {
      for (const side of [1, -1] as const)
        for (const sword of astaSwords) {
          const p = arena(side, 400),
            s = astaTechniques[id];
          practiceSword(p.a, sword);
          p.step({ down: true });
          p.step(
            s.family === 2
              ? {}
              : { direction: (s.family === 0 ? side : -side) as 1 | -1 },
          );
          p.step(
            s.family === 2
              ? { down: true, pressed: [s.button] }
              : {
                  direction: (s.family === 0 ? side : -side) as 1 | -1,
                  pressed: [s.button],
                },
          );
          expect(p.a.moveId, id + "/" + side + "/" + sword).toBe(id);
          for (let t = 0; t < 100; t++) p.step();
          expect(p.a.asta!.equipped).toBe(s.stages.at(-1)!.sword);
          expect(p.a.asta!.pending).toBeUndefined();
          expect(p.a.attackShapes()).toHaveLength(0);
          p.a.attack("stand_light");
          expect(p.a.asta!.attackSword).toBe(s.stages.at(-1)!.sword);
        }
    },
  );
  it.each(astaSpecialIds)(
    "%s has body-specific six-cel segments, blade sockets and finite timing",
    (id) => {
      const m = astaSpecialMoves[id],
        cells = astaCells(id),
        data = astaAnimation();
      expect(cells.reduce((n, c) => n + c.ticks, 0)).toBe(
        m.startup + m.active + m.recovery,
      );
      expect(new Set(cells.map((c) => c.sheet)).size).toBe(
        id === "astaDualBreak" || id === "astaFlashSteps" ? 2 : 1,
      );
      for (const sheet of new Set(cells.map((c) => c.sheet))) {
        const clip = Object.values(data.clips).find(
          (c) => c.sheet === "asta/" + sheet + ".png",
        )!;
        expect(clip.frames).toEqual([0, 1, 2, 3, 4, 5]);
      }
      const p = arena();
      p.a.attack(id);
      for (const stage of astaTechniques[id].stages) {
        p.a.stateFrame = stage.at - 1;
        const old = p.a.asta!.equipped;
        commitAstaSword(p.a);
        expect(p.a.asta!.equipped).toBe(old);
        p.a.stateFrame = stage.at;
        commitAstaSword(p.a);
        commitAstaSword(p.a);
        expect(p.a.asta!.equipped).toBe(stage.sword);
      }
    },
  );
  it.each(astaSpecialIds)(
    "%s hits or guards without repeated damage after recovery",
    (id) => {
      for (const side of [1, -1] as const)
        for (const guard of [false, true]) {
          const p = arena(side);
          if (guard) {
            p.a.x = side === 1 ? 1150 : 130;
            p.b.x = side === 1 ? 1235 : 45;
          }
          p.a.attack(id);
          for (let t = 0; t < 130; t++)
            p.step({}, guard ? { direction: side } : {});
          expect(p.hits.length, id + "/" + side + "/" + guard).toBeGreaterThan(
            0,
          );
          expect(p.hits.length).toBeLessThanOrEqual(
            id === "astaFlashSteps" || id === "astaDualBreak" ? 2 : 1,
          );
          expect(p.hits.every((h) => h.blocked === guard)).toBe(true);
          expect(p.a.asta!.equipped).toBe(
            astaTechniques[id].stages.at(-1)!.sword,
          );
          expect(p.a.attackShapes()).toHaveLength(0);
        }
    },
  );
  it("retains the last committed stage on interruption, never two logical swords", () => {
    for (const t of [0, 2, 3, 20, 25, 26, 31]) {
      const p = arena();
      practiceSword(p.a, "slasher");
      p.a.attack("astaDualBreak");
      p.a.stateFrame = t;
      commitAstaSword(p.a);
      commitAstaSword(p.a);
      p.a.setState("hitstun");
      expect(p.a.asta!.equipped).toBe(
        t < 3 ? "slasher" : t < 26 ? "dweller" : "destroyer",
      );
      expect(p.a.asta!.attackSword).toBeUndefined();
      expect(p.a.asta!.pending).toBeUndefined();
    }
  });
  it("keeps two Dual contacts finite, permits the second strike to miss", () => {
    const p = arena();
    p.a.attack("astaDualBreak");
    for (let t = 0; t < 110; t++) {
      if (p.a.stateFrame === 24) p.b.x = 1150;
      p.step();
    }
    expect(p.hits.map((h) => h.move)).toEqual(["astaDualBreak"]);
    expect(p.a.asta!.equipped).toBe("destroyer");
  });
  it("limits Black Slash to one finite projectile and a cooldown", () => {
    const p = arena(1, 500);
    p.a.attack("astaBlackSlash");
    for (let t = 0; t < 12; t++) p.step();
    expect(p.m.kiProjectiles.filter((p) => p.state === "flight")).toHaveLength(
      1,
    );
    p.a.setState("idle");
    expect(p.a.attack("astaBlackSlash")).toBe(false);
    for (let t = 0; t < 80; t++) p.step();
    expect(p.m.kiProjectiles).toHaveLength(0);
    expect(p.a.attack("astaBlackSlash")).toBe(true);
  });
  it("does not escape hitstun, air, grabs or consume Super", () => {
    for (const state of [
      "hitstun",
      "blockstun",
      "grabbed",
      "ko",
      "air",
    ] as const) {
      const p = arena();
      p.a.setState(state);
      if (state === "air") p.a.y = FLOOR - 80;
      for (const id of astaSpecialIds)
        expect(p.a.attack(id), state + "/" + id).toBe(false);
    }
    const p = arena();
    p.a.meter = 100;
    p.a.attack("astaBlackDivider");
    expect(p.a.meter).toBe(100);
    expect(p.a.invulnerable).toBe(false);
  });
  it("allows on-hit special chains and rejects repeating a special in the same combo", () => {
    const p = arena();
    p.a.attack("stand_medium");
    for (let t = 0; t < 40 && !p.a.canCancel("special"); t++) p.step();
    expect(p.a.canCancel("special")).toBe(true);
    expect(p.a.attack("astaIaiSlash")).toBe(true);
    for (let t = 0; t < 40 && !p.a.canCancel("special"); t++) p.step();
    expect(p.a.asta!.equipped).toBe("slasher");
    expect(p.a.attack("astaIaiSlash")).toBe(false);
    expect(p.a.attack("astaBlackRush")).toBe(true);
  });
  it("shares the Divider geometry with its visible blade extension", () => {
    const id = "astaBlackDivider",
      t = astaSpecialMoves[id].startup,
      g = astaSpecialGrip(id, t),
      b = astaSpecialBlade(id, t);
    expect(Math.hypot(b.b.x - g.x, b.b.y - g.y)).toBeCloseTo(astaReach(id, t));
    expect(astaReach(id, t)).toBe(210);
  });
  it.each(astaSpecialIds)(
    "%s snapshots all sword stages, projectiles, recovery and command state",
    (id) => {
      const p = arena();
      p.a.attack(id);
      for (let t = 0; t < 5; t++) p.step();
      const q = restore(snapshot(p.m));
      for (let t = 0; t < 160; t++) {
        p.step();
        q.step([neutral(), neutral()]);
        expect(hashState(snapshot(p.m))).toBe(hashState(snapshot(q)));
      }
    },
  );
  it("intercepts one eligible energy within five active ticks and improves only its close response", () => {
    const p = arena(1, 300, "goku");
    p.a.attack("astaCausalityBreak");
    p.a.stateFrame = 8;
    const blade = astaSpecialBlade("astaCausalityBreak", 8),
      x = p.a.x + blade.a.x,
      y = p.a.y + blade.a.y;
    const shot = (move: string, id = 1) => ({
      id,
      owner: 1,
      move,
      cast: 1,
      x,
      y,
      previousX: x,
      previousY: y,
      vx: -8,
      vy: 0,
      facing: -1,
      radius: 12,
      age: 0,
      life: 50,
      state: "flight" as const,
      impactAge: 0,
    });
    p.m.kiProjectiles.push(shot("ki_light"), shot("ki_light", 2));
    stepAstaAntimagic(p.m);
    stepAstaAntimagic(p.m);
    expect(p.m.kiProjectiles.filter((x) => x.state === "impact")).toHaveLength(
      1,
    );
    expect(p.a.asta!.neutralized).toBe(1);
    expect(p.a.move!.damage).toBe(76);
    expect(p.a.invulnerable).toBe(false);
    const late = arena(1, 300, "goku");
    late.a.attack("astaCausalityBreak");
    late.a.stateFrame = 12;
    late.m.kiProjectiles.push(shot("ki_light"));
    stepAstaAntimagic(late.m);
    expect(late.a.asta!.neutralized).toBe(0);
  });
  it("explicitly excludes physical knives, Haki, anti-magic and Supers", () => {
    for (const [character, move] of [
      ["dio", "knives"],
      ["xebec", "xebecRift"],
      ["asta", "astaBlackSlash"],
      ["goku", "ultimate_start"],
      ["sasuke", "goryuka"],
    ] as const) {
      const p = arena(1, 300, character);
      expect(neutralizableEnergy(p.b, { move } as never)).toBe(false);
    }
    for (const [character, move] of [
      ["goku", "ki_light"],
      ["goku", "kamehameha_light"],
      ["sasuke", "gokakyu"],
      ["sasuke", "hosenka"],
    ] as const) {
      const p = arena(1, 300, character);
      expect(
        neutralizableEnergy(p.b, { move } as never),
        character + "/" + move,
      ).toBe(true);
    }
  });
});

describe("Asta air input regression",()=>{
 it("keeps air normals after a down-forward pursuit even with a recent special motion",()=>{
  const p=arena();p.a.attack("crouch_heavy");
  for(let t=0;t<45&&!p.a.canCancel("jump");t++)p.step({down:true});
  expect(p.a.canCancel("jump")).toBe(true);
  p.step({direction:1,pressed:["jump"]});
  for(let t=0;t<8&&!p.a.airborne;t++)p.step({direction:1});
  expect(p.a.airborne).toBe(true);p.step({pressed:["light"]});
  expect(p.a.moveId).toBe("air_light");
 });
});

it("Black Slash can only be blocked when the defender faces the arriving cut",()=>{
 const p=arena(1,300);const b=p.b;
 p.m.kiProjectiles.push({id:++p.m.projectileSerial,owner:0,move:"astaBlackSlash",cast:1,x:b.x+14,y:b.y-90,previousX:b.x+14,previousY:b.y-90,vx:-12,vy:0,facing:-1,radius:22,age:0,life:26,state:"flight",impactAge:0});
 p.step({}, {direction:1});expect(p.hits).toHaveLength(1);expect(p.hits[0].blocked).toBe(false);
});

it("dissipates one eligible beam at Eclipse rather than at its distant emitter",()=>{
 const p=arena(1,350,"goku");p.a.attack("astaCausalityBreak");p.a.stateFrame=8;
 p.m.beams.push({id:1,owner:1,move:"kamehameha_light",cast:1,facing:-1,x:p.a.x+300,y:p.a.y-90,length:300,radius:18,age:0,life:40,state:"active",hitIds:[],impactAge:0});
 stepAstaAntimagic(p.m);stepAstaAntimagic(p.m);
 expect(p.m.beams[0].state).toBe("dissipate");expect(p.a.asta!.neutralized).toBe(1);
 expect(p.m.events).toHaveLength(1);expect(Math.abs(p.m.events[0].x-p.a.x)).toBeLessThan(80);
 expect(p.a.invulnerable).toBe(false);
});
it("Rising Demon allows a bounded aerial pursuit after a valid launcher",()=>{
 const p=arena();p.a.attack("astaRisingDemon");
 for(let t=0;t<40&&!p.a.canCancel("jump");t++)p.step();
 expect(p.a.canCancel("jump")).toBe(true);p.step({direction:1,pressed:["jump"]});
 for(let t=0;t<8&&!p.a.airborne;t++)p.step({direction:1});
 expect(p.a.airborne).toBe(true);p.step({pressed:["light"]});
 for(let t=0;t<30;t++)p.step();
 expect(p.hits.map(h=>h.move)).toEqual(["astaRisingDemon","air_light"]);
 expect(p.b.combo).toBeLessThanOrEqual(2);
});
