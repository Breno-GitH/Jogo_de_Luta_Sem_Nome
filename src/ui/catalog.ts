import { assetBase } from "../asset-base";
import type { CharacterId } from "../engine/characters";
import type { Bindings } from "../game/preferences";
import { keyLabel } from "../game/preferences";

export const roster: {
  id: CharacterId;
  name: string;
  style: string;
  status: string;
}[] = [
  {
    id: "samurai",
    name: "Samurai",
    style: "Espadachim técnico, com cortes rápidos e contra-ataques.",
    status: "Normais · especiais · Mil Cortes",
  },
  {
    id: "dio",
    name: "Dio Brando",
    style: "Controle de espaço utilizando The World e habilidades especiais.",
    status: "Normais do Stand · especiais · Road Roller. Sem agarrão próprio.",
  },
  {
    id: "goku",
    name: "Goku",
    style: "Combate rápido, combos aéreos, projéteis de Ki e teletransporte.",
    status: "Normais · especiais · Fúria Saiyajin",
  },
  {
    id: "luffy",
    name: "Luffy",
    style:
      "Zoner elástico, especializado em alcance e pressão de longa distância.",
    status:
      "Normais · três especiais terrestres · agarrão elástico",
  },
  {
    id: "sasuke",
    name: "Sasuke · Hebi",
    style: "Taijutsu preciso, Kusanagi e controle de distância com Raiton e Katon.",
    status: "Nove normais · oito especiais · Marca da Maldição nível 2",
  },
];
export const fighterInfo = (id: CharacterId) =>
  roster.find((c) => c.id === id)!;
export const fighterImage = (id: CharacterId) =>
  `${assetBase}sprites/${id}/base${id === "luffy" ? "-polished" : ""}.png`;
