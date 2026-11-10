import { expect, it } from "vitest";
import { effectCue } from "../src/audio/sound";
import { characters, type CharacterId } from "../src/engine/characters";
import { FLOOR, Match } from "../src/engine/combat";
import { kanekiOffensiveKagunes } from "../src/engine/kaneki-combat";
import { kanekiSpecialScene, kanekiTechniques, swordProfile } from "../src/engine/kaneki-specials";
import { hashState, restore, snapshot } from "../src/engine/state";
import { neutral, type InputFrame } from "../src/engine/types";

type Technique = (typeof kanekiTechniques)[number];
function duel(id: CharacterId, gap: number, side: -1 | 1) {
  const match = new Match(characters.kaneki, {}, characters[id]);
  match.phase = "fight";
  match.message = "";
  const [a, b] = match.fighters;
  a.x = 620; b.x = a.x + gap * side;
  a.facing = side; b.facing = -side;
  function step(frame: InputFrame = neutral(), rival: InputFrame = neutral()) {
    match.step([frame, rival]);
  }
  function command(t: Technique, rival = neutral()) {
    step({ ...neutral(), down: true }, rival);
    if (t.family === "rinkakuRush") step(neutral(), rival);
    const direction = t.family === "kaguneGrab" ? side : t.family === "fourSwords" ? -side as -1 | 1 : 0;
    step({ ...neutral(), direction, down: !direction, pressed: [t.strength] }, rival);
    expect(a.moveId).toBe(t.id);
  }
  return { match, a, b, step, command };
}

for (const t of kanekiTechniques) {
  it.each(["samurai", "dio", "goku", "luffy", "sasuke"] as const)("%s resolves " + t.id, (opponent) => {
    const { match, a, b, step, command } = duel(opponent,
      t.family === "kaguneGrab" ? 94 : t.family === "fourSwords" ? 109 : [198,214,246][t.rank],
      opponent === "goku" || opponent === "sasuke" ? -1 : 1);
    command(t);
    const cues = new Set<number>();
    const limbs = new Set<string>();
    let confirmed = false, hits = 0, chose = false, finished = false;
    for (let i = 0; i < 125; i++) {
      const choice = !chose && t.family === "kaguneGrab" && match.capture?.tick === 8;
      if (choice) chose = true;
      const ending = !finished && t.family === "kaguneGrab" && match.capture?.kaneki?.chain?.phase === "choice2";
      if (ending) finished = true;
      step(choice ? { ...neutral(), pressed: ["light"] } : ending ? { ...neutral(), pressed: ["medium"] } : neutral());
      confirmed ||= match.capture?.kaneki?.specialId === t.id;
      hits += match.hits.length;
      if (match.capture) for (const limb of kanekiOffensiveKagunes(a, FLOOR)) limbs.add(limb.id);
      const event = match.events.find(e => e.knuckleFrame === match.frame);
      if (event) {
        expect(effectCue(event)).toBe("knuckleSnap");
        const cap = match.capture!.kaneki!;
        const tick = match.capture!.tick - 1;
        expect(tick).toBe(swordProfile(t.rank).snap);
        expect(kanekiSpecialScene(t.id, tick, a, cap, cap.direction)).toMatchObject({
          clip: "swordsSnap", clipTick: 4, snapPose: 1, snap: true,
        });
        cues.add(event.knuckleFrame!);
      }
    }
    expect(confirmed).toBe(true);
    expect(hits).toBe(t.family === "fourSwords" ? 4 : t.family === "kaguneGrab" ? 2 : 1);
    expect(cues.size).toBe(t.family === "fourSwords" ? 1 : 0);
    if (t.family === "fourSwords") expect(limbs.size).toBe(4);
    expect(b.health).toBeLessThan(b.data.health);
    expect(match.capture).toBeUndefined();
    expect(a.attackShapes()).toHaveLength(0);
  });
}

