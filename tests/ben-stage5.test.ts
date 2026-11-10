import { describe, expect, it } from "vitest";
import { benForms } from "../src/engine/ben-forms";
import { benFormBalance, benObjectHeight, benObjectMove } from "../src/engine/ben-moves";
import type { BenAlien } from "../src/engine/ben-omnitrix";
import { characters, type CharacterId } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, overlaps, type Button, type InputFrame } from "../src/engine/types";
import { feedbackConductorContact, feedbackConductorPaths } from "../src/engine/feedback-conductor";
import { FighterPresentation } from "../src/render/presentation";
import { benAnimation, feedbackHeadAnchor } from "../src/render/ben-animations";

const forms = ["diamondhead", "humungousaur", "feedback"] as const;

function arena(form: BenAlien, gap = 78, seat: 0 | 1 = 0, opponent: CharacterId = "sasuke") {
  const ids = seat === 0 ? [characters.ben, characters[opponent]] : [characters[opponent], characters.ben];
  const match = new Match(ids[0], { training: true }, ids[1]);
  match.phase = "fight";
  const f = match.fighters[seat], rival = match.fighters[1 - seat], watch = f.omnitrix!;
  watch.active = watch.selected = form;
  const facing: 1 | -1 = seat === 0 ? 1 : -1;
  f.x = 640 - 190 * facing;
  rival.x = f.x + facing * gap;
  const events: typeof match.hits = [];
  const step = (input: Partial<InputFrame> = {}, target: Partial<InputFrame> = {}) => {
    const a = { ...neutral(), ...input }, b = { ...neutral(), ...target };
    match.step(seat === 0 ? [a, b] : [b, a]);
    events.push(...match.hits);
  };
  const run = (ticks: number, input: Partial<InputFrame> = {}, target: Partial<InputFrame> = {}) => {
    for (let tick = 0; tick < ticks; tick++) step(input, target);
  };
  const button = (b: Button, options: Partial<InputFrame> = {}) => step({ ...options, pressed: [b] });
  const motion = (family: number, strength: "light" | "medium") => {
    step({ down: true });
    if (family === 2) {
      step();
      button(strength, { down: true });
    } else button(strength, { direction: family === 0 ? facing : facing === 1 ? -1 : 1 });
  };
  const release = () => { while (match.hitstop) step(); };
  const swap = (to: BenAlien) => {
    watch.selected = to;
    step({ pressed: ["heavy"], omnitrix: { held: true } });
    run(24, { omnitrix: { held: true } });
    step({ omnitrix: { held: false } });
  };
  return { match, f, rival, watch, facing, events, step, run, button, motion, release, swap };
}

