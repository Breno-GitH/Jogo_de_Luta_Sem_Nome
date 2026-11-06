import { describe, it, expect } from "vitest";
import { GameSession } from "../src/game/session";
import { towerFloors, readTower, saveTower } from "../src/game/tower";
import { towerScreen, towerResult } from "../src/ui/tower";
import { characters, type CharacterId } from "../src/engine/characters";
import { vi } from "vitest";
import { neutral } from "../src/engine/types";
import { character } from "../src/engine/combat";
import { HealthBar } from "../src/render/hud";
import { swapPalette } from "../src/render/palette";
import { resultScreen, selectionScreen } from "../src/ui/screens";
import { Sound, effectCue } from "../src/audio/sound";

function advance(session: GameSession, n: number) {
  for (let i = 0; i < n; i++) session.step(neutral());
}
function win(session: GameSession, side: 0 | 1) {
  for (let round = 0; round < 2; round++) {
    session.match.phase = "fight";
    session.match.message = "";
    session.match.fighters[1 - side].health = 0;
    session.step(neutral());
    expect(session.match.phase).toBe("roundEnd");
    advance(session, round === 0 ? 250 : 150);
  }
}
function training() {
  const session = new GameSession("training");
  session.match.fighters[0].x = 500;
  session.match.fighters[1].x = 600;
  return session;
}

