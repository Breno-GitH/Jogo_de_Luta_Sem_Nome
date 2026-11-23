import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";

const playable = ["samurai", "dio", "goku", "luffy", "sasuke", "kaneki", "ben", "xebec", "asta"] as const;

function fight(id: typeof playable[number]) {
  const m = new Match(characters[id], { training: true }, characters.samurai);
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 1100;
  b.x = 1150;
  a.facing = 1;
  b.facing = -1;
  return m;
}

describe("global anti-spam at the corner", () => {
  it.each(playable)("%s eventually releases a defender against held J", id => {
    const m = fight(id);
    let firstHit = -1;
    let firstFreedom = -1;
    for (let tick = 0; tick < 540; tick++) {
      m.step([{ ...neutral(), pressed: ["light"] }, neutral()]);
      const b = m.fighters[1];
      if (firstHit < 0 && m.hits.some(hit => hit.attacker === 0 && !hit.blocked)) firstHit = tick;
      if (firstHit >= 0 && tick > firstHit && ["idle", "walk", "crouch", "air"].includes(b.state) && !b.knockedDown) {
        firstFreedom = tick - firstHit;
        break;
      }
    }
    expect(firstHit).toBeGreaterThanOrEqual(0);
    expect(firstFreedom).toBeGreaterThan(0);
    expect(firstFreedom).toBeLessThan(360);
    expect(hashState(snapshot(restore(snapshot(m))))).toBe(hashState(snapshot(m)));
  });

  it("repeated launchers end in a fall while a first launcher still lifts", () => {
    const m = fight("samurai");
    const [a, b] = m.fighters;
    a.x = 580;
    b.x = 650;
    const connect = () => {
      a.setState("idle");
      a.y = b.y = FLOOR;
      a.vx = a.vy = b.vx = b.vy = 0;
      b.knockedDown = false;
      b.setState("hitstun");
      b.stun = 90;
      const before = m.hitSerial;
      expect(a.attack("crouch_heavy")).toBe(true);
      for (let i = 0; i < 50 && m.hitSerial === before; i++) m.step([neutral(), neutral()]);
      expect(m.hitSerial).toBeGreaterThan(before);
    };
    connect();
    expect(b.vy).toBeLessThan(0);
    b.combo = 0;
    b.controlFrames = 0;
    connect();
    expect(b.vy).toBeGreaterThanOrEqual(0);
    expect(b.knockedDown).toBe(true);
  });

  it("repeated blocked J provides a short blockstun and spacing", () => {
    const m = fight("samurai");
    const [a, b] = m.fighters;
    for (let repeat = 0; repeat < 3; repeat++) {
      a.setState("idle");
      a.x = 1100;
      b.x = 1170;
      a.y = b.y = FLOOR;
      a.vx = a.vy = b.vx = b.vy = 0;
      b.setState("idle");
      const before = m.hitSerial;
      expect(a.attack("stand_light")).toBe(true);
      for (let i = 0; i < 40 && m.hitSerial === before; i++)
        m.step([neutral(), { ...neutral(), direction: 1 }]);
      expect(m.hitSerial).toBeGreaterThan(before);
    }
    expect(b.blockLightsInSequence).toBe(3);
    expect(b.stun).toBeLessThanOrEqual(7);
    expect(a.vx).toBeLessThan(0);
  });

  it("two players mashing J still get control back", () => {
    const m = fight("goku");
    const [a, b] = m.fighters;
    a.x = 600;
    b.x = 650;
    const first = [-1, -1], recovery = [-1, -1];
    for (let tick = 0; tick < 540; tick++) {
      const mash = { ...neutral(), pressed: ["light" as const] };
      m.step([mash, mash]);
      for (let i = 0; i < 2; i++) {
        const victim = m.fighters[i];
        if (first[i] < 0 && m.hits.some(hit => hit.victim === i && !hit.blocked)) first[i] = tick;
        if (first[i] >= 0 && recovery[i] < 0 && tick > first[i] &&
            ["idle", "walk", "crouch", "air", "attack"].includes(victim.state) && !victim.knockedDown)
          recovery[i] = tick - first[i];
      }
      if (recovery.every(value => value >= 0)) break;
    }
    expect(first.every(value => value >= 0)).toBe(true);
    expect(recovery.every(value => value > 0 && value < 360)).toBe(true);
  });
});
