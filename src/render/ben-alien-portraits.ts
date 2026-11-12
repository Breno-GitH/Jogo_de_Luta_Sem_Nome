import { benAliens, type BenAlien } from "../engine/ben-omnitrix";

export const portraitIds = [
  ...benAliens.map(({ id }) => id),
  "alienX",
] as const;
export const portraitSheet = (id: BenAlien | "alienX") =>
  `ben/omnitrix/${id}.png`;
export const portraitSheets = portraitIds.map(portraitSheet);
export const portraitSize = 56;
