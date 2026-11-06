import kanekiArt from "../data/kaneki-art.json";

/** Characters at the visual-only stage have their own registry. Their IDs
 * become match participants only once complete character data is supplied. */
export const characterPreviews = {
  kaneki: {
    id: "kaneki",
    name: "Kaneki Ken",
    variant: "Cabelo branco · Tokyo Ghoul",
    archetype: "Grappler de captura",
    baseSprite: "kaneki/base.png",
    animations: kanekiArt,
    lumbar: kanekiArt.lumbar,
  },
} as const;
