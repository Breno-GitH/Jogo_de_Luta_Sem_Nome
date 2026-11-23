import { writeFileSync, mkdirSync } from "node:fs";
import { Match } from "../src/engine/combat";
import { characters } from "../src/engine/characters";
import { neutral } from "../src/engine/types";

const ids = ["samurai", "dio", "goku", "luffy", "sasuke", "kaneki", "ben", "xebec", "asta"] as const;
const results = ids.map(id => {
  const m = new Match(characters[id], { training: true }, characters.samurai);
  m.phase = "fight";
  const [attacker, defender] = m.fighters;
  attacker.x = 1100;
  defender.x = 1150;
  attacker.facing = 1;
  defender.facing = -1;
  let firstHit = -1, firstFreedom = -1, hits = 0;
  for (let tick = 0; tick < 540; tick++) {
    m.step([{ ...neutral(), pressed: ["light"] }, neutral()]);
    hits += m.hits.filter(hit => hit.attacker === 0 && !hit.blocked).length;
    if (firstHit < 0 && hits) firstHit = tick;
    if (firstHit >= 0 && tick > firstHit && ["idle", "walk", "crouch", "air"].includes(defender.state) && !defender.knockedDown) {
      firstFreedom = tick;
      break;
    }
  }
  return { id, firstHitTick: firstHit, firstFreedomTick: firstFreedom, ticksFromHitToFreedom: firstFreedom - firstHit, hitsBeforeFreedom: hits };
});
if (results.some(result => result.firstHitTick < 0 || result.ticksFromHitToFreedom > 360))
  throw new Error(`Anti-spam audit failed: ${JSON.stringify(results)}`);
mkdirSync("deployment/audit/anti-spam", { recursive: true });
writeFileSync("deployment/audit/anti-spam/recovery.json", JSON.stringify(results, null, 2) + "\n");
console.table(results);
