/** Shared deterministic anti-infinite rule for repeated weak normals.
 * Hits are counted on the defender across standing/crouching/air J attacks.
 * Mediums, heavies and specials remain available in normal combo routes.
 */
export const antiLightCombo = {
  maxHits: 3,
  push: 18,
  launch: -8.5,
  stun: 30,
} as const;

export function isLimitedLightNormal(characterId: string, moveId: string): boolean {
  return (characterId === "goku" || characterId === "samurai") &&
    /^(stand|crouch|air)_light$/.test(moveId);
}
