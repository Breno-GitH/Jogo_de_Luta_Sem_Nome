import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { roadConfig, roadScene } from "../src/engine/road-roller";
import { snapshot, restore, hashState } from "../src/engine/state";
import { CommandBuffer } from "../src/engine/input";
import { effectCue } from "../src/audio/sound";
import { poseAt } from "../src/engine/moves";
import { worldRect, shapeBounds } from "../src/engine/geometry";
import { overlaps, type Move } from "../src/engine/types";
const step = (m: Match, a = neutral(), b = neutral()) => m.step([a, b]);
function fixture(
  enemy: "samurai" | "dio" = "samurai",
  mirror = false,
  gap = 85,
) {
  const m = new Match(characters.dio, {}, characters[enemy]);
  m.phase = "fight";
  m.message = "";
  const [a, b] = m.fighters;
  a.x = mirror ? 780 : 500;
  b.x = a.x + (mirror ? -gap : gap);
  a.facing = mirror ? -1 : 1;
  b.facing = -a.facing;
  a.meter = 200;
  for (const f of m.fighters)
    if (f.stand) {
      f.stand.s.x = f.x - 30 * f.facing;
      f.stand.s.y = f.y - 18;
      f.stand.s.facing = f.facing;
    }
  return m;
}
function until(m: Match, test: () => boolean, max = 800) {
  for (let i = 0; i < max && !test(); i++) step(m);
  expect(test()).toBe(true);
}
function direction(value: number, facing: number, press = false): InputFrame {
  return {
    direction: ([3, 6].includes(value) ? facing : 0) as -1 | 0 | 1,
    down: [2, 3].includes(value),
    pressed: press ? ["heavy"] : [],
  };
}
function command(m: Match) {
  step(m, { ...neutral(), pressed: ["ultimate"] });
}

