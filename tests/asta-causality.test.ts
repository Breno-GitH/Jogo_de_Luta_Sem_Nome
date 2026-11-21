import { describe, it, expect } from "vitest";
import { Match, Fighter } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral, type InputFrame } from "../src/engine/types";
import {
  recordAstaDamage,
  recoverableAstaHealth,
  causalityBalance,
  stepAstaCausality,
} from "../src/engine/asta-causality";
import {
  stepAstaAntimagic,
  causalityVolumes,
  causalityRibbons,
  neutralizableEnergy,
} from "../src/engine/asta-antimagic";
import { addCombatStatus } from "../src/engine/status-effects";
import { practiceSword } from "../src/engine/asta-stances";
import { snapshot, restore, hashState } from "../src/engine/state";
function arena() {
  const m = new Match(characters.asta, { training: true }, characters.goku);
  m.phase = "fight";
  const [a, b] = m.fighters;
  a.x = 400;
  b.x = 900;
  const step = (i: Partial<InputFrame> = {}) =>
    m.step([{ ...neutral(), ...i }, neutral()]);
  const loss = (amount: number) => {
    const actual = Math.min(a.health, amount);
    a.health -= actual;
    recordAstaDamage(a, actual);
  };
  const cast = () => {
    expect(a.attack("astaCausalityBreak")).toBe(true);
    for (let t = 0; t < 55; t++) step();
  };
  return { m, a, b, step, loss, cast };
}
describe("Causality Break: bounded authoritative recent-damage restoration", () => {
  it.each([
    [150, 45],
    [400, 60],
    [101, 30],
    [1, 0],
  ])(
    "restores %i recent damage by the configured capped ratio: %i HP",
    (damage, heal) => {
      const p = arena();
      p.loss(damage);
      expect(recoverableAstaHealth(p.a)).toBe(heal);
      p.cast();
      expect(p.a.health).toBe(1000 - damage + heal);
      expect(p.a.asta!.causalityResult?.hp).toBe(heal);
      expect(p.a.asta!.equipped).toBe("destroyer");
      expect(p.a.asta!.restorationReadyAt > 0).toBe(heal > 0);
      expect(p.a.attackShapes()).toHaveLength(0);
    },
  );
  it("does not recover old damage, heal past maximum HP, or resurrect after KO", () => {
    const p = arena();
    p.loss(200);
    p.m.combatFrame = causalityBalance.recentTicks;
    p.cast();
    expect(p.a.health).toBe(800);
    const q = arena();
    q.loss(200);
    q.a.health = 990;
    q.cast();
    expect(q.a.health).toBe(1000);
    const z = arena();
    z.loss(1000);
    expect(z.a.attack("astaCausalityBreak")).toBe(false);
    z.a.moveId = "astaCausalityBreak";
    z.a.state = "attack";
    z.a.stateFrame = 24;
    stepAstaCausality(z.a);
    expect(z.a.health).toBe(0);
  });
  it("records actual combat damage once, with no debt from infinite-health training", () => {
    for (const infinite of [false, true]) {
      const p = arena();
      p.a.x = 500;
      p.b.x = 585;
      if (infinite) p.m.rules.infiniteHealth = [true, false];
      p.b.attack("stand_light");
      for (let t = 0; t < 50; t++) p.step();
      const debt = p.a.asta!.recentDamage.reduce((n, x) => n + x.amount, 0);
      expect(debt).toBe(1000 - p.a.health);
      expect(debt > 0).toBe(!infinite);
      if (!infinite) expect(p.a.asta!.recentDamage).toHaveLength(1);
    }
  });
  it("claims contributing events once, even if a restore phase or cooldown is maliciously replayed", () => {
    const p = arena();
    p.loss(150);
    p.cast();
    const hp = p.a.health,
      cast = p.a.asta!.cast;
    p.a.state = "attack";
    p.a.moveId = "astaCausalityBreak";
    p.a.stateFrame = 24;
    stepAstaCausality(p.a);
    expect(p.a.health).toBe(hp);
    p.a.asta!.restorationReadyAt = 0;
    p.a.asta!.restoredCast = -1;
    p.a.asta!.cast = cast + 1;
    stepAstaCausality(p.a);
    expect(p.a.health).toBe(hp);
    expect(p.a.asta!.recentDamage.every((x) => x.claimed)).toBe(true);
    expect(p.a.asta!.recentDamage.reduce((n, x) => n + x.restored, 0)).toBe(45);
  });
  it("keeps a deterministic twenty-second restoration cooldown across other attacks and sword changes", () => {
    const p = arena();
    p.loss(200);
    p.cast();
    const ready = p.a.asta!.restorationReadyAt;
    p.loss(100);
    p.cast();
    expect(p.a.health).toBe(760);
    practiceSword(p.a, "slasher");
    p.a.attack("astaIaiSlash");
    for (let t = 0; t < 40; t++) p.step();
    expect(p.a.asta!.restorationReadyAt).toBe(ready);
    p.m.combatFrame = ready;
    p.loss(100);
    p.cast();
    expect(p.a.health).toBe(690);
  });
  it("interrupts before restoration, offers no physical invulnerability, and has uncancellable recovery", () => {
    const p = arena();
    p.loss(150);
    p.a.attack("astaCausalityBreak");
    for (let t = 0; t < 12; t++) p.step();
    p.a.setState("hitstun");
    for (let t = 0; t < 55; t++) p.step();
    expect(p.a.health).toBe(850);
    expect(p.a.asta!.restorationReadyAt).toBe(0);
    const q = arena();
    q.a.x = 500;
    q.b.x = 585;
    q.a.attack("astaCausalityBreak");
    q.b.attack("stand_light");
    for (let t = 0; t < 60; t++) q.step();
    expect(q.a.health).toBeLessThan(1000);
    expect(q.a.invulnerable).toBe(false);
    const z = arena();
    z.loss(150);
    z.a.attack("astaCausalityBreak");
    for (let t = 0; t < 25; t++) z.step();
    expect(z.a.health).toBe(895);
    expect(z.a.attack("astaBlackRush")).toBe(false);
    z.step({ pressed: ["light"] });
    expect(z.a.moveId).toBe("astaCausalityBreak");
  });
  it("cleans only temporary removable magical metadata even while healing is on cooldown", () => {
    const p = arena();
    p.a.asta!.restorationReadyAt = 1000;
    for (const [id, origin, removal, expiresAt] of [
      ["magic", "magic", "causality", 500],
      ["physical", "physical", "causality", 500],
      ["protected", "magic", "none", 500],
      ["permanent", "magic", "causality", null],
    ] as const)
      addCombatStatus(p.a, {
        id,
        kind: "spellDebuff",
        origin,
        removal,
        expiresAt,
      });
    p.cast();
    expect(p.a.statusEffects?.map((x) => x.id)).toEqual([
      "physical",
      "protected",
      "permanent",
    ]);
    expect(p.a.asta!.causalityResult).toMatchObject({
      hp: 0,
      cleansed: ["magic"],
    });
    expect(p.a.asta!.restorationReadyAt).toBe(1000);
  });
  it("replays the damage ledger, removal and HP restoration identically from a snapshot", () => {
    const p = arena();
    p.loss(150);
    addCombatStatus(p.a, {
      id: "test-burn",
      kind: "magicBurn",
      origin: "magic",
      removal: "causality",
      expiresAt: 500,
    });
    p.a.attack("astaCausalityBreak");
    for (let t = 0; t < 18; t++) p.step();
    const q = restore(snapshot(p.m));
    for (let t = 0; t < 80; t++) {
      p.step();
      q.step([neutral(), neutral()]);
      expect(hashState(snapshot(q))).toBe(hashState(snapshot(p.m)));
    }
    expect(p.a.health).toBe(895);
    expect(p.a.statusEffects).toBeUndefined();
  });
  it("draws five changing blade-origin extensions only during the neutralization window", () => {
    const p = arena();
    p.a.attack("astaCausalityBreak");
    expect(causalityRibbons(p.a, 11)).toHaveLength(0);
    expect(causalityRibbons(p.a, 18)).toHaveLength(5);
    expect(causalityRibbons(p.a, 18)).not.toEqual(causalityRibbons(p.a, 19));
    expect(causalityRibbons(p.a, 32)).toHaveLength(0);
    p.a.stateFrame = 18;
    const volumes = causalityVolumes(p.a);
    expect(volumes).toHaveLength(60);
    expect(
      volumes.every(
        (v) =>
          Number.isFinite(v.a.x) &&
          Number.isFinite(v.b.y) &&
          Math.hypot(v.b.x - v.a.x, v.b.y - v.a.y) < 22,
      ),
    ).toBe(true);
  });
  it("neutralizes at most three eligible energies per cast and never physical attacks or Supers", () => {
    const p = arena();
    p.a.attack("astaCausalityBreak");
    p.a.stateFrame = 18;
    const shape = causalityVolumes(p.a)[2];
    for (const id of [1, 2, 3, 4])
      p.m.kiProjectiles.push({
        id,
        owner: 1,
        move: "ki_light",
        cast: 1,
        x: shape.b.x,
        y: shape.b.y,
        previousX: shape.b.x,
        previousY: shape.b.y,
        vx: -8,
        vy: 0,
        facing: -1,
        radius: 12,
        age: 0,
        life: 80,
        state: "flight",
        impactAge: 0,
      });
    for (let t = 0; t < 4; t++) stepAstaAntimagic(p.m);
    expect(p.a.asta!.neutralized).toBe(3);
    expect(p.m.kiProjectiles.filter((x) => x.state === "impact")).toHaveLength(
      3,
    );
    for (const move of ["ultimate_start", "gokuFury", "stand_light"])
      expect(neutralizableEnergy(p.b, { move } as never)).toBe(false);
  });
  it("uses explicit compatibility metadata for future magic without classifying by graphics", () => {
    const p = arena();
    const move = {
      ...p.b.data.specialMoves!.ki_light,
      energy: { nature: "magic" as const, causalityBreak: true },
    };
    const owner = new Fighter(
      {
        ...p.b.data,
        specialMoves: {
          futureSpell: move,
          physicalSpell: {
            ...move,
            energy: { nature: "physical", causalityBreak: true },
          },
          protectedSpell: {
            ...move,
            energy: { nature: "magic", causalityBreak: false },
          },
          superSpell: { ...move, super: true },
        },
      },
      1,
      p.b.x,
    );
    expect(neutralizableEnergy(owner, { move: "futureSpell" } as never)).toBe(
      true,
    );
    for (const move of ["physicalSpell", "protectedSpell", "superSpell"])
      expect(neutralizableEnergy(owner, { move } as never)).toBe(false);
  });
  it("keeps beam dissipation at the blade contact and allows a flying Black Slash to clash with compatible energy", () => {
    const p = arena();
    p.a.attack("astaCausalityBreak");
    p.a.stateFrame = 18;
    const shape = causalityVolumes(p.a)[2];
    p.m.beams.push({
      id: 1,
      owner: 1,
      move: "kamehameha_light",
      cast: 1,
      facing: -1,
      x: shape.b.x + 100,
      y: shape.b.y,
      length: 140,
      radius: 16,
      age: 0,
      life: 50,
      state: "active",
      hitIds: [],
      impactAge: 0,
    });
    stepAstaAntimagic(p.m);
    expect(p.m.beams[0].state).toBe("dissipate");
    expect(p.a.asta!.neutralized).toBe(1);
    const q = arena();
    q.a.attack("astaBlackSlash");
    for (let t = 0; t < 29; t++) q.step();
    const slash = q.m.kiProjectiles[0];
    q.m.kiProjectiles.push({
      id: ++q.m.projectileSerial,
      owner: 1,
      move: "ki_light",
      cast: 1,
      x: slash.x,
      y: slash.y,
      previousX: slash.x,
      previousY: slash.y,
      vx: -8,
      vy: 0,
      facing: -1,
      radius: 14,
      age: 0,
      life: 80,
      state: "flight",
      impactAge: 0,
    });
    stepAstaAntimagic(q.m);
    expect(q.m.kiProjectiles.every((x) => x.state === "impact")).toBe(true);
  });
});
