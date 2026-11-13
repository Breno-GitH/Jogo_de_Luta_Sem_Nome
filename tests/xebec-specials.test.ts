import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { pandemoniumConfig } from "../src/engine/xebec-pandemonium";
import { GameSession } from "../src/game/session";

type Input = Partial<InputFrame>;
const specials = [
  ["xebecLightning", "xebecRift", "xebecRupture"],
  ["xebecIntimidation", "xebecPressure", "xebecCollision"],
  ["xebecBrutal", "xebecBreaker", "xebecConqueror"],
] as const;
const buttons = ["light", "medium", "heavy"] as const;

function arena(gap = 68, side: 1 | -1 = 1) {
  const match = new Match(characters.xebec, {}, characters.samurai);
  match.phase = "fight";
  const [a,b] = match.fighters;
  a.x = 640 - side * gap / 2;
  b.x = 640 + side * gap / 2;
  a.facing = side; b.facing = -side;
  const hits: { move: string; blocked: boolean; damage: number }[] = [];
  const step = (i: Input = {}, j: Input = {}) => {
    match.step([{ ...neutral(), ...i }, { ...neutral(), ...j }]);
    hits.push(...match.hits);
  };
  function advance(ticks: number, j?: Input) {
    for (let i=0; i<ticks; i++) step({}, j);
  }
  function motion(row: number, column: number, j?: Input) {
    step({ down: true },j);
    if (row === 2) {
      step({},j);
      step({ down: true, pressed: [buttons[column]] },j);
    } else {
      const direction = (row === 0 ? a.facing : -a.facing) as 1 | -1;
      step({ down: true, direction },j);
      step({ direction, pressed: [buttons[column]] },j);
    }
  }
  return { match, a, b, hits, step, advance, motion };
}

