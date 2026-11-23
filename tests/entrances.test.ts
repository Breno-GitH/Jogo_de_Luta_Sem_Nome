import { describe, it, expect, vi } from "vitest";
import { Match, FLOOR } from "../src/engine/combat";
import { characters, type CharacterId } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import { snapshot, restore, hashState } from "../src/engine/state";
import {
  entranceProfiles,
  entranceProfile,
  entranceRoot,
  entranceStagger,
  introStage,
} from "../src/engine/entrances";
import { FighterPresentation } from "../src/render/presentation";
import { entranceAnimationSets } from "../src/render/entrance-animations";
import { entranceHidden } from "../src/render/entrance-fx";
import { validInput } from "../src/net/protocol";
import { GameSession } from "../src/game/session";
import { Sound } from "../src/audio/sound";
const ids = Object.keys(characters) as CharacterId[];
const step = (m: Match, a = neutral(), b = neutral()) => m.step([a, b]);
const advance = (m: Match, n: number, a = neutral(), b = neutral()) => {
  for (let i = 0; i < n; i++) step(m, a, b);
};
const resource = (m: Match) =>
  m.fighters.map((f) => ({
    hp: f.health,
    meter: f.meter,
    asta: structuredClone(f.asta),
    domination: structuredClone(f.domination),
    watch: structuredClone(f.omnitrix),
    curse: structuredClone(f.sasukeCurse),
  }));

