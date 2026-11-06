import { describe, it, expect } from "vitest";
import { GameSession } from "../src/game/session";
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
  it("plays three real best-of-three confrontations with distinct palettes and increasing difficulty", () => {
    const session = new GameSession("arcade");
    expect(session.next()).toBe(false);
    for (const [index, difficulty, palette] of [
      [0, "easy", "cyan"],
      [1, "normal", "amber"],
      [2, "hard", "violet"],
    ] as const) {
      expect(session.stage).toBe(index);
      expect(session.currentDifficulty).toBe(difficulty);
      expect(session.palette).toBe(palette);
      expect(session.match.wins).toEqual([0, 0]);
      expect(session.match.fighters[0].health).toBe(1000);
      win(session, 0);
      expect(session.results[index]).toEqual([2, 0]);
      expect(session.status).toBe(index === 2 ? "victory" : "stageClear");
      expect(resultScreen(session)).toContain(
        index === 2 ? "Arcade concluído" : "next-opponent",
      );
      expect(session.next()).toBe(index < 2);
    }
    expect(session.results).toHaveLength(3);
    expect(session.stage).toBe(2);
  });
  it("defeat allows retrying the current opponent without losing earlier progress", () => {
    const session = new GameSession("arcade");
    win(session, 0);
    session.next();
    win(session, 1);
    expect(session.status).toBe("defeat");
    expect(session.next()).toBe(false);
    expect(resultScreen(session)).toContain("Derrota");
    session.restart();
    expect(session.stage).toBe(1);
    expect(session.currentDifficulty).toBe("normal");
    expect(session.status).toBe("playing");
    expect(session.match.wins).toEqual([0, 0]);
    expect(session.results[0]).toEqual([2, 0]);
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
  it("offers the same four fighters in every local selection", () => {
    for (const id of ["samurai", "dio", "goku", "luffy"])
      expect(selectionScreen("arcade")).toContain(`value="${id}"`);
    expect(selectionScreen("arcade")).not.toContain('id="difficulty"');
    expect(selectionScreen("versus")).toContain('value="samurai"');
  });
  it("builds three distinct non-mirror opponents for each selected fighter", () => {
    for (const id of ["samurai", "dio", "goku", "luffy"] as const) {
      const s = new GameSession("arcade", "easy", id);
      expect(s.route).toHaveLength(3);
      expect(new Set(s.route).size).toBe(3);
      expect(s.route).not.toContain(id);
      for (const enemy of s.route) {
        expect(s.match.fighters[1].data.id).toBe(enemy);
        win(s, 0);
        if (s.status === "stageClear") expect(s.next()).toBe(true);
      }
      expect(s.status).toBe("victory");
    }
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
