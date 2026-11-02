import { describe, expect, it } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { neutral } from "../src/engine/types";
import { reactionFor } from "../src/engine/lifecycle";
import { FighterPresentation } from "../src/render/presentation";
import { restore, snapshot, hashState } from "../src/engine/state";

describe("visual audit regressions", () => {
  it("restarts airborne and ground reaction phases and shares their clock with collision data", () => {
    const match = new Match();
    match.phase = "fight";
    const [a, b] = match.fighters;
    a.x = 500;
    b.x = 600;
    a.attack("crouch_heavy");
    const presentation = new FighterPresentation();
    const phases = new Map<string, number>();
    let last = "";
    for (let i = 0; i < 150; i++) {
      match.step([neutral(), neutral()]);
      presentation.tick(b);
      const reaction = reactionFor(b);
      if (b.state === "hitstun" && reaction) {
        if (reaction.clip !== last) {
          phases.set(reaction.clip, reaction.tick);
          expect(reaction.tick).toBe(0);
          expect(presentation.animator.frame()).toBe(0);
        }
        last = reaction.clip;
      }
    }
    expect([...phases.keys()]).toContain("launched");
    expect([...phases.keys()]).toContain("falling");
  });

  it("starts downed on its first cell when an aerial finisher lands after long hitstun", () => {
    const match = new Match();
    match.phase = "fight";
    const f = match.fighters[1];
    f.setState("hitstun");
    f.y = FLOOR - 45;
    f.vy = 5;
    f.knockedDown = true;
    f.stun = 80;
    f.stateFrame = 40;
    f.syncReactionClock(false);
    for (let i = 0; i < 20 && f.airborne; i++)
      match.step([neutral(), neutral()]);
    expect(f.y).toBe(FLOOR);
    expect(reactionFor(f)).toEqual({ clip: "downed", tick: 0 });
    match.step([neutral(), neutral()]);
    expect(reactionFor(f)).toEqual({ clip: "downed", tick: 1 });
    const copy = restore(snapshot(match));
    for (let i = 0; i < 30; i++) {
      match.step([neutral(), neutral()]);
      copy.step([neutral(), neutral()]);
      expect(hashState(snapshot(copy))).toBe(hashState(snapshot(match)));
    }
  });

  it("keeps the retreat gait near an opponent while still allowing real blocking", () => {
    const match = new Match();
    match.phase = "fight";
    const [a, b] = match.fighters;
    a.x = 500;
    b.x = 620;
    const presentation = new FighterPresentation();
    match.step([{ ...neutral(), direction: -1 }, neutral()]);
    expect(a.guardIntent).toBe(true);
    presentation.tick(a);
    expect(presentation.animator.clipName).toBe("walkBack");
    b.x = a.x + 60;
    b.attack("stand_light");
    let blocked = false;
    for (let i = 0; i < 8; i++) {
      match.step([{ ...neutral(), direction: -1 }, neutral()]);
      blocked ||= match.hits.some((hit) => hit.blocked);
    }
    expect(a.health).toBe(a.data.health);
    expect(blocked).toBe(true);
  });
});
