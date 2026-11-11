import { describe, expect, it } from "vitest";
import { Bot } from "../src/engine/bot";
import { characters, type CharacterId } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { sasukeCurseBalance } from "../src/engine/sasuke-curse";
import { sasukeGrab, sasukeThrow } from "../src/engine/sasuke-grab";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { FighterPresentation } from "../src/render/presentation";
import { sasukeAnimations } from "../src/render/sasuke-animations";
import { defaultBindings } from "../src/game/preferences";
import { fighterHero, movesContent } from "../src/ui/catalog";

function fight(id: CharacterId, gap = 57, side: 1 | -1 = 1, cursed = false) {
  const match = new Match(characters.sasuke, {}, characters[id]);
  match.phase = "fight";
  const [a, b] = match.fighters;
  a.x = 620;
  a.facing = side;
  b.x = 620 + gap * side;
  b.facing = -side;
  if (cursed) a.sasukeCurse = { phase: "active", remaining: sasukeCurseBalance.durationTicks,
    airBurstUsed: false, airBurstTick: 0 };
  const tick = (p1: Partial<InputFrame> = {}, p2: Partial<InputFrame> = {}) =>
    match.step([{ ...neutral(), ...p1 }, { ...neutral(), ...p2 }]);
  return { match, a, b, tick };
}

describe("Sasuke final integration", () => {
  it.each(Object.keys(characters) as CharacterId[])("throws %s with synchronized capture and knockdown in either form", id => {
    for (const cursed of [false, true]) {
      const side = cursed ? -1 : 1;
      const { match, a, b, tick } = fight(id, 63, side, cursed);
      b.x = side === 1 ? 1240 : 40;
      a.x = b.x - side * 63;
      const present = new FighterPresentation(sasukeAnimations);
      tick({ pressed: ["throw"] }, { direction: side });
      expect(a.moveId).toBe("throw");
      const animation = () => {
        present.tick(a);
        return present.animator.clipName;
      };
      const variant = cursed ? "curse_" : "";
      expect(animation()).toBe(variant + "throw");
      for (let i = 0; i < 14 && !match.capture; i++) tick({}, { direction: side });
      expect(match.capture?.kind).toBe("grab");
      expect(animation()).toBe(variant + "grabHold");
      const restored = restore(snapshot(match));
      const remaining = a.sasukeCurse?.remaining;
      for (let i = 0; i < 50 && match.capture; i++) {
        tick();
        restored.step([neutral(), neutral()]);
        expect(hashState(snapshot(restored))).toBe(hashState(snapshot(match)));
      }
      expect(match.capture).toBeUndefined();
      expect(a.state).toBe("throwRecover");
      expect(animation()).toBe(variant + "throwRecover");
      expect(a.sasukeCurse?.remaining).toBe(remaining);
      expect(b.health).toBe(b.data.health - sasukeGrab.damage);
      expect(b.knockedDown).toBe(true);
      expect(b.vx * side).toBeGreaterThan(0);
    }
  });

  it.each(["far", "airborne", "corner"] as const)("enforces %s throw contact without phantom damage", scenario => {
    const { match, a, b, tick } = fight("samurai", scenario === "far" ? 180 : 58);
    if (scenario === "airborne") { b.y = FLOOR - 95; b.setState("air"); }
    if (scenario === "corner") { a.x = 1182; b.x = 1240; }
    tick({ pressed: ["throw"] });
    for (let i = 0; i < 65; i++) {
      tick();
      expect(b.x).toBeLessThanOrEqual(1240);
    }
    expect(b.health).toBe(b.data.health - (scenario === "corner" ? sasukeThrow.damage : 0));
    expect(match.capture).toBeUndefined();
    expect(a.state).toBe("idle");
  });

  it("shows the taunt in both forms and allows a strike to interrupt it", () => {
    for (const cursed of [false, true]) {
      const { a, tick } = fight("samurai", 58, 1, cursed);
      const present = new FighterPresentation(sasukeAnimations);
      tick({ pressed: ["taunt"] }, { pressed: ["light"] });
      expect(a.state).toBe("taunt");
      present.tick(a);
      expect(present.animator.clipName).toBe(cursed ? "curse_taunt" : "taunt");
      expect(present.animator.sprite().sheet).toBe(cursed ? "sasuke/taunt-marca.png" : "sasuke/taunt-hebi.png");
      for (let i = 0; i < 12 && a.state === "taunt"; i++) tick();
      expect(a.state).toBe("hitstun");
    }
  });

  it("shows the animated card, the two lifecycle commands and the temporary form", () => {
    const commands = movesContent("sasuke", defaultBindings);
    for (const text of ["Agarrão de pulso", "Provocação", "13 s", "18 s", "Kirin"])
      expect(commands).toContain(text);
    expect(fighterHero("sasuke")).toContain("menu-idle.webp");
  });

  it("uses the real inputs for varied Katon and Raiton, awakening, normals and a Kirin punish", () => {
    const moves = new Set<string>();
    const decisions = new Set<string>();
    for (const gap of [63, 158, 265, 388]) {
      const { match, a, b } = fight("samurai", gap);
      const bot = new Bot("hard", 3097 + gap, 0);
      for (let i = 0; i < 750; i++) {
        if (match.phase !== "fight") break;
        if (b.state === "idle" && a.state === "idle") {
          a.x = 440;
          b.x = 440 + gap;
        }
        const input = bot.sample(match);
        decisions.add(bot.lastDecision);
        match.step([input, neutral()]);
        if (a.moveId) moves.add(a.moveId);
      }
    }
    expect(moves.has("curse_awaken")).toBe(true);
    expect([...moves].filter(id => ["gokakyu", "hosenka", "goryuka"].includes(id)).length).toBeGreaterThanOrEqual(2);
    expect([...moves].some(id => ["senbon", "eiso", "chidori"].includes(id))).toBe(true);
    expect([...moves].some(id => id.startsWith("stand_") || id.startsWith("crouch_"))).toBe(true);
    expect(decisions.has("continuar combo") || decisions.has("perseguir lançamento")).toBe(true);

    const { match, a, b, tick } = fight("samurai", 64, 1, true);
    const bot = new Bot("hard", 2134, 0);
    a.meter = a.meterMaximum;
    b.setState("hitstun");
    b.stun = 85;
    for (let i = 0; i < 60 && !match.kirin; i++) tick(bot.sample(match));
    expect(match.kirin?.cursed).toBe(true);
  });
});
