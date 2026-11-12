import { describe, expect, it } from "vitest";
import art from "../src/data/ben-alien-art.json";
import { ben } from "../src/engine/ben-data";
import { benForms } from "../src/engine/ben-forms";
import {
  alienXSuper, benAliens, omnitrixHoldTicks, omnitrixSwapTicks, type BenAlien,
} from "../src/engine/ben-omnitrix";
import { characters } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, overlaps, type Button, type InputFrame } from "../src/engine/types";
import { ONLINE_CHARACTERS, validInput } from "../src/net/protocol";
import { FighterPresentation } from "../src/render/presentation";
import benArt from "../src/data/ben-art.json";

const playable = ["xlr8", "fourArms", "heatblast"] as const;
const control = (held: boolean, pressed: Button[] = []): InputFrame =>
  ({ ...neutral(), pressed, omnitrix: { held } });
const tap = () => control(false, ["heavy"]);

function arena(seat: 0 | 1 = 0) {
  const match = seat === 0
    ? new Match(ben, { training: true }, characters.sasuke)
    : new Match(characters.sasuke, { training: true }, ben);
  match.phase = "fight";
  const fighter = match.fighters[seat], rival = match.fighters[1 - seat];
  const step = (input = neutral(), enemy = neutral()) => match.step(seat === 0 ? [input, enemy] : [enemy, input]);
  const run = (ticks: number, input = neutral()) => {
    for (let i = 0; i < ticks; i++) step(input);
  };
  const hold = (ticks = omnitrixHoldTicks) => {
    step(control(true, ["heavy"]));
    run(ticks - 1, control(true));
  };
  const select = (id: BenAlien) => {
    for (let n = 0; n < benAliens.length && fighter.omnitrix!.selected !== id; n++) step(tap());
    expect(fighter.omnitrix!.selected).toBe(id);
  };
  const transform = (id: BenAlien) => {
    select(id);
    hold();
    run(omnitrixSwapTicks, control(true));
    step(control(false));
    expect(fighter.omnitrix!.active).toBe(id);
  };
  return { match, fighter, rival, step, run, hold, select, transform };
}