describe("Arcade and match flow", () => {
  it("plays all ten best-of-three floors with progressively stronger real BOT parameters", () => {
    const session = new GameSession("arcade");
    expect(session.next()).toBe(false);
    const route = [...session.route];
    let reaction = 27, punish = 0;
    for (const [index, floor] of towerFloors.entries()) {
      expect(session.stage).toBe(index);
      expect(session.currentDifficulty).toBe(floor.tier);
      expect(session.palette).toBe(floor.palette);
      expect(session.match.wins).toEqual([0, 0]);
      expect(session.match.fighters[1].health).toBe(1000);
      expect(session.bot.profile.reaction).toBeLessThan(reaction);
      expect(session.bot.profile.punish).toBeGreaterThan(punish);
      reaction = session.bot.profile.reaction;
      punish = session.bot.profile.punish;
      if ("boss" in floor) expect(towerScreen(session, index)).toContain(`data-tower-boss="${floor.boss}"`);
      win(session, 0);
      expect(session.results[index]).toEqual([2, 0]);
      expect(session.status).toBe(index === 9 ? "victory" : "stageClear");
      expect(towerResult(session, index + 1)).toContain(index === 9 ? "Torre concluída" : "next-opponent");
      expect(session.next()).toBe(index < 9);
      expect(session.route).toEqual(route);
    }
    expect(session.results).toHaveLength(10);
  });
  it("saves completed floors, retries after defeat, and ignores incompatible progress", () => {
    const values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
    try {
      const session = new GameSession("arcade", "normal", "sasuke");
      win(session, 0);
      session.next();
      win(session, 1);
      expect(session.status).toBe("defeat");
      expect(session.next()).toBe(false);
      expect(towerResult(session, 1)).toContain("Derrota no andar 2");
      saveTower(session.tower!);
      const { attempt, best } = readTower();
      expect(best).toBe(1);
      const resumed = new GameSession("arcade", "normal", "samurai", "dio", attempt);
      expect(resumed.characterId).toBe("sasuke");
      expect(resumed.stage).toBe(1);
      expect(resumed.route).toEqual(session.route);
      expect(resumed.tower?.losses).toBe(1);
      expect(resumed.tower?.ticks).toBeGreaterThan(0);
      expect(resumed.match.wins).toEqual([0, 0]);
      expect(resumed.results).toEqual([[2, 0]]);
      saveTower(new GameSession("arcade").tower!);
      expect(readTower().best).toBe(1);
      for (const key of values.keys()) values.set(key, JSON.stringify({ attempt: { ...attempt, schema: 2 }, best: 1 }));
      expect(readTower()).toEqual({ attempt: undefined, best: 1 });
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("versus keeps selected difficulty on restart and resolves victory and defeat", () => {
    for (const side of [0, 1] as const) {
      const session = new GameSession("versus", "hard");
      win(session, side);
      expect(session.status).toBe(side === 0 ? "victory" : "defeat");
      expect(resultScreen(session)).toContain('id="again"');
      session.restart();
      expect(session.bot.difficulty).toBe("hard");
      expect(session.match.rules.training).toBeUndefined();
    }
  });
  it("offers all five fighters and schedules every rival without mirrors or adjacent repeats", () => {
    const ids = Object.keys(characters) as CharacterId[];
    for (const id of ids) {
      expect(selectionScreen("arcade")).toContain(`value="${id}"`);
      const s = new GameSession("arcade", "normal", id);
      expect(s.route).toHaveLength(10);
      expect(new Set(s.route)).toEqual(new Set(ids.filter(other => other !== id)));
      expect(s.route.some((other, i) => other === s.route[i - 1])).toBe(false);
      expect(s.match.fighters[0].data.id).toBe(id);
      expect(s.match.fighters[1].data.id).toBe(s.route[0]);
    }
    expect(selectionScreen("arcade")).not.toContain('id="difficulty"');
  });
});

describe("training rules and measurements", () => {
  it("a jumping dummy and repeated jump presses never restart the jump startup forever", () => {
    const s = training();
    s.training.dummy = "jump";
    for (let i = 0; i < 10; i++) s.step({ ...neutral(), pressed: ["jump"] });
    expect(s.match.fighters.every((f) => f.airborne)).toBe(true);
    advance(s, 100);
    expect(s.match.fighters[1].state).not.toBe("hitstun");
  });
  it("freezes timer, preserves damage and hitstun with infinite health", () => {
    const s = training();
    s.step({ ...neutral(), pressed: ["light"] });
    advance(s, 15);
    expect(s.match.fighters[1].health).toBe(1000);
    expect(s.match.fighters[1].state).toBe("hitstun");
    expect(s.training.damage.fighters[0].lastHit).toBe(45);
    expect(s.training.damage.fighters[0].comboDamage).toBe(45);
    const timer = s.match.timer;
    advance(s, 400);
    expect(s.match.timer).toBe(timer);
    expect(s.match.phase).toBe("fight");
  });
  it("measures every ultimate hit with infinite life and without double counting hitstop", () => {
    const s = training();
    s.training.unlimitedMeter = false;
    s.match.fighters[0].meter = 100;
    s.step({ ...neutral(), pressed: ["ultimate"] });
    advance(s, 230);
    const stats = s.training.damage.fighters[0];
    expect(stats.comboHits).toBe(10);
    expect(stats.comboDamage).toBe(299);
    expect(stats.totalDamage).toBe(299);
    expect(stats.bestDamage).toBe(299);
    expect(s.match.fighters[1].health).toBe(1000);
    expect(s.match.fighters[0].meter).toBe(0);
  });
  it("can disable infinite life, play KO, and automatically restore practice", () => {
    const s = training();
    s.training.infiniteHealth = false;
    s.match.fighters[1].health = 1;
    s.step({ ...neutral(), pressed: ["light"] });
    advance(s, 15);
    expect(s.match.phase).toBe("roundEnd");
    expect(s.match.message).toBe("K.O.");
    advance(s, 160);
    expect(s.match.phase).toBe("fight");
    expect(s.match.fighters[1].health).toBe(1000);
    expect(s.status).toBe("playing");
  });
  it("a lethal ultimate reserves the final hit without inventing extra HP or damage", () => {
    const s = training();
    s.training.infiniteHealth = false;
    s.training.unlimitedMeter = false;
    s.match.fighters[0].meter = 100;
    s.match.fighters[1].health = 30;
    s.step({ ...neutral(), pressed: ["ultimate"] });
    advance(s, 230);
    expect(s.training.damage.fighters[0].totalDamage).toBe(30);
    expect(s.match.phase).toBe("roundEnd");
    expect(s.match.fighters[1].health).toBe(0);
  });
  it("keeps settings on restart, resets metrics and honours finite energy", () => {
    const s = training();
    s.training.dummy = "guard";
    s.training.unlimitedMeter = false;
    s.training.infiniteHealth = false;
    s.restart();
    expect(s.training.dummy).toBe("guard");
    expect(s.training.infiniteHealth).toBe(false);
    expect(s.match.fighters[0].meter).toBe(0);
    s.step({ ...neutral(), pressed: ["ultimate"] });
    expect(s.match.fighters[0].moveId).not.toBe("ultimate_start");
    expect(s.training.damage.fighters[0].totalDamage).toBe(0);
  });
  it("dummy guards in place then regains movement when switched to BOT", () => {
    const s = training();
    s.training.dummy = "guard";
    s.step({ ...neutral(), pressed: ["light"] });
    advance(s, 12);
    expect(s.match.fighters[1].health).toBe(1000);
    expect(s.match.fighters[1].x).toBeGreaterThanOrEqual(600);
    expect(s.match.fighters[1].data.speed).toBe(0);
    expect(s.training.damage.fighters[0].totalDamage).toBe(0);
    s.training.dummy = "bot";
    advance(s, 80);
    expect(s.match.fighters[1].data.speed).toBe(character.speed);
  });
});

describe("presentation polish", () => {
  it("animates damage with a delayed trail, converges and resets on healing", () => {
    const bar = new HealthBar();
    bar.tick(0.7);
    expect(bar.value).toBeGreaterThan(0.7);
    expect(bar.trail).toBe(1);
    for (let i = 0; i < 100; i++) bar.tick(0.7);
    expect(bar.value).toBe(0.7);
    expect(bar.trail).toBeCloseTo(0.7);
    bar.tick(1);
    expect(bar.value).toBe(1);
    expect(bar.trail).toBe(1);
  });
  it("recolours only the exact red ramp and never changes alpha or skin", () => {
    for (const palette of ["amber", "violet"] as const) {
      const pixels = new Uint8ClampedArray([
        180, 33, 50, 255, 255, 208, 160, 255, 180, 33, 50, 0,
      ]);
      const result = swapPalette(pixels, palette);
      expect([...result.slice(0, 3)]).not.toEqual([180, 33, 50]);
      expect([...result.slice(4, 8)]).toEqual([255, 208, 160, 255]);
      expect([...result.slice(8)]).toEqual([180, 33, 50, 0]);
      expect(result[3]).toBe(255);
    }
  });
  it("audio is optional and maps impacts to distinct sound cues", async () => {
    const sound = new Sound();
    await sound.unlock();
    expect(() => sound.play("ko")).not.toThrow();
    expect(
      effectCue({ x: 0, y: 0, life: 10, blocked: true, kind: "guard" }),
    ).toBe("guard");
    expect(
      effectCue({ x: 0, y: 0, life: 10, blocked: false, kind: "ultimate" }),
    ).toBe("heavy");
    sound.setEnabled(false);
    expect(sound.enabled).toBe(false);
  });
});
