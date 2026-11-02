import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const expected = JSON.parse(
  readFileSync("deployment/audit/preserved-game.json", "utf8"),
);
const changed = Object.entries(expected)
  .filter(
    ([p, hash]) =>
      !existsSync(p) ||
      createHash("sha256").update(readFileSync(p)).digest("hex") !== hash,
  )
  .map(([p]) => p);
const report = {
  checked: Object.keys(expected).length,
  changed,
  date: new Date().toISOString(),
};
writeFileSync(
  "deployment/audit/preservation-result.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2