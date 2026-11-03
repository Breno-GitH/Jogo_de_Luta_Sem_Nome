import { describe, expect, it } from "vitest";
import { Match, FLOOR, character } from "../src/engine/combat";
import { CommandBuffer } from "../src/engine/input";
import { neutral, type Button, type InputFrame } from "../src/engine/types";
import { FighterPresentation } from "../src/render/presentation";
import { reactionFor } from "../src/engine/lifecycle";
import metadata from "../src/data/animations.json";
import complete from "../public/sprites/samurai/complete.json";

const input = (
  direction: -1 | 0 | 1 = 0,
  down = false,
  pressed: Button[] = [],
): InputFrame => ({ direction, down, pressed });
function fixture(gap = 100, mirrored = false) {
  const m = new Match();
  m.phase = "fight";
  m.fighters[0].x = mirrored ? 700 : 500;
  m.fighters[1].x = m.fighters[0].x + (mirrored ? -gap : gap);
  m.fighters[0].facing = mirrored ? -1 : 1;
  m.fighters[1].facing = mirrored ? 1 : -1;
  return m;
}
function advance(m: Match, n: number, a = neutral(), b = neutral()) {
  for (let i = 0; i < n; i++) m.step([a, b]);
}
function motion(
  m: Match,
  pattern: number[],
  button: Button = "light",
  index = 0,
) {
  const facing = m.fighters[index].facing;
  pattern.forEach((d, i) => {
    const frame = input(
      (d === 3 || d === 6 ? facing : d === 1 || d === 4 ? -facing : 0) as
        -1 | 0 | 1,
      [1, 2, 3].includes(d),
      i === pattern.length - 1 ? [button] : [],
    );
    m.step(index === 0 ? [frame, neutral()] : [neutral(), frame]);
  });
}
function until(m: Match, predicate: () => boolean, limit = 250) {
  for (let i = 0; i < limit && !predicate(); i++) advance(m, 1);
  expect(predicate(), "simulation reached its expected condition").toBe(true);
}

describe("directional commands", () => {
  for (const mirrored of [false, true])
    for (const strength of ["light", "medium", "heavy"] as const) {
      for (const [pattern, move] of [
        [[2, 3, 6], "draw"],
        [[6, 2, 3], "crescent"],
      ] as const) {
        it(`${move} ${strength} recognizes ${mirrored ? "left" : "right"} facing`, () => {
          const m = fixture(400, mirrored);
          motion(m, [...pattern], strength);
          expect(m.fighters[0].moveId).toBe(`${move}_${strength}`);
        });
      }
      it(`counter ${strength} recognizes ${mirrored ? "left" : "right"} facing`, () => {
        const m = fixture(400, mirrored);
        motion(m, [2, 1, 4], strength);
        expect(m.fighters[0].state).toBe("counter");
      });
    }
  it("ignores stale, incomplete and reversed commands, and consumes each motion", () => {
    const buffer = new CommandBuffer();
    buffer.push(input(0, true), 0, 1);
    buffer.push(input(1, true), 3, 1);
    buffer.push(input(1), 6, 1);
    expect(buffer.special()).toBe("draw");
    buffer.consumeMotion();
    expect(buffer.special()).toBeUndefined();
    buffer.push(input(0, true), 7, 1);
    buffer.push(input(1), 8, 1);
    expect(buffer.special()).toBeUndefined();
    buffer.push(input(0, true), 10, 1);
    buffer.push(input(1, true), 12, 1);
    buffer.push(input(1), 14, 1);
    buffer.push(neutral(), 22, 1);
    expect(buffer.special()).toBeUndefined();
  });
  it("prioritizes dragon punch with optional final forward over a quarter circle", () => {
    const m = fixture(400);
    motion(m, [6, 2, 3, 6]);
    expect(m.fighters[0].moveId).toBe("crescent_light");
  });
  it("buffers a special cancel during hitstop, but cannot cancel on whiff", () => {
    const hit = fixture();
    hit.step([input(0, false, ["light"]), neutral()]);
    until(hit, () => hit.hitstop > 0);
    motion(hit, [2, 3, 6], "heavy");
    until(hit, () => hit.fighters[0].moveId === "draw_heavy", 20);
    const miss = fixture(400);
    miss.step([input(0, false, ["light"]), neutral()]);
    motion(miss, [2, 3, 6], "heavy");
    expect(miss.fighters[0].moveId).toBe("stand_light");
  });
});

