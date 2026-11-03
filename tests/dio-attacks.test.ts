import { describe, it, expect } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters, type CharacterId } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";

function fixture(gap = 65, mirror = false, enemy: CharacterId = "samurai") {
  const m = new Match(characters.dio, { training: true }, characters[enemy]);
  m.phase = "fight";
  m.message = "";
  const [a, b] = m.fighters;
  a.x = 600;
  b.x = 600 + gap * (mirror ? -1 : 1);
  a.facing = mirror ? -1 : 1;
  b.facing = -a.facing;
  for (const f of m.fighters)
    if (f.stand) {
      f.stand.s.x = f.x - 30 * f.facing;
      f.stand.s.y = f.y - 18;
      f.stand.s.facing = f.facing;
    }
  return m;
}
const step = (m: Match, a = neutral(), b = neutral()) => m.step([a, b]);
function until(m: Match, test: () => boolean, max = 240) {
  for (let i = 0; i < max && !test(); i++) step(m);
  expect(test()).toBe(true);
}
function command(m: Match, pressed: InputFrame["pressed"], down = false) {
  step(m, { ...neutral(), pressed, down });
}
const expectedDamage = (id: string) =>
  id === "air_medium" ? 67 : characters.dio.moves[id].damage;

describe("Dio commands; The World alone fights", () => {
  it('withdraws the Stand during a Samurai grab and recovers after the capture',()=>{
    const m=fixture(52),[a,b]=m.fighters;a.attack('stand_heavy');b.attack('throw');
    until(m,()=>!!m.capture);expect(a.attackShapes()).toEqual([]);
    for(let i=0;i<220;i++){step(m);expect(a.attackShapes()).toEqual([]);}
    expect(a.health).toBeLessThan(1000);expect(a.stand!.ready).toBe(true);
  });
  for (const enemy of ["samurai", "dio"] as const)
    for (const mirror of [false, true])
      for (const name of Object.keys(characters.dio.moves))
        it(`${name} versus ${enemy}, ${mirror ? "left" : "right"}: only Stand contacts, exact hit count, recovery`, () => {
          const m = fixture(60, mirror, enemy),
            [a, b] = m.fighters;
          if (name.startsWith("air_")) {
            a.y = b.y = 300;
            a.vy = b.vy = -5;
            b.setState("air");
            a.stand!.s.y = a.y - 18;
            if (b.stand) b.stand.s.y = b.y - 18;
          }
          expect(a.attack(name)).toBe(true);
          let hits = 0;
          for (let i = 0; i < 180; i++) {
            step(m);
            hits += m.hits.filter((h) => h.attacker === 0).length;
            if (a.state === "attack") {
              expect(
                a.move!.poses!.every((p) => !p.hitboxes?.length && !p.blade),
              ).toBe(true);
              if (a.attackShapes().length)
                expect(a.attackShapes()).toEqual(a.stand!.hitboxes(a));
            }
          }
          expect(hits).toBe(name === "air_medium" ? 2 : 1);
          expect(b.health).toBe(1000 - expectedDamage(name));
          expect(a.state).toBe("idle");
          expect(a.stand!.s.mode).toBe("follow");
          expect(a.attackShapes()).toEqual([]);
          expect(
            Math.abs(a.stand!.transform.x - (a.x - 30 * a.facing)),
          ).toBeLessThanOrEqual(1);
        });
  for (const enemy of ["dio", "samurai"] as const)
    for (const mirror of [false, true])
      for (const route of ["stand", "crouch", "air", "launcher"] as const)
        it(`${route} chain versus ${enemy} ${mirror ? "left" : "right"} stays offensive and returns once`, () => {
          const m = fixture(route === "launcher" ? 75 : 65, mirror, enemy),
            [a, b] = m.fighters;
          let hits = 0,
            returns = 0,
            started = false,
            bridges = 0;
          if (route === "air") {
            a.y = b.y = 300;
            a.vy = b.vy = -5;
            b.setState("air");
            a.stand!.s.y = a.y - 18;
          }
          const actions =
            route === "launcher"
              ? ["crouch_heavy", "jump", "air_light", "air_medium", "air_heavy"]
              : ["light", "medium", "heavy"].map((k) => `${route}_${k}`);
          let stage = 0,
            lastMode = "",
            lastX = a.stand!.transform.x,
            maxStep = 0;
          for (let tick = 0; tick < 260; tick++) {
            const input = neutral(),
              next = actions[stage];
            if (
              !m.hitstop &&
              next &&
              (stage === 0 ||
                (next === "jump"
                  ? a.canCancel("jump")
                  : a.stand!.s.mode === "link" ||
                    a.canCancel(next.split("_").at(-1)!)))
            ) {
              // Do not skip the independently timed second punch.
              if (a.moveId !== "air_medium" || a.hitIds.includes(1)) {
                input.pressed = [
                  next === "jump"
                    ? "jump"
                    : (next.split("_").at(-1) as "light" | "medium" | "heavy"),
                ];
                input.down = next.startsWith("crouch");
                stage++;
              }
            }
            step(m, input);
            const s = a.stand!.s;
            hits += m.hits.filter((h) => h.attacker === 0).length;
            if (s.mode === "attack") started = true;
            if (started && s.mode === "return" && lastMode !== "return")
              returns++;
            if (s.bridgeClip && s.clip === s.bridgeClip) bridges++;
            maxStep = Math.max(maxStep, Math.abs(s.x - lastX));
            lastX = s.x;
            lastMode = s.mode;
          }
          expect(stage).toBe(actions.length);
          expect(hits).toBe(route === "launcher" ? 5 : route === "air" ? 4 : 3);
          expect(returns).toBe(1);
          expect(bridges).toBeGreaterThan(0);
          expect(maxStep).toBeLessThan(24);
          expect(a.stand!.ready).toBe(true);
          expect(b.health).toBeLessThan(850);
        });
  it("Air Medium has two separate impact windows and cannot rehit each window", () => {
    const m = fixture(),
      [a, b] = m.fighters;
    a.y = b.y = 300;
    a.vy = b.vy = -5;
    b.setState("air");
    a.stand!.s.y = a.y - 18;
    a.attack("air_medium");
    const events: { tick: number; damage: number }[] = [];
    for (let i = 0; i < 100; i++) {
      step(m);
      for (const h of m.hits)
        events.push({ tick: a.stateFrame, damage: h.damage });
    }
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.damage)).toEqual([32, 35]);
    expect(events[1].tick - events[0].tick).toBeGreaterThanOrEqual(4);
  });
  it("restores a checkpoint between the two aerial impacts without repeating the first", () => {
    const m = fixture(),
      [a, b] = m.fighters;
    a.y = b.y = 300;
    a.vy = b.vy = -5;
    b.setState("air");
    a.stand!.s.y = a.y - 18;
    a.attack("air_medium");
    until(m, () => a.hitIds.includes(0));
    const restored = restore(JSON.parse(JSON.stringify(snapshot(m))));
    let extra = 0;
    for (let i = 0; i < 110; i++) {
      step(m);
      step(restored);
      extra += restored.hits.length;
      expect(hashState(snapshot(restored))).toBe(hashState(snapshot(m)));
    }
    expect(extra).toBe(1);
    expect(b.health).toBe(933);
  });
  it("even accidental owner attack boxes cannot replace the real Stand fist", () => {
    const m = fixture(),
      a = m.fighters[0];
    a.data = structuredClone(a.data);
    a.attack("stand_light");
    for (const p of a.move!.poses!)
      p.hitboxes = [{ x: -500, y: -500, w: 1000, h: 1000 }];
    until(m, () => a.attackPhase === "active");
    expect(a.attackShapes()).toEqual(a.stand!.hitboxes(a));
    const before = a.attackShapes()[0] as { x: number };
    a.stand!.s.x += 100;
    expect((a.attackShapes()[0] as { x: number }).x - before.x).toBe(100);
  });
  it("cannot cancel on whiff, repeat a light or cancel outside its configured window", () => {
    const m = fixture(350),
      a = m.fighters[0];
    command(m, ["light"]);
    for (let i = 0; i < 8; i++) step(m);
    expect(a.connected).toBe(false);
    command(m, ["medium"]);
    expect(a.moveId).toBe("stand_light");
    expect(a.attack("stand_medium")).toBe(false);
    expect(a.attack("stand_light")).toBe(false);
  });
  it("launcher on whiff or guard does not launch; real connection does", () => {
    for (const guard of [false, true]) {
      const m = fixture(guard ? 65 : 350),
        [a, b] = m.fighters;
      command(m, ["heavy"], true);
      for (let i = 0; i < 70; i++)
        step(
          m,
          neutral(),
          guard ? { ...neutral(), direction: -b.facing as -1 | 1 } : neutral(),
        );
      expect(b.y).toBe(FLOOR);
      expect(b.health).toBe(1000);
      expect(a.attackShapes()).toEqual([]);
    }
  });
  it("damage cancels future hitboxes, plays recoil and returns even across a facing change", () => {
    const m = fixture(65),
      [a, b] = m.fighters;
    a.attack("stand_heavy");
    b.attack("stand_light");
    for (let i = 0; i < 8; i++) step(m);
    expect(a.state).toBe("hitstun");
    expect(a.stand!.hitboxes(a)).toEqual([]);
    expect(["recoil", "return", "reaction"]).toContain(a.stand!.s.mode);
    b.x = 300;
    for (let i = 0; i < 100; i++) {
      step(m);
      expect(a.attackShapes()).toEqual([]);
    }
    expect(a.stand!.s.mode).toBe("follow");
    expect(a.stand!.transform.facing).toBe(-1);
    expect(a.stand!.transform.x).toBe(Math.round(a.x + 30));
  });
  it("enforces juggle limits and restores all hit/window/Stand state deterministically", () => {
    const m = fixture();
    command(m, ["heavy"]);
    for (let i = 0; i < 19; i++) step(m);
    const copy = restore(JSON.parse(JSON.stringify(snapshot(m))));
    for (let i = 0; i < 120; i++) {
      step(m);
      step(copy);
      expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
    }
    const n = fixture(),
      [a, b] = n.fighters;
    b.combo = characters.dio.combatLimits!.maxHits - 1;
    b.comboAge = 100;
    b.setState("hitstun");
    b.stun = 40;
    command(n, ["light"]);
    until(n, () => a.connected);
    expect(b.knockedDown).toBe(true);
    expect(b.vy).toBe(10);
    for (let i = 0; i < 100; i++) step(n);
    expect(b.state).toBe("idle");
  });
  it("landing interrupts an air attack with no permanent hitbox at either wall", () => {
    for (const x of [40, 1240]) {
      const m = fixture(160),
        a = m.fighters[0];
      a.x = x;
      a.y = FLOOR - 10;
      a.vy = 4;
      a.stand!.s.x = x - 30 * a.facing;
      a.stand!.s.y = a.y - 18;
      a.attack("air_heavy");
      for (let i = 0; i < 90; i++) step(m);
      expect(a.y).toBe(FLOOR);
      expect(a.stand!.ready).toBe(true);
      expect(a.attackShapes()).toEqual([]);
    }
  });
});
