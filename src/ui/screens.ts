import type { Mode, GameSession } from "../game/session";
import type { CharacterId } from "../engine/characters";
import type { Preferences } from "../game/preferences";
import { keyLabel } from "../game/preferences";
import {
  completeRoster,
  characterCards,
  fighterHero,
  fighterInfo,
  fighterImage,
  actionNames,
} from "./catalog";
export const difficultyName = {
  easy: "Fácil",
  normal: "Normal",
  hard: "Difícil",
};
export const modeName: Record<Mode, string> = {
  versus: "Versus BOT",
  arcade: "Arcade Torre",
  training: "Treinamento",
};
export const menuScreen = () =>
  `<div class="main-menu"><div class="menu-copy"><span class="eyebrow">FIGHTING PROJECT / 60 Hz</span><h1>SEM<span>NOME</span></h1><p class="tagline">${completeRoster.length} ESTILOS.<br>UMA ARENA.</p><nav aria-label="Menu principal">${[
    ["arcade", "01", "ARCADE", "Dez andares. Vença até chegar ao topo."],
    ["versus", "02", "VERSUS BOT", "Seu rival. Sua dificuldade."],
    ["training", "03", "TREINAMENTO", "Explore golpes, alcance e combos."],
    ["online", "04", "MULTIPLAYER LAN", "Dois jogadores. Uma sala privada."],
    ["settings", "05", "OPÇÕES", "Áudio, vídeo e controles."],
  ]
    .map(
      ([id, n, label, hint]) =>
        `<button class="menu-option" id="${id}"><span class="menu-index">${n}</span><span><strong>${label}</strong><small>${hint}</small></span><b>›</b></button>`,
    )
    .join(
      "",
    )}</nav><div class="nav-help"><kbd>W</kbd><kbd>S</kbd> navegar <kbd>Enter</kbd> confirmar <kbd>Esc</kbd> voltar</div></div><div class="menu-cast" aria-label="Elenco atual">${completeRoster.map((c) => `<div class="cast-member cast-${c.id}"><img src="${fighterImage(c.id)}" alt="${c.name}"><strong>${c.name}</strong></div>`).join("")}<span class="cast-caption">ESCOLHA SEU ESTILO DE COMBATE</span></div></div>`;
