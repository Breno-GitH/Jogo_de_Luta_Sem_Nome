// Node-only test fixture. Never imported by the game or served by Apache.
export{Match}from"../../src/engine/combat";
export{characters}from"../../src/engine/characters";
export{snapshot,hashState}from"../../src/engine/state";
export{astaSpecialBlade}from"../../src/engine/asta-specials";

export{recordAstaDamage}from"../../src/engine/asta-causality";
export{addCombatStatus}from"../../src/engine/status-effects";
export{causalityVolumes}from"../../src/engine/asta-antimagic";