describe("Saque Relâmpago and Corte Crescente", () => {
  for (const mirrored of [false, true])
    for (const strength of ["light", "medium", "heavy"] as const) {
      it(`draw ${strength} hits once and recovers, facing ${mirrored ? -1 : 1}`, () => {
        const m = fixture(160, mirrored);
        motion(m, [2, 3, 6], strength);
        advance(m, 140);
        expect(m.fighters[1].health).toBe(
          1000 - character.moves[`draw_${strength}`].damage,
        );
        expect(m.fighters[0].state).toBe("idle");
        expect(m.fighters[0].meter).toBe(10);
      });
      it(`crescent ${strength} intercepts an aerial target, facing ${mirrored ? -1 : 1}`, () => {
        const m = fixture(65, mirrored);
        m.fighters[1].y = FLOOR - 95;
        m.fighters[1].vy = -2;
        motion(m, [6, 2, 3], strength);
        advance(m, 160);
        expect(m.fighters[1].health).toBe(
          1000 - character.moves[`crescent_${strength}`].damage,
        );
        expect(m.fighters[0].state).toBe("idle");
        expect(m.fighters[0].y).toBe(FLOOR);
      });
    }
  it("draw strengths trade startup and recovery for damage and travel", () => {
    const travel: number[] = [];
    for (const strength of ["light", "medium", "heavy"]) {
      const m = fixture(600);
      m.fighters[0].attack(`draw_${strength}`);
      advance(m, 90);
      travel.push(m.fighters[0].x - 500);
    }
    expect(travel[0]).toBeLessThan(travel[1]);
    expect(travel[1]).toBeLessThan(travel[2]);
    expect(character.moves.draw_light.startup).toBeLessThan(
      character.moves.draw_heavy.startup,
    );
    expect(character.moves.draw_light.recovery).toBeLessThan(
      character.moves.draw_heavy.recovery,
    );
  });
  it("dragon punch has bounded invulnerability and punishable recovery", () => {
    const m = fixture();
    const f = m.fighters[0];
    f.attack("crescent_heavy");
    expect(f.invulnerable).toBe(true);
    f.stateFrame = 13;
    expect(f.invulnerable).toBe(false);
    f.y = FLOOR;
    f.vy = 0;
    f.stateFrame = 25;
    m.fighters[1].attack("stand_light");
    advance(m, 12);
    expect(f.health).toBeLessThan(1000);
    const weak = fixture().fighters[0];
    weak.attack("crescent_light");
    expect(weak.invulnerable).toBe(false);
    expect(weak.hurtboxes()).toHaveLength(2);
  });
});

describe("counter stance", () => {
  for (const mirrored of [false, true]) {
    it(`parries a frontal strike and retaliates, facing ${mirrored ? -1 : 1}`, () => {
      const m = fixture(65, mirrored);
      motion(m, [2, 1, 4]);
      advance(m, 7);
      m.step([neutral(), input(0, false, ["light"])]);
      advance(m, 110);
      expect(m.fighters[0].health).toBe(1000);
      expect(m.fighters[1].health).toBe(890);
      expect(m.fighters[0].state).toBe("idle");
    });
  }
  it("exposes entry and failure recovery and cannot retaliate without contact", () => {
    const m = fixture(300);
    motion(m, [2, 1, 4]);
    const f = m.fighters[0];
    expect(reactionFor(f)?.clip).toBe("counterEntry");
    advance(m, 7);
    expect(reactionFor(f)?.clip).toBe("counterWait");
    advance(m, 18);
    expect(reactionFor(f)?.clip).toBe("counterFail");
    advance(m, 30);
    expect(f.state).toBe("idle");
    expect(m.fighters[1].health).toBe(1000);
  });
  it("loses to a low strike and to a grab", () => {
    for (const grab of [false, true]) {
      const m = fixture(60);
      motion(m, [2, 1, 4]);
      advance(m, 7);
      m.step([neutral(), input(0, !grab, [grab ? "throw" : "light"])]);
      advance(m, 100);
      expect(m.fighters[0].health).toBe(grab ? 880 : 960);
      expect(m.fighters[1].health).toBe(1000);
    }
  });
});

