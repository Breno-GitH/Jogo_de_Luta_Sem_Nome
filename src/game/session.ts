import { Match } from "../engine/combat";
import { Bot, type Difficulty } from "../engine/bot";
import type { InputFrame } from "../engine/types";
import { Training } from "./training";
import { characterById, type CharacterId } from "../engine/characters";
import {
  currentFloor,
  newTower,
  towerComplete,
  towerFloors,
  towerProfile,
  type TowerAttempt,
} from "./tower";

export type Mode = "versus" | "arcade" | "training";
export type Palette = "cyan" | "amber" | "violet";

export class GameSession {
  match!: Match;
  bot!: Bot;
  training = new Training();
  stage = 0;
  readonly tower?: TowerAttempt;
  status: "playing" | "stageClear" | "victory" | "defeat" = "playing";
  constructor(
    public mode: Mode,
    public difficulty: Difficulty = "normal",
    public characterId: CharacterId = "samurai",
    public opponentCharacterId: CharacterId = "samurai",
    attempt?: TowerAttempt,
  ) {
    if (mode === "arcade") {
      this.tower = attempt ?? newTower(characterId);
      this.characterId = this.tower.fighter;
      this.stage = currentFloor(this.tower);
    }
    this.restart();
  }
  get route() {
    return this.tower?.route ?? [];
  }
  get results() {
    return this.tower?.results ?? [];
  }
  get palette(): Palette {
    return this.tower ? towerFloors[this.stage].palette : "cyan";
  }
  get opponentName() {
    const name = characterById(
      this.tower ? this.route[this.stage] : this.opponentCharacterId,
    ).name;
    return this.tower
      ? name
      : this.mode === "training"
        ? `${name} · Treino`
        : `${name} · BOT`;
  }
  get currentDifficulty(): Difficulty {
    return this.tower ? towerFloors[this.stage].tier : this.difficulty;
  }
  restart() {
    this.match = new Match(
      characterById(this.characterId),
      this.mode === "training" ? { training: true } : {},
      characterById(
        this.tower ? this.route[this.stage] : this.opponentCharacterId,
      ),
    );
    this.bot = new Bot(
      this.currentDifficulty,
      3417 + this.stage * 1013,
      1,
      this.tower ? towerProfile(this.stage) : undefined,
    );
    this.status =
      this.tower && towerComplete(this.tower) ? "victory" : "playing";
    this.training.damage.reset();
    if (this.mode === "training") {
      this.match.phase = "fight";
      this.match.message = "";
      this.training.configure(this.match);
    }
  }
  next() {
    if (!this.tower || this.status !== "stageClear") return false;
    this.stage = currentFloor(this.tower);
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
    if (this.match.phase !== "finished") return;
    const won = this.match.wins[0] >= 2;
    if (this.tower) {
      this.tower.ticks += this.match.frame;
      if (won)
        this.tower.results.push([this.match.wins[0], this.match.wins[1]]);
      else this.tower.losses++;
      this.status = won
        ? towerComplete(this.tower)
          ? "victory"
          : "stageClear"
        : "defeat";
    } else this.status = won ? "victory" : "defeat";
  }
}
