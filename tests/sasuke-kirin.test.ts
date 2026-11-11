import { describe, expect, it } from "vitest";
import { characters, characterById } from "../src/engine/characters";
import { FLOOR, Match, type CombatHit } from "../src/engine/combat";
import { kirinConfig, kirinCurseOpener, kirinId, kirinScene } from "../src/engine/sasuke-kirin";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";

function fight(opponent = "samurai", direction: 1 | -1 = 1, gap = 57, corner = false) {
  const m = new Match(characters.sasuke, {}, characterById(opponent));
  m.phase = "fight";
  const [a, b] = m.fighters;
  b.x = corner ? (direction === 1 ? 1240 : 40) : 640 + direction * gap;
  a.x = b.x - direction * gap;
  a.facing = direction;
  b.facing = -direction;
  const hits: CombatHit[] = [];
  const tick = (attack?: Partial<InputFrame>, victim?: Partial<InputFrame>) => {
    m.step([{ ...neutral(), ...attack }, { ...neutral(), ...victim }]);
    hits.push(...m.hits);
  };
  const run = (ticks: number, victim?: Partial<InputFrame>) => {
    for (let i = 0; i < ticks; i++) tick(undefined, victim);
  };
  const until = (predicate: () => boolean, ticks = 300) => {
    for (let i = 0; i < ticks && !predicate(); i++) tick();
    expect(predicate()).toBe(true);
  };
  const ultimate = () => tick({ pressed: ["ultimate"] });
  const confirm = () => {
    a.meter = a.meterMaximum;
    ultimate();
    expect(a.moveId).toBe(kirinId);
    until(() => !!m.kirin, 30);
  };
  return { m, a, b, hits, tick, run, until, ultimate, confirm };
}

