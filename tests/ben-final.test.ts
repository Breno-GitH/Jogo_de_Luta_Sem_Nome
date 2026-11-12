import { describe, expect, it } from "vitest";
import { characters } from "../src/engine/characters";
import { alienXConfig, alienXMove } from "../src/engine/ben-alien-x";
import { FLOOR, Match } from "../src/engine/combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { benAnimation } from "../src/render/ben-animations";
import { FighterPresentation } from "../src/render/presentation";

type Frame = Partial<InputFrame>;

function setup(gap = 105, reverse = false) {
  const match = reverse ? new Match(characters.samurai, {}, characters.ben) :
    new Match(characters.ben, {}, characters.samurai);
  match.phase = "fight";
  const f = match.fighters[reverse ? 1 : 0], target = match.fighters[reverse ? 0 : 1];
  const face = reverse ? -1 : 1;
  f.x = reverse ? 850 : 430;
  target.x = f.x + gap * face;
  const step = (input: Frame = {}, enemy: Frame = {}) => {
    const a = { ...neutral(), ...input }, b = { ...neutral(), ...enemy };
    match.step(reverse ? [b, a] : [a, b]);
  };
  const run = (ticks: number, input: Frame = {}, enemy: Frame = {}) => {
    for (let i = 0; i < ticks; i++) step(input, enemy);
  };
  return { match, f, target, face, step, run };
}
const superInput = { pressed: ["ultimate"] } as Frame;

