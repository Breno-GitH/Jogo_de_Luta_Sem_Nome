import { combatPace } from "../src/engine/pace";
import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters, characterById } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { FighterPresentation } from "../src/render/presentation";
import animation from "../src/data/goku-animations.json";
import manifest from "../public/sprites/goku/movement.json";
import gait from "../src/data/goku-gait.json";
import { snapshot, restore, hashState } from "../src/engine/state";
import { GameSession } from "../src/game/session";
const tick = (m: Match, i: InputFrame = neutral()) => m.step([i, neutral()]);
type WalkName = "walkForward" | "walkBack";
const correctionLimit = (key: WalkName) =>
  Math.max(
    0,
    Math.min(
      4,
      Math.floor(
        (gait[key] as { maxFootCorrection?: number }).maxFootCorrection ?? 0,
      ),
    ),
  );
function fixture(mirror = false) {
  const m = new Match(characters.goku, { training: true }, characters.samurai);
  m.phase = "fight";
  m.message = "";
  m.fighters[0].x = mirror ? 880 : 400;
  m.fighters[1].x = mirror ? 100 : 1180;
  m.fighters[0].facing = mirror ? -1 : 1;
  m.fighters[1].facing = mirror ? 1 : -1;
  return m;
}
describe("Goku movement in the existing engine", () => {
  it.each([false, true])(
    "enters an authored whole-pose transition while physical movement responds immediately, side=%s",
    (mirror) => {
      for (const direction of [-1, 1]) {
        const m = fixture(mirror),
          a = m.fighters[0],
          p = new FighterPresentation(animation);
        p.tick(a);
        const beforeX = a.x;
        const beforeBounds = manifest.clips.idle.bounds[p.animator.frame()];
        tick(m, { ...neutral(), direction: (a.facing * direction) as -1 | 1 });
        p.tick(a);
        expect(p.animator.clipName).toBe(
          direction === 1 ? "idleToWalkForward" : "idleToWalkBack",
        );
        expect(Math.abs(a.x - beforeX)).toBeCloseTo(
          direction === 1 ? a.data.speed : a.data.locomotion!.backSpeed,
          10,
        );
        for (let n = 0; n < 4; n++) {
          tick(m, {
            ...neutral(),
            direction: (a.facing * direction) as -1 | 1,
          });
          p.tick(a);
        }
        const key = p.animator.clipName as WalkName;
        expect(["walkForward", "walkBack"]).toContain(key);
        const meta = manifest.clips[key],
          definition = gait[key];
        const frame = p.animator.frame();
        const support = p.plantedFoot?.side as "near" | "far";
        expect(support).toBeDefined();
        const oldFoot =
          beforeX +
          (definition.restFeet[support === "near" ? 0 : 1] - 128) * a.facing;
        const foot =
          p.renderRootX(a) +
          (definition.pixelFeet[frame][support === "near" ? 0 : 1] - 128) *
            a.facing;
        expect(Number.isInteger(foot)).toBe(true);
        // Compare actual raster bounds, not invented interpolated bone lengths.
        expect(
          Math.abs(meta.bounds[frame][3] - beforeBounds[3]),
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(meta.bounds[frame][1] - beforeBounds[1]),
        ).toBeLessThanOrEqual(8);
      }
    },
  );
  it("finishes rising when movement is blocked by the arena wall", () => {
    const m = fixture(),
      a = m.fighters[0],
      p = new FighterPresentation(animation);
    a.x = 40;
    p.tick(a);
    for (let n = 0; n < 16; n++) {
      tick(m, { ...neutral(), down: true });
      p.tick(a);
    }
    for (let n = 0; n < 12; n++) {
      tick(m, { ...neutral(), direction: -1 });
      p.tick(a);
      expect(a.x).toBe(40);
    }
    expect(p.animator.clipName).toBe("idle");
    tick(m, { ...neutral(), direction: 1 });
    p.tick(a);
    expect(p.animator.clipName).toBe("idleToWalkForward");
  });
  it.each([false, true])(
    "reports the real rendered sole and bounds any optional pixel correction, side=%s",
    (mirror) => {
      for (const sign of [-1, 1]) {
        const m = fixture(mirror),
          a = m.fighters[0],
          p = new FighterPresentation(animation);
        p.tick(a);
        let checked = 0;
        for (let n = 0; n < 45; n++) {
          tick(m, { ...neutral(), direction: (a.facing * sign) as -1 | 1 });
          p.tick(a);
          const key = sign === 1 ? "walkForward" : "walkBack",
            def = gait[key],
            frame = p.animator.frame();
          if (p.animator.clipName !== key) continue;
          const side = p.plantedFoot?.side;
          expect(side).toBeDefined();
          if (!side) throw new Error("Walking frame has no planted foot");
          expect(def.supportByFrame[frame]).toContain(side);
          const x =
            p.renderRootX(a) +
            (def.pixelFeet[frame][side === "near" ? 0 : 1] - 128) * a.facing;
          expect(p.plantedFoot!.worldX).toBe(x);
          expect(Number.isInteger(p.renderRootX(a))).toBe(true);
          expect(Math.abs(p.renderRootX(a) - a.x)).toBeLessThanOrEqual(
            correctionLimit(key) + 1,
          );
          checked++;
        }
        expect(checked).toBeGreaterThan(30);
      }
    },
  );
  it.each([-1, 1] as const)(
    "rises into an authored first step when leaving a full crouch, direction=%s",
    (direction) => {
      const m = fixture(),
        a = m.fighters[0],
        p = new FighterPresentation(animation);
      p.tick(a);
      for (let n = 0; n < 20; n++) {
        tick(m, { ...neutral(), down: true });
        p.tick(a);
      }
      const seen = new Set<string>();
      for (let n = 0; n < 16; n++) {
        tick(m, { ...neutral(), direction });
        p.tick(a);
        seen.add(p.animator.clipName);
        expect(a.y).toBe(FLOOR);
      }
      expect(
        seen.has(direction === 1 ? "crouchWalkForward" : "crouchWalkBack"),
      ).toBe(true);
      expect(p.animator.clipName).toBe(
        direction === 1 ? "walkForward" : "walkBack",
      );
    },
  );
  it("holds the provisional defeated drawing instead of restarting a second fall", () => {
    const a = fixture().fighters[0],
      p = new FighterPresentation(animation);
    a.setState("ko");
    a.stateFrame = 40;
    p.tick(a);
    const last = p.animator.frame();
    a.setState("defeat");
    p.tick(a);
    expect(p.animator.frame()).toBe(last);
    expect(last).toBe(2);
  });
  it("uses the deliberate walk cadence while retaining agile aerial and dash mobility", () => {
    expect(characterById("goku")).toBe(characters.goku);
    expect(characters.goku.speed).toBeGreaterThan(0);
    expect(characters.goku.speed).toBe(combatPace.mobility.goku.speed);
    expect(combatPace.mobility.goku.backSpeed).toBe(
      characters.goku.locomotion?.backSpeed,
    );
    expect(characters.goku.locomotion?.airSpeed).toBe(combatPace.mobility.goku.airSpeed);
    expect(characters.goku.locomotion!.airSpeed).toBeGreaterThan(
      characters.samurai.speed,
    );
    expect(Math.max(...characters.goku.locomotion!.dashForward)).toBeCloseTo(22 * combatPace.mobility.goku.dashScale);
    expect(Math.max(...characters.goku.locomotion!.backdash)).toBeCloseTo(18 * combatPace.mobility.goku.dashScale);
    expect(characters.goku.jump).toBeLessThan(characters.samurai.jump);
    expect(Object.keys(characters.goku.moves)).toHaveLength(10);
    expect(Object.keys(characters.goku.specialMoves!)).toHaveLength(12);
    expect(Object.keys(characters.goku.superMoves!)).toEqual(["ssj1_fury"]);
    expect(characters.goku.companion).toBeUndefined();
  });
  it.each([false, true])(
    "uses the whole drawings and their individual durations through a full cycle, side=%s",
    (mirror) => {
      for (const forward of [false, true]) {
        const m = fixture(mirror),
          a = m.fighters[0],
          p = new FighterPresentation(animation);
        p.tick(a);
        const key = forward ? "walkForward" : "walkBack";
        const clip = animation.clips[key],
          total = clip.durations.reduce((a, b) => a + b, 0);
        for (let n = 0; n < 4; n++) {
          tick(m, {
            ...neutral(),
            direction: (a.facing * (forward ? 1 : -1)) as -1 | 1,
          });
          p.tick(a);
        }
        let firstTick: number | undefined, firstX: number | undefined;
        const seen = new Set<number>();
        for (let n = 0; n < total + Math.max(...clip.durations) + 1; n++) {
          tick(m, {
            ...neutral(),
            direction: (a.facing * (forward ? 1 : -1)) as -1 | 1,
          });
          p.tick(a);
          expect(p.animator.clipName).toBe(key);
          const frame = p.animator.frame(),
            meta = manifest.clips[key],
            side = p.plantedFoot?.side;
          expect(side).toBeDefined();
          if (!side) throw new Error("Walking frame has no planted foot");
          expect(meta.support[frame]).toContain(side);
          firstTick ??= p.animator.elapsedTicks;
          firstX ??= a.x;
          const travelled = Math.abs(a.x - firstX) / Math.abs(gait[key].speed);
          const expected = Math.floor(firstTick + travelled + 1e-6) % total;
          const actual = p.animator.elapsedTicks;
          expect(Math.min((actual-expected+total)%total,(expected-actual+total)%total)).toBeLessThanOrEqual(1);
          const at = clip.frames.indexOf(frame);
          expect(at).toBeGreaterThanOrEqual(0);
          const start = clip.durations.slice(0, at).reduce((a, b) => a + b, 0);
          expect(p.animator.elapsedTicks).toBeGreaterThanOrEqual(start);
          expect(p.animator.elapsedTicks).toBeLessThan(start + clip.durations[at]);
          seen.add(frame);
        }
        expect(seen).toEqual(new Set(clip.frames));
      }
    },
  );
  it.each([false, true])(
    "settles a walk through complete authored drawings and can interrupt that transition, side=%s",
    (mirror) => {
      const m = fixture(mirror),
        a = m.fighters[0],
        p = new FighterPresentation(animation);
      p.tick(a);
      for (let n = 0; n < 13; n++) {
        tick(m, { ...neutral(), direction: a.facing as -1 | 1 });
        p.tick(a);
      }
      tick(m);
      p.tick(a);
      expect(p.animator.clipName).toBe("walkToIdleForward");
      const x = a.x;
      for (let n = 0; n < 4; n++) {
        tick(m);
        p.tick(a);
        expect(a.x).toBe(x);
      }
      expect(p.animator.clipName).toBe("idle");
      expect(p.animator.sprite().sheet).toBe(animation.clips.idle.sheet);
      expect(p.plantedFoot).toBeUndefined();
      expect(p.renderRootX(a)).toBe(Math.round(a.x));
    },
  );
  it("uses a dedicated backward cycle and preserves drawing phase during fast reversals", () => {
    const m = fixture(),
      a = m.fighters[0],
      p = new FighterPresentation(animation);
    p.tick(a);
    const seen = new Set<string>();
    for (let n = 0; n < 80; n++) {
      tick(m, { ...neutral(), direction: n % 8 < 4 ? 1 : -1 });
      p.tick(a);
      seen.add(p.animator.clipName);
      expect(p.animator.frame()).toBeLessThan(
        (manifest.clips as Record<string, { count: number }>)[
          p.animator.clipName
        ].count,
      );
      expect(a.y).toBe(FLOOR);
    }
    expect(seen).toEqual(
      new Set(["idleToWalkForward", "walkForward", "walkBack"]),
    );
    expect(gait.walkBack.feet).not.toEqual(
      [...gait.walkForward.feet].reverse(),
    );
  });
  it("stops cycling feet when actual travel is blocked at a wall", () => {
    const m = fixture();
    m.fighters[0].x = 40;
    m.fighters[1].x = 1180;
    const p = new FighterPresentation(animation);
    p.tick(m.fighters[0]);
    for (let n = 0; n < 20; n++) {
      tick(m, { ...neutral(), direction: -1 });
      p.tick(m.fighters[0]);
    }
    expect(m.fighters[0].x).toBe(40);
    expect(p.animator.clipName).toBe("idle");
  });
  it("has anatomical start/idle/end crouch phases, including quick releases", () => {
    for (const hold of [1, 3, 16]) {
      const m = fixture(),
        a = m.fighters[0],
        p = new FighterPresentation(animation);
      p.tick(a);
      const seen = new Set<string>();
      for (let n = 0; n < hold; n++) {
        tick(m, { ...neutral(), down: true });
        p.tick(a);
        seen.add(p.animator.clipName);
        expect(a.y).toBe(FLOOR);
      }
      for (let n = 0; n < 10; n++) {
        tick(m);
        p.tick(a);
        seen.add(p.animator.clipName);
        expect(a.y).toBe(FLOOR);
      }
      expect(seen.has("crouchStart")).toBe(true);
      expect(seen.has("crouchEnd")).toBe(true);
      expect(p.animator.clipName).toBe("idle");
      if (hold > 6) expect(seen.has("crouchIdle")).toBe(true);
    }
  });
  it.each([-1, 0, 1] as const)(
    "selects takeoff, rise, apex, fall and landing by actual physics, direction=%s",
    (direction) => {
      const m = fixture(),
        a = m.fighters[0],
        p = new FighterPresentation(animation);
      p.tick(a);
      const seen = new Set<string>();
      let minimum = FLOOR;
      for (let n = 0; n < 75; n++) {
        tick(m, { ...neutral(), direction, pressed: n === 0 ? ["jump"] : [] });
        p.tick(a);
        seen.add(p.animator.clipName);
        minimum = Math.min(minimum, a.y);
        if (p.animator.clipName === "landing") expect(a.y).toBe(FLOOR);
        if (a.y < FLOOR) expect(p.animator.clipName).not.toBe("idle");
      }
      expect(minimum).toBeLessThan(FLOOR - 180);
      for (const phase of [
        "jumpStart",
        "jumpRise",
        "jumpApex",
        "jumpFall",
        "landing",
      ])
        expect(
          [...seen].some((s) => s.startsWith(phase)),
          phase,
        ).toBe(true);
      expect(a.y).toBe(FLOOR);
      expect(a.vy).toBe(0);
    },
  );
  it.each([false, true])(
    "performs dash and backdash with engine displacement and returns safely, side=%s",
    (mirror) => {
      for (const sign of [1, -1]) {
        const m = fixture(mirror),
          a = m.fighters[0],
          p = new FighterPresentation(animation);
        p.tick(a);
        const start = a.x;
        tick(m, {
          ...neutral(),
          direction: (sign * a.facing) as -1 | 1,
          pressed: ["dash"],
        });
        p.tick(a);
        expect(p.animator.clipName).toBe(
          sign === 1 ? "dashForward" : "backdash",
        );
        for (let i = 0; i < 20; i++) {
          tick(m);
          p.tick(a);
        }
        expect(Math.abs(a.x - start)).toBeGreaterThan(140);
        expect(a.state).toBe("idle");
        expect(p.animator.clipName).toBe("idle");
      }
    },
  );
  it("training exposes the current Super through universal R", () => {
    const s = new GameSession("training", "easy", "goku");
    expect(s.match.fighters[0].data.id).toBe("goku");
    for (let n = 0; n < 20; n++)
      s.step({
        ...neutral(),
        direction: 1,
        pressed: ["ultimate", "taunt"],
      });
    expect(s.match.fighters[0].state).toBe("attack");
    expect(s.match.fighters[0].moveId).toBe("ssj1_fury");
    expect(s.match.projectiles).toEqual([]);
    expect(s.match.roadRoller).toBeUndefined();
  });
  it("handles incoming Samurai/Dio damage and captures using explicitly provisional Goku-owned reactions", () => {
    for (const enemy of ["samurai", "dio"] as const) {
      const m = new Match(characters.goku, {}, characters[enemy]);
      m.phase = "fight";
      const [a, b] = m.fighters;
      a.x = 500;
      b.x = 580;
      b.attack("stand_medium");
      const p = new FighterPresentation(animation);
      let hit = false;
      for (let n = 0; n < 100; n++) {
        tick(m);
        p.tick(a);
        if (a.health < 1000) hit = true;
        expect(p.animator.sprite().sheet.startsWith("goku/")).toBe(true);
      }
      expect(hit, enemy).toBe(true);
      expect(a.state).toBe("idle");
    }
  });
  it("restores movement state and future physics deterministically", () => {
    const m = fixture();
    for (let i = 0; i < 17; i++)
      tick(m, {
        ...neutral(),
        direction: 1,
        pressed: i === 16 ? ["jump"] : [],
      });
    const copy = restore(JSON.parse(JSON.stringify(snapshot(m))));
    for (let i = 0; i < 80; i++) {
      const input = { ...neutral(), direction: (i < 35 ? 1 : 0) as 0 | 1 };
      tick(m, input);
      tick(copy, input);
      expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
    }
  });
});
