import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { gravityAt, planetoid } from "../src/engine/ben-stage7";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { benAnimation } from "../src/render/ben-animations";

const families = {
  gravattack: ["gravityPull", "gravityRepel", "gravityDomain"],
  echoEcho: ["sonicCry", "echoSplit", "echoHarmony"],
} as const;
type Form = keyof typeof families;
type Strength = "light" | "medium";
type Input = Partial<InputFrame>;

function arena(form: Form, gap = 85, seat: 0 | 1 = 0) {
  const ben = characters.ben, samurai = characters.samurai;
  const match = new Match(seat ? samurai : ben, { training: true }, seat ? ben : samurai);
  match.phase = "fight";
  const f = match.fighters[seat], target = match.fighters[1 - seat], watch = f.omnitrix!;
  const sign: -1 | 1 = seat ? -1 : 1;
  f.x = 640 - sign * 140;
  target.x = f.x + gap * sign;
  watch.active = watch.selected = form;
  const hits: typeof match.hits = [];
  const step = (self: Input = {}, rival: Input = {}) => {
    const a = { ...neutral(), ...self }, b = { ...neutral(), ...rival };
    match.step(seat ? [b, a] : [a, b]);
    hits.push(...match.hits);
  };
  const run = (ticks: number, self: Input = {}, rival: Input = {}) => {
    for (let i = 0; i < ticks; i++) step(self, rival);
  };
  const motion = (family: number, strength: Strength, rival: Input = {}) => {
    step({ down: true }, rival);
    if (family === 2) {
      step({}, rival);
      step({ down: true, pressed: [strength] }, rival);
    } else step({ direction: family === 0 ? sign : sign === 1 ? -1 : 1, pressed: [strength] }, rival);
  };
  return { match, f, target, watch, sign, hits, step, run, motion };
}

