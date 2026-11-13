import { describe, expect, it } from "vitest";
import { FLOOR } from "../src/engine/combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { pandemonium, pandemoniumId } from "../src/engine/xebec-pandemonium";
import {
  xebecCounterReply,
  xebecExtraShock,
} from "../src/engine/xebec-specials";
import { GameSession } from "../src/game/session";
import { FighterPresentation } from "../src/render/presentation";
import { xebecAnimations } from "../src/render/xebec-animations";

const commands = [
  ["forward", "light", "xebecFlash"],
  ["forward", "medium", "xebecFissure"],
  ["forward", "heavy", "xebecRupture"],
  ["back", "light", "xebecIntimidation"],
  ["back", "medium", "xebecPressure"],
  ["back", "heavy", "xebecCollision"],
  ["doubleDown", "light", "xebecBrutal"],
  ["doubleDown", "medium", "xebecBreaker"],
  ["doubleDown", "heavy", "xebecImpact"],
] as const;
type Motion = (typeof commands)[number][0];
type Strength = (typeof commands)[number][1];

function training(gap: number, side: 1 | -1 = 1) {
  const session = new GameSession("training", "normal", "xebec", "samurai");
  session.training.infiniteHealth = session.training.unlimitedMeter = false;
  const match = session.match;
  const [a, b] = match.fighters;
  a.meter = b.meter = 0;
  a.x = 640 - (side * gap) / 2;
  b.x = 640 + (side * gap) / 2;
  const view = new FighterPresentation(xebecAnimations);
  const hits: typeof match.hits = [];
  const step = (
    input: Partial<InputFrame> = {},
    rival?: Partial<InputFrame>,
  ) => {
    if (rival)
      match.step([
        { ...neutral(), ...input },
        { ...neutral(), ...rival },
      ]);
    else session.step({ ...neutral(), ...input });
    view.tick(a);
    for (const hit of match.hits)
      if (hits.at(-1)?.serial !== hit.serial) hits.push(hit);
  };
  const until = (
    ready: () => boolean,
    max = 140,
    input: Partial<InputFrame> = {},
  ) => {
    for (let i = 0; i < max && !ready(); i++) step(input);
    expect(ready()).toBe(true);
  };
  step();
  const command = (motion: Motion, strength: Strength) => {
    step({ down: true });
    if (motion === "doubleDown") {
      step();
      step({ down: true, pressed: [strength] });
    } else {
      const direction = (motion === "forward" ? side : -side) as 1 | -1;
      step({ direction, down: true });
      step({ direction, pressed: [strength] });
    }
  };
  return { session, match, a, b, step, command, view, until, hits };
}

