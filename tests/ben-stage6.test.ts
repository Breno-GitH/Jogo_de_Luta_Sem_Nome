import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { benObjectMove, benObjectShape, benStage6Balance } from "../src/engine/ben-moves";
import type { BenAlien } from "../src/engine/ben-omnitrix";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, overlaps, type Button, type InputFrame } from "../src/engine/types";
import { benAnimation } from "../src/render/ben-animations";

const forms = ["bigChill", "ghostfreak", "nrg", "nrgReleased"] as const;
const active = (id: typeof forms[number]) => id === "nrgReleased" ? "nrg" : id;
const families = {
  bigChill: ["frostBreath", "iceDive", "ghostFlight"],
  ghostfreak: ["ghostCross", "spectralArms", "ghostPhase"],
  nrg: ["thermal", "armorImpact", "nrgUnseal"],
  nrgReleased: ["radiantShot", "radiantWave", "nrgSeal"],
};

function arena(form: typeof forms[number] | "human" = "bigChill", gap = 71, seat: 0 | 1 = 0) {
  const match = new Match(seat ? characters.samurai : characters.ben, { training: true },
    seat ? characters.ben : characters.samurai);
  match.phase = "fight";
  const f = match.fighters[seat], rival = match.fighters[1 - seat], watch = f.omnitrix!;
  if (form !== "human") watch.active = watch.selected = active(form);
  if (form === "nrgReleased") {
    watch.nrgReleased = true;
    watch.nrgTicks = benStage6Balance.nrgDuration;
  }
  const direction: 1 | -1 = seat ? -1 : 1;
  f.x = 640 - direction * 120;
  rival.x = f.x + direction * gap;
  const events: typeof match.hits = [];
  const step = (input: Partial<InputFrame> = {}, other: Partial<InputFrame> = {}) => {
    const local = { ...neutral(), ...input }, enemy = { ...neutral(), ...other };
    match.step(seat ? [enemy, local] : [local, enemy]);
    events.push(...match.hits);
  };
  const run = (ticks: number, input: Partial<InputFrame> = {}, other: Partial<InputFrame> = {}) => {
    for (let tick = 0; tick < ticks; tick++) step(input, other);
  };
  const button = (b: Button, rest: Partial<InputFrame> = {}) => step({ ...rest, pressed: [b] });
  const motion = (family: number, b: "light" | "medium", other: Partial<InputFrame> = {}) => {
    step({ down: true }, other);
    if (family === 2) {
      step({}, other);
      step({ down: true, pressed: [b] }, other);
    } else step({ direction: family === 0 ? direction : direction === 1 ? -1 : 1, pressed: [b] }, other);
  };
  const activate = (to: BenAlien) => {
    for (let i = 0; i < 11 && watch.selected !== to; i++) button("heavy", { omnitrix: { held: false } });
    button("heavy", { omnitrix: { held: true } });
    run(24, { omnitrix: { held: true } });
    step({ omnitrix: { held: false } });
    expect(watch.active).toBe(to);
    expect(watch.selected).toBe(to);
  };
  const clearHitstop = () => { while (match.hitstop) step(); };
  return { match, f, rival, watch, direction, events, step, run, button, motion, activate, clearHitstop };
}

