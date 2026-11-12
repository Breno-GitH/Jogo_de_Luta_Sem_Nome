import { assetBase } from "../asset-base";
import curseBalance from "../data/sasuke-curse.json";
import type { CharacterId } from "../engine/characters";
import type { Bindings } from "../game/preferences";
import { keyLabel } from "../game/preferences";
import { benId } from "../engine/ben-omnitrix";

export const roster: {
  id: CharacterId;
  name: string;
  style: string;
  status: string;
  prototype?: boolean;
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
    style: "Técnico híbrido. Use Kusanagi e Katon para controlar a distância e a Marca II para pressionar com Raiton e avanço aéreo.",
    status: "Nove normais · oito especiais · Marca II temporária · agarrão · Kirin",
  },
  {
    id: "kaneki",
    name: "Kaneki Ken",
    style: "Grappler de captura. Os Kagunes puxam, arremessam ou lançam o adversário.",
    status: "Normais · especiais · Chain Grabs · Centipede",
  },
  {
    id: benId,
    name: "Ben Tennyson",
    style: "Omniverse. Onze alienígenas selecionáveis pelo Omnitrix, cada um com seu estilo de combate.",
    status: "Onze formas cadastradas · transformação com L · especiais próprios · Alien X reservado",
  },
];
export const completeRoster = roster.filter(fighter => !fighter.prototype);
export const fighterInfo = (id: CharacterId) =>
  roster.find((c) => c.id === id)!;
export const fighterImage = (id: CharacterId) =>
  `${assetBase}sprites/${id}/base${id === "luffy" ? "-polished" : ""}.png`;
const curseDescription =
  `Marca II: ${curseBalance.durationTicks / 60} s de combate ativo, ${curseBalance.cooldownTicks / 60} s de recarga após a reversão. Amplia a mobilidade e muda os golpes.`;
function fighterPortrait(id: CharacterId, name: string, animate: boolean) {
  const still = `<img src="${fighterImage(id)}" alt="${name}" draggable="false">`;
  return (id === "sasuke" || id === benId) && animate
    ? `<picture><source media="(prefers-reduced-motion: no-preference)" srcset="${assetBase}sprites/${id}/menu-idle.webp">${still}</picture>`
    : still;
}

