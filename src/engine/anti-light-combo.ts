/** Shared deterministic anti-infinite rule for repeated weak normals.
 * Hits are counted on the defender across standing/crouching/air J attacks.
 * Mediums, heavies and specials remain available in normal combo routes.
 */
export const antiLightCombo = {
  maxHits: 3,
  push: 15,
  stun: 16,
  recoveryFrames: 8,
  blockedPush: 10,
  blockedStun: 7,
} as const;

export function isLimitedLightNormal(_characterId: string, moveId: string): boolean {
  // All nine fighters, including sword stances and Omnitrix forms, use these
  // shared logical IDs for their J normals. Command specials stay separate.
  return /^(stand|crouch|air)_light$/.test(moveId);
}

export const launcherCombo = {
  minimumLift: -8,
  maxLaunches: 2,
  finisherFall: 9,
  finisherStun: 22,
  finisherPush: 11,
} as const;