export type SelectStep = "player" | "opponent" | "ready";
export function selectionScreen(
  mode: Mode,
  selected: CharacterId = "samurai",
  enemy: CharacterId = "dio",
  step: SelectStep = "player",
) {
  const choosing = step !== "ready",
    current = step === "opponent" ? enemy : selected;
  return `<div class="panel selection"><div class="screen-heading"><div><span class="eyebrow">${modeName[mode].toUpperCase()}</span><h2>${step === "player" ? "Escolha seu lutador" : step === "opponent" ? (mode === "training" ? "Parceiro de treino" : "Escolha seu rival") : "Prepare o confronto"}</h2></div><span class="step-indicator">${step === "player" ? "01 / LUTADOR" : step === "opponent" ? "02 / ADVERSÁRIO" : "03 / CONFIRMAÇÃO"}</span></div>${choosing ? `<div class="selection-layout"><div id="fighter-hero" class="fighter-hero">${fighterHero(current)}</div><div class="selection-choices">${characterCards(step === "player" ? "character" : "opponent", current, undefined, false, mode === "training" && step === "player")}<button class="primary" id="confirm-character">CONFIRMAR ${step === "player" ? "LUTADOR" : "ADVERSÁRIO"}<span>→</span></button></div></div>` : `<div class="versus-line"><div><img src="${fighterImage(selected)}" alt="${fighterInfo(selected).name}"><strong>${fighterInfo(selected).name}</strong></div><b>VS</b><div><img src="${fighterImage(enemy)}" alt="Adversário"><strong>${fighterInfo(enemy).name}</strong></div></div><label class="difficulty-label">Dificuldade do BOT <select id="difficulty"><option value="easy">Fácil</option><option value="normal" selected>Normal</option><option value="hard">Difícil</option></select></label><p class="hint">Fácil: espaço para aprender. Normal: pressão equilibrada e combos. Difícil: reage mais rápido, defende melhor e pune aberturas. ${mode === "training" ? "O treino começa com o parceiro parado; você pode ativar a IA na arena." : ""}</p><button class="primary" id="fight">${mode === "training" ? "INICIAR TREINAMENTO" : "ENTRAR NA ARENA"}<span>→</span></button>`}<button class="text" id="back">Voltar</button></div>`;
}
export function resultScreen(session: GameSession) {
  const won = session.status === "victory";
  const [self, enemy] = session.match.fighters;
  const winner = won ? self : enemy;
  return `<div class="panel result"><span class="eyebrow">${modeName[session.mode].toUpperCase()} / RESULTADO</span><h2>${won ? "Vitória" : "Derrota"}</h2><div class="result-winner"><img src="${fighterImage(winner.data.id as CharacterId)}" alt="Vencedor"><div><small>VENCEDOR</small><strong>${winner.data.name}</strong><p>Derrotado: ${(won ? enemy : self).data.name}</p></div></div><div class="score"><strong>${session.match.wins[0]}</strong><span>ROUNDS</span><strong>${session.match.wins[1]}</strong></div><button class="primary" id="again">REVANCHE</button><button id="change-character">Trocar personagem</button><button class="text" id="return">Menu principal</button></div>`;
}
export function settingsScreen(p: Preferences) {
  return `<div class="panel settings"><span class="eyebrow">CONFIGURAÇÕES LOCAIS</span><h2>Opções</h2><div class="settings-columns"><section><h3>ÁUDIO</h3>${(
    [
      ["master", "Volume geral"],
      ["effects", "Efeitos"],
      ["music", "Música"],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<label>${label}<span><input type="range" id="opt-${id}" aria-label="${label}" min="0" max="100" value="${Math.round(p[id] * 100)}"><output id="value-${id}">${Math.round(p[id] * 100)}%</output></span></label>`,
    )
    .join(
      "",
    )}<label>Silenciar<input type="checkbox" id="opt-muted" ${p.muted ? "checked" : ""}></label><button id="test-sound">Testar som</button><p class="hint">Trilha original sintetizada e efeitos do combate. O áudio começa após sua primeira interação.</p><h3>VÍDEO</h3><button id="fullscreen">${document.fullscreenElement ? "Sair da tela cheia" : "Tela cheia"}</button><label>Escala máxima<select id="opt-scale"><option value="fit" ${p.scale === "fit" ? "selected" : ""}>Ajustar à janela</option><option value="1" ${p.scale === "1" ? "selected" : ""}>1× · 1280 × 720</option><option value="2" ${p.scale === "2" ? "selected" : ""}>2× · 2560 × 1440</option></select></label><label>Escala inteira pixel-perfect<input type="checkbox" id="opt-pixelPerfect" ${p.pixelPerfect ? "checked" : ""}></label><label>Tremor de câmera<input type="checkbox" id="opt-shake" ${p.shake ? "checked" : ""}></label><label>Mostrar FPS<input type="checkbox" id="opt-fps" ${p.fps ? "checked" : ""}></label><p class="hint">A simulação continua em 1280 × 720, a 60 Hz. Em janelas menores, o jogo reduz proporcionalmente. Suavização de imagens sempre desativada.</p></section><section><h3>CONTROLES</h3><p class="hint">Clique em uma tecla e pressione a nova. W/S, Enter e Esc continuam navegando os menus.</p><div class="binding-grid">${Object.entries(
    p.bindings,
  )
    .map(
      ([action, key]) =>
        `<span>${actionNames[action as keyof typeof p.bindings]}</span><button data-bind="${action}" aria-label="Remapear ${actionNames[action as keyof typeof p.bindings]}">${keyLabel(key)}</button>`,
    )
    .join(
      "",
    )}</div><p class="hint">Shift + direção: dash ou backdash. Para defender, segure para trás. Os comandos de especiais acompanham o remapeamento.</p></section></div><p id="settings-message" role="status">Preferências salvas automaticamente neste navegador.</p><div class="button-row"><button id="reset-options">Restaurar padrões</button><button class="primary" id="back">Voltar</button></div></div>`;
}
export const trainingPanel = () =>
  `<section class="training-panel" id="training-panel" hidden aria-label="Configurações de treinamento"><div class="training-head"><div><span class="eyebrow">LABORATÓRIO DE COMBATE</span><h2>Treinamento</h2></div><div class="button-row"><button id="training-moves">Lista de golpes</button><button id="reset-positions">Reiniciar posições</button><button id="clear-damage">Reiniciar combo</button></div></div><div class="training-controls"><label><input type="checkbox" id="infinite-health" checked>Vida infinita para ambos</label><label><input type="checkbox" id="unlimited-meter" checked>Super infinita</label><button id="refill-health">Restaurar vida</button><button id="fill-meter">Encher Super</button><button id="empty-meter">Zerar Super</button><label>Parceiro<select id="dummy"><option value="idle">Parado</option><option value="guard">Defesa em pé</option><option value="crouchGuard">Defesa agachada</option><option value="jump">Pular</option><option value="bot">BOT atacando</option></select></label><label id="training-difficulty-label" hidden>Dificuldade<select id="training-difficulty"><option value="easy">Fácil</option><option value="normal" selected>Normal</option><option value="hard">Difícil</option></select></label></div><div class="training-values">${[0, 1].map((i) => `<label>Vida P${i + 1} (%) <input type="number" id="health-${i}" min="1" max="100" value="100"></label><label>Super P${i + 1} (%) <input type="number" id="meter-${i}" min="0" max="100" value="100"></label>`).join("")}</div><div class="training-metrics"><div>Último golpe<output id="last-damage">0</output></div><div>Dano de combo<output id="combo-damage">0</output></div><div>Hits<output id="combo-hits">0</output></div><div>Melhor combo<output id="best-hits">0</output></div><div>Dano total<output id="total-damage">0</output></div></div><div class="training-states"><p>VOCÊ <output id="player-state"></output></p><p>PARCEIRO <output id="dummy-state"></output></p><p>IA <output id="ai-decision"></output></p><p>COMANDOS <output id="input-history">—</output></p></div><small>Caixas: vermelho = hitbox, verde = hurtbox, azul = pushbox. Esc pausa o treino. A Super usa a tecla configurada (padrão R).</small></section>`;
