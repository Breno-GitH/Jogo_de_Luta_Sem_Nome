import type { InputFrame } from "./types";

/** Presentation ticks at 60 Hz. No attacks, resource changes or render clocks. */
export const entranceProfiles = {
  samurai: {
    duration: 168,
    distance: 46,
    walkTicks: 28,
    name: "A LÂMINA EM SILÊNCIO",
  },
  dio: {
    duration: 180,
    distance: 64,
    walkTicks: 36,
    name: "DIO BRANDO · THE WORLD",
  },
  goku: {
    duration: 150,
    distance: 30,
    walkTicks: 24,
    name: "PRONTO PARA LUTAR",
  },
  luffy: {
    duration: 162,
    distance: 36,
    walkTicks: 24,
    name: "O CHAPÉU DE PALHA",
  },
  sasuke: {
    duration: 150,
    distance: 36,
    walkTicks: 28,
    name: "O OLHAR UCHIHA",
  },
  kaneki: {
    duration: 174,
    distance: 28,
    walkTicks: 34,
    name: "POR TRÁS DA MÁSCARA",
  },
  ben: {
    duration: 156,
    distance: 42,
    walkTicks: 24,
    name: "HORA DE SER HERÓI",
  },
  xebec: {
    duration: 180,
    distance: 48,
    walkTicks: 32,
    name: "PRESENÇA DO CONQUISTADOR",
  },
  asta: {
    duration: 186,
    distance: 24,
    walkTicks: 28,
    name: "O GRIMÓRIO DE CINCO FOLHAS",
  },
} as const;
export type EntranceId = keyof typeof entranceProfiles;
export const entranceStagger = 42;
export const roundAnnouncementTicks = 48;
export interface IntroState {
  tick: number;
  full: boolean;
  skipped: boolean;
  skipVotes: [boolean, boolean];
  presentationEnd: number;
  fightAt: number;
}
export function entranceProfile(id: string) {
  return entranceProfiles[id as EntranceId] ?? entranceProfiles.samurai;
}
export function createIntro(ids: readonly string[], full: boolean): IntroState {
  const presentationEnd = full
    ? Math.max(
        entranceProfile(ids[0]).duration,
        entranceStagger + entranceProfile(ids[1]).duration,
      )
    : 0;
  return {
    tick: 0,
    full,
    skipped: false,
    skipVotes: [false, false],
    presentationEnd,
    fightAt: presentationEnd + roundAnnouncementTicks,
  };
}
export function advanceIntro(
  s: IntroState,
  inputs: readonly InputFrame[],
  both: boolean,
) {
  if (s.full && s.tick < s.presentationEnd) {
    for (const seat of [0, 1] as const)
      if (inputs[seat]?.skipIntro) s.skipVotes[seat] = true;
    if (both ? s.skipVotes.every(Boolean) : s.skipVotes.some(Boolean)) {
      s.skipped = true;
      s.tick = s.presentationEnd;
    }
  }
  s.tick++;
}
export function entranceAge(s: IntroState, seat: number) {
  return s.tick - (seat ? entranceStagger : 0);
}
export function entranceRoot(
  home: number,
  facing: number,
  id: string,
  age: number,
) {
  const p = entranceProfile(id);
  const progress = Math.max(0, Math.min(1, age / Math.max(1, p.walkTicks)));
  // The engine currently shares a 1280px platform; neither actor can leave it.
  return (
    Math.round(
      Math.max(
        120,
        Math.min(1160, home - facing * p.distance * (1 - progress)),
      ) * 16,
    ) / 16
  );
}
export function introStage(s: IntroState) {
  return s.tick < s.presentationEnd
    ? "presentations"
    : s.tick < s.fightAt - 18
      ? "round"
      : "fight";
}
