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
      { x: -12, y: -154, w: 29, h: 32 },
      { x: -29, y: -125, w: 58, h: 56 },
      { x: -28, y: -70, w: 58, h: 70 },
    ],
    crouching: [
      { x: -11, y: -106, w: 30, h: 29 },
      { x: -32, y: -78, w: 66, h: 47 },
      { x: -34, y: -38, w: 68, h: 38 },
    ],
    air: [
      { x: -14, y: -138, w: 31, h: 31 },
      { x: -30, y: -108, w: 59, h: 62 },
      { x: -31, y: -48, w: 68, h: 44 },
    ],
  },
  moves: {},
};