describe("Ben Stage 6 in the combat simulator", () => {
  it("selects by taps and switches directly among the new forms and back", () => {
    const a = arena("human", 300);
    a.f.health = 701;
    a.f.meter = 72;
    for (const id of ["bigChill", "ghostfreak", "nrg", "ghostfreak", "bigChill"] as const) a.activate(id);
    expect(a.f.health).toBe(701);
    expect(a.f.meter).toBe(72);
    expect(a.watch.nrgReleased).toBeFalsy();
  });

  it.each(["nrg", "nrgReleased"] as const)("%s stays at the same root for 30 seconds in both facings", id => {
    for (const seat of [0, 1] as const) {
      const a = arena(id, 330, seat);
      if (id === "nrgReleased") a.watch.nrgTicks = 1900; // isolate Idle from the separately tested mode timeout
      const { x, y, facing } = a.f;
      const boxes = a.f.hurtboxes();
      for (let tick = 0; tick < 1800; tick++) {
        a.step();
        expect([a.f.x, a.f.y, a.f.facing, a.f.state]).toEqual([x, y, facing, "idle"]);
        expect(a.f.hurtboxes()).toEqual(boxes);
      }
    }
  });

  it.each(forms)("%s has planted idle, its own motion, sprites and all six normals", id => {
    for (const seat of [0, 1] as const) {
      const idle = arena(id, 320, seat);
      const { x, y } = idle.f;
      const boxes = idle.f.hurtboxes();
      idle.run(180);
      expect([idle.f.x, idle.f.y, idle.f.state, idle.f.hurtboxes()]).toEqual([x, y, "idle", boxes]);
      idle.run(5, { direction: idle.direction });
      expect(idle.f.x).not.toBe(x);
      idle.button("jump");
      idle.run(12);
      expect(idle.f.y).toBeLessThan(FLOOR);
      const art = benAnimation(id);
      expect(art.clips.idle.frames).toHaveLength(6);
      for (const post of ["stand", "crouch", "air"] as const) for (const strength of ["light", "medium"] as const) {
        const a = arena(id, 71, seat);
        if (post === "air") {
          a.f.y = FLOOR - 59;
          a.f.vy = 1;
          a.f.setState("air");
        }
        const move = `${post}_${strength}`;
        expect(art.clips[move]).toBeDefined();
        a.button(strength, { down: post === "crouch" });
        expect(a.f.moveId).toBe(move);
        a.run(60);
        expect(a.events.some(hit => hit.move === move && hit.damage > 0), `${id}/${move} facing ${seat}`).toBe(true);
      }
      const grab = arena(id, 71, seat);
      grab.button("throw");
      grab.run(85);
      expect(grab.events.some(hit => hit.move === "throw" && hit.damage > 0)).toBe(true);
      expect(grab.match.capture).toBeUndefined();
    }
  });

  it.each(forms)("%s executes each J/K command with a real move and corresponding animation", id => {
    const damaging = {
      bigChill: [true, true, true, true, false, false],
      ghostfreak: [true, true, true, true, true, true],
      nrg: [true, true, true, true, false, false],
      nrgReleased: [true, true, true, true, false, false],
    }[id];
    for (let family = 0; family < 3; family++) for (const [index, strength] of ["light", "medium"].entries()) {
      const a = arena(id, family === 0 && id === "ghostfreak" ? 89 : 79);
      const key = strength as "light" | "medium";
      const move = id === "nrg" && family === 2 && key === "medium"
        ? "armorCounter_medium" : `${families[id][family]}_${key}`;
      a.motion(family, key);
      expect(a.f.moveId).toBe(move);
      expect(benAnimation(id).clips[move]).toBeDefined();
      a.run(120);
      expect(a.events.some(hit => hit.move === move && hit.damage > 0), move).toBe(damaging[family * 2 + index]);
      expect(a.match.capture).toBeUndefined();
    }
  });

  it.each([0, 1] as const)("contains the ram and overhead hammer at close range on seat %s", seat => {
    for (const key of ["light", "medium"] as const) {
      const a = arena("nrg", key === "light" ? 122 : 77, seat);
      const x = a.f.x;
      const id = "armorImpact_" + key;
      a.motion(1, key);
      a.run(26);
      const hit = a.events.find(h => h.move === id);
      expect(hit?.damage).toBeGreaterThan(0);
      if (key === "light") expect((a.f.x - x) * a.direction).toBeGreaterThan(20);
      else expect(a.rival.knockedDown).toBe(true);
      expect((a.rival.x - a.f.x) * a.direction).toBeGreaterThan(0);

      const miss = arena("nrg", 246, seat);
      miss.motion(1, key);
      miss.run(29);
      expect(miss.events).toHaveLength(0);
      expect(miss.f.attackPhase).toBe("recovery");
    }
  });

  it.each([0, 1] as const)("counters one physical hit only during the armor window on seat %s", seat => {
    const a = arena("nrg", 79, seat);
    const before = a.f.health;
    a.motion(2, "medium");
    a.run(3);
    a.step({}, { pressed: ["light"] });
    a.run(35);
    const chip = a.events.find(h => h.attacker === a.rival.id);
    expect(chip?.damage).toBeGreaterThan(0);
    expect(chip?.damage).toBeLessThan(18);
    expect(a.f.health).toBe(before - chip!.damage);
    expect(a.events.filter(h => h.move === "nrgCounterShove")).toHaveLength(1);
    expect(a.events.find(h => h.move === "nrgCounterShove")?.damage).toBeGreaterThan(0);
    expect(a.f.state).not.toBe("hitstun");

    const whiff = arena("nrg", 79, seat);
    whiff.motion(2, "medium");
    whiff.run(16);
    expect(whiff.f.attackPhase).toBe("recovery");
    whiff.step({}, { pressed: ["light"] });
    whiff.run(8);
    expect(whiff.f.state).toBe("hitstun");
    expect(whiff.events[0]?.damage).toBeGreaterThan(25);
    expect(whiff.events.some(h => h.move === "nrgCounterShove")).toBe(false);
  });

  it("does not intercept throws or let a confirmed hit activate counter armor", () => {
    const a = arena("nrg", 63);
    a.motion(2, "medium", { pressed: ["throw"] });
    a.run(12);
    expect(a.match.capture?.attacker).toBe(a.rival.id);
    expect(a.events.some(h => h.move === "nrgCounterShove")).toBe(false);

    const b = arena("nrg", 79);
    b.step({}, { pressed: ["medium"] });
    b.run(15);
    expect(b.f.state).toBe("hitstun");
    b.motion(2, "medium");
    expect(b.f.state).toBe("hitstun");
    expect(b.f.moveId).toBe("");
  });

  it.each([
    ["light", false, 1, "light", "armorImpact_light", true],
    ["light", true, 0, "light", "thermal_light", true],
    ["medium", false, 1, "medium", "armorImpact_medium", false],
  ] as const)("links NRG %s into %s / %s / %s", (opener, down, family, key, finisher, chain) => {
    const a = arena("nrg", 74);
    const contact = (id: string) => {
      for (let i = 0; i < 28 && !a.events.some(h => h.move === id && h.damage); i++) a.step();
      expect(a.events.at(-1)?.move).toBe(id);
      a.clearHitstop();
    };
    a.button(opener, { down });
    contact((down ? "crouch_" : "stand_") + opener);
    if (chain) {
      a.button("medium");
      contact("stand_medium");
    }
    a.motion(family, key);
    contact(finisher);
    expect(a.events.at(-1)?.combo).toBe(chain ? 3 : 2);
  });

  it("links a standing confirm to Friagem's ice breath", () => {
    const a = arena("bigChill");
    a.button("light");
    a.run(5);
    a.clearHitstop();
    a.button("medium");
    a.run(8);
    a.clearHitstop();
    a.motion(0, "light");
    a.run(28);
    expect(a.events.map(h => h.move)).toEqual(["stand_light", "stand_medium", "frostBreath_light"]);
    expect(a.events.at(-1)?.combo).toBe(3);
  });

  it("chills only on hit and freezes briefly with immunity after repeated impacts", () => {
    const guarded = arena("bigChill", 116);
    guarded.motion(0, "light", { direction: 1 });
    guarded.run(36, {}, { direction: 1 });
    expect(guarded.events[0]?.blocked).toBe(true);
    expect(guarded.rival.chill).toBeUndefined();

    const a = arena("bigChill", 116);
    a.motion(0, "medium");
    a.run(54);
    expect(a.rival.chill?.build).toBe(56);
    for (let tick = 0; a.rival.state !== "idle" && tick < 55; tick++) a.step();
    expect(a.rival.state).toBe("idle");
    a.f.x = a.rival.x - 116;
    a.motion(0, "medium");
    for (let tick = 0; !a.rival.chill?.freeze && tick < 25; tick++) a.step();
    expect(a.rival.chill?.freeze).toBe(benStage6Balance.freezeTicks);
    expect(a.rival.chill?.immune).toBe(benStage6Balance.frostImmunity);
    expect(a.rival.state).toBe("hitstun");
    a.run(60);
    expect(a.rival.chill?.freeze).toBe(0);
    expect(a.rival.chill?.immune).toBeGreaterThan(0);
  });

  it("limits glide in one airtime and accepts an aerial dive on directional input", () => {
    const a = arena("bigChill", 410);
    a.f.y = FLOOR - 104;
    a.f.setState("air");
    a.motion(2, "light");
    expect(a.f.moveId).toBe("ghostFlight_light");
    a.run(12, { direction: 1 });
    expect(a.watch.flightUsed).toBe(true);
    expect(a.f.x).toBeGreaterThan(520);
    expect(a.f.attack("ghostFlight_medium")).toBe(false);
    a.run(34);
    a.motion(1, "light");
    expect(a.f.moveId).toBe("iceDive_light");
    a.run(90);
    expect(a.f.y).toBe(FLOOR);
    expect(a.watch.flightUsed).toBeFalsy();
    expect(a.watch.diveUsed).toBeFalsy();
  });

  it("evades a physical hit only during the spectral window and has cooldown and punishable recovery", () => {
    const a = arena("ghostfreak", 65);
    a.motion(2, "medium");
    a.run(22);
    expect(a.f.invulnerable).toBe(true);
    expect(a.rival.attack("stand_light")).toBe(true);
    a.rival.stateFrame = a.rival.move!.startup - 1;
    a.step();
    expect(a.f.health).toBe(a.f.data.health);
    a.rival.x = 900;
    a.run(24);
    expect(a.f.invulnerable).toBe(false);
    a.rival.x = a.f.x + 55;
    a.rival.facing = -1;
    expect(a.f.attack("ghostPhase_light")).toBe(false);
    a.rival.setState("idle");
    expect(a.rival.attack("stand_light")).toBe(true);
    a.rival.stateFrame = a.rival.move!.startup - 1;
    a.step();
    expect(a.f.health).toBeLessThan(a.f.data.health);
  });

  it("does not cancel a confirmed grab and does not cross the stage edge", () => {
    const a = arena("ghostfreak", 60);
    a.rival.attack("throw");
    a.rival.stateFrame = a.rival.move!.startup - 1;
    a.step();
    expect(a.match.capture?.victim).toBe(a.f.id);
    a.motion(2, "medium");
    expect(a.match.capture?.victim).toBe(a.f.id);
    expect(a.f.benPhase).toBeUndefined();

    const edge = arena("ghostfreak", 66);
    edge.rival.x = 1240;
    edge.f.x = edge.rival.x - 66;
    edge.motion(0, "medium");
    edge.run(75);
    expect(edge.f.x).toBeLessThanOrEqual(1280 - edge.f.stageInset);
    expect(overlaps(edge.f.pushbox(), edge.rival.pushbox())).toBe(false);
  });

  it("releases and returns NRG without healing and keeps mode, cooldown and hashes in snapshots", () => {
    const a = arena("nrg", 260);
    a.f.health = 704;
    a.f.meter = 65;
    const width = a.f.pushbox().w;
    a.motion(2, "light");
    a.run(30);
    expect(a.watch.nrgReleased).toBe(true);
    expect(a.watch.active).toBe("nrg");
    expect(a.f.pushbox().w).toBeLessThan(width);
    expect(a.watch.nrgTicks).toBeGreaterThan(620);
    const saved = snapshot(a.match);
    const restored = restore(saved);
    expect(hashState(snapshot(restored))).toBe(hashState(saved));
    expect(restored.fighters[0].benForm).toBe(a.f.benForm);

    a.motion(2, "medium");
    a.run(30);
    expect(a.watch.nrgReleased).toBe(false);
    expect(a.f.pushbox().w).toBe(width);
    expect([a.f.health, a.f.meter]).toEqual([704, 65]);
    expect(a.f.attack("nrgUnseal_light")).toBe(false);
    a.run(200);
    a.motion(2, "light");
    a.run(30);
    expect(a.watch.nrgReleased).toBe(true);
    a.activate("diamondhead");
    expect(a.watch.nrgReleased).toBe(false);
    a.activate("nrg");
    expect(a.watch.nrgCooldown).toBeGreaterThan(0);
    expect(a.f.pushbox().w).toBe(width);
  });

  it.each([
    ["ghostfreak", 1, "spectralArms_light"],
    ["nrg", 0, "thermal_light"],
    ["nrgReleased", 0, "radiantShot_light"],
  ] as const)("%s confirms J → K into %s (%s)", (id, family, ender) => {
    const a = arena(id, 71);
    a.button("light");
    a.run(a.f.move!.startup);
    a.clearHitstop();
    a.button("medium");
    a.run(a.f.move!.startup);
    a.clearHitstop();
    a.motion(family, "light");
    a.run(35);
    expect(a.events.map(hit => hit.move)).toEqual(["stand_light", "stand_medium", ender]);
    expect(a.events.at(-1)?.combo).toBe(3);
  });

  it("confirms Friagem's air J and K into an aerial dive", () => {
    const a = arena("bigChill", 67);
    a.f.y = FLOOR - 68;
    a.f.vy = 1;
    a.f.setState("air");
    a.button("light");
    a.run(5);
    a.clearHitstop();
    a.button("medium");
    a.run(8);
    a.clearHitstop();
    a.motion(1, "light");
    a.run(32);
    expect(a.events.map(hit => hit.move)).toEqual(["air_light", "air_medium", "iceDive_light"]);
    expect(a.events.at(-1)?.combo).toBe(3);
  });

  it("jump-cancels a confirmed heavy frost breath", () => {
    const a = arena("bigChill", 100);
    a.motion(0, "medium");
    for (let i = 0; i < 35 && !a.f.hitConfirmed; i++) a.step();
    expect(a.rival.airborne).toBe(true);
    a.clearHitstop();
    a.button("jump", { direction: 1 });
    expect(a.f.state).toBe("air");
    expect(a.f.airChaseTicks).toBeGreaterThan(0);
  });

  it("reveals Zs’Skayr only on unguarded hand contact and clears the pending hands", () => {
    const a = arena("ghostfreak", 92);
    a.motion(2, "medium");
    const types = new Set<string>();
    for (let i = 0; i < 120; i++) {
      a.step();
      if (a.match.capture?.ben) {
        types.add(a.match.capture.ben.moveId);
        expect(a.watch.objects.every(o => o.spent)).toBe(true);
      }
    }
    expect(types).toEqual(new Set(["ghostPhase_medium"]));
    expect(a.events.filter(hit => hit.damage > 0)).toHaveLength(4);
    expect(a.match.capture).toBeUndefined();
    expect(a.watch.objects).toHaveLength(0);
    const guard = arena("ghostfreak", 93);
    guard.motion(2, "light", { down: true, direction: 1 });
    guard.run(100, {}, { down: true, direction: 1 });
    expect(guard.events.some(hit => hit.blocked)).toBe(true);
    expect(guard.events.some(hit => hit.damage > 0)).toBe(false);
    expect(guard.rival.health).toBe(guard.rival.data.health);
    const miss = arena("ghostfreak", 540);
    miss.motion(2, "medium");
    miss.run(125);
    expect(miss.events).toHaveLength(0);
    expect(miss.match.capture).toBeUndefined();
    expect(miss.watch.objects).toHaveLength(0);
  });

  it("keeps the heat sweep attached in flight and clips the downward beam at the floor", () => {
    for (const seat of [0,1] as const) {
      const a = arena("nrgReleased", 430, seat);
      a.button("jump", { up: true });
      a.run(28, { up: true });
      a.motion(0, "medium");
      a.run(17, { down: true, direction: a.direction });
      const beam = a.watch.objects.find(o => o.id === "radiantShot_medium")!;
      expect(beam).toBeDefined();
      const first = { x: beam.x, y: beam.y };
      a.run(6, { down: true, direction: a.direction });
      expect((beam.x - first.x) * a.direction).toBeGreaterThan(5);
      expect(beam.y).toBeGreaterThan(first.y);
      const shape = benObjectShape(beam, benObjectMove(beam.id).ben!.field!);
      if (!("a" in shape)) throw new Error("Expected heat beam capsule");
      expect(shape.b.y).toBeCloseTo(FLOOR, 5);
      expect((shape.b.x - shape.a.x) * a.direction).toBeGreaterThan(20);
    }
  });

  it("flies in both directions, holds height in neutral and reseals where it lands", () => {
    for (const seat of [0, 1] as const) {
      const a = arena("nrgReleased", 330, seat);
      a.button("jump", { up: true });
      a.run(26, { up: true, direction: a.direction });
      const x = a.f.x, y = a.f.y;
      expect(a.watch.flightTicks).toBeGreaterThan(0);
      expect(y).toBeLessThan(480);
      a.run(10);
      expect(a.f.x).toBeCloseTo(x, 4);
      expect(a.f.y).toBeCloseTo(y, 4);
      const reverse = a.direction === 1 ? -1 : 1;
      a.run(12, { direction: reverse, down: true });
      expect((a.f.x - x) * reverse).toBeGreaterThan(25);
      expect(a.f.y).toBeGreaterThan(y);
      const land = a.f.x;
      a.watch.nrgTicks = 1;
      a.run(75);
      expect(a.f.y).toBe(FLOOR);
      expect(a.f.x).toBeCloseTo(land, 4);
      expect(a.watch.nrgReleased).toBe(false);
      expect(a.watch.nrgCooldown).toBeGreaterThan(0);
    }
  });

  it("follows the captive into the air and strikes from alternating sides", () => {
    const a = arena("ghostfreak", 93);
    a.motion(1, "medium");
    const sides = new Set<number>();
    let elevation = 0;
    for (let i = 0; i < 110; i++) {
      a.step();
      if (a.match.capture) {
        sides.add(a.f.facing);
        elevation = Math.max(elevation, FLOOR - a.f.y);
      }
    }
    expect(sides.size).toBe(2);
    expect(elevation).toBeGreaterThan(60);
    expect(a.events.filter(h => h.move === "spectralArms_medium")).toHaveLength(3);
    expect(a.match.capture).toBeUndefined();
    expect(a.f.y).toBe(FLOOR);
  });

  it("cancels a confirmed armoured heavy into NRG release and a released jab", () => {
    const a = arena("nrg", 69);
    a.button("medium");
    a.run(a.f.move!.startup);
    a.motion(2, "light");
    a.clearHitstop();
    a.step();
    expect(a.f.moveId).toBe("nrgUnseal_light");
    for (let i = 0; i < 36 && a.f.state !== "idle"; i++) a.step();
    expect(a.watch.nrgReleased).toBe(true);
    a.button("light");
    a.run(18);
    expect(a.events.at(-1)?.move).toBe("stand_light");
    expect(a.events.at(-1)?.combo).toBe(2);
  });

  it.each(["nrg", "nrgReleased"] as const)("can be knocked out in mode %s", id => {
    const a = arena(id, 68);
    a.f.health = 5;
    a.rival.attack("stand_light");
    a.run(40);
    expect(a.f.health).toBe(0);
    expect(a.match.phase).toBe("roundEnd");
    expect(a.watch.nrgReleased).toBeFalsy();
  });

  it("returns NRG automatically after the timer, waiting out hitstun and landing", () => {
    const a = arena("nrgReleased", 290);
    a.watch.nrgTicks = 3;
    a.f.y = FLOOR - 38;
    a.f.setState("hitstun");
    a.f.stun = 25;
    a.run(12);
    expect(a.watch.nrgTicks).toBe(0);
    expect(a.watch.nrgReleased).toBe(true);
    a.run(70);
    expect(a.watch.nrgReleased).toBe(false);
    expect(a.watch.nrgCooldown).toBeGreaterThan(0);
  });
});

