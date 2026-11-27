import { it, expect } from "vitest";
import { arenaIds } from "../src/engine/arenas";
import { Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral } from "../src/engine/types";

for (const arenaId of arenaIds) it(`all registered base specials preserve finite physics in ${arenaId}`, () => {
  let executed = 0;
  for (const data of Object.values(characters)) for (const move of Object.keys(data.specialMoves ?? {})) {
    const m = new Match(data, { training: true, arenaId, arenaMode: "interativo" }, characters.samurai);
    m.phase = "fight"; const f = m.fighters[0];
    f.x = 530; m.fighters[1].x = 640; f.meter = f.meterMaximum;
    if (f.domination) f.domination.charge = 100;
    if (!f.attack(move)) continue;
    executed++;
    for (let tick = 0; tick < 240; tick++) m.step([neutral(), neutral()]);
    expect(m.fighters.every(actor => [actor.x, actor.y, actor.vx, actor.vy].every(Number.isFinite)), `${data.id}/${move}`).toBe(true);
    expect(m.arena.transition?.tick ?? 0, `${data.id}/${move}`).toBeLessThan(84);
  }
  expect(executed).toBeGreaterThan(50);
});