describe("Stage 5 move families", () => {
  it.each(forms)("%s lands the six normals and its grounded throw facing either direction", form => {
    for (const seat of [0, 1] as const) {
      for (const posture of ["stand", "crouch", "air"] as const) {
        for (const key of ["light", "medium"] as const) {
          const a = arena(form, 73, seat);
          if (posture === "air") { a.f.y -= 66; a.f.vy = -1; a.f.setState("air"); }
          a.button(key, { down: posture === "crouch" });
          const id = `${posture}_${key}`;
          expect(a.f.moveId).toBe(id);
          a.run(50);
          expect(a.events.some(h => h.damage && h.move === id), `${form} ${id} ${seat}`).toBe(true);
        }
      }
      const a = arena(form, 71, seat);
      a.run(5, {}, { down: true });
      a.button("throw");
      a.run(75, {}, { down: true });
      expect(a.events.filter(h => h.move === "throw").map(h => h.damage)).toEqual([benForms[form]!.grab.damage]);
      expect(a.match.capture).toBeUndefined();
    }
  });

  it.each([
    ["diamondhead", 0, "spikes", 91], ["diamondhead", 2, "shards", 125],
    ["humungousaur", 0, "colossal", 126], ["humungousaur", 1, "car", 153],
    ["feedback", 0, "storm", 114], ["feedback", 2, "discharge", 146],
  ] as const)("%s %s %s variants connect", (form, command, name, gap) => {
    for (const key of ["light", "medium"] as const) for (const seat of [0, 1] as const) {
      const a = arena(form, gap, seat);
      a.motion(command, key);
      expect(a.f.moveId).toBe(`${name}_${key}`);
      a.run(115);
      const contacts = a.events.filter(h => h.damage && h.move === `${name}_${key}`);
      expect(contacts.length).toBeGreaterThanOrEqual(1);
      expect(contacts.length).toBeLessThanOrEqual(name === "storm" ? 3 : 1);
    }
  });

  it.each([
    ["diamondhead", false, 0, "light", "spikes_light"], ["diamondhead", true, 2, "light", "shards_light"],
    ["humungousaur", false, 0, "light", "colossal_light"], ["humungousaur", true, 1, "light", "car_light"],
    ["feedback", false, 2, "light", "discharge_light"], ["feedback", true, 2, "light", "discharge_light"],
  ] as const)("%s links normals into %s %s %s %s", (form, low, family, key, finisher) => {
    const a = arena(form, 71);
    a.button("light", { down: low });
    a.run(benForms[form]!.moves[low ? "crouch_light" : "stand_light"].startup);
    a.release();
    a.button("medium");
    a.run(benForms[form]!.moves.stand_medium.startup);
    a.release();
    a.motion(family, key);
    a.run(80);
    expect(a.events.find(h => h.move === finisher)?.combo).toBe(3);
  });

  it("pursues the crystal launcher after a confirmed swap into XLR8", () => {
    const a = arena("diamondhead", 74);
    a.motion(0, "medium");
    a.run(9);
    a.swap("xlr8");
    expect(a.rival.airborne).toBe(true);
    expect(a.watch).toMatchObject({ active: "xlr8", comboSwap: true });
    a.button("jump", { direction: 1 });
    for (let t = 0; t < 15 && !a.f.airborne; t++) a.step();
    a.button("light", { direction: 1 });
    a.run(25);
    expect(a.events.find(h => h.move === "air_light")?.combo).toBe(2);
  });

  it("launches after a confirmed conductive capture and enables pursuit", () => {
    const a = arena("feedback", 104);
    a.motion(1, "medium");
    a.run(18);
    expect(a.match.capture?.ben?.moveId).toBe("conductor_medium");
    for (let t = 0; t < 68 && a.match.capture; t++) a.step();
    expect(a.rival.airborne).toBe(true);
    expect(a.events.filter(h => h.move === "conductor_medium")).toHaveLength(2);
    expect(a.f.airborne).toBe(true);
  });
});

describe("Diamondhead constructions", () => {
  it("grows sequenced spikes in place with one hit per cast", () => {
    const a = arena("diamondhead", 178);
    a.motion(0, "medium");
    a.run(15);
    const first = a.watch.objects[0], field = benObjectMove(first.id).ben!.field!;
    expect(a.watch.objects.map(o => o.age)).toEqual([1, -2, -5, -8]);
    expect(benObjectHeight(first, field)).toBeLessThan(field.height);
    const x = first.x;
    a.run(13);
    expect(a.watch.objects[0].x).toBe(x);
    expect(benObjectHeight(first, field)).toBe(field.height);
    a.run(65);
    expect(a.events.filter(h => h.move === "spikes_medium")).toHaveLength(1);
    expect(a.watch.objects).toHaveLength(0);
  });

  it.each(["light", "medium"] as const)("wall %s stops movement, lasts briefly and absorbs projectiles", key => {
    const a = arena("diamondhead", 260, 0, "ben");
    a.rival.omnitrix!.active = "feedback";
    a.motion(1, key);
    a.run(55);
    const wall = a.watch.objects[0];
    expect(wall?.durability).toBe(key === "light" ? 55 : 116);
    expect(a.f.attack("wall_medium")).toBe(false);
    a.run(17, {}, { direction: -1 });
    expect(a.rival.pushbox().x).toBeGreaterThanOrEqual(wall.x);
    const before = wall.durability!;
    expect(a.rival.attack("discharge_medium")).toBe(true);
    a.run(25);
    expect(a.f.health).toBe(a.f.data.health);
    expect(wall.durability).toBeLessThan(before);
    a.run(200);
    expect(a.watch.objects).toHaveLength(0);
  });

  it("does not place a wall inside another fighter or outside the edge", () => {
    const a = arena("diamondhead", 112);
    a.motion(1, "light");
    a.run(9);
    expect(a.watch.objects).toHaveLength(0);
    expect(a.watch.noSpace).toBeGreaterThan(0);
    const b = arena("diamondhead", 50, 1);
    b.f.x = 90;
    b.rival.x = 40;
    b.motion(1, "medium");
    b.run(18);
    expect(b.watch.objects).toHaveLength(0);
  });
});

