import { describe, expect, it } from "vitest";
import { ben } from "../src/engine/ben-data";
import { benForms } from "../src/engine/ben-forms";
import { benObjectMove } from "../src/engine/ben-moves";
import type { BenAlien } from "../src/engine/ben-omnitrix";
import { characters } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type Button, type InputFrame } from "../src/engine/types";

const forms = ["xlr8", "fourArms", "heatblast"] as const;
const families = {
  xlr8: ["turbo", "cyclone", "lightning"],
  fourArms: ["tackle", "quad", "seismic"],
  heatblast: ["fireball", "pillar", "propulsion"],
} as const;

function arena(form: BenAlien, gap = 72, seat: 0 | 1 = 0) {
  const match = seat === 0
    ? new Match(ben, { training: true }, characters.sasuke)
    : new Match(characters.sasuke, { training: true }, ben);
  match.phase = "fight";
  const f = match.fighters[seat], rival = match.fighters[1 - seat];
  f.omnitrix!.active = form;
  f.x = 560;
  const facing = seat === 0 ? 1 : -1;
  rival.x = f.x + facing * gap;
  const events: typeof match.hits = [];
  const step = (input: Partial<InputFrame> = {}, target: Partial<InputFrame> = {}) => {
    const a = { ...neutral(), ...input }, b = { ...neutral(), ...target };
    match.step(seat === 0 ? [a, b] : [b, a]);
    events.push(...match.hits);
  };
  const run = (n: number, input: Partial<InputFrame> = {}, target: Partial<InputFrame> = {}) => {
    for (let i = 0; i < n; i++) step(input, target);
  };
  const button = (b: Button, options: Partial<InputFrame> = {}) => step({ ...options, pressed: [b] });
  const motion = (family: number, strength: "light" | "medium", input: Partial<InputFrame> = {}) => {
    step({ ...input, down: true });
    if (family === 2) {
      step(input);
      button(strength, { ...input, down: true });
    } else button(strength, { ...input, direction: family === 0 ? facing : facing === 1 ? -1 : 1 });
  };
  const afterHit = (input: Partial<InputFrame> = {}) => {
    while (match.hitstop) step(input);
  };
  return { match, f, rival, events, facing, step, run, button, motion, afterHit };
}

