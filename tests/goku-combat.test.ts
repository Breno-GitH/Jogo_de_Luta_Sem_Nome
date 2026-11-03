import { combatPace } from "../src/engine/pace";
import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";
import { FighterPresentation } from "../src/render/presentation";
import { gokuAnimations } from "../src/render/goku-animations";
import { swapGokuPalette } from "../src/render/palette";
import fs from "node:fs";
const keys = [
  "stand_light",
  "stand_medium",
  "stand_heavy",
  "crouch_light",
  "crouch_medium",
  "crouch_heavy",
  "air_light",
  "air_medium",
  "air_heavy",
];
function setup(enemy: "samurai" | "dio" | "goku" = "samurai", mirror = false) {
  const m = new Match(characters.goku, { training: true }, characters[enemy]);
  m.phase = "fight";
  m.message = "";
  const [a, b] = m.fighters;
  a.x = 600;
  b.x = 600 + (mirror ? -1 : 1) * 70;
  a.facing = mirror ? -1 : 1;
  b.facing = -a.facing;
  return m;
}
const recorded = new WeakMap<Match, Match["hits"]>();
function hits(m: Match) {
  return recorded.get(m) ?? [];
}
function step(
  m: Match,
  input: InputFrame = neutral(),
  target: InputFrame = neutral(),
) {
  m.step([input, target]);
  recorded.set(m, [...hits(m), ...m.hits]);
}
function run(
  m: Match,
  n: number,
  input: InputFrame = neutral(),
  target: InputFrame = neutral(),
) {
  for (let t = 0; t < n; t++) step(m, input, target);
}
describe("Goku normals in the existing shared combat engine", () => {
  it.each(
    (["samurai", "dio", "goku"] as const).flatMap((enemy) =>
      [false, true].map((mirror) => ({ enemy, mirror })),
    ),
  )(
    "chains a jumping air-to-air light/medium/heavy against $enemy, mirrored=$mirror",
    ({ enemy, mirror }) => {
      const m = setup(enemy, mirror),
        a = m.fighters[0];
      let stage = 0;
      const delay = enemy === "dio" ? 4 : 0;
      for (let t = 0; t < 180; t++) {
        const input = neutral(),
          target = neutral();
        if (t === 0) target.pressed = ["jump"];
        if (t === delay) input.pressed = ["jump"];
        if (t === 10 + delay) {
          input.pressed = ["light"];
          stage = 1;
        } else if (
          stage === 1 &&
          a.moveId === "air_light" &&
          a.canCancel("medium")
        ) {
          input.pressed = ["medium"];
          stage = 2;
        } else if (
          stage === 2 &&
          a.moveId === "air_medium" &&
          a.canCancel("heavy")
        ) {
          input.pressed = ["heavy"];
          stage = 3;
        }
        step(m, input, target);
      }
      expect(
        hits(m)
          .filter((h) => h.attacker === 0)
          .map((h) => h.move),
      ).toEqual(["air_light", "air_medium", "air_heavy"]);
      expect(a.state).toBe("idle");
      expect(m.fighters[1].state).toBe("idle");
    },
  );
  it("scales damage and forces a knockdown at the juggle limit", () => {
    const m = setup(),
      a = m.fighters[0],
      b = m.fighters[1];
    // A nearly exhausted juggle is a boundary fixture; the actual next hit
    // still has to connect through the normal move/hurtbox collision path.
    b.combo = combatPace.combo.maxHits - 1;
    b.comboAirHits = combatPace.combo.maxAirHits - 1;
    b.comboAge = combatPace.combo.maxTicks - 1;
    b.y = FLOOR - 100;
    b.setState("hitstun");
    b.stun = 80;
    b.vy = 0;
    a.y = b.y;
    a.setState("air");
    a.attack("air_light");
    run(m, 15);
    expect(hits(m)).toHaveLength(1);
    expect(hits(m)[0].damage).toBe(Math.round(characters.goku.moves.air_light.damage * combatPace.combo.minimumDamageScale));
    expect(b.knockedDown).toBe(true);
    expect(b.vy > 0 || b.y === FLOOR).toBe(true);
    run(m, 100);
    expect(b.state).toBe("idle");
    expect(a.attackShapes()).toEqual([]);
  });
  it("lets movement and a new attack interrupt visual damage recovery without delaying input", () => {
    const m = setup(),
      a = m.fighters[0],
      p = new FighterPresentation(gokuAnimations);
    p.tick(a);
    a.setState("hitstun");
    a.reactionStrength = 2;
    a.stun = 10;
    a.syncReactionClock(false);
    p.tick(a);
    expect(p.animator.clipName).toBe("hitMedium");
    a.setState("idle");
    p.tick(a);
    expect(p.animator.clipName).toBe("hitRecovery");
    step(m, { ...neutral(), direction: 1 });
    p.tick(a);
    expect(a.state).toBe("walk");
    expect(p.animator.clipName).toBe("walkForward");
    step(m, { ...neutral(), pressed: ["light"] });
    p.tick(a);
    expect(a.moveId).toBe("stand_light");
    expect(p.animator.clipName).toBe("stand_light");
  });
  it("keeps skin, hair, blue accessories and alpha exact in the alternate palette", () => {
    const palette = JSON.parse(
      fs.readFileSync("public/sprites/goku/palette.json", "utf8"),
    ) as string[];
    const bytes = new Uint8ClampedArray(
      palette.flatMap((c) => [
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5, 7), 16),
        255,
      ]),
    );
    const before = bytes.slice();
    swapGokuPalette(bytes);
    const orange = new Set([
      "#542119",
      "#883116",
      "#ac3c0b",
      "#d95208",
      "#f67a14",
      "#ff9b2b",
      "#ffbc57",
    ]);
    palette.forEach((color, i) => {
      expect(bytes[i * 4 + 3]).toBe(255);
      if (!orange.has(color))
        expect(bytes.slice(i * 4, i * 4 + 4)).toEqual(
          before.slice(i * 4, i * 4 + 4),
        );
    });
    expect(bytes).not.toEqual(before);
  });
  it.each(keys)(
    "%s hits once in both directions against every existing opponent and recovers",
    (key) => {
      for (const enemy of ["samurai", "dio", "goku"] as const)
        for (const mirror of [false, true]) {
          const m = setup(enemy, mirror),
            [a, b] = m.fighters;
          if (key.startsWith("air")) {
            a.y = b.y = FLOOR - 130;
            a.setState("air");
            b.setState("air");
            if (key === "air_heavy") b.y += 32;
          }
          expect(a.attack(key)).toBe(true);
          run(m, 100);
          const impacts = hits(m).filter(
            (h) => h.attacker === 0 && h.move === key,
          );
          expect(impacts.length, `${key}/${enemy}/${mirror}`).toBe(1);
          expect(impacts[0].blocked).toBe(false);
          expect(b.health).toBeLessThan(1000);
          expect(a.state).toBe("idle");
          expect(a.attackShapes()).toEqual([]);
        }
    },
  );
  it.each(
    (["samurai", "dio", "goku"] as const).flatMap((enemy) =>
      [false, true].flatMap((mirror) =>
        (["stand_light", "crouch_light"] as const).map((start) => ({
          enemy,
          mirror,
          start,
        })),
      ),
    ),
  )(
    "builds a real $start combo against $enemy, mirrored=$mirror",
    ({ start, enemy, mirror }) => {
      const m = setup(enemy, mirror),
        [a, b] = m.fighters,
        context = start.split("_")[0],
        seen: string[] = [];
      step(m, { ...neutral(), down: context === "crouch", pressed: ["light"] });
      let medium = false,
        heavy = false;
      for (let n = 0; n < 140; n++) {
        const input = neutral();
        input.down = context === "crouch";
        if (
          a.moveId === start &&
          a.connected &&
          a.canCancel("medium") &&
          !medium
        ) {
          input.pressed = ["medium"];
          medium = true;
        }
        if (
          a.moveId === context + "_medium" &&
          a.connected &&
          a.canCancel("heavy") &&
          !heavy
        ) {
          input.pressed = ["heavy"];
          heavy = true;
        }
        seen.push(a.moveId || a.state);
        step(m, input);
      }
      expect(
        hits(m)
          .filter((h) => h.attacker === 0)
          .map((h) => h.move),
      ).toEqual([start, context + "_medium", context + "_heavy"]);
      expect(Math.max(...hits(m).map((h) => h.combo))).toBe(3);
      expect(medium && heavy).toBe(true);
      expect(b.health).toBeLessThan(900);
      const from = seen.indexOf(start),
        to = seen.indexOf(context + "_heavy");
      expect(seen.slice(from, to)).not.toContain("idle");
    },
  );
  it.each(
    (["samurai", "dio", "goku"] as const).flatMap((enemy) =>
      [false, true].map((mirror) => ({ enemy, mirror })),
    ),
  )(
    "supports confirmed launcher jump-cancel and aerial finish against $enemy, mirrored=$mirror",
    ({ enemy, mirror }) => {
      const m = setup(enemy, mirror),
        [a, b] = m.fighters,
        trace: unknown[] = [];
      step(m, { ...neutral(), down: true, pressed: ["heavy"] });
      let jumped = false,
        light = false,
        medium = false,
        heavy = false;
      for (let n = 0; n < 200; n++) {
        const input = neutral();
        if (
          a.moveId === "crouch_heavy" &&
          a.connected &&
          a.canCancel("jump") &&
          !jumped
        ) {
          input.pressed = ["jump"];
          jumped = true;
        } else if (jumped && a.state === "air" && !light) {
          input.pressed = ["light"];
          light = true;
        } else if (
          a.moveId === "air_light" &&
          a.connected &&
          a.canCancel("medium") &&
          !medium
        ) {
          input.pressed = ["medium"];
          medium = true;
        } else if (
          a.moveId === "air_medium" &&
          a.connected &&
          a.canCancel("heavy") &&
          !heavy
        ) {
          input.pressed = ["heavy"];
          heavy = true;
        }
        step(m, input);
        if (a.attackPhase === "active")
          trace.push({
            move: a.moveId,
            t: a.stateFrame,
            a: [a.x, a.y, a.vy],
            b: [b.x, b.y, b.vy],
            shape: a.attackShapes(),
            hurt: b.hurtboxes(),
            targetState: b.state,
            hit: !!m.hits.length,
          });
      }
      fs.mkdirSync("art/goku/combat/qa", { recursive: true });
      fs.writeFileSync(
        `art/goku/combat/qa/launcher-${enemy}-${mirror}.json`,
        JSON.stringify(trace, null, 2),
      );
      expect(
        hits(m)
          .filter((h) => h.attacker === 0)
          .map((h) => h.move),
      ).toEqual(["crouch_heavy", "air_light", "air_medium", "air_heavy"]);
      expect(jumped && light && medium && heavy).toBe(true);
      expect(b.y).toBe(FLOOR);
      expect(b.state).toBe("idle");
      const miss = setup();
      miss.fighters[1].x = 1100;
      miss.fighters[0].attack("crouch_heavy");
      run(miss, 15);
      expect(miss.fighters[0].canCancel("jump")).toBe(false);
      expect(miss.fighters[1].y).toBe(FLOOR);
    },
  );
  it("blocks highs standing, lows crouched, and never launches a blocking target", () => {
    for (const [key, down] of [
      ["stand_heavy", false],
      ["crouch_medium", true],
      ["crouch_heavy", false],
    ] as const) {
      const m = setup(),
        [a, b] = m.fighters;
      a.x = 1170;
      b.x = 1240;
      a.attack(key);
      run(m, 50, neutral(), {
        ...neutral(),
        direction: -b.facing as -1 | 1,
        down,
      });
      expect(b.health).toBe(1000);
      expect(hits(m).some((h) => h.blocked)).toBe(true);
      expect(b.y).toBe(FLOOR);
    }
  });
  it("disables every pending offensive shape when Goku receives damage", () => {
    const m = setup(),
      [a, b] = m.fighters;
    a.attack("stand_heavy");
    b.attack("stand_light");
    run(m, 8);
    expect(a.state).toBe("hitstun");
    expect(a.attackShapes()).toEqual([]);
    expect(hits(m).filter((h) => h.attacker === 0)).toHaveLength(0);
  });
  it("restores attack/launcher simulation deterministically", () => {
    const m = setup();
    m.fighters[0].attack("crouch_heavy");
    run(m, 11);
    const clone = restore(snapshot(m));
    for (let i = 0; i < 90; i++) {
      step(m);
      step(clone);
      expect(hashState(snapshot(m))).toBe(hashState(snapshot(clone)));
    }
  });
  it.each(
    (["samurai", "dio", "goku"] as const).flatMap((enemy) =>
      [false, true].map((mirror) => ({ enemy, mirror })),
    ),
  )(
    "captures, throws, knocks down and releases $enemy, mirrored=$mirror",
    ({ enemy, mirror }) => {
      const m = setup(enemy, mirror),
        [a, b] = m.fighters;
      a.x = mirror ? 120 : 1160;
      b.x = a.x + a.facing * 60;
      const origin = a.x;
      step(m, { ...neutral(), pressed: ["throw"] });
      const states = new Set<string>();
      let captured = false,
        maxLift = 0;
      for (let n = 0; n < 150; n++) {
        step(m);
        states.add(b.state);
        if (m.capture) {
          captured = true;
          expect(a.x).toBe(origin);
          maxLift = Math.max(maxLift, FLOOR - b.y);
          expect(b.x).toBeGreaterThanOrEqual(40);
          expect(b.x).toBeLessThanOrEqual(1240);
        }
      }
      expect(captured).toBe(true);
      expect(maxLift).toBeGreaterThan(60);
      expect(hits(m).filter((h) => h.move === "throw")).toHaveLength(1);
      expect(b.health).toBe(875);
      expect(states.has("getup")).toBe(true);
      expect(m.capture).toBeUndefined();
      expect(a.state).toBe("idle");
      expect(b.state).toBe("idle");
    },
  );
  it("a throw whiff obeys recovery, an airborne target escapes, and capture snapshots resume identically", () => {
    const m = setup();
    m.fighters[1].x = 1100;
    step(m, { ...neutral(), pressed: ["throw"] });
    run(m, 10, { ...neutral(), pressed: ["light"] });
    expect(m.fighters[0].moveId).toBe("throw");
    expect(m.capture).toBeUndefined();
    expect(m.fighters[1].health).toBe(1000);
    run(m, 35);
    expect(m.fighters[0].state).toBe("idle");
    const escape = setup();
    step(
      escape,
      { ...neutral(), pressed: ["throw"] },
      { ...neutral(), pressed: ["jump"] },
    );
    run(escape, 40);
    expect(escape.capture).toBeUndefined();
    expect(escape.fighters[1].health).toBe(1000);
    const grabbed = setup();
    step(grabbed, { ...neutral(), pressed: ["throw"] });
    while (!grabbed.capture) step(grabbed);
    run(grabbed, 12);
    const copy = restore(snapshot(grabbed));
    for (let n = 0; n < 90; n++) {
      step(grabbed);
      step(copy);
      expect(hashState(snapshot(copy))).toBe(hashState(snapshot(grabbed)));
    }
  });
  it("uses distinct defense, damage, getup and KO drawings without unresolved aliases", () => {
    const m = setup(),
      a = m.fighters[0],
      p = new FighterPresentation(gokuAnimations);
    p.tick(a);
    for (const strength of [1, 2, 3]) {
      a.setState("hitstun");
      a.reactionStrength = strength;
      a.stun = 30;
      a.syncReactionClock(false);
      p.tick(a);
      expect(p.animator.clipName).toBe(
        ["", "hitLight", "hitMedium", "hitHeavy"][strength],
      );
    }
    a.setState("blockstun");
    a.blockCrouched = false;
    p.tick(a);
    expect(p.animator.clipName).toBe("guardImpactStand");
    a.blockCrouched = true;
    p.tick(a);
    expect(p.animator.clipName).toBe("guardImpactCrouch");
    a.setState("getup");
    p.tick(a);
    expect(p.animator.clipName).toBe("getup");
    a.setState("ko");
    a.stateFrame = 60;
    p.tick(a);
    const last = p.animator.frame();
    a.setState("defeat");
    p.tick(a);
    expect(p.animator.frame()).toBe(last);
    expect(p.animator.clipName).toBe("ko");
  });
});