describe("exclusive first-round fighter entrances", () => {
  it("covers every playable fighter with an individual 2–4s performance", () => {
    expect(Object.keys(entranceProfiles).sort()).toEqual(ids.slice().sort());
    for (const id of ids) {
      expect(entranceProfile(id).duration).toBeGreaterThanOrEqual(120);
      expect(entranceProfile(id).duration).toBeLessThanOrEqual(240);
      const art = entranceAnimationSets[id];
      expect(art).toBeDefined();
      expect(art.clips.entrance.frames.length).toBeGreaterThanOrEqual(8);
      expect(art.clips.entrance.sheet).not.toMatch(/walk|idle/);
    }
  });
  it.each(ids)(
    "%s performs authored cels, preserves resources and releases both players together",
    (id) => {
      const m = new Match(characters[id], {}, characters.dio);
      m.fighters.forEach((f) => {
        f.meter = 37;
      });
      const before = resource(m),
        total = m.phaseFrames;
      const presenters = m.fighters.map(() => new FighterPresentation());
      const seen = new Set<number>();
      const mash: InputFrame = {
        direction: 1,
        down: true,
        pressed: [
          "light",
          "medium",
          "heavy",
          "throw",
          "ultimate",
          "taunt",
          "jump",
          "dash",
        ],
        omnitrix: { held: true },
      };
      expect(entranceHidden(m, 0)).toBe(true);
      expect(entranceHidden(m, 1)).toBe(true);
      for (let tick = 1; tick < total; tick++) {
        step(m, mash, mash);
        expect(m.phase).toBe("intro");
        expect(m.combatFrame).toBe(0);
        expect(m.timer).toBe(99 * 60);
        expect(m.hits).toHaveLength(0);
        expect(m.capture).toBeUndefined();
        expect(m.astaUnion).toBeUndefined();
        expect(m.projectiles).toHaveLength(0);
        expect(m.kiProjectiles).toHaveLength(0);
        expect(m.beams).toHaveLength(0);
        m.fighters.forEach((f, i) => {
          expect(f.x).toBeGreaterThanOrEqual(120);
          expect(f.x).toBeLessThanOrEqual(1160);
          expect(f.y).toBe(FLOOR);
          expect(f.state).not.toBe("attack");
          expect(f.buffer.actions).toHaveLength(0);
          if (f.state === "entrance") {
            presenters[i].tick(f);
            if (i === 0 && presenters[i].animator.clipName === "entrance")
              seen.add(presenters[i].animator.frame());
          }
        });
        if (tick < entranceStagger) expect(entranceHidden(m, 1)).toBe(true);
      }
      expect(seen.size).toBeGreaterThanOrEqual(8);
      expect(resource(m)).toEqual(before);
      expect(introStage(m.intro)).toBe("fight");
      step(m, mash, mash);
      expect(m.phase).toBe("fight");
      expect(m.fighters.map((f) => f.state)).toEqual(["idle", "idle"]);
      expect(m.fighters.map((f) => f.x)).toEqual([400, 880]);
      expect(resource(m)).toEqual(before);
      step(m);
      expect(m.fighters[0].state).toBe("idle");
      step(m, { ...neutral(), pressed: ["light"] });
      expect(m.fighters[0].state).toBe("attack");
    },
  );
  it("uses short round announcements after round one and repeats full intros for a rematch", () => {
    const m = new Match(characters.asta, {}, characters.xebec);
    m.phase = "roundEnd";
    m.phaseFrames = 1;
    step(m);
    expect(m.round).toBe(2);
    expect(m.intro.full).toBe(false);
    expect(m.phaseFrames).toBe(48);
    advance(m, 47);
    expect(m.phase).toBe("intro");
    expect(m.fighters.every((f) => f.state === "idle")).toBe(true);
    step(m);
    expect(m.phase).toBe("fight");
    const session = new GameSession("versus", "normal", "asta", "dio");
    session.match.intro.skipVotes = [true, true];
    session.restart();
    expect(session.match.intro.full).toBe(true);
    expect(session.match.intro.skipVotes).toEqual([false, false]);
  });
  it("plays the initial Training intro while position/damage resets can enter practice immediately", () => {
    const session = new GameSession("training", "normal", "asta", "ben");
    expect(session.match.phase).toBe("intro");
    session.restart(false);
    expect(session.match.phase).toBe("fight");
    expect(session.match.fighters[0].asta?.equipped).toBe("slayer");
    expect(session.match.fighters[1].omnitrix?.active).toBe("human");
  });
  it("keeps the root inside platform margins for either orientation", () => {
    for (const id of ids)
      for (const facing of [-1, 1])
        for (const home of [-20, 400, 880, 1310])
          for (const age of [-42, 0, 8, 60, 200]) {
            const x = entranceRoot(home, facing, id, age);
            expect(x).toBeGreaterThanOrEqual(120);
            expect(x).toBeLessThanOrEqual(1160);
          }
  });
});
describe("deterministic intro skip and snapshots", () => {
  it("plays prop sounds at their own ticks once and suppresses them on a skipped performance", () => {
    const m = new Match(characters.ben, {}, characters.asta),
      sound = new Sound();
    const play = vi.spyOn(sound, "play").mockImplementation(() => {});
    sound.tick(m);
    advance(m, 45);
    sound.tick(m);
    sound.tick(m);
    expect(play.mock.calls.filter((c) => c[0] === "introWatch")).toHaveLength(
      1,
    );
    advance(m, 45);
    sound.tick(m);
    expect(play.mock.calls.filter((c) => c[0] === "introSword")).toHaveLength(
      1,
    );
    play.mockClear();
    const skipped = new Match(characters.ben, {}, characters.asta);
    step(skipped, { ...neutral(), skipIntro: true });
    sound.tick(skipped);
    expect(play.mock.calls.some((c) => c[0].startsWith("intro"))).toBe(false);
  });
  it("skips local performances but still announces the round before enabling controls", () => {
    const m = new Match(characters.goku, {}, characters.asta);
    step(m, { ...neutral(), skipIntro: true, pressed: ["ultimate"] });
    expect(m.intro.skipped).toBe(true);
    expect(m.phase).toBe("intro");
    expect(m.phaseFrames).toBe(47);
    advance(m, 46, { ...neutral(), skipIntro: true });
    expect(m.phase).toBe("intro");
    step(m);
    expect(m.phase).toBe("fight");
    expect(m.fighters[0].state).toBe("idle");
  });
  it("does not permit a unilateral LAN skip; a later second vote jumps to a common announcement", () => {
    const m = new Match(
      characters.samurai,
      { introSkip: "both" },
      characters.dio,
    );
    step(m, { ...neutral(), skipIntro: true });
    advance(m, 25);
    expect(m.intro.skipVotes).toEqual([true, false]);
    expect(m.intro.skipped).toBe(false);
    expect(m.phaseFrames).toBeGreaterThan(47);
    const copy = restore(snapshot(m));
    const accept = { ...neutral(), skipIntro: true };
    step(m, neutral(), accept);
    step(copy, neutral(), accept);
    expect(m.intro.skipVotes).toEqual([true, true]);
    expect(m.intro.skipped).toBe(true);
    expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
    advance(m, 47);
    advance(copy, 47);
    expect(m.phase).toBe("fight");
    expect(copy.phase).toBe("fight");
    expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
  });
  it.each(ids)(
    "restores %s's active entrance and companion timeline without hash divergence",
    (id) => {
      const m = new Match(
        characters[id],
        { introSkip: "both" },
        characters.dio,
      );
      advance(m, 87);
      const copy = restore(snapshot(m));
      for (let i = 0; i < 90; i++) {
        step(m);
        step(copy);
        expect(hashState(snapshot(copy))).toBe(hashState(snapshot(m)));
      }
    },
  );
  it("accepts only a boolean skip edge on the existing bounded input protocol", () => {
    expect(validInput({ ...neutral(), skipIntro: true })).toBe(true);
    expect(validInput({ ...neutral(), skipIntro: false })).toBe(true);
    expect(validInput({ ...neutral(), skipIntro: 1 })).toBe(false);
    expect(validInput({ ...neutral(), skipIntro: true, seat: 1 })).toBe(false);
    expect(validInput({ ...neutral(), pressed: ["skipIntro"] })).toBe(false);
  });
});