describe("Road Roller confirmed cinematic Super", () => {
  it("also works when Dio is player two, without using player-one sprite or state ownership", () => {
    const m = new Match(characters.samurai, {}, characters.dio);
    m.phase = "fight";
    m.fighters[0].x = 500;
    m.fighters[1].x = 585;
    m.fighters[1].meter = 200;
    expect(m.fighters[1].attack("road_roller")).toBe(true);
    until(m, () => !!m.roadRoller);
    expect(m.roadRoller!.attacker).toBe(1);
    expect(m.roadRoller!.facing).toBe(-1);
    until(m, () => !m.roadRoller);
    expect(m.fighters[0].health).toBe(650);
    expect(m.fighters[1].y).toBe(FLOOR);
    expect(m.fighters[1].stand!.ready).toBe(true);
  });
  it("never starts a posthumous capture after losing an actual simultaneous lethal trade", () => {
    const m = new Match(characters.samurai, {}, characters.dio);
    m.phase = "fight";
    const [a, b] = m.fighters;
    a.x = 500;
    b.x = 585;
    b.health = 1;
    b.meter = 200;
    b.attack("road_roller");
    const startup = a.data.moves.stand_light.startup;
    until(m, () => b.stateFrame === 26 - startup);
    a.attack("stand_light");
    for (let i = 0; i < startup + 2; i++) step(m);
    expect(b.health).toBe(0);
    expect(m.roadRoller).toBeUndefined();
    expect(m.phase).toBe("roundEnd");
  });
  it("routes distinct impact, punch and explosion audio cues without borrowing Samurai visual effects", () => {
    for (const [kind, cue] of [
      ["roadImpact", "heavy"],
      ["roadPunch", "hit"],
      ["roadExplosion", "heavy"],
    ] as const)
      expect(
        effectCue({
          kind,
          audioOnly: true,
          blocked: false,
          x: 0,
          y: 0,
          life: 8,
        }),
      ).toBe(cue);
    const m = fixture();
    m.fighters[0].attack("road_roller");
    until(m, () => !!m.roadRoller && m.roadRoller.tick === 108);
    expect(m.events.some((e) => e.kind === "roadImpact" && e.audioOnly)).toBe(
      true,
    );
  });
  it("synchronizes every cinematic punch and the final heavy fist to the actual roller drum", () => {
    const m = fixture();
    m.fighters[0].attack("road_roller");
    until(m, () => !!m.roadRoller);
    for (const tick of [...roadConfig.punchTicks, roadConfig.finalPunchTick]) {
      const s = roadScene({ ...m.roadRoller!, tick }),
        action = characters.dio.companion!.actions[s.stand.clip];
      const pose = poseAt(action as unknown as Move, s.stand.tick);
      expect(pose?.hitboxes?.length, tick.toString()).toBe(1);
      const fist = worldRect(
        shapeBounds(pose!.hitboxes![0]),
        s.stand.x,
        s.stand.y,
        m.roadRoller!.facing,
      );
      const drum = worldRect(
        { x: 60, y: -60, w: 90, h: 60 },
        s.object.x,
        s.object.y,
        m.roadRoller!.facing,
      );
      expect(overlaps(fist, drum), `punch ${tick}`).toBe(true);
    }
  });
  it("brings an airborne confirmed victim down continuously instead of snapping to the floor", () => {
    const m = fixture(),
      [a, b] = m.fighters;
    a.attack("road_roller");
    until(m, () => a.stateFrame === 24);
    b.y = FLOOR - 24;
    b.vy = 0;
    b.setState("air");
    until(m, () => !!m.roadRoller);
    expect(m.roadRoller!.targetY).toBeLessThan(FLOOR);
    expect(b.y).toBe(m.roadRoller!.targetY);
    until(m, () => m.roadRoller!.tick === 22);
    expect(b.y).toBe(FLOOR);
  });
  for (const enemy of ["samurai", "dio"] as const)
    for (const mirror of [false, true])
      it(`confirms ${enemy}, facing ${mirror ? "left" : "right"}, stages all actors and deals exactly 350`, () => {
        const m = fixture(enemy, mirror),
          [a, b] = m.fighters;
        command(m);
        expect(a.moveId).toBe("road_roller");
        expect(a.meter).toBe(0);
        until(m, () => !!m.roadRoller);
        let hits = 1,
          damage = 35,
          phases = new Set<string>(),
          leftScreen = false,
          maximumHeight = 0;
        const timer = m.timer;
        while (m.roadRoller) {
          const scene = roadScene(m.roadRoller);
          phases.add(scene.phase);
          maximumHeight = Math.min(maximumHeight, a.y);
          if (scene.phase === "offscreen") {
            expect(a.y).toBeLessThan(-200);
            expect(a.stand!.transform.y).toBeLessThan(-200);
            leftScreen = true;
          }
          if (scene.object.visible) {
            expect(
              scene.object.x - roadConfig.objectHalfWidth,
            ).toBeGreaterThanOrEqual(0);
            expect(
              scene.object.x + roadConfig.objectHalfWidth,
            ).toBeLessThanOrEqual(1280);
            expect(scene.object.y).toBeLessThanOrEqual(FLOOR);
          }
          step(
            m,
            { ...neutral(), pressed: ["heavy", "jump"] },
            { ...neutral(), pressed: ["heavy", "jump"] },
          );
          for (const h of m.hits) {
            hits++;
            damage += h.damage;
          }
          expect(m.timer).toBe(timer);
        }
        expect(leftScreen).toBe(true);
        expect(phases.size).toBe(Object.keys(roadConfig.phases).length);
        expect(hits).toBe(15);
        expect(damage).toBe(350);
        expect(b.health).toBe(650);
        expect(a.meter).toBe(0);
        expect(a.y).toBe(FLOOR);
        expect(a.x).toBeGreaterThanOrEqual(40);
        expect(a.x).toBeLessThanOrEqual(1240);
        expect(a.stand!.s.mode).toBe("follow");
        expect(a.stand!.s.depth).toBe(0);
        expect(a.attackShapes()).toEqual([]);
        for (let i = 0; i < 140; i++) step(m);
        expect(a.state).toBe("idle");
        expect(b.state).toBe("idle");
        expect(m.capture).toBeUndefined();
      });
  for (const meter of [0, 100, 199])
    it(`rejects ${meter} energy without knife fallback or consumption`, () => {
      const m = fixture();
      m.fighters[0].meter = meter;
      command(m);
      expect(m.fighters[0].moveId).toBe("");
      expect(m.fighters[0].meter).toBe(meter);
      for (let i = 0; i < 90; i++) step(m);
      expect(m.roadRoller).toBeUndefined();
      expect(m.projectiles).toEqual([]);
    });
  it("preserves Samurai capacity and grants two honest bars to Dio and training", () => {
    const m = fixture("samurai");
    expect(m.fighters[0].meterMaximum).toBe(200);
    expect(m.fighters[1].meterMaximum).toBe(100);
  });
  it("spends two bars on block and whiff but never starts the machine", () => {
    for (const blocked of [false, true]) {
      const m = fixture("samurai", false, blocked ? 85 : 450),
        [a, b] = m.fighters;
      b.data = { ...b.data, speed: 0, locomotion: { ...b.data.locomotion!, backSpeed: 0 } };
      const guard = { ...neutral(), direction: -b.facing as -1 | 1 };
      expect(a.attack("road_roller")).toBe(true);
      let blocks = 0;
      for (let i = 0; i < 180; i++) {
        step(m, neutral(), blocked ? guard : neutral());
        blocks += m.hits.filter((h) => h.blocked).length;
        expect(m.roadRoller).toBeUndefined();
      }
      expect(a.meter).toBe(0);
      expect(b.health).toBe(1000);
      expect(blocks).toBe(blocked ? 1 : 0);
      expect(a.stand!.ready).toBe(true);
    }
  });
  it("has vulnerable startup; a real early Samurai hit cancels it without refund", () => {
    const m = fixture("samurai", false, 60),
      [a, b] = m.fighters;
    a.attack("road_roller");
    b.attack("stand_light");
    for (let i = 0; i < 130; i++) step(m);
    expect(a.health).toBeLessThan(1000);
    expect(a.meter).toBeLessThan(200);
    expect(m.roadRoller).toBeUndefined();
    expect(a.stand!.ready).toBe(true);
  });
  it("confirms after a heavy in a real combo, with scaled damage and no return between strikes", () => {
    const m = fixture(),
      a = m.fighters[0];
    a.attack("stand_heavy");
    until(m, () => a.connected);
    command(m);
    expect(a.moveId).toBe("stand_heavy");
    until(m, () => !!m.roadRoller);
    expect(a.meter).toBe(0);
    expect(m.fighters[1].combo).toBe(2);
    until(m, () => !m.roadRoller);
    expect(m.fighters[1].health).toBeGreaterThan(534);
    expect(m.fighters[1].health).toBeLessThan(650);
  });
  for (const edge of [40, 1240])
    it(`contains the complete machine at arena edge ${edge}`, () => {
      const m = fixture(),
        [a, b] = m.fighters;
      b.x = edge;
      a.x = edge === 40 ? 125 : 1155;
      a.facing = edge === 40 ? -1 : 1;
      b.facing = -a.facing;
      a.stand!.s.x = a.x - 30 * a.facing;
      a.stand!.s.facing = a.facing;
      a.attack("road_roller");
      until(m, () => !!m.roadRoller);
      while (m.roadRoller) {
        const s = roadScene(m.roadRoller);
        expect(s.object.x - 164).toBeGreaterThanOrEqual(0);
        expect(s.object.x + 164).toBeLessThanOrEqual(1280);
        expect(Math.abs(s.object.x - b.x)).toBeLessThan(165);
        step(m);
      }
      expect(a.y).toBe(FLOOR);
      expect(a.stand!.transform.x).toBeGreaterThan(0);
      expect(a.stand!.transform.x).toBeLessThan(1280);
    });
  it("defers K.O. and round end until the complete sequence finishes, then allows a fresh rematch", () => {
    const m = fixture(),
      [a, b] = m.fighters;
    b.health = 100;
    a.attack("road_roller");
    until(m, () => !!m.roadRoller);
    until(m, () => b.health === 0);
    expect(m.roadRoller).toBeDefined();
    expect(m.phase).toBe("fight");
    until(m, () => !m.roadRoller);
    expect(m.phase).toBe("roundEnd");
    expect(m.wins[0]).toBe(1);
    expect(a.y).toBe(FLOOR);
    const next = fixture();
    expect(next.fighters[0].attack("road_roller")).toBe(true);
    until(next, () => !!next.roadRoller);
    until(next, () => !next.roadRoller);
    expect(next.fighters[1].health).toBe(650);
  });
  it("leaves time-stop history and cooldown untouched throughout capture", () => {
    const m = fixture();
    m.temporal.s.ledger[0] = { uses: 3, cooldown: 1900 };
    m.temporal.s.ledger[1] = { uses: 2, cooldown: 1700 };
    m.fighters[0].attack("road_roller");
    until(m, () => !!m.roadRoller);
    const ledger = structuredClone(m.temporal.s.ledger);
    until(m, () => !m.roadRoller);
    expect(m.temporal.s.ledger).toEqual(ledger);
  });
  it("suspends an active time stop independently, then resumes its remaining duration", () => {
    const m = fixture();
    m.temporal.activate(0);
    m.temporal.s.remaining = 90;
    m.fighters[0].attack("road_roller");
    until(m, () => !!m.roadRoller);
    const temporal = structuredClone(m.temporal.s);
    until(m, () => !m.roadRoller);
    expect(m.temporal.s).toEqual(temporal);
    step(m);
    expect(m.temporal.s.remaining).toBe(temporal.remaining - 1);
    expect(m.temporal.s.ledger[0].uses).toBe(1);
  });
  it("restores every synchronized actor, object, camera and punch tick deterministically", () => {
    const m = fixture("dio");
    m.fighters[0].attack("road_roller");
    until(m, () => !!m.roadRoller && m.roadRoller.tick === 145);
    const copy = restore(JSON.parse(JSON.stringify(snapshot(m))));
    for (let i = 0; i < 240; i++) {
      step(m);
      step(copy);
      expect(hashState(snapshot(m))).toBe(hashState(snapshot(copy)));
      if (m.roadRoller)
        expect(roadScene(m.roadRoller)).toEqual(roadScene(copy.roadRoller!));
    }
  });
  it("uses R on both sides, consumes its edge once, and no longer recognizes the old double quarter-circle as a Super", () => {
    for (const mirror of [false, true]) {
      const m = fixture("samurai", mirror);
      command(m);
      expect(m.fighters[0].moveId).toBe("road_roller");
      expect(
        m.fighters[0].buffer.actions.some((a) => a.button === "ultimate"),
      ).toBe(false);
    }
    const b = new CommandBuffer();
    b.push({ ...neutral(), pressed: ["ultimate"] }, 0, 1);
    expect(b.consume("ultimate")).toBe(true);
    expect(b.consume("ultimate")).toBe(false);
    for (const diagonal of [false, true]) {
      const m = fixture();
      const pattern = diagonal ? [2, 3, 6, 2, 3, 6] : [2, 6, 2, 6];
      pattern.forEach((v, i) =>
        step(m, direction(v, 1, i === pattern.length - 1)),
      );
      expect(m.fighters[0].moveId).not.toBe("road_roller");
      expect(m.fighters[0].meter).toBe(200);
    }
  });
});
