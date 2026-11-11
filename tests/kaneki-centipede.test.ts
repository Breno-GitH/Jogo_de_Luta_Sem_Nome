import { expect, it } from "vitest";
import { FLOOR, Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { centipedeConfig, centipedeScene, type CentipedeState } from "../src/engine/kaneki-centipede";
import art from "../src/data/kaneki-centipede-art.json";
import { resistanceButton } from "../src/engine/kaneki-chain";
import { kanekiTechnique } from "../src/engine/kaneki-specials";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type Button, type InputFrame } from "../src/engine/types";

function fight(gap = 115, side: -1 | 1 = 1, edge = false) {
  const m = new Match(characters.kaneki, {}, characters.sasuke);
  m.phase = "fight";
  const [a,b] = m.fighters;
  a.x = edge ? side === 1 ? 1230 - gap : 50 + gap : 620;
  b.x = a.x + side * gap;
  a.facing = side;
  b.facing = side === 1 ? -1 : 1;
  a.meter = 100;
  const step = (pressed?: Button, defense: Partial<InputFrame> = {}) =>
    m.step([{ ...neutral(), pressed: pressed ? [pressed] : [] }, { ...neutral(), ...defense }]);
  const until = (condition: () => unknown, max = 90) => {
    for (let i=0; i<max && !condition(); i++) step();
    expect(condition()).toBeTruthy();
  };
  const chain = () => m.capture?.kaneki?.chain;
  const special = (id: string) => {
    const technique = kanekiTechnique(id)!;
    const rush = technique.family === "rinkakuRush";
    m.step([{ ...neutral(), down:true }, neutral()]);
    if (rush) step();
    const direction = rush ? 0 : technique.family === "fourSwords" ? (side === 1 ? -1 : 1) : side;
    m.step([{ ...neutral(), direction, down:rush, pressed:[technique.strength] }, neutral()]);
  };
  return { m, a, b, step, until, chain, special };
}

it.each([1,-1] as const)("confirms a real opener on both sides and plays the full deterministic sequence (%s)", side => {
  const f = fight(115,side,true);
  f.step("ultimate");
  expect(f.a.moveId).toBe("centipede");
  expect(f.a.meter).toBe(0);
  expect(f.m.centipede).toBeUndefined();
  f.until(() => f.m.centipede);
  expect(f.m.centipede!.source).toBe("strike");
  const frames = new Map<number, string>();
  let ground = false;
  let rewound = false;
  let reloaded: Match | undefined;
  for (let i=0; i<510 && f.m.centipede; i++) {
    const { tick } = f.m.centipede;
    const s = centipedeScene(f.m.centipede);
    for (const x of [f.a.x,f.b.x]) expect(x).toBeGreaterThanOrEqual(40);
    for (const x of [f.a.x,f.b.x]) expect(x).toBeLessThanOrEqual(1240);
    expect(f.a.y).toBeLessThanOrEqual(FLOOR);
    expect(f.b.y).toBeLessThanOrEqual(FLOOR);
    if (s.phase === "impact") ground ||= f.b.y === FLOOR && f.a.y < FLOOR;
    if (tick === 200 && !rewound) {
      reloaded = restore(snapshot(f.m));
      rewound = true;
    }
    f.step("ultimate");
    if (reloaded) {
      reloaded.step([{ ...neutral(), pressed:["ultimate"] }, neutral()]);
      expect(hashState(snapshot(reloaded))).toBe(hashState(snapshot(f.m)));
    }
    for (const e of f.m.events) if (e.centipede) frames.set(e.centipede.frame, e.centipede.cue);
  }
  expect(ground).toBe(true);
  expect(rewound).toBe(true);
  expect([...frames.values()].filter(cue => cue === "ground")).toHaveLength(1);
  expect(f.m.centipede).toBeUndefined();
  expect(f.a.state).toBe("idle");
  expect(f.a.actionClip).toBe("");
  expect(f.a.meter).toBe(0);
  expect(f.b.knockedDown).toBe(true);
  expect(f.b.health).toBe(f.b.data.health - 343);
});

it("tracks mirrored attacks, plants at a real boundary and returns from above the victim", () => {
  const base: CentipedeState = {
    attacker:0, victim:1, tick:0, facing:1, scale:1, hold:0,
    originX:620, originY:FLOOR, targetX:740, targetY:FLOOR, grip:"lowerFront", source:"strike",
  };
  const mirror: CentipedeState = {...base,facing:-1,originX:660,targetX:540};
  const p = centipedeConfig.phases, duration=centipedeConfig.duration;
  const phases = new Set<string>();
  let flips = 0, previous = centipedeScene(base);
  for(let tick=0;tick<=duration;tick++) {
    const scene=centipedeScene({...base,tick}), reversed=centipedeScene({...mirror,tick});
    phases.add(scene.phase);
    expect(Math.abs(scene.attacker.x+reversed.attacker.x-1280)).toBeLessThanOrEqual(1);
    expect(scene.attacker.y).toBe(reversed.attacker.y);
    expect(scene.wall+reversed.wall).toBe(1280);
    expect(Object.hasOwn(art.clips,scene.attacker.clip)).toBe(true);
    expect(Math.hypot(scene.attacker.x-previous.attacker.x,scene.attacker.y-previous.attacker.y)).toBeLessThan(70);
    if (scene.phase==="zigzag" && scene.attacker.facing!==previous.attacker.facing) flips++;
    if (tick===p.plant) {
      expect(scene.attacker.x).toBe(scene.wall-37);
      expect(scene.attacker.clip).toBe("centipedeWallPlant");
    }
    if (tick===p.ground) {
      expect(scene.victim.y).toBe(FLOOR);
      expect(scene.attacker.y).toBeLessThan(FLOOR);
      expect(scene.victim.clip).toBe("downed");
    }
    if (tick===p.windup) expect(scene.attacker.y).toBeLessThan(scene.victim.y-65);
    if (tick===p.return) expect(scene.attacker.clip).toBe("centipedeFrenzyLook");
    previous=scene;
  }
  expect(flips).toBeGreaterThanOrEqual(3);
  expect([...phases]).toEqual(["transformation","rush","zigzag","wall","capture","ascend","windup","descent","impact","return"]);
  expect(previous.armor).toBe(0);
  expect(previous.camera.scale).toBe(1);
});