export function characterCards(
  name: string,
  selected: CharacterId | undefined,
  prefix = name,
  disabled = false,
) {
  return `<div class="character-grid" role="group" aria-label="Escolha de personagem">${roster.map((c) => `<label class="character-card ${selected === c.id ? "selected" : ""}" data-character="${c.id}"><input type="radio" id="${prefix}-${c.id}" name="${name}" value="${c.id}" aria-label="Selecionar ${c.name}" ${selected === c.id ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="sprite-window"><img src="${fighterImage(c.id)}" alt="${c.name}" draggable="false"></span><strong>${c.name}</strong><small>${c.id === "luffy" ? "ZONER" : c.id === "dio" ? "STAND" : c.id === "goku" ? "MOBILIDADE" : "TÉCNICO"}</small></label>`).join("")}</div>`;
}
export function fighterHero(id: CharacterId) {
  const c = fighterInfo(id);
  return `<div class="hero-sprite"><img src="${fighterImage(id)}" alt="${c.name}"></div><div><span class="eyebrow">SEU LUTADOR</span><h2>${c.name}</h2><p>${c.style}</p><small class="availability">${c.status}</small></div>`;
}
export function controlsContent(b: Bindings) {
  return `<div class="controls-list">${Object.entries(b)
    .map(
      ([action, code]) =>
        `<span><kbd>${keyLabel(code)}</kbd> ${actionNames[action as keyof Bindings]}</span>`,
    )
    .join(
      "",
    )}<span><kbd>Esc</kbd> Pausa / voltar</span></div><p>Segure para trás para defender. Baixo + trás defende golpes baixos. Dash: segure a tecla de dash e pressione uma direção. Os comandos abaixo são relativos ao lado para o qual seu personagem olha.</p>`;
}
export const actionNames: Record<keyof Bindings, string> = {
  left: "Esquerda",
  right: "Direita",
  jump: "Pular",
  down: "Agachar",
  light: "Leve",
  medium: "Médio",
  heavy: "Forte",
  ultimate: "Super",
  dash: "Dash / Backdash",
  throw: "Agarrar",
  taunt: "Provocar",
};
export function movesContent(id: CharacterId, b: Bindings) {
  const atk = `${keyLabel(b.light)} / ${keyLabel(b.medium)} / ${keyLabel(b.heavy)}`;
  const moves: Record<CharacterId, string[]> = {
    samurai: [
      "Saque Relâmpago|↓ ↘ → + " + atk,
      "Postura de Contra-ataque|↓ ↙ ← + " + atk,
      "Corte Crescente|→ ↓ ↘ + " + atk,
      `Mil Cortes|${keyLabel(b.ultimate)} · 100 de energia`,
    ],
    dio: [
      "Lançamento de Facas|↓ → + " + atk,
      "Muda Muda Rush|↓ ← + " + atk,
      `Parada do Tempo|→ ↓ + ${keyLabel(b.heavy)} · recarga progressiva`,
      `Road Roller|${keyLabel(b.ultimate)} · 2 barras`,
    ],
    goku: [
      "Rajada de Ki|↓ → + " + atk,
      "Kamehameha|↓ ← + " + atk,
      "Teletransporte|↓ ↓ + " + atk,
      `Fúria Saiyajin|${keyLabel(b.ultimate)} · barra completa · SSJ1 apenas na cinematografia`,
    ],
    sasuke: [
      `Taijutsu em pé|Soco ${keyLabel(b.light)} · chute ${keyLabel(b.medium)}`,
      `Kusanagi em pé|${keyLabel(b.heavy)} · corte horizontal`,
      `Agachado|${keyLabel(b.down)} + ${atk} · soco baixo, rasteira e launcher`,
      `No ar|${atk} · soco, chute e corte descendente`,
      `Perseguir lançamento|${keyLabel(b.down)} + ${keyLabel(b.heavy)} → ${keyLabel(b.jump)}`,
      `Chidori Senbon|↓ → + ${keyLabel(b.light)}`,
      `Chidori Eisō|↓ → + ${keyLabel(b.medium)}`,
      `Chidori|↓ → + ${keyLabel(b.heavy)}`,
      `Katon: Gōkakyū|↓ ← + ${keyLabel(b.light)}`,
      `Katon: Hōsenka|↓ ← + ${keyLabel(b.medium)}`,
      `Katon: Gōryūka|↓ ← + ${keyLabel(b.heavy)}`,
      `Serpentes|↓ ↓ + ${keyLabel(b.light)}`,
      `Chidori Nagashi|↓ ↓ + ${keyLabel(b.medium)}`,
      `Marca da Maldição nível 2|↓ ↓ + ${keyLabel(b.heavy)} · transformação temporária`,
      `Kirin|${keyLabel(b.ultimate)} · barra completa · confirme o golpe inicial`,
      `Avanço aéreo com asas|${keyLabel(b.dash)} no ar · um por salto na Marca`,
    ],
    luffy: [
      "Gomu Gomu no Pistol|↓ → + " + atk,
      "Gomu Gomu no Gatling|↓ ← + " + atk,
      "Gomu Gomu no Bazooka|↓ ↓ + " + atk,
      `Agarrão elástico|${keyLabel(b.throw)} · curto alcance em solo`,
      `Provocação|${keyLabel(b.taunt)}`,
      `Gomu Gomu no Jet Gigant|${keyLabel(b.ultimate)} · barra completa · confirme o Jet Pistol`,
    ],
  };
  return `<div class="move-list">${moves[id]
    .map((s) => {
      const [name, command] = s.split("|");
      return `<div><strong>${name}</strong><span>${command}</span></div>`;
    })
    .join(
      "",
    )}</div><p>Leve → Médio → Forte. Baixo + Forte → Pular → combo aéreo. Normais podem cancelar em especiais nas janelas de confirmação. Os especiais comuns não gastam Super.</p>${id === "goku" ? "<p>Teletransporte no ar: leve avança, médio aparece atrás, forte persegue alvo em combo aéreo. Um uso por salto/combo. Solte baixo entre os dois toques.</p>" : id === "luffy" ? "<p>Os três especiais são terrestres. Normais aéreos continuam elásticos. Solte baixo entre os dois toques do Bazooka. Confirme Médio para Pistol ou Bazooka e Forte para Gatling. O agarrão vence a guarda, mas exige um adversário em solo e ao alcance.</p>" : id === "dio" ? "<p>The World executa todos os normais. Parada do Tempo preserva sua recarga entre rounds. Agarrão próprio indisponível.</p>" : id === "sasuke" ? "<p>Use frente e trás em relação ao adversário. Solte baixo entre os dois toques. A Marca tem recarga própria e preserva a barra de Super.</p>" : ""}`;
}
