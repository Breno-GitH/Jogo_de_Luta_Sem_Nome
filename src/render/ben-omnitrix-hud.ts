import {
  benAliens, omnitrixDialTicks, omnitrixHoldTicks, omnitrixSwapTicks,
  type OmnitrixState,
} from "../engine/ben-omnitrix";
import { benForms } from "../engine/ben-forms";
import { benFormBalance } from "../engine/ben-moves";
import { alienPortrait } from "./ben-alien-portraits";

const tau = Math.PI * 2;
const lime = "#b7f86e";

function ring(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, width = 1, start = 0, end = tau) {
  c.beginPath();
  c.arc(x, y, radius, start, end);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}

function hourglass(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = "#101e19";
  c.fillRect(x - 1, y - 1, 15, 15);
  c.strokeStyle = "#73a86c";
  c.strokeRect(x - .5, y - .5, 14, 14);
  c.fillStyle = lime;
  for (const [row, inset] of [0, 1, 2, 3, 2, 1, 0].entries())
    c.fillRect(x + 2 + inset, y + 1 + row * 1.5, 9 - inset * 2, 1.5);
}

export function drawOmnitrixHud(
  c: CanvasRenderingContext2D,
  state: OmnitrixState,
  seat: number,
  key: string,
  locked: boolean,
) {
  const index = benAliens.findIndex(form => form.id === state.selected);
  const selected = benAliens[index];
  const active = benAliens.find(form => form.id === state.active);
  const previous = benAliens[(index + benAliens.length - 1) % benAliens.length];
  const wipe = state.dialTicks / omnitrixDialTicks;
  const charging = !locked && state.holdTicks > 0 && state.holdTicks < omnitrixHoldTicks;
  const energy = state.transition ? 1 : charging ? state.holdTicks / omnitrixHoldTicks : 0;
  const x = seat === 0 ? 94 : 1186;
  const y = 175;
  const sign = seat === 0 ? 1 : -1;
  const textX = x + sign * 53;

  c.save();
  c.imageSmoothingEnabled = false;

  // A narrow chamfered plate keeps the active and selected readouts out of the arena.
  c.save();
  c.translate(x, y);
  c.scale(sign, 1);
  c.beginPath();
  c.moveTo(22, -40);
  c.lineTo(228, -40);
  c.lineTo(242, -26);
  c.lineTo(242, 27);
  c.lineTo(230, 40);
  c.lineTo(22, 40);
  c.closePath();
  c.fillStyle = "#0b1518f5";
  c.fill();
  c.strokeStyle = "#3d5656";
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = "#66876d";
  c.fillRect(47, -40, 115, 2);
  c.fillStyle = "#334a43";
  c.fillRect(47, 4, 183, 1);
  c.fillStyle = "#56725b";
  c.fillRect(230, 27, 4, 4);
  c.restore();

  c.beginPath();
  c.arc(x, y, 41, 0, tau);
  c.fillStyle = "#151f23";
  c.fill();
  ring(c, x, y, 40, "#253735", 4);
  ring(c, x, y, 41, "#729086");
  ring(c, x, y, 35, "#4e665b");
  ring(c, x, y, 32, "#8acc6b");
  if (energy > 0) {
    ring(c, x, y, 40, "#254c39", 4);
    ring(c, x, y, 40, state.transition ? "#ecffd0" : lime, 3, -Math.PI / 2, -Math.PI / 2 + tau * energy);
  }

  for (let mark = 0; mark < benAliens.length; mark++) {
    const angle = -Math.PI / 2 + (mark - wipe) * tau / benAliens.length;
    const emphasized = mark === index;
    c.fillStyle = emphasized ? lime : "#557069";
    const dotX = Math.round(x + Math.cos(angle) * 37);
    const dotY = Math.round(y + Math.sin(angle) * 37);
    c.fillRect(dotX - 1, dotY - 1, emphasized ? 4 : 2, emphasized ? 4 : 2);
  }

  c.save();
  c.beginPath();
  c.arc(x, y, 31, 0, tau);
  c.clip();
  c.fillStyle = "#0b201b";
  c.fillRect(x - 31, y - 31, 62, 62);
  c.fillStyle = "#1b352b";
  for (let row = -30; row < 31; row += 4)
    c.fillRect(x - 31, y + row, 62, 1);
  const shift = Math.round(62 * wipe);
  if (shift) c.drawImage(alienPortrait(previous.id), x - 24 - shift * sign + 62 * sign, y - 24);
  c.drawImage(alienPortrait(selected.id), x - 24 - shift * sign, y - 24);
  if (state.transition || wipe > 0) {
    c.fillStyle = state.transition ? "#beff8c44" : "#9bff6e30";
    c.fillRect(x - 31, y - 31, 62, 62);
  }
  c.restore();
  hourglass(c, x + 20 * sign - 6, y + 21);

  c.textAlign = seat === 0 ? "left" : "right";
  c.font = "bold 11px monospace";
  c.fillStyle = "#aec4b7";
  c.fillText(`OMNITRIX  /  ${String(index + 1).padStart(2, "0")} / ${benAliens.length}`, textX, y - 22);
  c.font = "bold 17px monospace";
  c.fillStyle = state.transition ? "#efffd2" : lime;
  c.fillText(selected.name.toUpperCase(), textX, y - 3);
  c.font = "bold 11px monospace";
  c.fillStyle = "#d8e6df";
  const activeLabel = active ? `${active.name.toUpperCase()}` : "HUMANO";
  const mode = state.active === "nrg"
    ? state.nrgReleased ? ((state.nrgTicks ?? 0) ? `${state.flightTicks ? "VOO" : "LIBERADO"} ${Math.ceil(state.nrgTicks! / 60)}s` : "RECONTENÇÃO")
      : state.nrgCooldown ? `ARMADURA · ${Math.ceil(state.nrgCooldown / 60)}s` : "ARMADURA"
    : state.active === "ghostfreak" ? state.ghostCooldown ? `PESADELO ${(state.ghostCooldown / 60).toFixed(1)}s` : "PESADELO PRONTO"
      : state.active === "bigChill" ? state.flightUsed ? "VOO GASTO" : "VOO PRONTO" : "";
  c.fillText(`ATIVA  ${activeLabel}`, textX, y + 18);
  if (mode) {
    c.textAlign = seat === 0 ? "right" : "left";
    c.font = "bold 9px monospace";
    c.fillStyle = state.active === "nrg" ? "#f7bc79" : "#a4dcea";
    c.fillText(mode, x + sign * 232, y + 32);
    c.textAlign = seat === 0 ? "left" : "right";
  }
  c.font = "10px monospace";
  c.fillStyle = state.transition ? lime : "#a3b6ad";
  const status = state.transition ? "TRANSIÇÃO" : state.noSpace ? "SEM ESPAÇO" : locked ? "BLOQUEADO" : !benForms[selected.id] ? "EM DESENVOLVIMENTO" : charging ? "CONFIRMANDO" : `${key} TOQUE / SEGURE`;
  c.fillText(mode && status === `${key} TOQUE / SEGURE` ? `${key} OMNITRIX` : status, textX, y + 32);
  if (state.active === "feedback" || (state.charge > 0 && !mode)) {
    const barX = seat === 0 ? x + 176 : x - 232;
    c.fillStyle = "#294945";
    c.fillRect(barX, y + 28, 56, 5);
    const cue = state.chargeCue;
    const power = benFormBalance.energy;
    c.fillStyle = cue?.kind === "spend" ? "#ffaf57" : state.absorbFlash ? "#fff9c3" :
      state.charge >= power.mediumSpend ? "#ffdc62" : state.charge >= power.lightSpend ? "#cfa44c" : "#86a766";
    c.fillRect(barX, y + 28, Math.round(56 * state.charge / power.capacity), 5);
    c.fillStyle = "#18262b";
    for (const cost of [power.lightSpend, power.mediumSpend])
      c.fillRect(barX + Math.round(56 * cost / power.capacity), y + 27, 1, 7);
    c.textAlign = "center";
    c.font = "bold 8px monospace";
    c.fillStyle = cue?.kind === "spend" ? "#ffc385" : "#edf4ce";
    const charge = cue ? (cue.kind === "absorb" ? "ABS " : "") +
      (cue.amount > 0 ? "+" : "") + String(cue.amount) : `${state.charge}/100`;
    c.fillText(charge, barX + 28, y + 25);
    c.fillStyle = "#fff5b8";
    if (state.charge >= power.lightSpend) c.fillText("J", barX + 15, y + 40);
    if (state.charge >= power.mediumSpend) c.fillText("K", barX + 29, y + 40);
  }
  c.restore();
}

export function drawOmnitrixFlash(
  c: CanvasRenderingContext2D, ticks: number, wrist?: { x: number; y: number },
) {
  const age = omnitrixSwapTicks - ticks;
  const spread = 15 + age * 4;
  c.save();
  c.fillStyle = "#a9ff69";
  for (const sign of [-1, 1]) {
    c.fillRect(sign * spread, -79 - age * 3, 3, 14);
    c.fillRect(sign * (spread + 7), -51 + age, 3, 9);
    c.fillRect(sign * (spread + 12), -100 + age, 2, 5);
  }
  if (wrist) {
    c.fillRect(wrist.x - 4, wrist.y - 1, 9, 3);
    c.fillRect(wrist.x - 1, wrist.y - 4, 3, 9);
    c.fillStyle = "#efffce";
    c.fillRect(wrist.x - 1, wrist.y - 1, 3, 3);
  }
  c.globalAlpha = ticks / omnitrixSwapTicks;
  c.strokeStyle = "#a8ff83";
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(0, -6, 28 + age * 4, 8 + age, 0, 0, tau);
  c.stroke();
  c.restore();
}