const swords = kanekiTechniques.filter(t => t.family === "fourSwords");
it.each(swords)("keeps %o blockable, out of range, and able to finish a round", t => {
  for (const mode of ["block", "miss", "KO"] as const) {
    const { match, a, b, command, step } = duel("samurai", mode === "miss" ? 310 : 104, 1);
    const rival: InputFrame = { ...neutral(), direction: mode === "block" ? 1 : 0 };
    if (mode === "KO") b.health = 1;
    command(t);
    let held = false, heard = false, blocked = false;
    for (let i = 0; i < 110; i++) {
      step(neutral(), i >= t.startup - 2 ? rival : neutral());
      held ||= !!match.capture;
      heard ||= match.events.some(e => e.kind === "knuckleSnap");
      blocked ||= match.hits.some(e => e.blocked);
    }
    expect(blocked).toBe(mode === "block");
    expect(held).toBe(mode === "KO");
    expect(heard).toBe(held);
    expect(b.health).toBe(mode === "KO" ? 0 : b.data.health);
    expect(match.phase).toBe(mode === "KO" ? "roundEnd" : "fight");
    expect(a.attackShapes()).toHaveLength(0);
  }
});

it.each(kanekiTechniques.filter(t => t.family === "rinkakuRush"))("uses the body as a separate blockable contact: %o", t => {
  const { match, a, command, step } = duel("samurai", 64, 1);
  const guard: InputFrame = { ...neutral(), direction: 1 };
  command(t, guard);
  let blocks = 0;
  for (let i = 0; i < 84; i++) {
    step(neutral(), guard);
    expect(match.capture).toBeUndefined();
    blocks += match.hits.filter(h => h.blocked).length;
  }
  expect(blocks).toBe(1);
  expect(a.x).toBeGreaterThan(620);
});

it("requires two down edges for Rush and rejects R without meter", () => {
  const { a, step } = duel("samurai", 190, 1);
  step({ ...neutral(), pressed: ["ultimate"] });
  expect(a.moveId).toBe("");
  for (let i = 0; i < 5; i++) step({ ...neutral(), down: true });
  step({ ...neutral(), down: true, pressed: ["medium"] });
  expect(a.moveId).toBe("crouch_medium");
});

it("keeps a restored match synchronized across the sound event and release", () => {
  const { match, step, command } = duel("sasuke", 115, -1);
  command(swords[1]);
  for (let i = 0; i < 32 && !match.capture; i++) step();
  expect(match.capture?.kaneki?.specialId).toBe("fourSwords_medium");
  const replay = restore(snapshot(match));
  for (let i = 0; i < 95; i++) {
    step();
    replay.step([neutral(),neutral()]);
    expect(hashState(snapshot(replay))).toBe(hashState(snapshot(match)));
  }
});



it.each(["fourSwords_light", "rinkakuRush_light"] as const)("can cancel a confirmed medium into %s", move => {
  const { a, b, match, step, command } = duel("samurai", 64, 1);
  step({ ...neutral(), pressed: ["medium"] });
  for (let i = 0; i < 28 && (!a.hitConfirmed || match.hitstop > 0); i++) step();
  expect(a.hitConfirmed).toBe(true);
  command(kanekiTechniques.find(t => t.id === move)!);
  for (let i = 0; i < 85; i++) step();
  expect(b.health).toBeLessThan(b.data.health - 49);
  expect(match.capture).toBeUndefined();
});

it("clears an interrupted burrow and emits no snap", () => {
  const { a, b, match, step, command } = duel("samurai", 61, 1);
  command(swords[2]);
  for (let i = 0; i < 16 && a.state === "attack"; i++)
    step(neutral(), i === 0 ? { ...neutral(), pressed: ["light"] } : neutral());
  expect(a.state).toBe("hitstun");
  expect(a.kanekiBurrowX).toBeUndefined();
  expect(kanekiOffensiveKagunes(a, FLOOR)).toHaveLength(0);
  for (let i = 0; i < 55; i++) {
    step();
    expect(match.events.some(e => e.kind === "knuckleSnap")).toBe(false);
  }
  expect(b.health).toBe(b.data.health);
});

it("keeps a Four Swords throw in the arena at the left edge", () => {
  const { a, b, match, step, command } = duel("sasuke", 115, -1);
  a.x = 165; b.x = 50;
  command(swords[2]);
  let far = false;
  for (let i = 0; i < 140; i++) {
    step();
    far ||= b.x === 40;
    expect(b.x).toBeGreaterThanOrEqual(40);
    expect(b.x).toBeLessThanOrEqual(1240);
  }
  expect(far).toBe(true);
  expect(match.capture).toBeUndefined();
});

