import type { CharacterData } from "./types";

export const xebecId = "xebec";

export const xebec: CharacterData = {
  id: xebecId,
  name: "Rocks D. Xebec",
  health: 1000,
  speed: 4.8,
  jump: -16.5,
  gravity: 0.72,
  locomotion: {
    backSpeed: 3.8,
    airSpeed: 4.5,
    jumpStartup: 5,
    landingTicks: 7,
    dashForward: [6, 9, 13, 15, 15, 14, 13, 12, 10, 8, 6, 4, 2],
    backdash: [5, 8, 11, 13, 13, 12, 11, 10, 8, 7, 5, 3, 2],
  },
  hurtboxes: {
    standing: [
      { x: -10, y: -128, w: 24, h: 27 },
      { x: -24, y: -104, w: 48, h: 47 },
      { x: -23, y: -58, w: 48, h: 58 },
    ],
    crouching: [
      { x: -9, y: -88, w: 25, h: 24 },
      { x: -27, y: -65, w: 55, h: 39 },
      { x: -28, y: -32, w: 57, h: 32 },
    ],
    air: [
      { x: -12, y: -115, w: 26, h: 26 },
      { x: -25, y: -90, w: 49, h: 52 },
      { x: -26, y: -40, w: 57, h: 37 },
    ],
  },
  moves: {},
};