describe("Humungousaur growth", () => {
  it.each([["light", 1], ["medium", 2]] as const)("growth %s changes boxes once and expires on the shared clock", (key, rank) => {
    const a = arena("humungousaur", 260);
    const normal = a.f.pushbox(), y = a.f.y;
    a.motion(2, key);
    a.run(benForms.humungousaur!.moves[`growth_${key}`].startup);
    expect(a.watch.growth?.rank).toBe(rank);
    expect(a.f.pushbox().w / normal.w).toBeCloseTo(benFormBalance.growth[rank].scale);
    expect(a.f.y).toBe(y);
    expect(a.f.attack("growth_medium")).toBe(false);
    const clone = restore(snapshot(a.match));
    expect(clone.fighters[0].benScale).toBe(a.f.benScale);
    for (let n = 0; n < 35; n++) { a.step(); clone.step([neutral(), neutral()]); }
    expect(hashState(snapshot(clone))).toBe(hashState(snapshot(a.match)));
    a.run(benFormBalance.growth[rank].ticks);
    expect(a.f.pushbox().w).toBe(normal.w);
    expect(a.watch.growthCooldown).toBeGreaterThan(0);
  });

  it("rejects unsafe growth and clears it on a valid form switch", () => {
    const a = arena("humungousaur", 255, 1);
    a.f.x = 1230;
    a.rival.x = 900;
    a.motion(2, "medium");
    a.run(22);
    expect(a.watch.noSpace).toBeGreaterThan(0);
    expect(a.f.benScale).toBe(1);
    const b = arena("humungousaur", 248);
    b.motion(2, "light");
    b.run(48);
    expect(b.f.benScale).toBeGreaterThan(1);
    b.swap("diamondhead");
    expect(b.watch.active).toBe("diamondhead");
    expect(b.f.benScale).toBe(1);
    expect(b.watch.growthCooldown).toBeGreaterThan(0);
    expect(overlaps(b.f.pushbox(), b.rival.pushbox())).toBe(false);
  });
});

