import config from "./playwright.config.mjs";
process.env.GOKU_PRODUCTION = "1";
export default {
  ...config,
  testMatch: [
    "**/goku-production.pw.mjs",
    "**/goku-combat-production.pw.mjs",
    "**/goku-specials-production.pw.mjs",
    "**/goku-fury-production.pw.mjs",
  ],
  webServer: undefined,
  use: { ...config.use, baseURL: "http://localhost/jogo-luta/" },
};
