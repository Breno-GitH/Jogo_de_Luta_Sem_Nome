import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { antiLightCombo, isLimitedLightNormal } from "../src/engine/anti-light-combo";
import { neutral } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";

const step = (match: Match) => match.step([neutral(), neutral()]);

/** Keep both fighters in contact to simulate the worst-case corner mash. */
function connectLight(match: Match): boolean {
  const [attacker, defender] = match.fighters;
  attacker.setState("idle");
  attacker.x = 600;
  attacker.y = FLOOR;
  attacker.vx = attacker.vy = 0;
  attacker.facing = 1;
  defender.x = 665;
  defender.y = FLOOR;
  defender.vx = defender.vy = 0;
  defender.facing = -1;
  if (defender.state === "hitstun") defender.stun = 100;
  const before = match.hitSerial;
  expect(attacker.attack("stand_light")).toBe(true);
  for (let tick = 0; tick < 45; tick++) {
    step(match);
    if (match.hitSerial > before) return true;
  }
  return false;
}

describe("anti infinite for repeated weak punches", () => {
  it("only applies to Goku and Samurai normal J attacks", () => {
    for (const id of ["samurai", "goku"]) {
      expect(isLimitedLightNormal(id, "stand_light")).toBe(true);
      expect(isLimitedLightNormal(id, "crouch_light")).toBe(true);
      expect(isLimitedLightNormal(id, "air_light")).toBe(true);
      for (const idMove of ["stand_medium", "stand_heavy", "ki_light", "draw_light"])
        expect(isLimitedLightNormal(id, idMove)).toBe(false);
    }
    expect(isLimitedLightNormal("dio", "stand_light")).toBe(false);
  });

  it.each(["goku", "samurai"] as const)(
    "%s ends a run of J hits by launching the opponent, and locks further J hits",
    id => {
      const match = new Match(characters[id], { training: true }, characters.samurai);
      match.phase = "fight";
      const [attacker, defender] = match.fighters;
      for (let hit = 1; hit <= antiLightCombo.maxHits; hit++) {
        expect(connectLight(match), `hit ${hit}`).toBe(true);
        expect(defender.lightHitsInCombo).toBe(hit);
        if (hit < antiLightCombo.maxHits) {
          expect(defender.knockedDown).toBe(false);
        }
      }
      expect(defender.knockedDown).toBe(true);
      expect(defender.vx).toBeGreaterThanOrEqual(antiLightCombo.push - 1);
      expect(defender.vy).toBeLessThan(0);
      expect(connectLight(match)).toBe(false);
      expect(defender.lightHitsInCombo).toBe(antiLightCombo.maxHits);
      // Snapshot/restore must preserve the deterministic LAN replay state.
      expect(hashState(snapshot(restore(snapshot(match))))).toBe(hashState(snapshot(match)));
      defender.setState("idle");
      defender.combo = 0;
      defender.knockedDown = false;
      expect(connectLight(match)).toBe(true);
      expect(defender.lightHitsInCombo).toBe(1);
    },
  );
});