describe("Kirin", () => {
  it("requires a full stock, builds meter in combat, and spends once on the R edge", () => {
    const { a, m, tick, run, ultimate } = fight();
    a.meter = a.meterMaximum - 1;
    ultimate();
    expect(a.moveId).toBe("");
    expect(a.meter).toBe(a.meterMaximum - 1);
    tick({ pressed: ["light"] });
    run(30);
    expect(a.meter).toBe(a.meterMaximum);
    expect(m.kirin).toBeUndefined();
    ultimate();
    expect(a.moveId).toBe(kirinId);
    expect(a.meter).toBe(0);
    run(24);
    expect(a.meter).toBe(0);
  });

  it("confirms through ordinary guard and spends the stock", () => {
    const { a, b, m, tick, run, hits } = fight("samurai", 1, 57, true);
    a.meter = a.meterMaximum;
    const guard = { direction: 1 } as const;
    tick({ pressed: ["ultimate"] }, guard);
    run(60, guard);
    expect(hits.map(h => [h.move, h.damage, h.blocked])).toEqual([[kirinId, kirinConfig.opening.damage, false]]);
    expect(b.health).toBe(b.data.health - kirinConfig.opening.damage);
    expect(a.meter).toBe(0);
    expect(m.kirin).toBeDefined();
    expect(a.state).toBe("cinematic");
  });

  it("never captures on whiff or after the startup is interrupted", () => {
    const far = fight("samurai", 1, 520);
    far.a.meter = far.a.meterMaximum;
    far.ultimate();
    far.run(60);
    expect(far.a.meter).toBe(0);
    expect(far.m.kirin).toBeUndefined();
    expect(far.hits).toHaveLength(0);
    const close = fight("goku");
    close.a.meter = close.a.meterMaximum;
    close.tick({ pressed: ["ultimate"] }, { pressed: ["light"] });
    close.run(60);
    expect(close.hits.some(hit => hit.attacker === 1)).toBe(true);
    expect(close.hits.some(hit => hit.move === kirinId)).toBe(false);
    expect(close.m.kirin).toBeUndefined();
    expect(close.a.meter).toBeLessThan(close.a.meterMaximum);
  });

  it.each(["samurai", "dio", "goku", "luffy", "sasuke"])(
    "runs the full shared sequence against %s on both sides, including corners",
    (opponent) => {
      for (const side of [1, -1] as const) {
        const { a, b, m, hits, tick, confirm } = fight(opponent, side, 57, true);
        confirm();
        const startTime = m.timer;
        const phases = new Set<string>();
        const boss = new Set<number>();
        let zoom = 1, hold = 0;
        for (let i = 0; i < 270 && m.kirin; i++) {
          const stage = kirinScene(m.kirin);
          phases.add(stage.phase);
          if (stage.dragon.visible) boss.add(stage.dragon.cel);
          zoom = Math.max(zoom, stage.camera.scale);
          if (stage.phase === "impact") hold = Math.max(hold, m.kirin.hold);
          tick({ pressed: ["jump", "heavy"] });
          expect(a.x).toBeGreaterThanOrEqual(40);
          expect(b.x).toBeLessThanOrEqual(1240);
        }
        expect([...phases]).toEqual(["prepare", "storm", "reveal", "command", "dive", "impact", "clear"]);
        expect([...boss]).toEqual([0, 1, 2, 3]);
        expect(zoom).toBeGreaterThan(1.25);
        expect(hold).toBe(kirinConfig.hits[0].hold);
        expect(m.timer).toBe(startTime);
        expect(m.kirin).toBeUndefined();
        expect(a.state).toBe("idle");
        expect(b.knockedDown).toBe(true);
        expect(b.y).toBe(FLOOR);
        expect(b.health).toBe(b.data.health - kirinConfig.opening.damage - kirinConfig.hits[0].damage);
        expect(hits.map(hit => hit.move)).toEqual([kirinId, "kirin_ground"]);
      }
    },
  );

  it("starts from a confirmed normal as a scaled combo finisher", () => {
    const { a, b, m, tick, until } = fight();
    a.meter = a.meterMaximum;
    tick({ pressed: ["light"] });
    until(() => a.hitConfirmed, 15);
    tick({ pressed: ["ultimate"] });
    until(() => !!m.kirin, 32);
    expect(m.kirin?.scale).toBeLessThan(1);
    expect(b.combo).toBe(2);
  });

  it.each([false, true])("preserves Curse Mark and safely resolves pending expiry = %s", expire => {
    const { a, m, tick, until, confirm } = fight();
    a.sasukeCurse = { phase: "active", remaining: expire ? 7 : 600, airBurstUsed: false, airBurstTick: 0 };
    confirm();
    const mark = a.sasukeCurse!;
    expect(m.kirin?.cursed).toBe(true);
    expect(mark.phase).toBe(expire ? "ending" : "active");
    const left = mark.remaining;
    until(() => !m.kirin);
    expect(mark.remaining).toBe(left);
    tick();
    expect(mark.phase).toBe(expire ? "reverting" : "active");
  });

  it("uses the distinct Curse opener, with its own palm geometry", () => {
    const { a, ultimate } = fight();
    a.sasukeCurse = { phase: "active", remaining: 650, airBurstUsed: false, airBurstTick: 0 };
    a.meter = a.meterMaximum;
    ultimate();
    expect(a.move).toBe(kirinCurseOpener);
  });

  it("accumulates Katon weather at emission, reads it at confirmation, and clears it on release", () => {
    const { a, b, m, tick, until, confirm } = fight("samurai", 1, 320);
    const fire = (button: "light" | "heavy") => {
      tick({ down: true });
      tick({ direction: -1, pressed: [button] });
    };
    fire("light");
    expect(m.sasukeStormLevel).toBe(0);
    until(() => m.sasukeStormLevel === 1);
    until(() => !a.moveId);
    fire("heavy");
    until(() => m.sasukeStormLevel === kirinConfig.weather.maximum);
    until(() => !a.moveId);
    until(() => !m.kiProjectiles.length, 100);
    b.x = a.x + 57;
    confirm();
    expect(m.kirin?.storm).toBe(kirinConfig.weather.maximum);
    expect(kirinScene(m.kirin!).clouds).toBeGreaterThan(0);
    until(() => !m.kirin);
    expect(m.sasukeStormLevel).toBe(0);
    expect(m.sasukeStormUntil).toBe(0);
  });

  it("holds KO until the final release and replays identically from a server snapshot", () => {
    const { m, b, tick, confirm } = fight();
    b.health = 18;
    confirm();
    expect(b.health).toBe(1);
    const replica = restore(snapshot(m));
    while (m.kirin) {
      tick();
      replica.step([neutral(), neutral()]);
      expect(hashState(snapshot(m))).toBe(hashState(snapshot(replica)));
      if (m.kirin) expect(m.phase).toBe("fight");
    }
    expect(b.health).toBe(0);
    expect(m.phase).not.toBe("fight");
    expect(m.wins[0]).toBe(1);
  });
});
