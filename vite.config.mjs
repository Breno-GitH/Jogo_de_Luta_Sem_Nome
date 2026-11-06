import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  server: {
    hmr: process.env.PLAYWRIGHT_NO_HMR === "1" ? false : undefined,
    proxy: {
      "/socket.io": {
        target: process.env.ONLINE_PROXY_TARGET ?? "http://127.0.0.1:3001",
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        kaneki: fileURLToPath(new URL("./art/kaneki.html", import.meta.url)),
        sasuke: fileURLToPath(new URL("./art/sasuke.html", import.meta.url)),
        luffy: fileURLToPath(new URL("./art/luffy.html", import.meta.url)),
        luffyJet: fileURLToPath(new URL("./art/luffy-jet.html", import.meta.url)),
        luffySecondary: fileURLToPath(new URL("./art/luffy-secondary.html", import.meta.url)),
        game: fileURLToPath(new URL("./index.html", import.meta.url)),
        samurai: fileURLToPath(new URL("./art/samurai.html", import.meta.url)),
        dio: fileURLToPath(new URL("./art/dio.html", import.meta.url)),
        dioCombat: fileURLToPath(
          new URL("./art/dio-combat.html", import.meta.url),
        ),
        dioSpecials: fileURLToPath(
          new URL("./art/dio-specials.html", import.meta.url),
        ),
        roadRoller: fileURLToPath(
          new URL("./art/road-roller.html", import.meta.url),
        ),
        dioSecondary: fileURLToPath(
          new URL("./art/dio-secondary.html", import.meta.url),
        ),
        goku: fileURLToPath(new URL("./art/goku.html", import.meta.url)),
        gokuCombat: fileURLToPath(
          new URL("./art/goku-combat.html", import.meta.url),
        ),
        gokuSpecials: fileURLToPath(
          new URL("./art/goku-specials.html", import.meta.url),
        ),
        gokuFury: fileURLToPath(
          new URL("./art/goku-fury.html", import.meta.url),
        ),
      },
    },
  },
});
