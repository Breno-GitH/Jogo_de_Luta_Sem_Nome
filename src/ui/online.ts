import { fighterInfo, fighterImage } from "./catalog";
import type { OnlineClient } from "../net/client";
export const escapeText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export function onlineEntry(client?: OnlineClient) {
  return `<div class="panel online-panel"><span class="eyebrow">MULTIPLAYER LAN / SALA PRIVADA</span><h2>Encontre seu <em>adversário.</em></h2><p>Crie uma sala e compartilhe o código. O outro jogador deve acessar o endereço LAN deste computador, na mesma rede.</p><p class="connection-state" id="connection-state">${escapeText(client?.connectionText ?? "Preparando conexão…")}</p><button class="primary" id="create-room" ${!client?.connected || client.fatal ? "disabled" : ""}>CRIAR SALA <span>→</span></button><form id="join-form"><label for="room-code">Código da sala</label><div class="join-row"><input id="room-code" name="code" maxlength="6" minlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" required aria-label="Código da sala"><button id="join-room" type="submit" ${!client?.connected || client.fatal ? "disabled" : ""}>Entrar em sala</button></div></form><p class="online-error" id="online-error" role="alert">${escapeText(client?.message ?? "")}</p><button class="text" id="reconnect-online">Tentar conexão novamente</button><button class="text" id="back">Retornar ao menu</button></div>`;
}
export { lobby } from "./online-lobby";
export function onlineResult(client: OnlineClient) {
  const result = client.result!,
    won = result.winner === client.seat,
    closed = client.room?.status === "closed",
    ready = client.room?.players[client.seat]?.rematch;
  const description =
    result.reason === "disconnect"
      ? "A conexão do adversário não voltou dentro do prazo."
      : result.reason === "left"
        ? "O adversário saiu da sala."
        : result.reason === "desync"
          ? "A luta foi encerrada após divergências repetidas de sincronização."
          : result.reason === "inputTimeout"
            ? "A luta foi encerrada porque faltaram comandos por tempo demais."
            : "Os dois jogadores podem solicitar uma revanche nesta sala.";
  return `<div class="panel result"><span class="eyebrow">MULTIPLAYER LAN / RESULTADO</span><h2>${result.winner === null ? "Luta encerrada." : won ? "Vitória." : "Derrota."}</h2>${result.winner !== null && client.room?.players[result.winner]?.character ? `<div class="result-winner"><img src="${fighterImage(client.room.players[result.winner]!.character!)}" alt="Vencedor"><div><small>VENCEDOR</small><strong>${fighterInfo(client.room.players[result.winner]!.character!).name}</strong><p>Derrotado: ${client.room.players[1 - result.winner]?.character ? fighterInfo(client.room.players[1 - result.winner]!.character!).name : "Adversário"}</p></div></div>` : ""}<p>${description}</p><p class="connection-state" id="connection-state">${escapeText(client.connectionText)}</p><div class="score"><strong>${client.match?.wins[client.seat] ?? 0}</strong><span>ROUNDS</span><strong>${client.match?.wins[1 - client.seat] ?? 0}</strong></div>${!closed ? `<button class="primary" id="online-rematch" ${ready || !client.room?.players.every((p) => p?.connected) ? "disabled" : ""}>${ready ? "REVANCHE SOLICITADA" : "PEDIR REVANCHE"}</button><p class="hint">${ready ? "Aguardando a confirmação do adversário." : "A revanche só começa com a confirmação dos dois."}</p>` : ""}<button id="online-lobby">RETORNAR AO LOBBY</button><p class="${/restaurad/.test(client.message) ? "connection-state" : "online-error"}" id="online-error" role="status">${escapeText(client.message)}</p><button class="text" id="leave-room">Sair da sala e retornar ao menu</button></div>`;
}
