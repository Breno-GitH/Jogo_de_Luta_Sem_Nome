import { combatPace } from "../src/engine/pace";
import { describe, it, expect } from "vitest";
import { Match, FLOOR, character } from "../src/engine/combat";
import { neutral, type InputFrame } from "../src/engine/types";
import { poseAt, poseIndexAt, phaseAt } from "../src/engine/moves";
import { FighterPresentation } from "../src/render/presentation";
import {
  shapeBounds,
  shapeHitsRect,
  worldCapsule,
} from "../src/engine/geometry";

const normals = Object.keys(character.moves).filter((name) =>
  /^(stand|crouch|air)_(light|medium|heavy)$/.test(name),
);
const input = (
  pressed: InputFrame["pressed"] = [],
  down = false,
): InputFrame => ({ ...neutral(), down, pressed });
function fixture(name?: string, facing = 1) {
  const m = new Match();
  m.phase = "fight";
  m.fighters[0].x = 500;
  m.fighters[1].x = 500 + 100 * facing;
  m.fighters[0].facing = facing;
  m.fighters[1].facing = -facing;
  if (name?.startsWith("air_"))
    for (const f of m.fighters) {
      f.y = FLOOR - 115;
      f.vy = -1;
      f.setState("air");
    }
  return m;
}

describe("nine playable normal attacks", () => {
  it("simultaneous contacts trade and keep the stronger hitstop", () => {
    const m = fixture();
    const [a, b] = m.fighters;
    a.attack("stand_heavy");
    b.attack("stand_light");
    a.stateFrame = a.move!.startup - 1;
    b.stateFrame = b.move!.startup - 1;
    m.step([neutral(), neutral()]);
    expect(a.health).toBe(955);
    expect(b.health).toBe(885);
    expect(m.hitstop).toBe(combatPace.normals.hitstop[2]);
  });
  it.each(normals)(
    "%s selects its posture, hits exactly once, freezes and recovers",
    (name) => {
      const m = fixture(name);
      const [a, b] = m.fighters;
      const move = a.data.moves[name];
      const button = name.split("_")[1] as "light" | "medium" | "heavy";
      m.step([input([button], name.startsWith("crouch_")), neutral()]);
      expect(a.moveId).toBe(name);
      for (let t = 0; t < move.startup - 1; t++) {
        expect(a.attackShapes()).toEqual([]);
        expect(b.health).toBe(1000);
        m.step([neutral(), neutral()]);
      }
      for (let t = 0; t < move.active + 3 && b.health === 1000; t++)
        m.step([neutral(), neutral()]);
      expect(b.health).toBe(1000 - move.damage);
      expect(m.hitstop).toBe(move.hitstop);
      expect(b.stun).toBe(move.stun + (name.startsWith("air_") && !move.knockdown ? combatPace.combo.airExtensionStun : 0));
      const tick = a.stateFrame,
        y = a.y;
      for (let i = 0; i < 3; i++) m.step([neutral(), neutral()]);
      expect(a.stateFrame).toBe(tick);
      expect(a.y).toBe(y);
      for (let i = 0; i < 150; i++) m.step([neutral(), neutral()]);
      expect(b.health).toBe(1000 - move.damage);
      expect(a.state).toBe("idle");
      expect(a.moveId).toBe("");
    },
  );
  it.each(normals)(
    "%s synchronizes every pose and collider at each simulation tick",
    (name) => {
      const m = fixture(name);
      const f = m.fighters[0];
      const move = f.data.moves[name];
      const visual = new FighterPresentation();
      f.attack(name);
      for (
        let tick = 0;
        tick < move.startup + move.active + move.recovery;
        tick++
      ) {
        f.stateFrame = tick;
        visual.tick(f);
        expect(visual.animator.clipName).toBe(name);
        expect(visual.animator.frame()).toBe(poseIndexAt(move, tick));
        expect(poseAt(move, tick)?.phase).toBe(phaseAt(move, tick));
        expect(f.hurtboxes().length).toBeGreaterThan(3);
        expect(f.attackShapes().length).toBe(
          phaseAt(move, tick) === "active" ? 1 : 0,
        );
      }
    },
  );
  it.each(normals)("%s hits when mirrored left and respects range", (name) => {
    const m = fixture(name, -1);
    m.fighters[0].attack(name);
    for (let i = 0; i < 45 && m.fighters[1].health === 1000; i++)
      m.step([neutral(), neutral()]);
    expect(m.fighters[1].health).toBeLessThan(1000);
    const far = fixture(name);
    far.fighters[1].x = 900;
    far.fighters[0].attack(name);
    for (let i = 0; i < 65; i++) far.step([neutral(), neutral()]);
    expect(far.fighters[1].health).toBe(1000);
  });
  it("chains Light → Medium → Heavy through inputs during hitstop", () => {
    const m = fixture();
    let max = 0;
    const pressed = new Set<string>();
    m.step([input(["light"]), neutral()]);
    for (let i = 0; i < 160; i++) {
      const f = m.fighters[0];
      let buttons: InputFrame["pressed"] = [];
      if (f.connected && f.moveId === "stand_light" && !pressed.has("medium")) {
        buttons = ["medium"];
        pressed.add("medium");
      }
      if (f.connected && f.moveId === "stand_medium" && !pressed.has("heavy")) {
        buttons = ["heavy"];
        pressed.add("heavy");
      }
      m.step([input(buttons), neutral()]);
      max = Math.max(max, m.fighters[1].combo);
    }
    expect(max).toBe(3);
    expect(m.fighters[1].health).toBe(1000 - ["stand_light","stand_medium","stand_heavy"].reduce((sum,id,i)=>sum+Math.round(character.moves[id].damage*(1-i*combatPace.combo.damageStep)),0));
    expect(m.fighters[0].state).toBe("idle");
  });
  it("launches, chases, chains all three air attacks and finishes in hard knockdown", () => {
    const m = fixture();
    const pressed = new Set<string>();
    let max = 0,
      knockdown = false,
      launched = false;
    const attacks = new Set<string>();
    m.step([input(["heavy"], true), neutral()]);
    for (let i = 0; i < 220; i++) {
      const f = m.fighters[0];
      let key = "";
      let buttons: InputFrame["pressed"] = [];
      if (f.connected && f.moveId === "crouch_heavy") {
        key = "jump";
        buttons = ["jump"];
        launched ||= m.fighters[1].vy < 0;
      }
      if (f.airborne && f.state === "air") {
        key = "light";
        buttons = ["light"];
      }
      if (f.connected && f.moveId === "air_light") {
        key = "medium";
        buttons = ["medium"];
      }
      if (f.connected && f.moveId === "air_medium") {
        key = "heavy";
        buttons = ["heavy"];
      }
      if (pressed.has(key)) buttons = [];
      else if (key) pressed.add(key);
      m.step([input(buttons), neutral()]);
      if (f.moveId) attacks.add(f.moveId);
      max = Math.max(max, m.fighters[1].combo);
      knockdown ||= m.fighters[1].knockedDown;
    }
    expect(launched).toBe(true);
    expect([...attacks]).toEqual(
      expect.arrayContaining([
        "crouch_heavy",
        "air_light",
        "air_medium",
        "air_heavy",
      ]),
    );
    expect(max).toBe(4);
    expect(knockdown).toBe(true);
    expect(m.fighters[1].health).toBe(1000 - ["crouch_heavy","air_light","air_medium","air_heavy"].reduce((sum,id,i)=>sum+Math.round(character.moves[id].damage*(1-i*combatPace.combo.damageStep)),0));
    expect(m.fighters[0].state).toBe("idle");
  });
  it("distinguishes ground heavy from launcher and disallows cancels on whiff", () => {
    expect(character.moves.stand_heavy.launch).toBe(0);
    expect(character.moves.crouch_heavy.launch).toBeLessThan(0);
    const m = fixture();
    m.fighters[1].x = 1000;
    m.step([input(["light"]), neutral()]);
    m.step([input(["heavy"]), neutral()]);
    expect(m.fighters[0].moveId).toBe("stand_light");
  });
  it("blocks mids in either guard and lows only with crouching guard", () => {
    for (const name of ["stand_light", "crouch_light"])
      for (const crouching of [false, true]) {
        const m = fixture();
        m.fighters[1].data = { ...character, speed: 0, locomotion: { ...character.locomotion!, backSpeed: 0 } };
        m.fighters[0].attack(name);
        for (let i = 0; i < 12; i++)
          m.step([neutral(), { ...input([], crouching), direction: 1 }]);
        expect(m.fighters[1].health).toBe(
          name === "crouch_light" && !crouching ? 960 : 1000,
        );
      }
  });
});

describe("blade collision geometry", () => {
  it("rejects empty corners of the broad bounding rectangle of a diagonal sword", () => {
    const capsule = { a: { x: 0, y: 0 }, b: { x: 100, y: 100 }, r: 3 };
    expect(shapeBounds(capsule).w).toBe(106);
    expect(shapeHitsRect(capsule, { x: 1, y: 90, w: 5, h: 5 })).toBe(false);
    expect(shapeHitsRect(capsule, { x: 48, y: 48, w: 5, h: 5 })).toBe(true);
  });
  it("mirrors the endpoints around the character origin without swapping Y", () => {
    const shape = { a: { x: 10, y: -80 }, b: { x: 90, y: -60 }, r: 3 };
    expect(worldCapsule(shape, 500, 580, -1)).toEqual({
      a: { x: 490, y: 500 },
      b: { x: 410, y: 520 },
      r: 3,
    });
  });
});