export function characterCards(
  name: string,
  selected: CharacterId | undefined,
  prefix = name,
  disabled = false,
  includePrototype = false,
) {
  return `<div class="character-grid" role="group" aria-label="Escolha de personagem">${(includePrototype ? roster : completeRoster).map((c) => `<label class="character-card ${selected === c.id ? "selected" : ""}" data-character="${c.id}"><input type="radio" id="${prefix}-${c.id}" name="${name}" value="${c.id}" aria-label="Selecionar ${c.name}" ${selected === c.id ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="sprite-window">${fighterPortrait(c.id, c.name, selected === c.id)}</span><strong>${c.name}</strong><small>${c.prototype ? "PROTÓTIPO" : c.id === "luffy" ? "ZONER" : c.id === "dio" ? "STAND" : c.id === "goku" ? "MOBILIDADE" : c.id === "kaneki" ? "GRAPPLER" : "TÉCNICO"}</small></label>`).join("")}</div>`;
}
export function fighterHero(id: CharacterId) {
  const c = fighterInfo(id);
  return `<div class="hero-sprite">${fighterPortrait(id, c.name, true)}</div><div><span class="eyebrow">SEU LUTADOR</span><h2>${c.name}</h2><p>${c.style}</p><small class="availability">${c.status}</small>${id === "sasuke" ? `<p class="hint">${curseDescription}</p>` : ""}</div>`;
}
export function controlsContent(b: Bindings, id?: CharacterId) {
  return `<div class="controls-list">${Object.entries(b)
    .map(
      ([action, code]) =>
        `<span><kbd>${keyLabel(code)}</kbd> ${id === benId && action === "heavy" ? "Omnitrix" : id === benId && action === "ultimate" ? "Alien X (reservado)" : actionNames[action as keyof Bindings]}</span>`,
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
    ben: [
      `Normais das formas jogáveis|${keyLabel(b.light)} / ${keyLabel(b.medium)} em pé, com ${keyLabel(b.down)} ou no ar`,
      `XLR8|↓ → Turbo Rush · ↓ ← Ciclone · ↓ ↓ Deslocamento Relâmpago + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `Quatro Braços|↓ → Investida · ↓ ← Agarrão Quádruplo · ↓ ↓ Palma Sísmica + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `Chama|↓ → Bola de Fogo · ↓ ← Pilar de Chamas · ↓ ↓ Propulsão + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `Diamante|↓ → Espinhos de Cristal · ↓ ← Muralha · ↓ ↓ Rajada de Fragmentos + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `Enormossauro|↓ → Salto Colossal · ↓ ← Arma Improvisada (Carro) · ↓ ↓ Crescimento + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `Feedback|↓ → Tempestade Elétrica · ↓ ← Captura Condutora · ↓ ↓ Esfera J / Feixe K + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `Friagem|↓ → Sopro Congelante · ↓ ← Mergulho Glacial · ↓ ↓ Voo Fantasma + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `Fantasmático|↓ → Emboscada Subterrânea · ↓ ← Caçada Espectral · ↓ ↓ Pesadelo Espectral + ${keyLabel(b.light)} / ${keyLabel(b.medium)}`,
      `NRG contido|↓ → Raio de Calor · ↓ ← Aríete ${keyLabel(b.light)} / Martelo ${keyLabel(b.medium)} · ↓ ↓ Liberação ${keyLabel(b.light)} / Contrapressão ${keyLabel(b.medium)}`,
      `NRG liberado|↓ → Raios de Calor · ↓ ← Ataques de Área · ↓ ↓ Impulso ${keyLabel(b.light)} / Recontenção ${keyLabel(b.medium)}`,
      `Gravattack|↓ → Atração / Elevação · ↓ ← Repulsão · ↓ ↓ Campo J / Planetoide K`,
      `Eco Eco|↓ → Grito Sônico · ↓ ← Duplicação (até duas cópias) · ↓ ↓ Harmonia Sônica`,
      `Omnitrix|Toque ${keyLabel(b.heavy)} para avançar. Segure por ¼ s para confirmar a forma selecionada.`,
      `Agarrão|${keyLabel(b.throw)} · adversário em solo e ao alcance`,
      "Controle USB|Y / △ · toque para avançar, segure para confirmar",
      `Alien X — Reescrita da Realidade|${keyLabel(b.ultimate)} · uma barra · cinematografia após acerto`,
    ],
    kaneki: [
      `Em pé|${atk} · soco, chute giratório e chicote Kagune`,
      `Agachado|${keyLabel(b.down)} + ${atk} · soco baixo, rasteira e lançador duplo`,
      `No ar|${atk} · soco, chute diagonal e Kagune com captura condicionada`,
      `Kagune Grab|↓ → + ${atk} · captura de alcance variável com escolha de continuação`,
      `Kagune: Four Swords|↓ ← + ${atk} · sequência de quatro Kagunes após acerto do golpe inicial`,
      `Rinkaku Rush|↓ ↓ + ${atk} · investida com impacto corporal ou captura pela ponta`,
      `Centipede · Frenesi da Kakuja|${keyLabel(b.ultimate)} · uma barra · acerte a ponta ou converta uma janela válida de U, Kagune Grab ou Rush`,
      `Captura Rinkaku|${keyLabel(b.throw)} · no chão · pode cancelar Médio em pé confirmado`,
      `Puxar|${keyLabel(b.light)} durante a captura · aproxima para continuar`,
      `Arremessar|${keyLabel(b.medium)} durante a captura · afasta e derruba`,
      `Lançar|${keyLabel(b.heavy)} durante a captura → ${keyLabel(b.jump)} no solo · combo aéreo`,
    ],
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
      `Agarrão de pulso|${keyLabel(b.throw)} · adversário em solo e ao alcance`,
      `Provocação|${keyLabel(b.taunt)} · em solo`,
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
    )}</div>${id === benId ? "<p>Onze alienígenas têm normais, agarrão e duas versões por especial. Friagem acumula frio e tem voo limitado. Fantasmático revela Zs’Skayr em acerto confirmado. NRG alterna entre armadura e forma energética. Diamante cria cristais, Enormossauro cresce temporariamente e Feedback absorve projéteis de energia compatíveis no início de uma guarda. Vida e energia são compartilhadas. A troca fica indisponível durante golpes sem janela de cancelamento e reações a dano.</p>" : id === "kaneki" ? "<p>Leve → Médio → Forte. Baixo + Forte → Pular → combo aéreo. Uma captura por combo. U oferece as rotas clássicas. Kagune Grab oferece nove finalizações e até cinco segundos no total. O defensor pode quebrar a captura completando os três comandos de resistência da HUD. Four Swords e a ponta do Rush oferecem finalizações próprias com J/K/L. Solte baixo entre os dois toques do Rush. Centipede assume a Kakuja durante a sequência confirmada e consome uma barra de Super.</p>" : "<p>Leve → Médio → Forte. Baixo + Forte → Pular → combo aéreo. Normais podem cancelar em especiais nas janelas de confirmação. Os especiais comuns não gastam Super.</p>"}${id === "goku" ? "<p>Teletransporte no ar: leve avança, médio aparece atrás, forte persegue alvo em combo aéreo. Um uso por salto/combo. Solte baixo entre os dois toques.</p>" : id === "luffy" ? "<p>Os três especiais são terrestres. Normais aéreos continuam elásticos. Solte baixo entre os dois toques do Bazooka. Confirme Médio para Pistol ou Bazooka e Forte para Gatling. O agarrão vence a guarda, mas exige um adversário em solo e ao alcance.</p>" : id === "dio" ? "<p>The World executa todos os normais. Parada do Tempo preserva sua recarga entre rounds. Agarrão próprio indisponível.</p>" : id === "sasuke" ? `<p>${curseDescription} Solte baixo entre os dois toques. Kirin usa a barra de Super e muda de variante conforme a forma na ativação.</p>` : ""}`;
}