describe("Mil Cortes", () => {
  it("consumes 100, confirms, freezes timer, locks actors, synchronizes ten hits and returns to combat", () => {
    const m = fixture(130);
    const [a, b] = m.fighters;
    a.meter = 100;
    m.step([input(0, false, ["ultimate"]), neutral()]);
    expect(a.meter).toBe(0);
    until(m, () => !!m.capture);
    expect(m.capture?.kind).toBe("ultimate");
    const timer = m.timer,
      position = [a.x, b.x];
    let damageEvents = 0,
      previous = b.health;
    for (let i = 0; i < 200 && m.capture; i++) {
      m.step([
        input(1, false, ["heavy", "jump", "ultimate"]),
        input(-1, true, ["light", "throw"]),
      ]);
      if (b.health !== previous) {
        damageEvents++;
        previous = b.health;
      }
      expect(m.timer).toBe(timer);
      expect([a.x, b.x]).toEqual(position);
    }
    expect(m.capture).toBeUndefined();
    expect(damageEvents).toBe(9);
    expect(b.combo).toBe(10);
    expect(b.health).toBe(701);
    expect(a.meter).toBe(0);
    expect(a.state).toBe("ultimateRecover");
    expect(b.knockedDown).toBe(true);
    advance(m, 150);
    expect(a.state).toBe("idle");
    expect(b.state).toBe("idle");
    expect(a.moveId).toBe("");
  });
  it("spends energy on whiff or block, never runs an unconfirmed cinematic", () => {
    for (const blocked of [false, true]) {
      const m = fixture(blocked ? 130 : 500);
      m.fighters[0].meter = 100;
      m.fighters[1].data = { ...character, speed: 0, locomotion: { ...character.locomotion!, backSpeed: 0 } };
      let captured = false;
      m.step([input(0, false, ["ultimate"]), blocked ? input(1) : neutral()]);
      for (let i = 0; i < 130; i++) {
        m.step([neutral(), blocked ? input(1) : neutral()]);
        captured ||= !!m.capture;
      }
      expect(captured).toBe(false);
      expect(m.fighters[1].health).toBe(1000);
      expect(m.fighters[0].meter).toBe(0);
      expect(m.fighters[0].state).toBe("idle");
    }
  });
  it("finishes a lethal cinematic before awarding the round and holds its final victory pose", () => {
    const m = fixture(130);
    m.fighters[0].meter = 100;
    m.fighters[1].health = 30;
    m.step([input(0, false, ["ultimate"]), neutral()]);
    until(m, () => !!m.capture);
    expect(m.fighters[1].health).toBe(1);
    expect(m.phase).toBe("fight");
    until(m, () => m.phase === "roundEnd");
    expect(m.wins).toEqual([1, 0]);
    expect(m.fighters[0].state).toBe("victory");
    expect(m.fighters[1].state).toBe("ko");
    advance(m, 70);
    expect(m.fighters[1].state).toBe("defeat");
    const director = new FighterPresentation();
    director.tick(m.fighters[0]);
    expect(director.animator.clipName).toBe("victory");
    expect(director.animator.frame()).toBe(11);
  });
});

