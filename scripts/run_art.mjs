import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundled = path.join(
  homedir(),
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
);
const candidates = [
  ...(process.env.PYTHON ? [[process.env.PYTHON]] : []),
  ["python"],
  ["python3"],
  ["py", "-3"],
  ...(existsSync(bundled) ? [[bundled]] : []),
];

let interpreter;
for (const candidate of candidates) {
  const check = spawnSync(
    candidate[0],
    [...candidate.slice(1), "-c", "import PIL, numpy"],
    { encoding: "utf8", windowsHide: true },
  );
  if (check.status === 0) {
    interpreter = candidate;
    break;
  }
}
if (!interpreter) {
  console.error(
    "A arte requer Python 3 com Pillow e numpy. Instale com: python -m pip install -r requirements-art.txt. Opcional: defina PYTHON com o caminho do executável.",
  );
  process.exit(1);
}
const script = path.resolve(
  root,
  process.argv[2] ?? "scripts/build_samurai.py",
);
if (!script.startsWith(root + path.sep) || !existsSync(script)) {
  console.error("Script de arte inválido.");
  process.exit(1);
}
const result = spawnSync(
  interpreter[0],
  [...interpreter.slice(1), script, ...process.argv.slice(3)],
  {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  },
);
process.exit(result.status ?? 1);
