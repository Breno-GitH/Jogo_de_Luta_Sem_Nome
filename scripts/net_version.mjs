import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const files = [
  "src/engine/combat.ts",
  "src/engine/types.ts",
  "src/engine/input.ts",
  "src/engine/geometry.ts",
  "src/engine/moves.ts",
  "src/engine/movement.ts",
  "src/engine/stand-combat.ts",
  "src/engine/temporal.ts",
  "src/engine/road-roller.ts",
  "src/engine/projectiles.ts",
  "src/engine/characters.ts",
  "src/engine/goku-data.ts",
  "src/engine/goku-specials.ts",
  "src/engine/goku-fury.ts",
  "src/engine/goku-fury-move.ts",
  "src/data/goku-fury.json",
  "src/data/goku-fury-poses.json",
  "src/data/goku-fury-contacts.json",
  "src/data/goku-fury-release.json",
  "src/engine/lifecycle.ts",
  "src/engine/state.ts",
  "src/data/samurai.json",
  "src/data/dio.json",
  "src/data/goku.json",
  "src/data/goku-normals.json",
  "src/data/goku-combat.json",
  "src/data/goku-specials.json",
  "src/data/goku-special-moves.json",
  "src/data/dio-specials.json",
  "src/data/road-roller.json",
  "src/data/dio-super-moves.json",
  "src/data/the-world-super-actions.json",
  "src/data/dio-secondary.json",
  "src/data/the-world-secondary.json",
  "src/data/dio-special-moves.json",
  "src/data/the-world-special-actions.json",
  "src/data/cinematics.json",
  "src/net/protocol.ts",
];
const hash = createHash("sha256");
for (const file of files) hash.update(file).update(readFileSync(file));
const out = "src/net/version.ts",
  content = `// Generated from the shared simulation sources and data.\nexport const ENGINE_VERSION = "${hash.digest("hex").slice(0, 24)}";\n`;
if (!existsSync(out) || readFileSync(out, "utf8") !== content)
  writeFileSync(out, content);