describe("Feedback absorption", () => {
  function ki(a: ReturnType<typeof arena>, radius = 9) {
    const move = Object.entries(a.rival.data.specialMoves!).find(([, m]) => m.special === "ki")![0];
    a.match.kiProjectiles.push({ id: ++a.match.projectileSerial, owner: a.rival.id, move, cast: 0,
      x: a.f.x + 41 * a.facing, previousX: a.f.x + 41 * a.facing, y: FLOOR - 97,
      previousY: FLOOR - 97, vx: -14 * a.facing, vy: 0, facing: -a.facing,
      radius, age: 0, life: 20, state: "flight", impactAge: 0 });
  }

  it.each([9, 27])("absorbs Ki radius %s at the start of guard", radius => {
    const a = arena("feedback", 270, 0, "goku");
    ki(a, radius);
    a.run(4, { direction: -1 });
    expect(a.watch.charge).toBeGreaterThan(0);
    expect(a.f.health).toBe(a.f.data.health);
    expect(a.watch.absorbCooldown).toBeGreaterThan(0);
  });

  it("does not absorb physical fragments or energy outside its active window", () => {
    const a = arena("feedback", 230, 0, "ben");
    a.rival.omnitrix!.active = "diamondhead";
    a.rival.attack("shards_light");
    a.run(9);
    a.run(42);
    expect(a.watch.charge).toBe(0);
    expect(a.f.health).toBeLessThan(a.f.data.health);
    const b = arena("feedback", 270, 0, "goku");
    b.run(19, { direction: -1 });
    ki(b);
    b.run(3, { direction: -1 });
    expect(b.watch.charge).toBe(0);
    expect(b.events.some(hit => hit.blocked)).toBe(true);
  });

  it("caps, spends and expires the reserve independently of the active form", () => {
    const a = arena("feedback", 330, 0, "goku");
    a.watch.charge = 95;
    a.watch.chargeTicks = 35;
    ki(a);
    a.run(3, { direction: -1 });
    expect(a.watch.charge).toBe(100);
    a.run(70);
    a.motion(2, "medium");
    a.run(16);
    expect(a.watch.charge).toBe(50);
    expect(a.watch.objects[0]?.power).toBe(50);
    a.run(65);
    const remaining = a.watch.chargeTicks;
    a.swap("humungousaur");
    expect(a.watch.active).toBe("humungousaur");
    expect(a.watch.charge).toBe(50);
    expect(a.watch.chargeTicks).toBeLessThan(remaining);
    a.run(benFormBalance.energy.retention);
    expect(a.watch.charge).toBe(0);
  });
});