describe("Final Ben", () => {
  it.each([false, true])("plays the same confirmed Alien X on both seats (right: %s)", right => {
    const { match, f, target, face, step, run } = setup(102, right);
    const away = { direction: face } as Frame;
    const health = f.health;
    f.meter = 100;
    f.omnitrix!.selected = f.omnitrix!.active = "echoEcho";
    step(superInput);
    expect(f.moveId).toBe("alienX");
    expect(f.meter).toBe(0);
    expect(match.alienX).toBeUndefined();
    run(19);
    run(12, {}, away);
    expect(match.alienX?.attacker).toBe(f.id);
    const presentation = new FighterPresentation(benAnimation("human"));
    presentation.tick(f);
    expect(presentation.animator.clipName).toBe("alienXWatch");
    run(48);
    presentation.tick(f);
    expect(presentation.animator.sprite().sheet).toBe("ben/alien-x.png");
    const replica = restore(snapshot(match));
    for (let tick = 0; tick < alienXConfig.duration; tick++) {
      step();
      replica.step([neutral(), neutral()]);
      expect(hashState(snapshot(match))).toBe(hashState(snapshot(replica)));
    }
    expect(match.alienX).toBeUndefined();
    expect(f.state).toBe("idle");
    expect(f.omnitrix!.active).toBe("human");
    expect(f.omnitrix!.selected).toBe("echoEcho");
    expect(f.health).toBe(health);
    expect(f.meter).toBe(0);
    expect(target.health).toBe(target.data.health - alienXMove.damage - alienXConfig.hits[0].damage);
  });

  it("fails on whiff, stun, insufficient meter and against a target out of the opener's height", () => {
    for (const issue of ["far", "height", "stun", "bar"]) {
      const { match, f, target, step, run } = setup(issue === "far" ? 425 : 110);
      f.meter = issue === "bar" ? 99 : 100;
      if (issue === "stun") { f.setState("hitstun"); f.stun = 40; }
      if (issue === "height") {
        target.y = FLOOR - 470;
        target.setState("air");
      }
      step(superInput);
      run(95);
      expect(match.alienX, issue).toBeUndefined();
      expect(target.health, issue).toBe(target.data.health);
      expect(f.meter).toBe(issue === "bar" ? 99 : issue === "stun" ? 100 : 0);
    }
  });

  it("resolves the KO only after the final hit and releases the cinematic", () => {
    const { match, f, target, step, run } = setup();
    f.meter = 100;
    target.health = 8;
    step(superInput);
    run(44);
    expect(target.health).toBe(1);
    expect(match.phase).toBe("fight");
    run(340);
    expect(target.health).toBe(0);
    expect(match.phase).toBe("roundEnd");
    expect(match.cinematicActive).toBe(false);
  });

  it.each(["light", "medium"] as const)("raises and independently launches %s rocks with real contact", key => {
    const a = setup(key === "medium" ? 285 : 163);
    a.f.omnitrix!.active = "gravattack";
    a.step({ down: true });
    a.step({ direction: -1, pressed: [key] });
    a.run(key === "medium" ? 11 : 5);
    const debris = a.f.omnitrix!.objects.filter(object => object.id.startsWith("gravityStone"));
    expect(debris).toHaveLength(key === "medium" ? 4 : 2);
    const roots = debris.map(object => object.x);
    expect(debris.every(object => object.y < FLOOR - 8)).toBe(true);
    a.run(24);
    expect(debris.some((object, i) => object.x > roots[i] + 40)).toBe(true);
    expect(new Set(debris.map(object => object.y)).size).toBe(debris.length);
    a.run(60);
    expect(a.target.health).toBeLessThan(a.target.data.health);
    expect(a.f.omnitrix!.objects.every(object => !object.id.startsWith("gravityStone"))).toBe(true);
  });

  it("accelerates at floor height and brakes against the stage boundary", () => {
    const { f, target, step, run } = setup();
    f.omnitrix!.active = "gravattack";
    f.x = 1123;
    target.x = 1235;
    target.y = FLOOR - 465;
    target.setState("air");
    step({ down: true }); step(); step({ down: true, pressed: ["medium"] });
    run(16);
    const first = f.vx;
    run(3);
    expect(f.vx).toBeGreaterThan(first);
    expect(f.y).toBe(FLOOR);
    let returned = false;
    for (let i = 0; i < 61; i++) {
      step();
      if (f.vx < 0) returned = true;
      expect(f.x).toBeLessThanOrEqual(1280 - f.stageInset);
    }
    expect(returned).toBe(true);
    expect(f.state).toBe("idle");
  });

  it("gives human Ben distinct locomotion, aerials, crouch normals and U", () => {
    const art = benAnimation("human");
    for (const name of ["walkForward", "walkBack", "dashForward", "backdash", "crouchStart",
      "jumpStart", "jumpRise", "jumpApex", "jumpFall", "landing", "guardStand", "guardCrouch", "damage",
      "downed", "getup", "entrance", "taunt", "victory", "omnitrixUse"]) expect(art.clips[name]).toBeDefined();
    for (const posture of ["stand", "crouch", "air"]) {
      for (const key of ["light", "medium"] as const) {
        const a = setup(57);
        if (posture === "air") { a.f.setState("air"); a.f.y = FLOOR - 41; }
        a.step({ down: posture === "crouch", pressed: [key] });
        expect(a.f.moveId).toBe(posture + "_" + key);
        a.run(48);
        expect(a.target.health).toBeLessThan(a.target.data.health);
      }
    }
    const a = setup(61);
    a.step({ pressed: ["throw"] });
    a.run(75);
    expect(a.target.health).toBe(a.target.data.health - characters.ben.grabSequence!.damage);
    expect(a.match.capture).toBeUndefined();
  });

  it("keeps NRG walk cycles distinct and on the same fixed grid", () => {
    const { clips } = benAnimation("nrg");
    for (const id of ["walkForward", "walkBack"]) {
      const clip = clips[id];
      expect(clip.frames).toHaveLength(8);
      expect(clip.pivot).toEqual({ x: 128, y: 224 });
      expect([clip.frameWidth, clip.frameHeight]).toEqual([256, 256]);
    }
    expect(clips.walkForward.frames).not.toEqual(clips.walkBack.frames.slice().reverse());
    expect(benAnimation("nrgReleased").clips.walkForward.sheet).not.toBe("ben/nrg/walk-final.png");
  });
});

