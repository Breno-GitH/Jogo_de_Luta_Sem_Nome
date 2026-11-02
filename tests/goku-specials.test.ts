import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame, type Button } from "../src/engine/types";
import { CommandBuffer } from "../src/engine/input";
import { snapshot, restore, hashState } from "../src/engine/state";
import {
  gokuInvisible,
  gokuBalance,
  teleportDestination,
} from "../src/engine/goku-specials";
type Enemy = "samurai" | "dio" | "goku";
type Strength = "light" | "medium" | "heavy";
type Special = "ki" | "kamehameha" | "teleport";
function setup(enemy: Enemy = "samurai", mirror = false, distance = 320) {
  const m = new Match(characters.goku, { training: true }, characters[enemy]);
  m.phase = "fight";
  m.message = "";
  const [a, b] = m.fighters;
  a.x = mirror ? 980 : 300;
  b.x = a.x + (mirror ? -distance : distance);
  a.facing = mirror ? -1 : 1;
  b.facing = -a.facing;
  return m;
}
const history = new WeakMap<Match, Match["hits"]>();
function step(m: Match, a = neutral(), b = neutral()) {
  m.step([a, b]);
  history.set(m, [...(history.get(m) ?? []), ...m.hits]);
}
function run(m: Match, n: number, a = neutral(), b = neutral()) {
  for (let t = 0; t < n; t++) step(m, a, b);
}
function motion(
  m: Match,
  s: Special,
  button: Button = "light",
  diagonal = true,
) {
  const f = m.fighters[0],
    dir = s === "ki" ? f.facing : -f.facing;
  step(m, { ...neutral(), down: true });
  if (s === "teleport") {
    step(m);
    step(m, { ...neutral(), down: true, pressed: [button] });
  } else {
    if (diagonal)
      step(m, { ...neutral(), down: true, direction: dir as 1 | -1 });
    step(m, { ...neutral(), direction: dir as 1 | -1, pressed: [button] });
  }
}
const hits = (m: Match) =>
  history.get(m)?.filter((h) => h.attacker === 0) ?? [];