describe("Rocks D. Xebec", () => {
  it.each(specials.flatMap((row, i) => row.map((id, j) => ({ id, i, j }))))(
    "executes $id through the real input buffer on both sides",
    ({ id, i, j }) => {
      for (const side of [1,-1] as const) {
        const { a,b,hits,motion,advance } = arena(i === 0 && j === 1 ? 340 : 68, side);
        const origin = a.x;
        motion(i,j);
        expect(a.moveId).toBe(id);
        expect(a.meter).toBe(0);
        advance(90);
        if (id === "xebecCollision") expect(hits).toHaveLength(0);
        else {
          expect(hits.map(h => h.move)).toEqual(Array(id === "xebecBreaker" || id === "xebecConqueror" ? 2 : 1).fill(id));
          expect(b.health).toBeLessThan(b.data.health);
        }
        if (id === "xebecLightning" || id === "xebecBrutal") {
          expect((a.x - origin) * side).toBeGreaterThan(7);
          expect((b.x - a.x) * side).toBeGreaterThan(0);
        }
      }
    },
  );

  it("pushes on block and cannot turn a guarded first hit into the second hit", () => {
    const p = arena();
    p.motion(1,1,{ direction: 1 });
    p.advance(36,{ direction: 1 });
    expect(p.hits[0]).toMatchObject({ move: "xebecPressure", blocked: true });
    expect(p.a.domination!.charge).toBe(0);
    const q = arena();
    q.motion(2,1,{ direction: 1 });
    q.advance(45,{ direction: 1 });
    expect(q.hits).toHaveLength(1);
    expect(q.hits[0].blocked).toBe(true);
  });

  it("creates one swept projectile and rebuilds identically from its snapshot", () => {
    const p = arena(620);
    p.motion(0,1);
    p.advance(18);
    expect(p.match.kiProjectiles).toHaveLength(1);
    const clone = restore(snapshot(p.match));
    for (let i = 0; i < 75; i++) {
      p.step(); clone.step([neutral(),neutral()]);
      expect(hashState(snapshot(p.match))).toBe(hashState(snapshot(clone)));
    }
    expect(p.hits).toHaveLength(1);
    expect(p.match.kiProjectiles).toHaveLength(0);
  });

  it("counters a close strike, exposes recovery on whiff, and loses to a throw", () => {
    const p = arena(53);
    p.motion(1,2);
    p.advance(1);
    p.step({}, { pressed: ["light"] });
    p.advance(50);
    expect(p.hits.map(h => h.move)).toEqual(["xebecRiposte"]);
    expect(p.a.domination!.charge).toBe(26);
    const q = arena(53);
    q.motion(1,2);
    q.advance(17);
    expect(q.a.attackPhase).toBe("recovery");
    expect(q.hits).toHaveLength(0);
    const t = arena(53);
    t.motion(1,2);
    t.step({}, { pressed: ["throw"] });
    t.advance(50);
    expect(t.hits.some(h => h.move === "throw")).toBe(true);
    expect(t.hits.some(h => h.move === "xebecRiposte")).toBe(false);
  });

  it("awards once per multi-hit and consumes domination only for specials on L", () => {
    const p = arena(68);
    p.motion(2,1);
    p.advance(65);
    expect(p.hits).toHaveLength(2);
    expect(p.a.domination!.charge).toBe(18);
    for (const row of [0,1,2]) {
      const trial = arena(75);
      trial.a.domination!.charge = 100;
      trial.motion(row,2);
      expect(trial.a.domination).toMatchObject({ charge: 0, powered: true });
      const snap = restore(snapshot(trial.match));
      expect(snap.fighters[0].domination).toEqual(trial.a.domination);
      trial.advance(80);
      expect(trial.a.domination!.charge).toBe(0);
      if (row === 0) expect(trial.match.projectileSerial).toBe(1);
    }
    const light = arena(68);
    light.a.domination!.charge = 100;
    light.motion(2,0);
    light.advance(70);
    expect(light.a.domination!.charge).toBe(100);
  });

  it("throws only a grounded target within reach", () => {
    const p = arena(61);
    p.step({ pressed: ["throw"] });
    p.advance(80);
    expect(p.hits).toMatchObject([{ move: "throw", damage: 106 }]);
    expect(p.match.capture).toBeUndefined();
    const q = arena(200);
    q.step({ pressed: ["throw"] }); q.advance(80);
    expect(q.hits).toHaveLength(0);
  });

  it("charges one bar for R, stages only on contact, and restores control after deterministic KO", () => {
    const p = arena(138);
    p.step({ pressed: ["ultimate"] });
    expect(p.a.moveId).toBe("");
    p.a.meter = 100;
    p.b.health = 100;
    p.step({ pressed: ["ultimate"] });
    p.advance(20);
    expect(p.a.meter).toBe(0);
    expect(p.match.pandemonium).toBeDefined();
    const saved = restore(snapshot(p.match));
    let stageHits = 0;
    for (let i = 0; i < pandemoniumConfig.duration + 30; i++) {
      p.step(); saved.step([neutral(), neutral()]);
      expect(hashState(snapshot(saved))).toBe(hashState(snapshot(p.match)));
      stageHits += p.match.hits.filter(h => h.move === "pandemonium_ground").length;
    }
    expect(stageHits).toBe(1);
    expect(p.match.cinematicActive).toBe(false);
    expect(p.match.phase).toBe("roundEnd");
    expect(p.b.health).toBe(0);
    expect(p.a.actionClip).toBe("");
    const whiff = arena(620);
    whiff.a.meter = 100;
    whiff.step({ pressed: ["ultimate"] });
    whiff.advance(80);
    expect(whiff.match.pandemonium).toBeUndefined();
    expect(whiff.hits).toHaveLength(0);
    expect(whiff.a.state).toBe("idle");
  });

  it.each([
    [2, 0, "xebecBrutal"], [0, 0, "xebecLightning"], [2, 2, "xebecConqueror"],
  ] as const)("confirms J → K → %s/%s", (family, button, id) => {
    const p = arena(59);
    p.step({ pressed: ["light"] });
    while (!p.a.hitConfirmed) p.step();
    p.step({ pressed: ["medium"] });
    for (let i = 0; i < 50 && (p.a.moveId !== "stand_medium" || !p.a.hitConfirmed); i++) p.step();
    expect(p.a.canSpecialCancel()).toBe(true);
    p.advance(p.match.hitstop);
    p.motion(family, button);
    expect(p.a.moveId).toBe(id);
    p.advance(70);
    expect(p.hits.slice(0, 3).map(h => h.move)).toEqual(["stand_light", "stand_medium", id]);
  });

  it("confirms Quebra-Mar's launcher into a jump, with a finite cancel window", () => {
    const p = arena(58);
    p.step({ pressed: ["medium"] });
    for (let i = 0; i < 30 && !p.a.hitConfirmed; i++) p.step();
    p.advance(p.match.hitstop);
    p.motion(2, 1);
    for (let i = 0; i < 48 && !p.a.hitIds.includes(1); i++) p.step();
    expect(p.a.canCancel("jump")).toBe(true);
    expect(p.a.canSuperCancel()).toBe(true);
    p.step({ pressed: ["jump"] });
    for (let i = 0; i < 13 && !p.a.airborne; i++) p.step();
    expect(p.a.airborne).toBe(true);
    p.step({ pressed: ["light"] });
    p.advance(30);
    expect(p.hits.map(h => h.move)).toContain("air_light");
  });

  it.each(["arcade", "versus"] as const)("starts a real %s match", mode => {
    const session = new GameSession(mode, "normal", "xebec", "samurai");
    for (let i=0; i<120; i++) session.step(neutral());
    expect(session.match.fighters[0].data.id).toBe("xebec");
    expect(session.match.phase).toBe("fight");
  });
});
