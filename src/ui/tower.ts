import type { GameSession } from "../game/session";
import { currentFloor, towerFloors, type TowerAttempt } from "../game/tower";
import { fighterImage, fighterInfo } from "./catalog";

const floorNumber = (index: number) => String(index + 1).padStart(2, "0");
const timeLabel = (ticks: number) => {
  const seconds = Math.floor(ticks / 60);
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
};

function stats(attempt: TowerAttempt, best: number) {
  return `<dl class="tower-stats"><div><dt>Vitórias</dt><dd>${attempt.results.length}</dd></div><div><dt>Derrotas</dt><dd>${attempt.losses}</dd></div><div><dt>Tempo de lutas</dt><dd>${timeLabel(attempt.ticks)}</dd></div><div><dt>Recorde</dt><dd>${best} / ${towerFloors.length}</dd></div></dl>`;
}

export function towerResume(attempt: TowerAttempt, best: number) {
  return `<div class="panel tower-resume"><span class="eyebrow">ARCADE / TORRE</span><h2>Uma subida em andamento</h2><p>${fighterInfo(attempt.fighter).name} · Andar ${currentFloor(attempt) + 1} de ${towerFloors.length}</p>${stats(attempt, best)}<div class="button-row"><button id="continue-tower" class="primary">CONTINUAR TORRE <span>↑</span></button><button id="new-tower">NOVA TENTATIVA</button><button id="back" class="text">Menu principal</button></div><p class="hint">Confirmar um lutador para uma nova tentativa substitui o progresso atual.</p></div>`;
}

export function towerScreen(session: GameSession, best: number) {
  const attempt = session.tower!,
    { stage } = session;
  const enemy = session.route[stage],
    fighter = fighterInfo(enemy);
  const floor = towerFloors[stage],
    role = "boss" in floor ? floor.boss : "";
  const currentTitle =
    role === "final"
      ? "Confronto decisivo"
      : role === "mini"
        ? "A prova do meio"
        : "Torre Arcade";
  return `<div class="panel tower-panel ${role ? "tower-" + role : ""}" data-tower-boss="${role || "none"}">
    <div class="tower-heading"><div><span class="eyebrow">ARCADE / ANDAR ${floorNumber(stage)}</span><h2>${currentTitle}</h2></div><span class="step-indicator">${attempt.results.length} / ${towerFloors.length} VENCIDOS</span></div>
    <div class="tower-layout">
      <ol class="tower-stack" reversed aria-label="Andares da Torre">
        ${towerFloors
          .map((item, i) => ({ item, i }))
          .reverse()
          .map(({ item, i }) => {
            const state =
              i < attempt.results.length
                ? "cleared"
                : i === stage
                  ? "current"
                  : "locked";
            const tag =
              "boss" in item
                ? item.boss === "final"
                  ? "Chefe final"
                  : "Mini-chefe"
                : "";
            return `<li class="tower-floor ${state}" data-floor="${i + 1}" data-floor-state="${state}" ${state === "current" ? 'aria-current="step"' : ""}><span class="floor-number">${floorNumber(i)}</span><span class="floor-name">${fighterInfo(attempt.route[i]).name}</span><span class="floor-role">${tag || (state === "cleared" ? "Vencido" : state === "current" ? "Atual" : "Bloqueado")}</span></li>`;
          })
          .join("")}
      </ol>
      <section class="tower-opponent" aria-label="Adversário do andar">
        <div class="tower-portrait"><img src="${fighterImage(enemy)}" alt="${fighter.name}"></div>
        <span class="eyebrow">${floor.label.toUpperCase()}</span>
        <h3>${fighter.name}</h3>
        <p>${fighter.style}</p>
        <small>${fighterInfo(attempt.fighter).name} · Melhor de três rounds</small>
      </section>
    </div>
    ${stats(attempt, best)}
    <div class="button-row"><button id="fight" class="primary">${role === "final" ? "ENFRENTAR O CHEFE" : "INICIAR ANDAR"} <span>↑</span></button><button id="back" class="text">Menu principal</button></div>
  </div>`;
}

export function towerResult(session: GameSession, best: number) {
  const attempt = session.tower!;
  const status = session.status,
    cleared = status !== "defeat";
  const [self, enemy] = session.match.fighters;
  const title =
    status === "victory"
      ? "Torre concluída"
      : cleared
        ? `Andar ${session.stage + 1} vencido`
        : `Derrota no andar ${session.stage + 1}`;
  const image = cleared ? attempt.fighter : attempt.route[session.stage];
  return `<div class="panel result tower-result ${status === "victory" ? "tower-champion" : ""}">
    <span class="eyebrow">ARCADE / ${status === "victory" ? "CAMPEÃO DA TORRE" : "RESULTADO"}</span>
    <h2>${title}</h2>
    <div class="result-winner"><img src="${fighterImage(image)}" alt="${fighterInfo(image).name}"><div><small>${cleared ? "VENCEDOR" : "ADVERSÁRIO"}</small><strong>${cleared ? self.data.name : enemy.data.name}</strong><p>${status === "victory" ? "Dez andares conquistados." : `${self.data.name} × ${enemy.data.name}`}</p></div></div>
    <div class="score"><strong>${session.match.wins[0]}</strong><span>ROUNDS</span><strong>${session.match.wins[1]}</strong></div>
    ${stats(attempt, best)}
    ${status === "stageClear" ? `<p>Próximo andar · ${fighterInfo(attempt.route[session.stage + 1]).name}</p><button id="next-opponent" class="primary">VER PRÓXIMO ANDAR <span>↑</span></button>` : `<button id="again" class="primary">${cleared ? "JOGAR NOVAMENTE" : "TENTAR NOVAMENTE"}</button>`}
    <button id="return" class="text">Menu principal</button>
  </div>`;
}
