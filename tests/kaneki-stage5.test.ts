import { expect, it } from "vitest";
import { FLOOR, Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { chainFinishes, kaguneGrabLimit, resistanceButton, type ChainButton, type ChainRoute } from "../src/engine/kaneki-chain";
import { kanekiTechnique, kanekiTechniques } from "../src/engine/kaneki-specials";
import { kanekiOffensiveKagunes } from "../src/engine/kaneki-combat";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral } from "../src/engine/types";

function duel(move: string, gap: number, side: -1 | 1 = 1, edge = false) {
  const m = new Match(characters.kaneki, {}, characters.sasuke);
  m.phase = "fight";
  const [a,b] = m.fighters;
  a.x = edge ? side === 1 ? 1237 - gap : 43 + gap : 620;
  b.x = a.x + side * gap;
  a.facing = side; b.facing = -side;
  const technique = kanekiTechnique(move)!;
  const step = (press?: ChainButton, defense?: ChainButton) =>
    m.step([{ ...neutral(), pressed: press ? [press] : [] }, { ...neutral(), pressed: defense ? [defense] : [] }]);
  const chain = () => m.capture?.kaneki?.chain;
  const until = (condition: () => unknown, limit = 130) => {
    for (let i=0; i<limit && !condition(); i++) step();
    expect(condition()).toBeTruthy();
  };
  const command = () => {
    m.step([{ ...neutral(), down:true }, neutral()]);
    const rush = technique.family === "rinkakuRush";
    if (rush) step();
    const direction = rush ? 0 : technique.family === "kaguneGrab" ? side : -side as -1 | 1;
    m.step([{ ...neutral(), direction, down:rush, pressed:[technique.strength] }, neutral()]);
    expect(a.moveId).toBe(move);
  };
  const open = () => { command(); until(chain, 52); };
  const choose = (first: ChainButton, second?: ChainButton) => {
    until(() => chain()?.phase === "choice1");
    step(first);
    if (second) {
      until(() => chain()?.phase === "choice2" && !m.hitstop);
      step(second);
    }
    until(() => chain()?.phase === "finisher");
  };
  return { m, a, b, step, chain, until, open, command, choose };
}

for (const t of kanekiTechniques.filter(t => t.family === "kaguneGrab")) {
  it.each([1,-1] as const)("reaches its nominal max in both directions " + t.id + " %s", side => {
    const f = duel(t.id,t.reach-3,side);
    const x = f.a.x;
    f.open();
    expect(f.a.x).toBe(x);
    expect(f.chain()?.origin).toBe("kaguneGrab");
    const points = kanekiOffensiveKagunes(f.a,FLOOR)[0].spine;
    expect(Math.abs(points.at(-1)!.x - f.a.x)).toBeGreaterThan(240);
    expect(Math.abs(points.at(-1)!.x - f.b.x)).toBeLessThan(40);
    const miss = duel(t.id,t.reach+45,side);
    miss.command();
    for (let i=0; i<85; i++) {
      miss.step(); expect(miss.m.capture).toBeUndefined();
    }
  });
}

it.each([false,true])("has a single exact 300-tick deadline across choices (%s)", continued => {
  const f = duel("kaguneGrab_light",248);
  f.open();
  const start = f.m.frame;
  while (f.m.frame - start < 299) {
    f.step(continued && f.m.frame - start === 245 ? "light" : undefined);
    expect(f.m.capture).toBeDefined();
    expect(f.chain()!.started).toBe(start);
    if (f.m.frame - start === 290 && continued) expect(f.chain()!.phase).toBe("choice2");
  }
  f.m.hitstop = 6; // Hitstop cannot postpone expiry.
  f.step();
  expect(f.m.frame - start).toBe(kaguneGrabLimit);
  expect(f.m.capture).toBeUndefined();
  expect(f.b.state).toBe("hitstun");
  expect(f.a.state).toBe("throwRecover");
});

it("breaks a long grip with three distinct prompted presses even before a continuation", () => {
  const f = duel("kaguneGrab_light",260);
  f.open();
  const start = f.m.frame;
  for (let i=0;i<19;i++) f.step(undefined,"light");
  expect(f.chain()?.resistance).toBe(1);
  f.step(undefined,resistanceButton(f.chain()!));
  expect(f.chain()?.resistance).toBe(2);
  for (let i=0;i<12;i++) f.step();
  f.step(undefined,resistanceButton(f.chain()!));
  expect(f.m.capture).toBeUndefined();
  expect(f.m.frame-start).toBeLessThan(60);
  expect(f.b.health).toBe(f.b.data.health);
  expect(f.m.events.some(e => e.kind === "chainEscape")).toBe(true);
});