describe("grabs and lifecycle", () => {
  it("separates pushboxes completely at either wall without crossing actors", () => {
    for (const mirrored of [false, true]) {
      const m = fixture();
      const [a, b] = m.fighters;
      a.x = mirrored ? 1240 : 40;
      b.x = mirrored ? 1230 : 50;
      advance(m, 1);
      expect(Math.abs(a.x - b.x)).toBe(52);
      expect(a.x).toBe(mirrored ? 1240 : 40);
    }
  });
  it("runs mirrored corner captures to completion and stays inside the arena", () => {
    for (const mirrored of [false, true])
      for (const ultimate of [false, true]) {
        const m = fixture(65, mirrored);
        const [a, b] = m.fighters;
        a.x = mirrored ? 105 : 1175;
        b.x = mirrored ? 40 : 1240;
        a.meter = 100;
        m.step([input(0, false, [ultimate ? "ultimate" : "throw"]), neutral()]);
        until(m, () => !!m.capture);
        for (let i = 0; i < 230; i++) {
          advance(m, 1);
          for (const f of m.fighters) {
            expect(f.x).toBeGreaterThanOrEqual(40);
            expect(f.x).toBeLessThanOrEqual(1240);
            expect(Number.isFinite(f.y)).toBe(true);
          }
        }
        expect(m.capture).toBeUndefined();
        expect(m.fighters.every((f) => f.state === "idle")).toBe(true);
      }
  });
  it("grabs with delayed damage, releases to knockdown/getup, and does not grab airborne opponents", () => {
    const m = fixture(65);
    m.step([input(0, false, ["throw"]), neutral()]);
    until(m, () => !!m.capture);
    expect(m.fighters[1].health).toBe(1000);
    expect(m.fighters[0].state).toBe("grabbing");
    expect(m.fighters[1].state).toBe("grabbed");
    until(m, () => !m.capture);
    expect(m.fighters[1].health).toBe(880);
    expect(m.fighters[0].state).toBe("throwRecover");
    let getup = false;
    for (let i = 0; i < 150; i++) {
      advance(m, 1);
      getup ||= m.fighters[1].state === "getup";
    }
    expect(getup).toBe(true);
    expect(m.fighters.every((f) => f.state === "idle")).toBe(true);
    const air = fixture(65);
    air.fighters[1].y = FLOOR - 60;
    air.fighters[0].attack("throw");
    advance(air, 10);
    expect(air.capture).toBeUndefined();
  });
  it("strike wins a simultaneous throw contact", () => {
    const m = fixture(65);
    m.fighters[0].attack("throw");
    m.fighters[1].attack("stand_light");
    advance(m, 12);
    expect(m.capture).toBeUndefined();
    expect(m.fighters[0].health).toBe(955);
    expect(m.fighters[1].health).toBe(1000);
  });
  it("entrance walks in and draws before input becomes available", () => {
    const m = new Match();
    advance(m, 1, input(1, false, ["heavy"]));
    expect(m.fighters[0].state).toBe("entrance");
    expect(m.fighters[0].x).toBe(354);
    advance(m, 99, input(1, false, ["heavy"]));
    expect(m.phase).toBe("fight");
    expect(m.fighters[0].x).toBe(400);
    advance(m, 1);
    expect(m.fighters[0].state).toBe("idle");
  });
  it("taunt returns to idle and can be interrupted by damage", () => {
    const m = fixture();
    m.step([input(0, false, ["taunt"]), neutral()]);
    expect(m.fighters[0].state).toBe("taunt");
    advance(m, 48);
    expect(m.fighters[0].state).toBe("idle");
    m.step([input(0, false, ["taunt"]), input(0, false, ["light"])]);
    advance(m, 8);
    expect(m.fighters[0].state).toBe("hitstun");
  });
  it("all authored action and reaction poses are reachable and have matching visual/physical timing", () => {
    const m = fixture();
    const f = m.fighters[0],
      director = new FighterPresentation();
    for (const [name, clip] of Object.entries(complete.clips)) {
      expect(metadata.clips).toHaveProperty(name);
      expect(clip.hurtboxes).toHaveLength(clip.count);
      const reaction = character.reactions![name];
      expect(reaction.poses.map((p) => p.ticks)).toEqual(clip.durations);
      for (let frame = 0; frame < clip.count; frame++) {
        f.setState("grabbed");
        f.actionClip = name;
        f.stateFrame = clip.durations
          .slice(0, frame)
          .reduce((a, b) => a + b, 0);
        director.tick(f);
        expect(director.animator.clipName).toBe(name);
        expect(director.animator.frame()).toBe(frame);
        expect(f.hurtboxes()).toHaveLength(clip.hurtboxes[frame].length);
      }
    }
  });
});
