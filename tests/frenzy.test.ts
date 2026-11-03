import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters, type CharacterId } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { combatPace, animationTick } from "../src/engine/pace";
import { snapshot, restore, hashState } from "../src/engine/state";
import { FighterPresentation } from "../src/render/presentation";
import { gokuAnimations } from "../src/render/goku-animations";
import { poseIndexAt } from "../src/engine/moves";
import { CommandBuffer } from "../src/engine/input";
const step = (m: Match, a = neutral(), b = neutral()) => m.step([a, b]);
function setup(id: CharacterId = "goku", mirror = false, gap = 70) {
  const m = new Match(characters[id], { training: true }, characters.samurai);
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 600;
  a.facing = mirror ? -1 : 1;
  b.x = a.x + gap * a.facing;
  b.facing = -a.facing;
  if (a.stand) {
    a.stand.s.x = a.x - 30 * a.facing;
    a.stand.s.y = a.y - 18;
  }
  return m;
}
function run(m: Match, n: number) {
  for (let i = 0; i < n; i++) step(m);
}
function until(m: Match, condition: () => boolean, max = 240) {
  for (let t = 0; t < max && !condition(); t++) step(m);
  expect(condition()).toBe(true);
}
function motion(m: Match, button: "light" | "medium" | "heavy") {
  step(m, { ...neutral(), down: true });
  step(m);
  step(m, { ...neutral(), down: true, pressed: [button] });
}
function air(m: Match, victim = false) {
  const [a, b] = m.fighters;
  a.y = 360;
  a.vy = -1;
  a.setState("air");
  if (victim) {
    b.y = 350;
    b.vy = -2;
    b.setState("hitstun");
    b.stun = 65;
    b.combo = 3;
    b.comboAirHits = 3;
  }
}
describe("Frenetic shared combat", () => {
  it("replays delayed launcher/J/K keyboard timings captured through the Apache proxy", () => {
    const m = new Match(characters.goku, { training: true }, characters.goku);
    m.phase = "fight";
    m.fighters[0].x = 500;
    m.fighters[1].x = 570;
    const hits: string[] = [];
    for (let tick = 1; tick <= 100; tick++) {
      const input =
        tick === 8
          ? {
              ...neutral(),
              down: true,
              pressed: ["heavy"] as InputFrame["pressed"],
            }
          : tick === 34
            ? {
                ...neutral(),
                pressed: ["jump", "light"] as InputFrame["pressed"],
              }
            : tick === 46
              ? { ...neutral(), pressed: ["medium"] as InputFrame["pressed"] }
              : neutral();
      step(m, input);
      hits.push(
        ...m.hits
          .filter((h) => h.attacker === 0 && !h.blocked)
          .map((h) => h.move),
      );
    }
    expect(hits).toEqual(["crouch_heavy", "air_light", "air_medium"]);
  });
  it("an unanswered boosted pursuit settles inside the arena instead of flying offscreen", () => {
    const m = setup(),
      a = m.fighters[0];
    a.attack("crouch_heavy");
    until(m, () => a.canCancel("jump"));
    run(m, 7);
    step(m, { ...neutral(), pressed: ["jump"] });
    m.fighters[1].x = 1200;
    let min = a.y;
    for (let t = 0; t < 130; t++) {
      step(m);
      min = Math.min(min, a.y);
    }
    expect(min).toBeGreaterThan(200);
    expect(a.y).toBe(FLOOR);
  });
  it("an unavailable R never swallows a simultaneous heavy normal on ground or in the air", () => {
    for (const id of ["samurai", "dio", "goku"] as const) {
      const m = setup(id),
        a = m.fighters[0];
      a.meter = 0;
      step(m, { ...neutral(), pressed: ["ultimate", "heavy"] });
      expect(a.moveId).toBe("stand_heavy");
      const airborne = setup(id),
        f = airborne.fighters[0];
      air(airborne);
      f.meter = id === "dio" ? 200 : 100;
      step(airborne, { ...neutral(), pressed: ["ultimate", "heavy"] });
      expect(f.moveId, id).toBe("air_heavy");
      expect(f.meter).toBe(id === "dio" ? 200 : 100);
    }
  });
  it("two distinct down taps survive hitstop without becoming a held-down command", () => {
    const b = new CommandBuffer();
    b.push({ ...neutral(), down: true }, 20, 1);
    b.push(neutral(), 20, 1);
    b.push({ ...neutral(), down: true, pressed: ["heavy"] }, 20, 1);
    expect(b.gokuSpecial("heavy")).toBe("teleport");
    b.consumeSpecial("heavy");
    expect(b.gokuSpecial("heavy")).toBeUndefined();
  });
  it.each(["samurai", "dio", "goku"] as const)(
    "%s permits one confirmed reverse beat and forbids repeating it",
    (id) => {
      const m = setup(id),
        a = m.fighters[0];
      a.attack("stand_medium");
      until(m, () => a.canCancel("light"));
      step(m, { ...neutral(), pressed: ["light"] });
      until(m, () => a.moveId === "stand_light", 20);
      expect(a.reverseBeatUsed).toBe(true);
      until(m, () => a.canCancel("medium"));
      step(m, { ...neutral(), pressed: ["medium"] });
      until(m, () => a.moveId === "stand_medium" && a.hitConfirmed, 40);
      until(m, () => a.canCancel("heavy"), 20);
      expect(a.canCancel("light")).toBe(false);
      expect(a.canCancel("heavy")).toBe(true);
    },
  );
  it.each(["samurai", "dio", "goku"] as const)(
    "%s J → K → L → special is a continuous legal route",
    (id) => {
      const m = setup(id),
        a = m.fighters[0];
      a.attack("stand_light");
      for (const button of ["medium", "heavy"] as const) {
        until(m, () => a.canCancel(button));
        step(m, { ...neutral(), pressed: [button] });
        until(m, () => a.moveId === `stand_${button}`, 30);
      }
      until(m, () => a.canSpecialCancel());
      const dir = (id === "dio" ? -a.facing : a.facing) as -1 | 1;
      step(m, { ...neutral(), down: true });
      step(m, { ...neutral(), down: true, direction: dir });
      step(m, { ...neutral(), direction: dir, pressed: ["light"] });
      const desired =
        id === "dio" ? "rush_light" : id === "goku" ? "ki_light" : "draw_light";
      until(m, () => a.moveId === desired, 25);
      let specialHits = 0;
      for (let t = 0; t < 130; t++) {
        step(m);
        specialHits += m.hits.filter(
          (h) => h.move === desired && !h.blocked,
        ).length;
      }
      expect(specialHits).toBeGreaterThan(0);
      expect(a.state).toBe("idle");
    },
  );
  it.each(["samurai", "dio", "goku"] as const)(
    "%s R is a finite-cost attempt, preserves the movie, and cannot repeat during startup",
    (id) => {
      for (const mirror of [false, true]) {
        const m = setup(id, mirror, id === "goku" ? 240 : 90),
          a = m.fighters[0];
        const cost = id === "dio" ? 200 : 100;
        a.meter = cost - 1;
        step(m, { ...neutral(), pressed: ["ultimate"] });
        expect(a.state).toBe("idle");
        expect(a.meter).toBe(cost - 1);
        a.meter = cost;
        step(m, { ...neutral(), pressed: ["ultimate"] });
        expect(a.moveId).toBe(
          id === "goku"
            ? "ssj1_fury"
            : id === "dio"
              ? "road_roller"
              : "ultimate_start",
        );
        expect(a.meter).toBe(0);
        const old = a.stateFrame;
        step(m, { ...neutral(), pressed: ["ultimate"] });
        expect(a.stateFrame).toBeGreaterThan(old);
        expect(a.meter).toBe(0);
        until(m, () => !!(m.fury || m.roadRoller || m.capture));
        until(m, () => !m.fury && !m.roadRoller && !m.capture, 700);
        expect(a.y).toBe(FLOOR);
        expect(a.state).not.toBe("cinematic");
      }
    },
  );
  it.each(["samurai", "dio", "goku"] as const)(
    "%s allows confirmed L into R without an Idle reset",
    (id) => {
      const m = setup(id),
        a = m.fighters[0];
      a.meter = id === "dio" ? 200 : 100;
      a.attack("stand_heavy");
      until(m, () => a.canSuperCancel());
      step(m, { ...neutral(), pressed: ["ultimate"] });
      until(
        m,
        () =>
          a.moveId === "ultimate_start" ||
          a.moveId === "road_roller" ||
          a.moveId === "ssj1_fury",
        30,
      );
      expect(a.attackShapes()).toEqual([]);
      until(m, () => !!(m.fury || m.roadRoller || m.capture), 170);
    },
  );
  it.each(["samurai", "dio", "goku"] as const)(
    "%s has faster distinct mobility and finite whiff recovery",
    (id) => {
      const m = setup(id, false, 600),
        a = m.fighters[0];
      step(m, { ...neutral(), direction: 1 });
      expect(a.vx).toBe(combatPace.mobility[id].speed);
      a.attack("stand_heavy");
      const total = a.move!.startup + a.move!.active + a.move!.recovery;
      expect(total).toBeGreaterThan(15);
      run(m, 3);
      expect(a.canCancel("special")).toBe(false);
      expect(a.canSuperCancel()).toBe(false);
      run(m, total);
      expect(a.state).toBe("idle");
      expect(a.attackShapes()).toEqual([]);
    },
  );
  it.each([false, true])(
    "all air teleports respect facing, resource and complete air drawings; mirror=%s",
    (mirror) => {
      for (const button of ["light", "medium", "heavy"] as const) {
        const m = setup("goku", mirror, 200),
          [a, b] = m.fighters;
        air(m, button === "heavy");
        const before = a.x;
        motion(m, button);
        expect(a.move?.airTeleport).toBe(true);
        expect(a.gokuAirTeleportsUsed).toBe(1);
        const visual = new FighterPresentation(gokuAnimations);
        for (let t = 0; t < 20 && a.state === "attack"; t++) {
          visual.tick(a);
          expect(visual.animator.clipName).toBe("teleport_air");
          expect(visual.animator.frame()).toBe(
            poseIndexAt(a.move!, a.stateFrame),
          );
          step(m);
        }
        expect(a.airborne).toBe(true);
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(52);
        expect(a.x).toBeGreaterThanOrEqual(40);
        expect(a.x).toBeLessThanOrEqual(1240);
        if (button === "light")
          expect(Math.sign(a.x - before)).toBe(mirror ? -1 : 1);
        if (button === "medium")
          expect(Math.sign(a.x - b.x)).toBe(mirror ? -1 : 1);
        if (button === "heavy")
          expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(90);
        expect(a.canStartSpecial("teleport_air_light")).toBe(false);
        const copy = restore(snapshot(m));
        for (let t = 0; t < 90; t++) {
          step(m);
          step(copy);
          expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
        }
        expect(a.gokuAirTeleportsUsed).toBe(0);
      }
    },
  );
  it("air L has no offensive destination without an airborne hitstun target", () => {
    const m = setup(),
      a = m.fighters[0];
    air(m);
    const x = a.x;
    motion(m, "heavy");
    expect(a.moveId).toBe("");
    expect(a.gokuAirTeleportsUsed).toBe(0);
    expect(a.x).toBe(x);
    for (const state of ["hitstun", "grabbed", "ko"] as const) {
      a.setState(state);
      expect(a.canStartSpecial("teleport_air_light")).toBe(false);
    }
  });
  it.each([false, true])(
    "launcher → J → K → air teleport L → J → K → L is one bounded combo, mirror=%s",
    (mirror) => {
      const m = setup("goku", mirror),
        [a, b] = m.fighters;
      let stage = 0,
        max = 0;
      const hits: string[] = [],
        trace: unknown[] = [];
      step(m, { ...neutral(), down: true, pressed: ["heavy"] });
      for (let t = 0; t < 430; t++) {
        let i = neutral();
        if (stage === 0 && a.canCancel("jump")) {
          i.pressed = ["jump"];
          stage++;
        } else if (stage === 1 && a.state === "air") {
          i.pressed = ["light"];
          stage++;
        } else if (stage === 2 && a.canCancel("medium")) {
          i.pressed = ["medium"];
          stage++;
        } else if (
          stage === 3 &&
          a.hitConfirmed &&
          a.moveId === "air_medium" &&
          m.hitstop === 0
        ) {
          motion(m, "heavy");
          stage++;
          continue;
        } else if (
          stage === 4 &&
          a.state === "air" &&
          a.gokuAirTeleportsUsed === 1
        ) {
          i.pressed = ["light"];
          stage++;
        } else if (stage === 5 && a.canCancel("medium")) {
          i.pressed = ["medium"];
          stage++;
        } else if (stage === 6 && a.canCancel("heavy")) {
          i.pressed = ["heavy"];
          stage++;
        }
        step(m, i);
        hits.push(...m.hits.filter((h) => !h.blocked).map((h) => h.move));
        max = Math.max(max, b.combo);
        if (i.pressed.length || (stage >= 4 && t % 4 === 0 && t < 100))
          trace.push([
            t,
            stage,
            a.moveId,
            a.stateFrame,
            Math.round(a.x),
            Math.round(a.y),
            Math.round(b.x),
            Math.round(b.y),
            b.stun,
            b.combo,
            a.hitConfirmed,
          ]);
      }
      expect(stage, JSON.stringify({ hits, trace })).toBe(7);
      expect(hits).toEqual([
        "crouch_heavy",
        "air_light",
        "air_medium",
        "air_light",
        "air_medium",
        "air_heavy",
      ]);
      expect(max).toBe(6);
      expect(a.y).toBe(FLOOR);
      expect(b.y).toBe(FLOOR);
      expect(b.state).toBe("idle");
    },
  );
  it("retiming preserves every active contact drawing and leaves source poses immutable", () => {
    for (const d of Object.values(characters))
      for (const [id, m] of Object.entries(d.moves)) {
        if (!m.visualTiming) continue;
        for (let t = m.startup; t < m.startup + m.active; t++)
          expect(animationTick(m, t)).toBe(
            m.visualTiming.startup + t - m.startup,
          );
        expect(m.recovery).toBeGreaterThan(0);
      }
  });
});