const paths: [string, number, ChainButton, ChainButton | undefined, ChainRoute][] = [
  ["kaguneGrab_light",263,"light","light","rinkakuCombo"],
  ["kaguneGrab_light",263,"light","medium","redSpiral"],
  ["kaguneGrab_light",263,"light","heavy","centipedeDrop"],
  ["kaguneGrab_medium",310,"medium","light","quickSwing"],
  ["kaguneGrab_medium",310,"medium","medium","doubleSwing"],
  ["kaguneGrab_medium",310,"medium","heavy","redCatapult"],
  ["kaguneGrab_heavy",365,"heavy","light","aerialSnatch"],
  ["kaguneGrab_heavy",365,"heavy","medium","rinkakuCyclone"],
  ["kaguneGrab_heavy",365,"heavy","heavy","centipedeMeteor"],
  ["fourSwords_light",96,"light",undefined,"swordsRecall"],
  ["fourSwords_medium",119,"medium",undefined,"swordsSide"],
  ["fourSwords_heavy",170,"heavy",undefined,"swordsRise"],
  ["rinkakuRush_light",198,"light",undefined,"rushReel"],
  ["rinkakuRush_light",198,"medium",undefined,"rushQuickThrow"],
  ["rinkakuRush_light",198,"heavy",undefined,"rushShortLift"],
  ["rinkakuRush_medium",214,"light",undefined,"rushCrossover"],
  ["rinkakuRush_medium",214,"medium",undefined,"rushSpinThrow"],
  ["rinkakuRush_medium",214,"heavy",undefined,"rushAirSet"],
  ["rinkakuRush_heavy",246,"light",undefined,"rushDragStrike"],
  ["rinkakuRush_heavy",246,"medium",undefined,"rushHeavyThrow"],
  ["rinkakuRush_heavy",246,"heavy",undefined,"rushSlam"],
];
for (const [move, gap, first, second, finish] of paths) {
  it(finish + " uses its own deterministic trajectory", () => {
    const f = duel(move,gap,-1);
    f.open(); f.choose(first,second);
    expect(f.chain()?.finish).toBe(finish);
    const replica = restore(snapshot(f.m));
    const config = chainFinishes[finish];
    const before = f.b.health;
    let height=0, crossed=false;
    for (let i=0;i<120 && f.m.capture;i++) {
      f.step(); replica.step([neutral(),neutral()]);
      expect(hashState(snapshot(replica))).toBe(hashState(snapshot(f.m)));
      height = Math.max(height,FLOOR-f.a.y);
      crossed ||= f.b.x > f.a.x;
      for (const p of [f.a,f.b]) {
        expect(p.x).toBeGreaterThanOrEqual(40);
        expect(p.x).toBeLessThanOrEqual(1240);
        expect(p.y).toBeLessThanOrEqual(FLOOR);
      }
      if (f.m.capture) expect(f.a.actionClip).toBe("chain_"+finish);
    }
    expect(f.m.capture).toBeUndefined();
    expect(f.b.health).toBeLessThan(before);
    expect(f.b.combo).toBeLessThanOrEqual(8);
    if (config.slam) expect(height).toBeGreaterThan(150);
    if (finish === "rushCrossover") expect(crossed).toBe(true);
    if (config.follow === "air") {
      expect(f.a.canCancel("jump")).toBe(true);
      f.m.step([{ ...neutral(), pressed:["jump"] }, neutral()]);
      f.until(() => f.a.airborne, 18);
    }
  });
}

it("scales long grab damage off prior hits and lets the finisher KO at the wall", () => {
  const f = duel("kaguneGrab_medium",320,1,true);
  f.b.combo = 5;
  f.b.stun = 200;
  f.b.setState("hitstun");
  f.command();
  // An unconfirmed long grab cannot bypass hitstun eligibility.
  for (let i=0; i<70; i++) { f.step(); expect(f.m.capture).toBeUndefined(); }
  const g = duel("kaguneGrab_heavy",363,-1,true);
  g.b.health = 30; g.b.combo = 2;
  g.b.stun = 99;
  g.open(); g.choose("heavy","heavy");
  expect(g.m.capture!.scale).toBeLessThan(1);
  g.until(() => !g.m.capture,120);
  expect(g.b.health).toBe(0);
  expect(g.m.phase).toBe("roundEnd");
});