it.each([false,true])("passes ordinary guard on contact (crouch=%s)", down => {
  const f = fight(82);
  f.step("ultimate");
  for (let i=0; i<42 && !f.m.centipede; i++)
    f.step(undefined, i > 24 ? { direction:1, down } : {});
  expect(f.m.centipede?.source).toBe("strike");
});

it.each(["meter","range","jump"] as const)("fails without confirming by %s", reason => {
  const f = fight(reason === "range" ? 355 : 122);
  if (reason === "meter") f.a.meter = 99;
  f.step("ultimate", reason === "jump" ? { pressed:["jump"] } : {});
  for (let i=0;i<100;i++) {
    expect(f.m.centipede).toBeUndefined();
    f.step();
  }
  expect(f.a.meter).toBe(reason === "meter" ? 99 : 0);
  expect(f.b.health).toBe(f.b.data.health);
  expect(f.a.state).toBe("idle");
});

it.each([
  ["universal",107,""], ["kaguneGrab",362,"kaguneGrab_heavy"], ["rinkakuRush",214,"rinkakuRush_medium"],
] as const)("converts live %s without teleporting or double-charging", (origin,gap,move) => {
  const f = fight(gap);
  if (move) f.special(move);
  else f.step("throw");
  f.until(() => f.chain()?.phase === "choice1" && !f.m.hitstop);
  const positions = [f.a.x,f.a.y,f.b.x,f.b.y];
  f.step("ultimate");
  expect(f.m.centipede?.source).toBe(origin);
  expect([f.a.x,f.a.y,f.b.x,f.b.y]).toEqual(positions);
  expect(f.a.meter).toBe(0);
  expect(f.m.capture).toBeUndefined();
});

it("rejects conversion during Four Swords and with a partial meter", () => {
  for (const [gap,move] of [[119,"fourSwords_medium"],[107,""]] as const) {
    const f = fight(gap);
    if (move) f.special(move);
    else { f.a.meter = 72; f.step("throw"); }
    f.until(() => f.chain()?.phase === "choice1" && !f.m.hitstop, 160);
    const meter = f.a.meter;
    f.step("ultimate");
    expect(f.m.centipede).toBeUndefined();
    expect(f.a.meter).toBe(meter);
  }
});

it("honors the target's successful escape on the same tick as R", () => {
  const f = fight(260);
  f.special("kaguneGrab_light");
  f.until(() => f.chain()?.phase === "choice1" && !f.m.hitstop);
  f.chain()!.resistance = 2;
  f.step("ultimate", { pressed:[resistanceButton(f.chain()!)] });
  expect(f.m.centipede).toBeUndefined();
  expect(f.m.capture).toBeUndefined();
  expect(f.a.meter).toBe(100);
});

it("loses the startup to a real opposing hit and does not refund the bar", () => {
  const f = fight(48);
  f.step("ultimate", { pressed:["light"] });
  f.until(() => f.a.state === "hitstun");
  expect(f.a.meter).toBeLessThan(100);
  expect(f.b.health).toBe(f.b.data.health);
  expect(f.m.centipede).toBeUndefined();
});

it("expires the long grab before accepting a conversion on tick 300", () => {
  const f = fight(260);
  f.special("kaguneGrab_light");
  f.until(() => f.chain()?.phase === "choice1" && !f.m.hitstop);
  const start = f.chain()!.started;
  while (f.m.frame - start < 299) f.step();
  f.step("ultimate");
  expect(f.m.centipede).toBeUndefined();
  expect(f.m.capture).toBeUndefined();
  expect(f.a.meter).toBe(100);
});

it("resolves KO only after the final slam and clears the form across rounds", () => {
  const f = fight();
  f.b.health = 50;
  f.step("ultimate");
  f.until(() => f.m.centipede);
  f.until(() => f.m.centipede!.tick > centipedeConfig.phases.ground, 465);
  expect(f.b.health).toBe(0);
  expect(f.m.phase).toBe("fight");
  f.until(() => !f.m.centipede, 110);
  expect(f.a.actionClip).toBe("");
  expect(f.m.phase).not.toBe("fight");
  f.until(() => f.m.phase === "fight", 700);
  expect(f.m.centipede).toBeUndefined();
  expect(f.m.fighters[1].health).toBe(f.m.fighters[1].data.health);
});

