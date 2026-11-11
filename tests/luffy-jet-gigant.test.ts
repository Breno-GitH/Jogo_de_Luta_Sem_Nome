import { describe, expect, it } from "vitest";
import { characterById } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import {
  jetConfig,
  jetId,
  jetOpener,
  jetScene,
} from "../src/engine/luffy-jet-gigant";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";
import { luffyAnimations } from "../src/render/luffy-animations";
import { FighterPresentation } from "../src/render/presentation";

function fixture(
  opponent = "samurai",
  side: 1 | -1 = 1,
  targetX = 660,
  gap = 175,
) {
  const m = new Match(characterById("luffy"), {}, characterById(opponent));
  m.phase = "fight";
  const [luffy, victim] = m.fighters;
  luffy.x = targetX - side * gap;
  victim.x = targetX;
  luffy.facing = side;
  victim.facing = -side;
  luffy.meter = luffy.meterMaximum;
  return { m, luffy, victim };
}
const r = (): InputFrame => ({ ...neutral(), pressed: ["ultimate"] });
const advance = (m: Match, count: number, foe = neutral()) => {
  for (let i = 0; i < count; i++) m.step([neutral(), foe]);
};

describe("Gomu Gomu no Jet Gigant", () => {
  it("requires a full bar and never accepts directional inputs as its Super", () => {
    const { m, luffy } = fixture();
    luffy.meter = luffy.meterMaximum - 1;
    m.step([r(), neutral()]);
    expect(luffy.moveId).toBe("");
    expect(luffy.meter).toBe(99);
    luffy.meter = luffy.meterMaximum;
    for (let i = 0; i < 2; i++) {
      m.step([{ ...neutral(), down: true }, neutral()]);
      m.step([
        { ...neutral(), direction: 1, pressed: i ? ["heavy"] : [] },
        neutral(),
      ]);
    }
    expect(luffy.moveId).not.toBe(jetId);
    expect(luffy.meter).toBe(100);
  });

  it("charges normally through combat and cannot activate in the air", () => {
    const { m, luffy } = fixture("samurai", 1, 602, 58);
    luffy.meter = 0;
    m.step([{ ...neutral(), pressed: ["light"] }, neutral()]);
    advance(m, 45);
    expect(luffy.meter).toBeGreaterThan(0);
    luffy.meter = 100;
    m.step([{ ...neutral(), pressed: ["jump"] }, neutral()]);
    advance(m, 8);
    expect(luffy.airborne).toBe(true);
    m.step([r(), neutral()]);
    expect(luffy.moveId).toBe("");
    expect(luffy.meter).toBe(100);
  });

  it.each(["whiff", "punished"] as const)(
    "spends exactly one bar with a normal %s recovery",
    (result) => {
      const { m, luffy, victim } = fixture(
        "samurai",
        1,
        result === "whiff" ? 850 : 660,
        result === "whiff" ? 500 : result === "punished" ? 70 : 160,
      );
      m.step([r(), neutral()]);
      expect(luffy.moveId).toBe(jetId);
      expect(luffy.meter).toBe(0);
      const initialHp = luffy.health;
      if (result === "punished")
        m.step([neutral(), { ...neutral(), pressed: ["light"] }]);
      for (let i = 0; i < 138; i++) {
        m.step([neutral(), neutral()]);
        expect(m.jetGigant).toBeUndefined();
      }
      expect(luffy.health < initialHp).toBe(result === "punished");
      expect(victim.health).toBe(victim.data.health);
      expect(luffy.state).toBe("idle");
      expect(jetOpener(luffy)).toBeUndefined();
      expect(luffy.attackShapes()).toEqual([]);
    },
  );

  it.each([
    ["samurai", 1, 660],
    ["dio", -1, 620],
    ["goku", 1, 1226],
    ["luffy", -1, 54],
  ] as const)(
    "runs all stages against %s, side %s at x=%s",
    (opponent, side, x) => {
      const { m, luffy, victim } = fixture(opponent, side, x);
      const presentation = new FighterPresentation(luffyAnimations);
      m.step([r(), neutral()]);
      const startup = new Set<number>();
      for (let i = 0; !m.jetGigant && i < 90; i++) {
        presentation.tick(luffy);
        startup.add(presentation.animator.frame());
        m.step([neutral(), neutral()]);
        if (!m.jetGigant && luffy.stateFrame < jetConfig.startup)
          expect(luffy.attackShapes()).toEqual([]);
      }
      expect(startup.size).toBeGreaterThanOrEqual(7);
      expect(m.jetGigant).toBeDefined();
      expect(victim.state).toBe("grabbed");
      const phases = new Set<string>(),
        cels = new Set<string>(),
        fists = new Set<number>();
      const impacts: string[] = [];
      const timer = m.timer;
      const replay = restore(snapshot(m));
      let took = 0;
      while (m.jetGigant && took++ < 520) {
        const scene = jetScene(m.jetGigant);
        phases.add(scene.phase);
        cels.add(scene.cel);
        for (const limb of scene.limbs)
          if (limb.giant !== undefined) fists.add(limb.giant);
        for (const f of m.fighters) {
          expect(f.x).toBeGreaterThanOrEqual(40);
          expect(f.x).toBeLessThanOrEqual(1240);
          expect(f.y).toBeLessThanOrEqual(FLOOR);
          expect(f.attackShapes()).toEqual([]);
        }
        expect(m.timer).toBe(timer);
        expect(luffy.canStartSuper()).toBe(false);
        const input: [InputFrame, InputFrame] = [
          { ...r(), direction: side },
          { ...neutral(), pressed: ["jump", "heavy"] },
        ];
        m.step(input);
        replay.step(input);
        expect(hashState(snapshot(m))).toBe(hashState(snapshot(replay)));
        impacts.push(...m.hits.map((hit) => hit.move));
      }
      expect([...phases]).toEqual([
        "jetPistol",
        "jetBazooka",
        "jetGatling",
        "gearThird",
        "gigantPistol",
        "return",
      ]);
      expect(fists.size).toBe(8);
      expect(cels).toContain("small");
      expect(cels).toContain("growing");
      expect(cels).toContain("base");
      expect(impacts).toEqual(jetConfig.hits.map((hit) => "jet_" + hit.kind));
      expect(victim.health).toBe(
        victim.data.health -
          jetConfig.initialDamage -
          jetConfig.hits.reduce((sum, hit) => sum + hit.damage, 0),
      );
      expect(m.phase).toBe("fight");
      expect(m.cinematicActive).toBe(false);
      expect(victim.knockedDown).toBe(true);
      expect(luffy.state).toBe("idle");
      expect(luffy.actionClip).toBe("");
      m.step([{ ...neutral(), direction: -side as 1 | -1 }, neutral()]);
      expect(luffy.state).toBe("walk");
    },
  );

  it("defers KO through landing and size recovery", () => {
    const { m, victim } = fixture();
    victim.health = 40;
    m.step([r(), neutral()]);
    advance(m, 70);
    expect(m.jetGigant).toBeDefined();
    while (m.jetGigant && m.jetGigant.tick < 320) {
      m.step([neutral(), neutral()]);
      expect(m.phase).toBe("fight");
    }
    expect(victim.health).toBe(0);
    advance(m, 110);
    expect(m.phase).toBe("roundEnd");
    expect(m.wins[0]).toBe(1);
    expect(victim.state).toBe("ko");
    expect(m.jetGigant).toBeUndefined();
  });
});
