import movement from "../data/goku-animations.json";
import combat from "../data/goku-combat-animations.json";
import specials from "../data/goku-special-animations.json";
import fury from "../data/goku-fury-animations.json";
/** Preserve approved movement definitions; new combat clips carry their own
 * dimensions and pivots. Loading an attack never changes locomotion geometry. */
export const gokuAnimations = {
  ...movement,
  clips: {
    ...movement.clips,
    ...combat.clips,
    ...specials.clips,
    ...fury.clips,
  },
};