describe("Ben combat", () => {
  it.each(forms)("%s has six distinct normals and all six directional specials", form => {
    const { moves } = benForms[form]!;
    expect(Object.keys(moves)).toHaveLength(13);
    for (const posture of ["stand", "crouch", "air"] as const) for (const b of ["light", "medium"] as const) {
      const { f, rival, button, run, events } = arena(form);
      if (posture === "air") {
        f.y = FLOOR - (form === "fourArms" ? 66 : 45);
        f.vy = -1;
        f.setState("air");
      }
      if (posture === "crouch") rival.x = f.x + 64;
      button(b, { down: posture === "crouch" });
      const id = `${posture}_${b}`;
      expect(f.moveId).toBe(id);
      expect(f.hitbox()).toBeUndefined();
      run(45);
      expect(events.some(event => event.move === id && event.damage > 0), id).toBe(true);
    }
    for (let family = 0; family < 3; family++) for (const strength of ["light", "medium"] as const) {
      for (const seat of [0, 1] as const) {
        const id = `${families[form][family]}_${strength}`;
        const gap = id === "pillar_medium" ? 215 : id === "pillar_light" ? 85 : 68;
        const { f, rival, motion, run, events } = arena(form, gap, seat);
        const x = f.x;
        motion(family, strength);
        expect(f.moveId).toBe(id);
        run(110);
        if (id.startsWith("lightning")) {
          expect(rival.health).toBe(rival.data.health);
          expect(Math.abs(f.x - x)).toBeGreaterThan(95);
        } else expect(events.some(event => event.move === id && event.damage > 0), id).toBe(true);
      }
    }
  });

  it("keeps Turbo Rush K follow-up conditional and respects low guard", () => {
    const a = arena("xlr8", 135);
    a.motion(0, "medium");
    a.run(70);
    expect(a.events.filter(h => h.move === "turbo_medium").length).toBeGreaterThan(1);
    const b = arena("xlr8", 135);
    b.motion(0, "medium");
    b.run(70, {}, { direction: 1 });
    expect(b.events.filter(h => h.move === "turbo_medium").map(h => h.blocked)).toEqual([true]);
    const c = arena("xlr8", 62);
    c.button("light", { down: true });
    c.run(20, {}, { direction: 1, down: true });
    expect(c.events[0]?.blocked).toBe(true);
  });

  it("crosses a rival with Lightning K without causing damage or crossing the stage", () => {
    const a = arena("xlr8", 68);
    a.motion(2, "medium");
    a.run(45);
    expect(a.f.x).toBeGreaterThan(a.rival.x + 45);
    expect(a.events).toHaveLength(0);
    const corner = arena("xlr8");
    corner.f.x = 1125;
    corner.rival.x = 1240;
    corner.motion(2, "medium");
    corner.run(55);
    expect(corner.f.x).toBeLessThan(corner.rival.x);
    expect(corner.f.x).toBeLessThanOrEqual(1240);
  });

  it.each(forms)("%s confirms U against guarding and releases the target", form => {
    const a = arena(form, form === "fourArms" ? 76 : 61);
    a.run(6, {}, { direction: 1, down: true });
    a.step({ pressed: ["throw"] }, { direction: 1, down: true });
    a.run(80, {}, { direction: 1, down: true });
    expect(a.events.filter(h => h.move === "throw").map(h => h.damage)).toEqual([benForms[form]!.grab.damage]);
    expect(a.match.capture).toBeUndefined();
    expect(a.rival.state).not.toBe("grabbed");
  });

  it("rejects a distant grab and uses different grab durations and directions", () => {
    const a = arena("fourArms", 290);
    a.motion(1, "medium");
    a.run(80);
    expect(a.events).toHaveLength(0);
    const b = arena("xlr8", 60);
    b.button("throw");
    for (let t = 0; t < 50 && b.rival.vx >= 0; t++) b.step();
    expect(b.rival.x).toBeLessThan(b.f.x);
    expect(b.rival.vx).toBeLessThan(0);
    const c = arena("fourArms", 69);
    c.button("light");
    c.run(5);
    c.afterHit();
    c.motion(1, "light");
    c.run(65);
    expect(c.events.map(hit => hit.move)).toContain("quad_light");
  });

  it("does not duplicate a projectile, keeps pillar position and replays objects and swap across LAN snapshots", () => {
    const a = arena("heatblast", 220, 1);
    a.motion(1, "medium");
    a.run(18);
    const object = a.f.omnitrix!.objects[0];
    expect(benObjectMove(object.id).ben?.field?.type).toBe("pillar");
    const x = object.x;
    const replica = restore(snapshot(a.match));
    for (let n = 0; n < 40; n++) {
      a.step();
      replica.step([neutral(), neutral()]);
      expect(hashState(snapshot(replica))).toBe(hashState(snapshot(a.match)));
      if (a.f.omnitrix!.objects.length) expect(a.f.omnitrix!.objects[0].x).toBe(x);
    }
    expect(a.events.filter(h => h.move === "pillar_medium")).toHaveLength(1);
  });

  it.each([
    ["xlr8", "turbo_light"], ["fourArms", "tackle_light"], ["heatblast", "fireball_light"],
  ] as const)("%s can confirm J → K → special", (form, finisher) => {
    const a = arena(form, 68);
    a.button("light");
    a.run(benForms[form]!.moves.stand_light.startup);
    a.afterHit();
    a.button("medium");
    a.run(benForms[form]!.moves.stand_medium.startup);
    a.afterHit();
    a.motion(0, "light");
    a.run(65);
    expect(a.events.filter(h => h.damage).map(h => h.move)).toContain(finisher);
    expect(a.events.find(h => h.move === finisher)?.combo).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ["xlr8", true, true, 0, "medium", "turbo_medium"],
    ["xlr8", false, false, 2, "medium", "lightning_medium"],
    ["fourArms", true, false, 2, "light", "seismic_light"],
    ["fourArms", false, false, 0, "medium", "tackle_medium"],
    ["heatblast", true, false, 1, "light", "pillar_light"],
    ["heatblast", false, false, 2, "medium", "propulsion_medium"],
  ] as const)("%s links additional route %s %s %s %s %s", (form, lowStart, lowMedium, family, strength, finisher) => {
    const a = arena(form, 68);
    a.button("light", { down: lowStart });
    const keepDown = lowStart && lowMedium ? { down: true } : {};
    a.run(benForms[form]!.moves[lowStart ? "crouch_light" : "stand_light"].startup, keepDown);
    a.afterHit(keepDown);
    a.button("medium", { down: lowMedium });
    a.run(benForms[form]!.moves[lowMedium ? "crouch_medium" : "stand_medium"].startup);
    a.afterHit();
    a.motion(family, strength);
    expect(a.f.moveId).toBe(finisher);
    a.run(65);
    if (finisher === "lightning_medium") expect(a.events.map(h => h.move)).not.toContain(finisher);
    else expect(a.events.find(h => h.move === finisher)?.combo).toBeGreaterThanOrEqual(3);
  });

  it("follows Chama's light fireball with an approach and a jab at the edge", () => {
    const a = arena("heatblast");
    a.f.x = 1155;
    a.rival.x = 1240;
    a.motion(0, "light");
    for (let tick = 0; tick < 45 && a.f.state === "attack"; tick++) a.step();
    a.run(2, { direction: 1 });
    a.button("light", { direction: 1 });
    a.run(20);
    expect(a.events.find(h => h.move === "stand_light")?.combo).toBe(2);
  });

  it("blocks repetition of a special family until the combo ends", () => {
    const a = arena("xlr8");
    a.motion(1, "light");
    for (let tick = 0; tick < 45 && !a.f.hitConfirmed; tick++) a.step();
    expect(a.rival.combo).toBe(1);
    expect(a.f.attack("cyclone_medium")).toBe(false);
    a.run(90);
    expect(a.rival.combo).toBe(0);
    a.motion(1, "medium");
    expect(a.f.moveId).toBe("cyclone_medium");
  });

  it("launches with Cyclone K and chases with a real airborne J", () => {
    const a = arena("xlr8", 68);
    a.button("medium");
    a.run(7);
    a.afterHit();
    a.motion(1, "medium");
    for (let tick = 0; tick < 60 && !a.rival.airborne; tick++) a.step();
    expect(a.rival.airborne).toBe(true);
    a.afterHit();
    a.button("jump");
    for (let tick = 0; tick < 12 && !a.f.airborne; tick++) a.step();
    expect(a.f.airborne).toBe(true);
    a.button("light");
    a.run(20);
    expect(a.events.find(h => h.move === "air_light")?.combo).toBeGreaterThan(2);
  });

  it.each([
    ["heatblast", 2, "xlr8", "air_light"],
    ["fourArms", 2, "heatblast", "pillar_light"],
  ] as const)("uses a launcher to transfer %s into %s %s", (form, family, next, follow) => {
    const a = arena(form, 71);
    a.f.omnitrix!.selected = next;
    a.motion(family, "medium");
    for (let t = 0; t < 50 && !a.rival.airborne; t++) a.step();
    expect(a.rival.airborne).toBe(true);
    a.afterHit();
    a.step({ pressed: ["heavy"], omnitrix: { held: true } });
    a.run(24, { omnitrix: { held: true } });
    expect(a.f.omnitrix).toMatchObject({ active: next, comboSwap: true });
    if (follow === "air_light") {
      a.run(2, { direction: 1 });
      a.button("light", { direction: 1 });
    } else a.motion(1, "light");
    a.run(20);
    expect(a.events.find(hit => hit.move === follow)?.combo).toBe(2);
  });

  it("confirms XLR8 → Quatro Braços inside an existing combo, once", () => {
    const a = arena("xlr8", 67);
    a.f.omnitrix!.selected = "fourArms";
    a.motion(0, "light");
    a.step({ pressed: ["heavy"], omnitrix: { held: true } });
    a.run(24, { omnitrix: { held: true } });
    expect(a.f.omnitrix).toMatchObject({ active: "fourArms", comboSwap: true });
    a.button("medium", { omnitrix: { held: false } });
    a.run(15);
    const hit = a.events.find(e => e.move === "stand_medium");
    expect(hit?.combo).toBe(2);
    expect(a.f.omnitrix!.comboSwap).toBe(true);
  });
});

