import type { Finish } from "./kaneki-chain";

// Each row defines a distinct actor/victim track, impact beat and release.
export const expandedFinishes = {
  rinkakuCombo: {
    keys: [[5,9,0,54,6],[10,16,0,51,10],[15,23,0,47,14],[21,28,0,58,12],[28,31,0,118,19]],
    beats: [{ at:10, damage:13 }, { at:15, damage:17 }], hit:21, damage:45, recovery:12, stop:7, push:7, launch:-3, limbs:2,
  },
  redSpiral: {
    keys: [[6,0,0,45,25],[13,4,0,-43,89],[20,-6,0,-53,35],[29,10,0,81,52],[36,13,0,188,24]],
    hit:29, damage:91, recovery:18, stop:9, push:12, launch:-4, limbs:2,
  },
  centipedeDrop: {
    keys: [[9,-8,0,54,17],[17,-10,42,46,43],[29,-2,235,41,218],[39,10,348,39,290],[48,20,315,33,240],[57,29,229,27,175],[68,39,57,24,0],[74,34,0,44,0],[82,22,0,56,0]],
    hit:68, damage:135, recovery:22, stop:13, push:3, launch:0, slam:true, limbs:4,
  },
  quickSwing: {
    keys: [[4,0,0,0,36],[10,-5,0,-18,68],[17,0,0,70,56],[24,2,0,130,34]],
    hit:17, damage:60, recovery:10, stop:6, push:9, launch:-3, limbs:1, relativeGap:true,
  },
  doubleSwing: {
    keys: [[7,0,0,-34,50],[15,-5,0,25,103],[22,-7,0,-48,63],[30,2,0,18,133],[38,6,0,120,71],[46,9,0,198,36]],
    hit:38, damage:91, recovery:17, stop:9, push:12, launch:-4, limbs:2, relativeGap:true,
  },
  redCatapult: {
    keys: [[8,-5,0,-24,53],[17,-11,0,-68,91],[27,4,0,25,165],[35,13,0,123,132],[46,17,0,251,83]],
    hit:35, damage:120, recovery:23, stop:11, push:15, launch:-3, limbs:4, relativeGap:true,
  },
  aerialSnatch: {
    keys: [[5,9,42,65,128],[12,28,131,46,151],[18,43,133,57,117],[23,49,75,93,43],[32,53,0,127,16]],
    hit:18, damage:62, recovery:12, stop:7, push:6, launch:3, limbs:1,
  },
  rinkakuCyclone: {
    keys: [[7,11,74,59,133],[14,30,153,51,202],[21,32,180,-62,195],[27,28,148,-47,112],[35,46,117,87,155],[49,54,0,221,60]],
    hit:35, damage:93, recovery:18, stop:9, push:13, launch:-2, limbs:3,
  },
  centipedeMeteor: {
    keys: [[6,22,63,66,133],[16,53,197,55,230],[25,73,310,43,290],[34,70,332,38,270],[42,88,254,31,196],[53,138,63,24,0],[60,136,0,49,0],[70,119,0,60,0]],
    hit:53, damage:153, recovery:29, stop:15, push:4, launch:0, slam:true, limbs:4,
  },
  swordsRecall: {
    keys: [[7,3,0,84,46],[12,8,0,51,17],[18,13,0,52,2],[22,12,0,58,0]],
    hit:18, damage:22, recovery:6, stop:5, push:.7, launch:0, follow:"ground", limbs:2,
  },
  swordsSide: {
    keys: [[7,-7,0,74,54],[15,8,0,119,72],[23,15,0,234,34]],
    hit:15, damage:29, recovery:15, stop:8, push:13, launch:-3, limbs:4,
  },
  swordsRise: {
    keys: [[6,3,0,69,29],[13,8,0,64,72],[19,10,0,69,87]],
    hit:13, damage:24, recovery:12, stop:7, push:1, launch:-8, follow:"air", limbs:2,
  },
  rushReel: {
    keys: [[4,4,0,68,10],[9,9,0,50,3],[13,7,0,56,0]],
    hit:9, damage:36, recovery:5, stop:5, push:.6, launch:0, follow:"ground", limbs:1,
  },
  rushQuickThrow: {
    keys: [[5,3,0,52,24],[11,8,0,104,38],[17,9,0,141,15]],
    hit:11, damage:62, recovery:10, stop:6, push:7, launch:-3, limbs:1,
  },
  rushShortLift: {
    keys: [[5,3,0,60,17],[10,5,0,51,47],[16,7,0,62,51]],
    hit:10, damage:43, recovery:10, stop:5, push:.9, launch:-7, follow:"air", limbs:2,
  },
  rushCrossover: {
    keys: [[6,7,0,59,33],[13,15,0,12,109],[20,16,0,-67,77],[27,15,0,-87,8]],
    hit:20, damage:53, recovery:13, stop:7, push:-5, launch:-2, limbs:2,
  },
  rushSpinThrow: {
    keys: [[7,3,0,42,27],[14,-4,0,-41,84],[20,8,0,72,102],[30,18,0,183,37]],
    hit:20, damage:89, recovery:16, stop:8, push:11, launch:-4, limbs:2,
  },
  rushAirSet: {
    keys: [[6,9,0,54,29],[13,14,0,61,84],[20,18,0,74,113]],
    hit:13, damage:56, recovery:13, stop:7, push:1.2, launch:-10, follow:"air", limbs:2,
  },
  rushDragStrike: {
    keys: [[6,-5,0,64,24],[14,8,0,47,13],[21,16,0,61,0],[26,12,0,68,0]],
    beats: [{ at:14, damage:22 }], hit:21, damage:55, recovery:12, stop:8, push:1.5, launch:0, follow:"ground", limbs:3,
  },
  rushHeavyThrow: {
    keys: [[8,-6,0,46,24],[16,-5,0,-34,99],[23,10,0,119,91],[33,16,0,229,38]],
    hit:23, damage:118, recovery:21, stop:11, push:14, launch:-4, limbs:3,
  },
  rushSlam: {
    keys: [[8,7,0,54,27],[17,24,129,49,112],[24,39,168,44,137],[30,50,143,36,110],[39,77,53,22,0],[47,76,0,48,0],[53,61,0,61,0]],
    hit:39, damage:122, recovery:26, stop:13, push:4, launch:0, slam:true, limbs:4,
  },
} satisfies Record<string, Finish>;

export type ExpandedRoute = keyof typeof expandedFinishes;

export const expandedNames: Record<ExpandedRoute, string> = {
  rinkakuCombo: "Rinkaku Combo", redSpiral: "Red Spiral", centipedeDrop: "Centipede Drop",
  quickSwing: "Quick Swing", doubleSwing: "Double Swing", redCatapult: "Red Catapult",
  aerialSnatch: "Aerial Snatch", rinkakuCyclone: "Rinkaku Cyclone", centipedeMeteor: "Centipede Meteor",
  swordsRecall: "Recolhimento", swordsSide: "Arremesso Lateral", swordsRise: "Arremesso Ascendente",
  rushReel: "Puxão de Investida", rushQuickThrow: "Arremesso Rápido", rushShortLift: "Lançamento Curto",
  rushCrossover: "Reposicionamento", rushSpinThrow: "Arremesso Giratório", rushAirSet: "Lançamento Aéreo",
  rushDragStrike: "Arrasto Rinkaku", rushHeavyThrow: "Arremesso Pesado", rushSlam: "Arremesso Descendente",
};