describe("Xebec's nine specials", () => {
  it.each(commands)(
    "reads %s + %s as %s on both sides",
    (motion, strength, id) => {
      for (const side of [1, -1] as const) {
        const { a, command, view } = training(150, side);
        command(motion, strength);
        expect(a.moveId).toBe(id);
        expect(a.meter).toBe(0);
        expect(view.animator.clipName).toBe(id);
        expect(view.animator.sprite()).toMatchObject({
          sheet: "xebec/specials.png",
          scale: 1.2,
          pivot: { x: 128, y: 224 },
        });
        expect(
          new Set(xebecAnimations.clips[id].frames).size,
        ).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("does not read held down as double down", () => {
    const { a, step } = training(80);
    step({ down: true });
    step({ down: true });
    step({ down: true, pressed: ["light"] });
    expect(a.moveId).toBe("crouch_light");
  });

  it("Flash covers distance, hits once and preserves sides", () => {
    const { match, a, b, command, until, hits } = training(175);
    const origin = a.x;
    command("forward", "light");
    until(() => match.hitSerial === 1);
    expect(a.x - origin).toBeGreaterThan(50);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.vy).toBe(0);
    until(() => a.state === "idle");
    expect(hits.map((h) => h.move)).toEqual(["xebecFlash"]);
  });

  it.each([false, true])(
    "Fissure travels independently and respects guard=%s",
    (guarded) => {
      const { match, session, a, b, step, command, until } = training(610);
      session.training.dummy = guarded ? "guard" : "idle";
      command("forward", "medium");
      until(() => match.kiProjectiles.length === 1);
      const p = match.kiProjectiles[0],
        x = p.x;
      step();
      expect(p.x - x).toBe(21);
      expect(p.vy).toBe(0);
      until(() => match.hitSerial === 1);
      expect(match.hits[0]).toMatchObject({
        move: "xebecFissure",
        blocked: guarded,
      });
      expect(a.xebec!.domination).toBe(guarded ? 0 : 18);
      expect(b.health < b.data.health).toBe(!guarded);
    },
  );

  it.each([false, true])(
    "Rupture hops, lands and only releases the extra wave when empowered=%s",
    (powered) => {
      const { match, a, b, command, until } = training(110);
      a.xebec!.domination = powered ? 100 : 0;
      command("forward", "heavy");
      expect(a.xebec!.empowered).toBe(powered);
      until(() => a.airborne);
      expect(a.y).toBeLessThan(FLOOR);
      until(() => match.hitSerial > 0);
      expect(b.knockedDown).toBe(true);
      until(() => a.y === FLOOR && a.stateFrame >= 29);
      expect(match.kiProjectiles.some((p) => p.move === xebecExtraShock)).toBe(
        powered,
      );
    },
  );

  it("Intimidation repels and Pressure pushes a guard with no damage or charge", () => {
    const pulse = training(65);
    pulse.command("back", "light");
    pulse.until(() => pulse.match.hitSerial === 1);
    expect(pulse.match.hits[0].damage).toBe(34);
    expect(pulse.b.vx).toBe(13);
    const pressure = training(105);
    pressure.session.training.dummy = "guard";
    pressure.command("back", "medium");
    pressure.until(() => pressure.match.hitSerial === 1);
    expect(pressure.match.hits[0]).toMatchObject({ blocked: true, damage: 0 });
    expect(pressure.b.vx).toBe(13);
    expect(pressure.a.xebec!.domination).toBe(0);
    pressure.until(() => pressure.b.state !== "blockstun");
    expect(pressure.match.hitSerial).toBe(1);
    expect(pressure.match.kiProjectiles).toHaveLength(0);
  });

  it.each([false, true])(
    "Collision answers a strike with its own window, empowered=%s",
    (powered) => {
      const { a, b, match, command, step, until } = training(57);
      a.xebec!.domination = powered ? 100 : 0;
      command("back", "heavy");
      step({}, { pressed: ["light"] });
      until(() => a.moveId === xebecCounterReply);
      expect(a.health).toBe(a.data.health);
      until(() => match.hitSerial === 1);
      expect(match.hits[0]).toMatchObject({
        move: xebecCounterReply,
        damage: powered ? 146 : 106,
      });
      expect(a.xebec!.domination).toBe(30);
      expect(b.vx).toBeGreaterThan(powered ? 17 : 11);
      until(() => !match.hitstop);
      command("forward", "medium");
      expect(a.moveId === "xebecFissure" || match.hitstop > 0).toBe(true);
      until(() => a.moveId === "xebecFissure");
    },
  );

  it("Collision whiffs and cannot be started in stun", () => {
    const { a, match, command, until } = training(64);
    command("back", "heavy");
    until(() => a.state === "idle");
    expect(match.hitSerial).toBe(0);
    a.setState("hitstun");
    a.stun = 15;
    command("back", "heavy");
    expect(a.state).toBe("hitstun");
    expect(a.moveId).toBe("");
  });

  it.each([
    ["forward", "xebecFlash"],
    ["doubleDown", "xebecBrutal"],
    ["doubleDown", "xebecImpact"],
  ] as const)("confirms grounded J → K into %s / %s", (motion, id) => {
    const { a, match, command, step, until } = training(55);
    step({ pressed: ["light"] });
    until(() => a.hitConfirmed);
    step({ pressed: ["medium"] });
    until(
      () =>
        a.moveId === "stand_medium" && a.hitConfirmed && match.hitstop === 0,
    );
    command(motion, id === "xebecImpact" ? "heavy" : "light");
    expect(a.moveId).toBe(id);
    until(() => match.hits.some((h) => h.move === id && h.combo >= 3));
  });

  it("Breaker confirms two distinct impacts and allows a confirmed air J → L", () => {
    const { a, b, match, command, step, until, hits } = training(54);
    step({ pressed: ["medium"] });
    until(() => a.hitConfirmed && !match.hitstop);
    command("doubleDown", "medium");
    until(() => hits.filter((h) => h.move === "xebecBreaker").length === 2);
    expect(b.hitLaunch).toBe(true);
    expect(b.vy).toBeLessThan(-10);
    expect(a.xebec!.domination).toBe(18);
    until(() => !match.hitstop);
    step({ pressed: ["jump"] });
    expect(a.airborne).toBe(true);
    step({ direction: 1, pressed: ["light"] });
    until(() => a.moveId === "air_light" && a.hitConfirmed);
    step({ direction: 1, pressed: ["heavy"] });
    until(() =>
      match.hits.some((h) => h.move === "air_heavy" && h.combo === 5),
    );
  });

  it.each([false, true])(
    "Breaker skips the sword on whiff or guard=%s",
    (guard) => {
      const { a, session, command, until, hits } = training(guard ? 56 : 350);
      session.training.dummy = guard ? "guard" : "idle";
      command("doubleDown", "medium");
      until(() => a.stateFrame >= 40);
      expect(a.state).toBe("attack");
      expect(a.hitConfirmed).toBe(false);
      expect(hits).toHaveLength(guard ? 1 : 0);
    },
  );

  it.each([false, true])(
    "Impact knocks down and scales only the finish when empowered=%s",
    (empowered) => {
      const { a, b, match, command, until, hits } = training(65);
      a.xebec!.domination = empowered ? 100 : 0;
      command("doubleDown", "heavy");
      until(() => match.hitSerial === 2);
      expect(hits.map((h) => h.damage)).toEqual([64, empowered ? 102 : 71]);
      expect(b.knockedDown).toBe(true);
      expect(b.vx).toBe(empowered ? 19 : 13);
      expect(a.canCancel("light")).toBe(false);
    },
  );

  it("charge is separate from Super and only L spends the full bar", () => {
    const { a, b, command, match, until } = training(62);
    a.xebec!.domination = 94;
    command("doubleDown", "light");
    until(() => match.hitSerial === 1);
    expect(a.xebec!.domination).toBe(100);
    expect(a.meter).toBeLessThan(100);
    until(() => a.state === "idle");
    b.x = a.x + 57;
    command("back", "heavy");
    expect(a.xebec).toMatchObject({ domination: 0, empowered: true });
    until(() => a.state === "idle");
    expect(a.xebec).toMatchObject({ domination: 0, empowered: false });
  });
});

describe("Pandemonium", () => {
  it.each(["whiff", "guard", "hit"] as const)(
    "confirms only on valid hit (%s)",
    (result) => {
      const { a, b, match, session, step, until, hits } = training(
        result === "whiff" ? 660 : 63,
      );
      session.training.dummy = result === "guard" ? "guard" : "idle";
      step({ pressed: ["ultimate"] });
      expect(a.moveId).not.toBe(pandemoniumId);
      a.meter = 100;
      step({ pressed: ["ultimate"] });
      expect(a.moveId).toBe(pandemoniumId);
      expect(a.meter).toBe(0);
      if (result !== "hit") {
        until(() => a.state === "idle");
        expect(match.pandemonium).toBeUndefined();
        expect(hits).toHaveLength(result === "guard" ? 1 : 0);
        expect(b.health).toBe(b.data.health);
        return;
      }
      until(() => !!match.pandemonium);
      expect(b.state).toBe("grabbed");
      const replica = restore(snapshot(match));
      for (let i = 0; i <= pandemonium.end; i++) {
        step();
        replica.step([neutral(), neutral()]);
        expect(hashState(snapshot(replica))).toBe(hashState(snapshot(match)));
      }
      expect(match.cinematicActive).toBe(false);
      expect(a.state).toBe("idle");
      expect(b.knockedDown).toBe(true);
      expect(b.x - a.x).toBeGreaterThan(245);
      expect(hits.map((h) => h.move)).toEqual([
        pandemoniumId,
        "pandemonium_finish",
      ]);
      expect(b.data.health - b.health).toBe(24 + pandemonium.damage);
    },
  );

  it("converts a confirmed Breaker while the opener still reaches the launched rival", () => {
    const { a, match, step, command, until, hits } = training(55);
    a.meter = 100;
    step({ pressed: ["medium"] });
    until(() => a.hitConfirmed && !match.hitstop);
    command("doubleDown", "medium");
    until(() => hits.filter((h) => h.move === "xebecBreaker").length === 2);
    step({ pressed: ["ultimate"] });
    until(() => !!match.pandemonium, 50);
    expect(match.hits.at(-1)?.combo).toBe(4);
  });
});
