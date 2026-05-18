import type { GameEvent, GameEventType, GameSource, Unsubscribe } from '@flipper/contracts';
import { TABLE } from '@flipper/contracts';
import { GameEventEmitter } from './event-emitter';

export interface MockGameSourceOptions {
  tickMs?: number;
  gameOverTick?: number;
}

const WALL_X = TABLE.width / 2 - TABLE.wall.thickness;
const WALL_Z_TOP = -(TABLE.depth / 2 - TABLE.wall.thickness);
const WALL_Z_BOTTOM = TABLE.depth / 2 - TABLE.wall.thickness;

export class MockGameSource implements GameSource {
  private readonly emitter = new GameEventEmitter();
  private readonly tickMs: number;
  private readonly gameOverTick: number;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private score = 0;
  private ballsLeft = 3;

  private bx = 0;
  private bz = 0;
  private vx = 0.09;
  private vz = 0.07;

  constructor(options: MockGameSourceOptions = {}) {
    this.tickMs = options.tickMs ?? 1000 / 60;
    this.gameOverTick = options.gameOverTick ?? 600;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.step();
    }, this.tickMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emitter.clear();
    this.tick = 0;
    this.score = 0;
    this.ballsLeft = 3;
    this.bx = 0;
    this.bz = 0;
    this.vx = 0.09;
    this.vz = 0.07;
  }

  on<T extends GameEventType>(
    type: T,
    handler: (event: Extract<GameEvent, { type: T }>) => void,
  ): Unsubscribe {
    return this.emitter.on(type, handler);
  }

  private step(): void {
    this.tick++;

    this.bx += this.vx;
    this.bz += this.vz;

    if (Math.abs(this.bx) >= WALL_X) {
      this.vx = -this.vx;
      this.bx = Math.sign(this.bx) * WALL_X;
      this.emitWallBumperHit(this.bx, this.bz);
    }

    if (this.bz <= WALL_Z_TOP || this.bz >= WALL_Z_BOTTOM) {
      this.vz = -this.vz;
      this.bz = this.bz <= WALL_Z_TOP ? WALL_Z_TOP : WALL_Z_BOTTOM;
    }

    this.emitter.emit({
      type: 'ball_position',
      payload: { x: this.bx, y: TABLE.ball.spawn.y, z: this.bz },
    });

    if (this.tick === this.gameOverTick) {
      this.emitter.emit({ type: 'game_over', payload: { finalScore: this.score } });
      this.tick = 0;
      this.score = 0;
      this.ballsLeft = 3;
    }
  }

  private emitWallBumperHit(x: number, z: number): void {
    const side = x > 0 ? 'wr' : 'wl';
    for (const wb of TABLE.wallBumpers) {
      if (!wb.id.startsWith(side)) continue;
      const half = (wb.length ?? 2) / 2;
      if (z >= wb.z - half && z <= wb.z + half) {
        this.emitter.emit({ type: 'bumper_hit', payload: { id: wb.id, x, z } });
        this.score += Math.floor(Math.random() * 81) + 20;
        this.emitter.emit({
          type: 'score_update',
          payload: { score: this.score, ballsLeft: this.ballsLeft },
        });
        return;
      }
    }
  }
}
