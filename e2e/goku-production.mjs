// Compatibility entry: the full reconstruction supersedes the revision2/4 assertions.
import { spawnSync } from "node:child_process";
const result=spawnSync(process.execPath,["node_modules/@playwright/test/cli.js","test","--config","playwright.goku-production.config.mjs"],{stdio:"inherit",windowsHide:true});
process.exit(result.status ?? 1);
