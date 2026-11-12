import { existsSync, readFileSync } from "node:fs";

function packages(lockfile) {
  return JSON.parse(readFileSync(lockfile, "utf8")).packages;
}

try {
  const locked = packages("package-lock.json");
  const installed = packages("node_modules/.package-lock.json");
  for (const [directory, expected] of Object.entries(locked)) {
    if (!directory) continue;
    const actual = installed[directory];
    if (!actual && expected.optional) continue;
    if (actual?.version !== expected.version ||
        actual?.integrity !== expected.integrity ||
        !existsSync(directory + "/package.json")) {
      throw new Error(directory);
    }
  }
} catch (error) {
  console.error("Dependencias incompletas:", error.message);
  process.exitCode = 1;
}