describe("Stage 7 in the main combat engine", () => {
  for (const form of Object.keys(families) as Form[]) {
    it.each([0, 1] as const)(form + " has a stable pivot, movement, six normals and throw on seat %s", seat => {
      const a = arena(form, 260, seat);
      const origin = [a.f.x, a.f.y, a.f.hurtboxes()];
      a.run(1800);
      expect([a.f.x, a.f.y, a.f.hurtboxes()]).toEqual(origin);
      const art = benAnimation(form);
      expect(art.sheet).toBe(`ben/${form}/stage7.png`);
      expect(art.scale).toBe(1);
      expect(art.clips.idle.frames).toHaveLength(6);
      expect(art.clips.walkForward.frames).toHaveLength(8);
      expect(art.clips.walkBack.frames).toHaveLength(8);
      a.run(5, { direction: a.sign });
      expect(a.f.x * a.sign).toBeGreaterThan(Number(origin[0]) * a.sign);
      a.step({ pressed: ["jump"] });
      a.run(13);
      expect(a.f.y).toBeLessThan(FLOOR - 30);
      for (const posture of ["stand", "crouch", "air"]) for (const key of ["light", "medium"] as const) {
        const b = arena(form, form === "gravattack" ? 83 : 55, seat);
        if (posture === "air") {
          b.f.setState("air");
          b.f.y = FLOOR - (posture === "air" && form === "gravattack" && key === "medium" ? 70 : 34);
        }
        b.step({ pressed: [key], down: posture === "crouch" });
        const id = posture + "_" + key;
        expect(b.f.moveId).toBe(id);
        expect(art.clips[id]?.frames).toHaveLength(3);
        b.run(65);
        expect(b.hits.some(hit => hit.move === id && hit.damage > 0), id).toBe(true);
      }
      const b = arena(form, form === "gravattack" ? 83 : 55, seat);
      b.step({ pressed: ["throw"] });
      b.run(80);
      expect(b.hits.some(hit => hit.move === "throw" && hit.damage > 0)).toBe(true);
      expect(b.match.capture).toBeUndefined();
    });

    it(form + " registers all J/K special variants with their atlas clips", () => {
      for (const [family, prefix] of families[form].entries()) for (const key of ["light", "medium"] as const) {
        const a = arena(form, form === "gravattack" ? 113 : 111);
        a.motion(family, key);
        const id = prefix + "_" + key;
        expect(a.f.moveId).toBe(id);
        expect(benAnimation(form).clips[id].frames.length).toBeGreaterThanOrEqual(4);
        a.run(80);
        const passive = id === "gravityDomain_light" || prefix === "echoSplit";
        expect(a.hits.some(hit => hit.move === id && hit.damage > 0), id).toBe(!passive);
        expect(a.f.state).toBe("idle");
      }
    });
  }

  it.each([
    ["gravattack", 1, "light", "gravityRepel_light"],
    ["gravattack", 2, "medium", "gravityDomain_medium"],
    ["echoEcho", 0, "light", "sonicCry_light"],
    ["echoEcho", 0, "medium", "sonicCry_medium"],
    ["echoEcho", 2, "light", "echoHarmony_light"],
  ] as const)("converts %s confirmed J → K into %s/%s", (form, family, strength, id) => {
    const a = arena(form, form === "gravattack" ? 83 : 55);
    const finishStop = () => { while (a.match.hitstop) a.step(); };
    a.step({ pressed: ["light"] });
    for (let i = 0; i < 25 && !a.f.hitConfirmed; i++) a.step();
    finishStop();
    expect(a.f.canCancel("medium")).toBe(true);
    a.step({ pressed: ["medium"] });
    for (let i = 0; i < 35 && !a.f.hitConfirmed; i++) a.step();
    finishStop();
    expect(a.f.canCancel("special")).toBe(true);
    a.motion(family, strength);
    expect(a.f.moveId).toBe(id);
    for (let i = 0; i < 55 && !a.hits.some(hit => hit.move === id); i++) a.step();
    expect(a.hits.map(hit => hit.move)).toEqual(["stand_light", "stand_medium", id]);
    expect(a.target.combo).toBe(3);
  });

  it("lets Gravattack convert attraction into a close J → K", () => {
    const a = arena("gravattack", 140);
    a.motion(0, "light");
    for (let i = 0; i < 65 && a.f.state !== "idle"; i++) a.step();
    expect(a.target.stun).toBeGreaterThan(9);
    a.step({ pressed: ["light"] });
    for (let i = 0; i < 25 && !a.f.hitConfirmed; i++) a.step();
    while (a.match.hitstop) a.step();
    a.step({ pressed: ["medium"] });
    for (let i = 0; i < 35 && !a.f.hitConfirmed; i++) a.step();
    expect(a.hits.map(hit => hit.move)).toEqual(["gravityPull_light", "stand_light", "stand_medium"]);
    expect(a.target.combo).toBe(3);
  });

  it("pulls, lifts, repels, and respects defense and range", () => {
    const pull = arena("gravattack", 152);
    const start = pull.target.x;
    pull.motion(0, "light");
    pull.run(32);
    expect(pull.target.x).toBeLessThan(start - 18);
    const lift = arena("gravattack", 136, 1);
    lift.motion(0, "medium");
    lift.run(27);
    expect(lift.target.y).toBeLessThan(FLOOR - 10);
    const repel = arena("gravattack", 109);
    repel.motion(1, "light");
    repel.run(31);
    expect(repel.target.x).toBeGreaterThan(609 + 24);
    const defended = arena("gravattack", 125);
    defended.motion(1, "medium");
    defended.run(17);
    defended.run(18, {}, { direction: 1 });
    expect(defended.hits.some(hit => hit.blocked)).toBe(true);
    const far = arena("gravattack", 450);
    far.motion(0, "medium");
    far.run(65);
    expect(far.hits).toHaveLength(0);
  });

  it("applies a temporary bounded gravity field and returns from the planetoid at the edge", () => {
    const a = arena("gravattack", 136);
    a.motion(2, "light");
    a.run(44);
    expect(gravityAt(a.f, a.target.x, FLOOR, FLOOR)).toBeDefined();
    expect(gravityAt(a.f, a.target.x + 400, FLOOR, FLOOR)).toBeUndefined();
    const control = arena("gravattack", 136);
    for (const b of [a, control]) {
      b.step({}, { pressed: ["jump"] });
      b.run(19);
    }
    expect(a.target.y).toBeGreaterThan(control.target.y + 6);
    a.run(220);
    expect(gravityAt(a.f, a.target.x, FLOOR, FLOOR)).toBeUndefined();

    const ball = arena("gravattack", 113);
    ball.f.x = 1100;
    ball.target.x = 1223;
    ball.motion(2, "medium");
    ball.run(14);
    expect(planetoid(ball.f)).toBe(true);
    expect(ball.f.y).toBe(FLOOR);
    const bodyTop = (b: typeof a) => Math.min(...b.f.hurtboxes().map(box => box.y)) - b.f.y;
    expect(bodyTop(ball)).toBeGreaterThan(bodyTop(a));
    ball.run(70);
    expect(planetoid(ball.f)).toBe(false);
    expect(ball.f.x).toBeLessThanOrEqual(1280 - ball.f.stageInset);
    expect(ball.f.y).toBe(FLOOR);
  });

  it("spawns up to two distinct copies, coordinates waves, and round-trips authority snapshots", () => {
    const a = arena("echoEcho", 163);
    a.motion(1, "medium");
    a.run(19);
    expect(a.watch.echoClones).toHaveLength(1);
    a.run(35);
    expect(a.watch.echoClones).toHaveLength(2);
    expect(new Set(a.watch.echoClones!.map(clone => clone.id)).size).toBe(2);
    expect(a.watch.echoClones!.every(clone => Math.abs(clone.x - a.f.x) > 25)).toBe(true);
    a.motion(2, "medium");
    const replica = restore(snapshot(a.match));
    const sources = new Set<number>();
    for (let i = 0; i < 72; i++) {
      a.step();
      replica.step([neutral(), neutral()]);
      for (const obj of a.watch.objects) if (obj.sourceClone !== undefined) sources.add(obj.sourceClone);
      expect(hashState(snapshot(replica))).toBe(hashState(snapshot(a.match)));
    }
    expect(sources.size).toBe(2);
    expect(a.hits.some(hit => hit.move === "echoCopyWave" && hit.damage > 0)).toBe(true);
    a.run(240);
    expect(a.watch.echoClones).toHaveLength(0);
    expect(a.watch.objects).toHaveLength(0);
  });

  it("lets Samurai destroy a copy and clears the formation on Omnitrix swap", () => {
    const a = arena("echoEcho", 163);
    a.motion(1, "medium");
    a.run(54);
    const clone = a.watch.echoClones!.find(copy => copy.x > a.f.x)!;
    expect(clone).toBeDefined();
    a.target.x = clone.x + 49;
    a.step({}, { pressed: ["light"] });
    a.run(10);
    expect(a.watch.echoClones?.some(copy => copy.id === clone.id && !copy.fading)).toBe(false);
    a.step({ pressed: ["heavy"], omnitrix: { held: false } });
    a.step({ pressed: ["heavy"], omnitrix: { held: true } });
    a.run(27, { omnitrix: { held: true } });
    expect(a.watch.active).toBe("heatblast");
    expect(a.watch.echoClones).toBeUndefined();
  });
});