describe("Omnitrix with playable forms", () => {
  it("keeps the eleven ordered entries, eleven playable profiles, and Alien X separate", () => {
    expect(ONLINE_CHARACTERS).toContain("ben");
    expect(benAliens.map(form => form.name)).toEqual([
      "XLR8", "Quatro Braços", "Feedback", "Gravattack", "Fantasmático", "Friagem",
      "NRG", "Diamante", "Eco Eco", "Chama", "Enormossauro",
    ]);
    expect(Object.keys(benForms).sort()).toEqual([...playable, "diamondhead", "humungousaur", "feedback", "bigChill", "ghostfreak", "nrg", "gravattack", "echoEcho"].sort());
    expect(benAliens.some(form => String(form.id) === alienXSuper.id)).toBe(false);
    expect(alienXSuper.command).toBe("ultimate");
  });

  it("resolves eleven short presses on release without transforming and wraps to XLR8", () => {
    const { fighter, step, run } = arena();
    step(control(true, ["heavy"]));
    run(omnitrixHoldTicks - 2, control(true));
    expect(fighter.omnitrix).toMatchObject({ active: "human", selected: "xlr8" });
    step(control(false));
    expect(fighter.omnitrix?.selected).toBe("fourArms");
    for (const form of [...benAliens.slice(2), benAliens[0]]) {
      step(tap());
      expect(fighter.omnitrix).toMatchObject({ active: "human", selected: form.id });
    }
  });

  it("charges once, preserves health and energy, and accepts a fresh press between samples", () => {
    const { fighter, hold, run, step } = arena();
    fighter.health = 433;
    fighter.meter = 66;
    hold(omnitrixHoldTicks - 1);
    expect(fighter.omnitrix?.transition).toBeUndefined();
    step(control(true));
    expect(fighter.omnitrix?.transition?.to).toBe("xlr8");
    run(omnitrixSwapTicks + 25, control(true));
    expect(fighter.omnitrix).toMatchObject({ active: "xlr8", selected: "xlr8" });
    expect(fighter.omnitrix?.transition).toBeUndefined();
    expect([fighter.health, fighter.meter, fighter.invulnerable]).toEqual([433, 66, false]);
    step(tap());
    expect(fighter.omnitrix).toMatchObject({ active: "xlr8", selected: "fourArms" });
  });

  it("switches directly across all eleven playable forms", () => {
    const { fighter, transform } = arena();
    for (const form of benAliens) transform(form.id);
    transform("gravattack");
    transform("echoEcho");
    expect(fighter.data).toBe(ben);
  });

  it("rejects growth at a corner and moves only Ben away from the rival if room exists", () => {
    const { fighter: f, rival, select, hold, run, step } = arena();
    f.x = 40;
    rival.x = 92;
    select("fourArms");
    hold();
    run(omnitrixSwapTicks);
    step(control(false));
    expect(f.omnitrix?.active).toBe("human");
    expect(f.omnitrix?.noSpace).toBeGreaterThan(0);
    expect([f.x, rival.x]).toEqual([40, 92]);
    f.x = 500;
    rival.x = 552;
    hold();
    run(omnitrixSwapTicks);
    expect(f.omnitrix?.active).toBe("fourArms");
    expect(f.x).toBeLessThan(500);
    expect(rival.x).toBe(552);
    expect(overlaps(f.pushbox(), rival.pushbox())).toBe(false);
  });

  it.each(["hitstun", "getup", "grabbed", "cinematic"] as const)("discards a partial hold in %s", state => {
    const { fighter, hold, run, step } = arena();
    hold(9);
    fighter.setState(state);
    run(30, control(true));
    step(control(false));
    expect(fighter.omnitrix).toMatchObject({ active: "human", selected: "xlr8", holdTicks: 0 });
  });

  it("discards a lost device and cancels a transition when Ben is hit", () => {
    const { fighter: f, rival, hold, step, run } = arena();
    hold(6);
    step();
    run(25, control(true));
    expect(f.omnitrix?.active).toBe("human");
    step(control(false));
    rival.x = f.x + 51;
    hold(omnitrixHoldTicks - 1);
    step(control(true), { ...neutral(), pressed: ["light"] });
    expect(f.omnitrix?.transition?.to).toBe("xlr8");
    run(omnitrixSwapTicks, control(true));
    expect(f.health).toBeLessThan(f.data.health);
    expect(f.omnitrix?.transition).toBeUndefined();
    expect(f.omnitrix?.active).toBe("human");
  });

  it.each(playable)("animates walk, dash, crouch, and jump on both sides with its own %s profile", id => {
    for (const seat of [0, 1] as const) {
      const { fighter: f, transform, step } = arena(seat);
      const pose = new FighterPresentation(benArt);
      transform(id);
      const apply = (input = neutral()) => {
        step(input);
        pose.tick(f);
        return pose.animator.clipName;
      };
      const sign = seat === 0 ? 1 : -1;
      const profile = benForms[id]!.movement;
      const x = f.x;
      expect(apply({ ...neutral(), direction: sign })).toBe("walkForward");
      expect(Math.abs(f.x - x)).toBeCloseTo(profile.speed);
      expect(apply({ ...neutral(), direction: sign === 1 ? -1 : 1 })).toBe("walkBack");
      expect(apply({ ...neutral(), direction: sign, pressed: ["dash"] })).toBe("dashForward");
      for (let t = 0; t < 16; t++) apply();
      expect(apply({ ...neutral(), direction: sign === 1 ? -1 : 1, pressed: ["dash"] })).toBe("backdash");
      for (let t = 0; t < 16; t++) apply();
      expect(apply({ ...neutral(), down: true })).toBe("crouchStart");
      for (let t = 0; t < 7; t++) apply({ ...neutral(), down: true });
      expect(pose.animator.clipName).toBe("crouchIdle");
      expect(apply()).toBe("crouchEnd");
      expect(apply({ ...neutral(), pressed: ["jump"] })).toBe("jumpStart");
      const clips = new Set<string>();
      let apex = FLOOR;
      for (let t = 0; t < 70; t++) {
        clips.add(apply());
        apex = Math.min(apex, f.y);
      }
      for (const clip of ["jumpRise", "jumpApex", "jumpFall", "landing", "idle"]) expect(clips.has(clip)).toBe(true);
      expect(apex).toBeLessThan(FLOOR - 90);
      expect(f.y).toBe(FLOOR);
      expect(f.facing).toBe(sign);
      expect(pose.animator.sprite().sheet).toBe(`ben/${id}/idle.png`);
    }
  });

  it.each(playable)("uses real J/K hitboxes and resolves the universal U capture as %s", id => {
    const { fighter, rival, match, transform, step, run } = arena();
    transform(id);
    const profile = benForms[id]!;
    const gap = (fighter.pushbox().w + rival.pushbox().w) / 2 + 1;
    for (const [button, move] of [["light", "stand_light"], ["medium", "stand_medium"]] as const) {
      rival.x = fighter.x + gap;
      const before = rival.health;
      step({ ...neutral(), pressed: [button] });
      expect(fighter.move).toBe(profile.moves[move]);
      run(50);
      expect(rival.health).toBeLessThan(before);
    }
    rival.x = fighter.x + gap;
    const before = rival.health;
    step({ ...neutral(), pressed: ["throw"] });
    run(profile.moves.throw.startup + 1);
    expect(match.capture?.kind).toBe("grab");
    run(60);
    expect(match.capture).toBeUndefined();
    expect(rival.health).toBe(before - profile.grab.damage);
  });

  it("replays a pending swap, orientation and movement on an independent replica", () => {
    const { match, fighter, select, hold, step } = arena(1);
    select("heatblast");
    hold();
    const replica = restore(snapshot(match));
    for (let t = 0; t < 25; t++) {
      const input: InputFrame = { ...control(true), direction: -1 };
      step(input);
      replica.step([neutral(), input]);
      expect(hashState(snapshot(replica))).toBe(hashState(snapshot(match)));
    }
    expect(fighter.omnitrix?.active).toBe("heatblast");
    expect(fighter.facing).toBe(-1);
    expect(snapshot(new Match()).fighters[0]).not.toHaveProperty("omnitrix");
  });

  it("keeps the Alien X command out of the dial while Sasuke retains his heavy", () => {
    const { fighter, rival, transform, step } = arena();
    transform("xlr8");
    fighter.meter = 0;
    step({ ...tap(), pressed: ["heavy", "ultimate"] }, { ...neutral(), pressed: ["heavy"] });
    expect([fighter.moveId, fighter.meter, rival.moveId]).toEqual(["", 0, "stand_heavy"]);
    expect(validInput(control(true, ["heavy"]))).toBe(true);
    expect(validInput({ ...tap(), omnitrix: { held: true, form: "xlr8" } })).toBe(false);
  });

  it.each(playable)("contains the full %s set of unique movement cells at the common floor pivot", id => {
    const data = art[id];
    expect(data.pivot).toEqual({ x: 128, y: 224 });
    const counts = [6, 6, 6, 5, 5, 2, 2, 2, 3, 2, 1, 2, 3];
    const clips = ["idle", "walkForward", "walkBack", "dashForward", "backdash",
      "crouchStart", "crouchIdle", "crouchEnd", "jumpStart", "jumpRise", "jumpApex", "jumpFall", "landing"] as const;
    expect(clips.map(clip => data.clips[clip].frames.length)).toEqual(counts);
  });
});