describe("Goku common specials with fixed-tick commands", () => {
  it.each(
    (["samurai", "dio", "goku"] as const).flatMap((enemy) =>
      [false, true].flatMap((mirror) =>
        (["light", "medium", "heavy"] as const).map((strength) => ({
          enemy,
          mirror,
          strength,
        })),
      ),
    ),
  )(
    "Ki $strength hits $enemy, mirrored=$mirror, once per independent projectile",
    ({ enemy, mirror, strength }) => {
      const m = setup(enemy, mirror);
      m.fighters[0].meter = 73;
      motion(m, "ki", strength);
      expect(m.fighters[0].moveId).toBe("ki_" + strength);
      run(m, 160);
      expect(hits(m).length).toBe(strength === "medium" ? 2 : 1);
      expect(hits(m).every((h) => !h.blocked)).toBe(true);
      expect(m.kiProjectiles).toEqual([]);
      expect(m.fighters[0].state).toBe("idle");
      expect(m.fighters[0].meter).toBeGreaterThanOrEqual(73);
      expect(m.capture).toBeUndefined();
      expect(m.roadRoller).toBeUndefined();
    },
  );
  it.each(
    (["samurai", "dio", "goku"] as const).flatMap((enemy) =>
      [false, true].flatMap((mirror) =>
        (["light", "medium", "heavy"] as const).map((strength) => ({
          enemy,
          mirror,
          strength,
        })),
      ),
    ),
  )(
    "Kamehameha $strength has limited discrete pulses against $enemy, mirrored=$mirror",
    ({ enemy, mirror, strength }) => {
      const m = setup(enemy, mirror);
      motion(m, "kamehameha", strength);
      expect(m.fighters[0].moveId).toBe("kamehameha_" + strength);
      let active = 0;
      for (let i = 0; i < 180; i++) {
        step(m);
        if (m.beams.some((b) => b.state === "active")) active++;
      }
      expect(hits(m).length).toBe(gokuBalance.kamehameha[strength].hits);
      expect(new Set(hits(m).map((h) => h.serial)).size).toBe(hits(m).length);
      expect(active).toBeGreaterThan(0);
      expect(m.projectiles).toEqual([]);
      expect(m.kiProjectiles).toEqual([]);
      expect(m.beams).toEqual([]);
      expect(m.fighters[0].state).toBe("idle");
    },
  );
  it.each(
    (["light", "medium", "heavy"] as const).flatMap((strength) =>
      [false, true].map((mirror) => ({ strength, mirror })),
    ),
  )(
    "teleports $strength safely, mirrored=$mirror, with vulnerable recovery",
    ({ strength, mirror }) => {
      const m = setup("samurai", mirror, 180),
        a = m.fighters[0],
        b = m.fighters[1],
        origin = a.x;
      motion(m, "teleport", strength);
      expect(a.moveId).toBe("teleport_" + strength);
      let hidden = false,
        reappeared = false;
      for (let t = 0; t < 90; t++) {
        step(m);
        if (gokuInvisible(a)) {
          hidden = true;
          expect(a.hurtboxes()).toEqual([]);
          expect(a.invulnerable).toBe(true);
        }
        if (a.move?.special === "teleport" && a.attackPhase === "recovery") {
          reappeared = true;
          expect(a.invulnerable).toBe(false);
          break;
        }
      }
      expect(hidden && reappeared).toBe(true);
      expect(a.x).not.toBe(origin);
      expect(a.x).toBeGreaterThanOrEqual(40);
      expect(a.x).toBeLessThanOrEqual(1240);
      if (strength === "medium")
        expect((a.x - b.x) * (mirror ? -1 : 1)).toBeGreaterThan(0);
      if (strength === "heavy") expect(a.y).toBeLessThan(FLOOR);
      expect(a.gokuTeleportLock).toBeGreaterThan(0);
    },
  );
  it("rejects normals during teleport recovery and repeated aerial teleport until landing/lock", () => {
    const m = setup(),
      a = m.fighters[0];
    motion(m, "teleport", "heavy");
    while (a.attackPhase !== "recovery") step(m);
    const move = a.moveId;
    step(m, { ...neutral(), pressed: ["light"] });
    expect(a.moveId).toBe(move);
    expect(a.canStartSpecial("teleport_air")).toBe(false);
    run(m, 150);
    expect(a.y).toBe(FLOOR);
    expect(a.gokuAirTeleportUsed).toBe(false);
    expect(a.canStartSpecial("teleport_heavy")).toBe(true);
  });
  it("validates all teleport destinations at walls, out of target range and in the air", () => {
    for (const mirror of [false, true])
      for (const s of ["light", "medium", "heavy"] as const) {
        const m = setup("goku", mirror, 70),
          a = m.fighters[0],
          b = m.fighters[1];
        a.x = mirror ? 45 : 1235;
        b.x = mirror ? 100 : 1180;
        a.attack("teleport_" + s);
        const p = teleportDestination(a);
        expect(p.x).toBeGreaterThanOrEqual(40);
        expect(p.x).toBeLessThanOrEqual(1240);
        if (Math.abs(p.y - b.y) < 90)
          expect(Math.abs(p.x - b.x)).toBeGreaterThanOrEqual(
            gokuBalance.teleport.separation,
          );
      }
    const far = setup("dio", false, 700),
      a = far.fighters[0];
    a.attack("teleport_medium");
    expect(teleportDestination(a).x - a.x).toBe(
      gokuBalance.teleport.medium.fallbackDistance,
    );
  });
  it("accepts diagonals/cardinals and two distinct down taps; rejects stale, held-down and post-button motions", () => {
    for (const diagonal of [false, true])
      for (const mirror of [false, true]) {
        const m = setup("dio", mirror);
        motion(m, "ki", "medium", diagonal);
        expect(m.fighters[0].moveId).toBe("ki_medium");
      }
    const buffer = new CommandBuffer();
    let tick = 0;
    const push = (down: boolean, direction: -1 | 0 | 1 = 0, button?: Button) =>
      buffer.push(
        { down, direction, pressed: button ? [button] : [] },
        tick++,
        1,
      );
    push(true);
    push(true);
    push(true, 0, "heavy");
    expect(buffer.gokuSpecial("heavy")).toBeUndefined();
    buffer.clear();
    push(true);
    push(false);
    push(true, 0, "heavy");
    expect(buffer.gokuSpecial("heavy")).toBe("teleport");
    buffer.consumeSpecial("heavy");
    expect(buffer.gokuSpecial("heavy")).toBeUndefined();
    push(true);
    push(false);
    for (let i = 0; i < 30; i++) push(false);
    push(false, 1, "light");
    expect(buffer.gokuSpecial("light")).toBeUndefined();
    buffer.clear();
    push(false, 0, "light");
    push(true);
    push(false, 1);
    expect(buffer.gokuSpecial("light")).toBeUndefined();
  });
  it.each([
    "ki_light",
    "ki_medium",
    "ki_heavy",
    "kamehameha_light",
    "kamehameha_medium",
    "kamehameha_heavy",
  ])(
    "blocks %s and removes pending energy when startup is interrupted",
    (id) => {
      const m = setup("samurai", false, 250),
        [a, b] = m.fighters;
      a.x = 990;
      b.x = 1240;
      a.attack(id);
      run(m, 170, neutral(), { ...neutral(), direction: 1 });
      expect(b.health).toBe(1000);
      expect(hits(m).length).toBeGreaterThan(0);
      expect(hits(m).every((h) => h.blocked)).toBe(true);
      const interrupted = setup("samurai", false, 60),
        [c, d] = interrupted.fighters;
      c.attack(id);
      d.attack("stand_light");
      run(interrupted, 6);
      expect(c.state).toBe("hitstun");
      run(interrupted, 120);
      expect(hits(interrupted)).toHaveLength(0);
      expect(interrupted.kiProjectiles).toEqual([]);
      expect(interrupted.beams).toEqual([]);
    },
  );
  it("terminates an active beam immediately after actual incoming damage", () => {
    const m = setup("samurai", false, 60),
      [a, b] = m.fighters;
    a.attack("kamehameha_heavy");
    b.x = 1000;
    run(m, 27);
    expect(m.beams.some((b) => b.state === "active")).toBe(true);
    b.x = a.x + 60;
    b.y = FLOOR;
    b.setState("idle");
    b.attack("stand_light");
    for (let i = 0; i < 40 && a.state !== "hitstun"; i++) step(m);
    expect(a.state).toBe("hitstun");
    expect(m.beams.every((b) => b.state === "dissipate")).toBe(true);
    const count = hits(m).length;
    run(m, 100);
    expect(hits(m).length).toBe(count);
  });
  it("caps independent projectiles and preserves released Ki after its owner is hit", () => {
    const m = setup("samurai", false, 650),
      a = m.fighters[0];
    a.attack("ki_medium");
    run(m, 20);
    expect(m.kiProjectiles.length).toBe(2);
    a.setState("hitstun");
    a.stun = 25;
    const x = m.kiProjectiles[0].x;
    step(m);
    expect(m.kiProjectiles[0].x).toBeGreaterThan(x);
    run(m, 22);
    a.setState("idle");
    a.attack("ki_medium");
    run(m, 20);
    expect(
      m.kiProjectiles.filter((p) => p.state === "flight").length,
    ).toBeLessThanOrEqual(4);
  });
  it("restores projectiles, beam pulses and teleport restrictions deterministically", () => {
    for (const id of ["ki_medium", "kamehameha_heavy", "teleport_heavy"]) {
      const m = setup("goku");
      m.fighters[0].attack(id);
      run(m, 20);
      const clone = restore(snapshot(m));
      for (let i = 0; i < 100; i++) {
        step(m);
        step(clone);
        expect(hashState(snapshot(clone))).toBe(hashState(snapshot(m)));
      }
    }
  });
  it.each([
    {
      start: "stand_light",
      next: "medium",
      special: "ki" as const,
      expected: ["stand_light", "stand_medium", "ki_light"],
    },
    {
      start: "stand_medium",
      next: "heavy",
      special: "kamehameha" as const,
      expected: [
        "stand_medium",
        "stand_heavy",
        "kamehameha_light",
        "kamehameha_light",
      ],
    },
    {
      start: "crouch_medium",
      next: "",
      special: "ki" as const,
      expected: ["crouch_medium", "ki_light"],
    },
  ])(
    "cancels $start into $special using real directional inputs",
    ({ start, next, special, expected }) => {
      for (const enemy of ["samurai", "dio", "goku"] as const)
        for (const mirror of [false, true]) {
          const m = setup(enemy, mirror, 70),
            a = m.fighters[0];
          a.attack(start);
          let followed = !next,
            cast = false;
          for (let t = 0; t < 150; t++) {
            if (!followed && a.canCancel(next)) {
              step(m, { ...neutral(), pressed: [next as Button] });
              followed = true;
            } else if (followed && !cast && a.canSpecialCancel()) {
              motion(m, special);
              cast = true;
            } else step(m);
          }
          expect(cast, `${enemy}/${mirror}`).toBe(true);
          expect(
            hits(m).map((h) => h.move),
            `${enemy}/${mirror}`,
          ).toEqual(expected);
          expect(Math.max(...hits(m).map((h) => h.combo))).toBe(
            expected.length,
          );
        }
    },
  );
  it("permits the heavy airborne teleport once and rejects Ki or beam in the air", () => {
    const m = setup(),
      a = m.fighters[0];
    step(m, { ...neutral(), pressed: ["jump"] });
    run(m, 10);
    motion(m, "teleport", "heavy");
    expect(a.moveId).toBe("teleport_air");
    run(m, 60);
    expect(m.capture).toBeUndefined();
    expect(a.y).toBeGreaterThan(100);
    const air = setup(),
      c = air.fighters[0];
    c.y = FLOOR - 100;
    c.setState("air");
    motion(air, "ki");
    expect(c.moveId).toBe("");
    expect(air.kiProjectiles).toEqual([]);
    expect(c.canStartSpecial("kamehameha_light")).toBe(false);
  });
  it("freezes Goku energy with Dio time stop and resumes its trajectory", () => {
    const m = setup("dio", false, 600),
      a = m.fighters[0];
    a.attack("ki_light");
    run(m, 9);
    expect(m.kiProjectiles).toHaveLength(1);
    m.temporal.activate(1);
    const before = structuredClone(m.kiProjectiles[0]);
    run(m, 30);
    expect(m.kiProjectiles[0]).toEqual(before);
    m.temporal.finish();
    run(m, 4);
    expect(m.kiProjectiles[0].x).toBeGreaterThan(before.x);
  });
});