describe("Feedback rework", () => {
  it.each([0, 1] as const)("keeps the idle root, floor and hurtboxes fixed for 30 seconds on seat %s", seat => {
    const a = arena("feedback", 305, seat);
    a.run(8, { direction: a.facing });
    a.step();
    const root = a.f.x, boxes = a.f.hurtboxes();
    for (let tick = 0; tick < 1800; tick++) {
      a.step();
      expect(a.f.x).toBe(root);
      expect(a.f.y).toBe(FLOOR);
      expect(a.f.state).toBe("idle");
      expect(a.f.facing).toBe(a.facing);
      expect(a.f.hurtboxes()).toEqual(boxes);
    }
    expect(a.watch.charge).toBe(0);
  });

  it("never captures on guard or whiff and awards charge once on confirmed capture", () => {
    const guard = arena("feedback", 100);
    guard.motion(1, "light");
    guard.run(48, {}, { direction: 1, down: true });
    expect(guard.events.some(hit => hit.blocked)).toBe(true);
    expect(guard.watch.charge).toBe(0);
    const miss = arena("feedback", 290);
    miss.motion(1, "light");
    miss.run(60);
    expect(miss.events).toHaveLength(0);
    expect(miss.f.state).toBe("idle");
    const a = arena("feedback", 109);
    a.watch.charge = 96;
    a.motion(1, "light");
    a.run(55);
    expect(a.events.filter(hit => hit.move === "conductor_light")).toHaveLength(1);
    expect(a.watch.charge).toBe(100);
  });

  it.each([0, 1] as const)("uses eight full walk cels per direction and returns to Idle from seat %s", seat => {
    const a = arena("feedback", 610, seat, "samurai");
    const p = new FighterPresentation();
    for (const [name, direction] of [["walkForward", a.facing], ["walkBack", -a.facing]] as const) {
      const frames = new Set<number>();
      const x = a.f.x;
      for (let tick = 0; tick < 28; tick++) {
        a.step({ direction: direction as 1 | -1 });
        p.tick(a.f);
        const sprite = p.animator.sprite();
        expect(p.animator.clipName).toBe(name);
        expect(sprite.scale).toBe(1);
        expect(feedbackHeadAnchor(sprite.sheet, p.animator.frame())).toBeUndefined();
        expect(a.f.y).toBe(FLOOR);
        expect(Math.abs(p.renderRootX(a.f) - a.f.x)).toBeLessThanOrEqual(18);
        frames.add(p.animator.frame());
      }
      expect(frames.size).toBe(8);
      expect((a.f.x - x) * direction).toBeGreaterThan(110);
    }
    a.step();
    p.tick(a.f);
    expect(p.animator.clipName).toBe("idle");
    expect(p.renderRootX(a.f)).toBe(Math.round(a.f.x));
  });

  it.each(["light", "medium"] as const)("uses only the visible %s connectors for contact and keeps guard and whiff outcomes", strength => {
    const id = "conductor_" + strength;
    const move = benForms.feedback!.moves[id];
    const art = benAnimation("feedback").clips[id];
    expect(art.frames).toHaveLength(move.startup + move.active + move.recovery);
    for (let tick = move.startup; tick < move.startup + move.active; tick++) {
      const sides = feedbackConductorContact(move, tick);
      const visible = feedbackConductorPaths(move, tick, { x: -8, y: -108 });
      for (const [i, shape] of sides.entries()) {
        expect(shape.a).toEqual(visible[strength === "light" ? 1 : i].at(-1));
        expect(Math.hypot(shape.b.x - shape.a.x, shape.b.y - shape.a.y)).toBeCloseTo(8);
      }
    }
    for (const seat of [0, 1] as const) {
      const guard = arena("feedback", 110, seat, "samurai");
      guard.motion(1, strength);
      guard.run(65, {}, { direction: guard.facing, down: true });
      expect(guard.events.some(hit => hit.move === id && hit.blocked)).toBe(true);
      expect(guard.match.capture).toBeUndefined();
      expect(guard.watch.charge).toBe(0);
      const miss = arena("feedback", 235, seat, "samurai");
      miss.motion(1, strength);
      miss.run(64);
      expect(miss.events).toHaveLength(0);
      expect(miss.f.state).toBe("idle");
      const edge = arena("feedback", 105, seat, "samurai");
      edge.rival.x = seat ? 42 : 1238;
      edge.f.x = edge.rival.x - edge.facing * 105;
      edge.motion(1, strength);
      for (let t = 0; t < move.startup + move.active && !edge.match.capture; t++) edge.step();
      expect(edge.match.capture?.ben?.contactFrame).toBeGreaterThanOrEqual(move.startup);
      expect(edge.match.capture?.ben?.contactFrame).toBeLessThan(move.startup + move.active);
      edge.run(95);
      expect(edge.match.capture).toBeUndefined();
      expect(edge.events.filter(hit => hit.move === id)).toHaveLength(strength === "light" ? 1 : 2);
      expect(edge.rival.x).toBeGreaterThanOrEqual(40);
      expect(edge.rival.x).toBeLessThanOrEqual(1240);
    }
  });

  it("allows a confirmed normal into conductive capture without a repeated capture", () => {
    const a = arena("feedback", 71, 0, "samurai");
    a.button("medium");
    for (let i = 0; i < 15 && !a.f.hitConfirmed; i++) a.step();
    expect(a.f.hitConfirmed).toBe(true);
    a.release();
    a.motion(1, "light");
    a.run(65);
    expect(a.events.filter(hit => hit.move === "conductor_light")).toHaveLength(1);
    expect(a.events.find(hit => hit.move === "conductor_light")?.combo).toBe(2);
  });

  it.each([["light", 25], ["medium", 50]] as const)("fires %s at zero and spends exactly %s when powered", (key, cost) => {
    for (const charge of [0, cost - 1, cost]) {
      const a = arena("feedback", 365);
      a.watch.charge = charge;
      a.motion(2, key);
      a.run(a.f.move!.startup);
      expect(a.watch.objects[0]?.power ?? 0).toBe(charge === cost ? cost : 0);
      expect(a.watch.charge).toBe(charge === cost ? 0 : charge);
      a.run(40);
      expect(a.events.filter(hit => hit.move === "discharge_" + key && hit.damage)).toHaveLength(1);
    }
  });

  it.each(["light", "medium"] as const)("leaps physically with %s and only hits once on the ground", key => {
    const a = arena("humungousaur", 123);
    a.motion(0, key);
    let apex = FLOOR;
    let hitY: number | undefined;
    for (let i = 0; i < 120; i++) {
      a.step();
      apex = Math.min(apex, a.f.y);
      if (a.match.hits.length) hitY = a.f.y;
    }
    expect(apex).toBeLessThan(FLOOR - (key === "light" ? 20 : 95));
    expect(hitY).toBe(FLOOR);
    expect(a.events.filter(hit => hit.move === "colossal_" + key)).toHaveLength(1);
  });

  it("throws an independent car in an arc and shatters it on physical impact", () => {
    const a = arena("humungousaur", 385);
    a.motion(1, "medium");
    a.run(29);
    const car = a.watch.objects[0];
    const { x, y } = car;
    a.run(7);
    expect(car.x).toBeGreaterThan(x);
    expect(car.y).toBeLessThan(y);
    for (let i = 0; i < 40 && car.impactAge === undefined; i++) a.step();
    expect(car.impactAge).toBeDefined();
    expect(a.events.filter(hit => hit.move === "car_medium")).toHaveLength(1);
    a.run(30);
    expect(a.watch.objects).toHaveLength(0);
  });

  it("blocks a lightning strike with normal guard against Goku", () => {
    const a = arena("feedback", 121, 0, "goku");
    a.motion(0, "medium");
    a.run(100, {}, { direction: 1, down: true });
    expect(a.events.some(hit => hit.move === "storm_medium" && hit.blocked)).toBe(true);
    expect(a.rival.health).toBe(a.rival.data.health);
  });

  it("can be interrupted by Kaneki before the nightmare goes underground", () => {
    const a = arena("ghostfreak", 58, 0, "kaneki");
    a.motion(2, "medium");
    expect(a.rival.attack("stand_light")).toBe(true);
    a.rival.stateFrame = a.rival.move!.startup - 1;
    a.step();
    expect(a.f.state).toBe("hitstun");
    expect(a.f.health).toBeLessThan(a.f.data.health);
    a.run(95);
    expect(a.events.some(hit => hit.attacker === a.f.id)).toBe(false);
    expect(a.watch.objects).toHaveLength(0);
  });

  it("telegraphs three fixed non-overlapping strike locations", () => {
    const a = arena("feedback", 101);
    a.motion(0, "light");
    a.run(12);
    expect(a.watch.objects.map(object => object.age)).toEqual([1, -7, -15]);
    expect(new Set(a.watch.objects.map(object => object.x)).size).toBe(3);
    expect(a.events).toHaveLength(0);
    a.run(65);
    expect(a.events.filter(hit => hit.move === "storm_light")).toHaveLength(1);
    expect(a.watch.objects).toHaveLength(0);
  });

  it("confirms the stronger discharge from standing normals and cannot repeat the special within that combo", () => {
    const a = arena("feedback", 69);
    a.watch.charge = 45;
    a.button("light");
    a.run(4);
    a.release();
    a.button("medium");
    a.run(8);
    a.release();
    a.motion(2, "medium");
    a.run(22);
    expect(a.events.at(-1)).toMatchObject({ move: "discharge_medium", combo: 3 });
    expect(a.watch.charge).toBe(0);
    expect(a.f.attack("discharge_light")).toBe(false);
  });

  it("absorbs Chama's projectile and preserves only the earned reserve across a round trip", () => {
    const a = arena("feedback", 125, 0, "ben");
    a.rival.omnitrix!.active = "heatblast";
    a.rival.attack("fireball_light");
    a.run(a.rival.move!.startup - 1);
    a.run(4, { direction: -1 });
    const charge = a.watch.charge;
    expect(charge).toBeGreaterThan(13);
    expect(a.f.health).toBe(a.f.data.health);
    a.run(20);
    a.swap("diamondhead");
    expect(a.watch.active).toBe("diamondhead");
    a.swap("feedback");
    expect(a.watch.active).toBe("feedback");
    expect(a.watch.charge).toBe(charge);
    expect(a.watch.chargeTicks).toBeLessThan(600);
  });
});

