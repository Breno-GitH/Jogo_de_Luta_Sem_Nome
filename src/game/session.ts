import opponents from "../data/arcade.json";
import { Match } from "../engine/combat";
import { Bot, type Difficulty } from "../engine/bot";
import type { InputFrame } from "../engine/types";
import { Training } from "./training";
import { characterById, type CharacterId } from "../engine/characters";

export type Mode = "versus" | "arcade" | "training";
export type Palette = "cyan" | "amber" | "violet";
export function arcadeRoute(characterId: CharacterId) {
  const original: CharacterId[] = ["samurai", "dio", "goku", "luffy"];
  return original.filter(id => id !== characterId).slice(0, opponents.length);
}
export class GameSession {
  match = new Match();
  bot: Bot;
  training = new Training();
  stage = 0;
  results: number[][] = [];
  status: "playing" | "stageClear" | "victory" | "defeat" = "playing";
  constructor(
    public mode: Mode,
    public difficulty: Difficulty = "normal",
    public characterId: CharacterId = "samurai",
    public opponentCharacterId: CharacterId = "samurai",
  ) {
    this.bot = new Bot(this.currentDifficulty);
    this.restart();
  }
  get opponent() {
    return {
      ...opponents[this.stage],
      name: characterById(this.route[this.stage]).name,
    };
  }
  get route(): CharacterId[] {
    return arcadeRoute(this.characterId);
  }
  get palette(): Palette {
    return this.mode === "arcade" ? (this.opponent.palette as Palette) : "cyan";
  }
  get opponentName() {
    const name = characterById(
      this.mode === "arcade"
        ? this.route[this.stage]
        : this.opponentCharacterId,
    ).name;
    return this.mode === "arcade"
      ? this.opponent.name
      : this.mode === "training"
        ? `${name} · Treino`
        : `${name} · BOT`;
  }
  get currentDifficulty(): Difficulty {
    return this.mode === "arcade"
      ? (this.opponent.difficulty as Difficulty)
      : this.difficulty;
  }
  restart() {
    this.match = new Match(
      characterById(this.characterId),
      this.mode === "training" ? { training: true } : {},
      this.mode === "arcade"
        ? characterById(this.route[this.stage])
        : characterById(this.opponentCharacterId),
    );
    this.bot = new Bot(
      this.currentDifficulty,
      this.mode === "arcade" ? this.opponent.seed : 3417,
    );
    this.status = "playing";
    this.training.damage.reset();
    if (this.mode === "training") {
      this.match.phase = "fight";
      this.match.message = "";
      this.training.configure(this.match);
    }
  }
  next() {
    if (
      this.mode !== "arcade" ||
      this.status !== "stageClear" ||
      this.stage >= opponents.length - 1
    )
      return false;
    this.stage++;
    this.restart();
    return true;
  }
  step(input: InputFrame) {
    if (this.status !== "playing") return;
    if (this.mode === "training") this.training.configure(this.match);
    const enemy =
      this.mode === "training"
        ? this.training.input(this.match, this.bot)
        : this.bot.sample(this.match);
    this.match.step([input, enemy]);
    if (this.mode === "training") {
      this.training.damage.tick(this.match);
      return;
    }
    if (this.match.phase === "finished") {
      const won = this.match.wins[0] >= 2;
      if (this.mode === "arcade" && won) {
        this.results[this.stage] = [...this.match.wins];
        this.status =
          this.stage < opponents.length - 1 ? "stageClear" : "victory";
      } else this.status = won ? "victory" : "defeat";
    }
  }
}
