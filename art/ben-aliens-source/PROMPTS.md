# Ben 10 Omniverse · Etapa 3

Arte gerada com a ferramenta ImageGen integrada. A montagem de referência da Etapa 2 orientou as proporções e as cores. Os três recortes do modelo aprovado visualmente foram as referências de continuidade dos quadros de movimento e combate.

## Modelos estáticos

Prompt-base: three transparent M.U.G.E.N. pixel-art fighting sprites, right-facing three-quarter stance, all feet on a common baseline, 135:165:145 heights. Match the supplied design reference for XLR8, Four Arms and Heatblast. No backdrop, text, props or blur. XLR8 has a swept black helmet, cyan face, green eyes, chest watch, two roller spheres and a long striped tail. Four Arms has two separate pairs of complete arms with shoulders at the upper torso and lower ribs, red skin, four eyes, green-black uniform and belt watch. Heatblast has deep red rock plates, yellow-orange seams, lava hands and feet, two bright eyes and an open flame crown growing out of the skull.

## Séries de quadros

Prompts de movimento e combate: use each attached master as the sole model and palette guide. Keep full, separately drawn right-facing cels, stable proportions, transparent gutters and crisp pixel clusters. Preserve two wheels and the tail for XLR8, four complete independent arms for Four Arms, and a uniquely changing flame crown for Heatblast.

- Idle: 3 × 2 ready-stance drawings. Ready, inhale, lean forward, shift balance back, relax, return near the first pose.
- Walk: six forward and six backward cels with contact, weight shift and passing poses. XLR8 skates, Four Arms transfers weight through heavier planted steps, Heatblast has a moving flame crown.
- Dash: five forward and five backward cels. Compress, lean, drive, change supporting leg, brake. Stay facing right during backdash.
- Crouch and jump: five columns and four rows. Entry, full crouch, rise, load, toe-off, rise, tuck at apex, extend to fall, land and recover.
- Normals: 3 × 3. Light windup/contact/retract, medium windup/contact/retract, then universal throw reach/lift/release. Use the anatomy and palette of the referenced fighter. No external fireballs or weapons.

`node scripts/run_art.mjs scripts/pack_ben_aliens.py` extracts each complete opaque silhouette, applies nearest-neighbor, aligns the ground pivot and exports the per-action atlases and scale proof.

