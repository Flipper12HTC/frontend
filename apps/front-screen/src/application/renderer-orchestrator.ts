import type { GameSource } from './ports/game-source';
import type { FlipperSide, InputSink } from './ports/input-sink';
import type { BallPosition, FlipperState } from '../domain/game-state';

export interface RendererCallbacks {
  onBallMoved: (position: BallPosition) => void;
  onFlipperChanged: (state: FlipperState) => void;
  onScoreChanged?: (score: number, ballsLeft: number) => void;
  onGameOver?: (finalScore: number) => void;
}

export interface Orchestrator {
  start: () => void;
  stop: () => void;
}

export function createRendererOrchestrator(
  source: GameSource,
  input: InputSink,
  callbacks: RendererCallbacks,
): Orchestrator {
  const unsubs: (() => void)[] = [];

  function subscribe(): void {
    unsubs.push(
      source.on('ball_position', (event) => {
        callbacks.onBallMoved(event.payload);
      }),
      source.on('flipper_state', (event) => {
        callbacks.onFlipperChanged(event.payload);
      }),
    );

    const scoreCb = callbacks.onScoreChanged;
    if (scoreCb) {
      unsubs.push(
        source.on('score_update', (event) => {
          scoreCb(event.payload.score, event.payload.ballsLeft);
        }),
      );
    }

    const overCb = callbacks.onGameOver;
    if (overCb) {
      unsubs.push(
        source.on('game_over', (event) => {
          overCb(event.payload.finalScore);
        }),
      );
    }

    unsubs.push(
      input.onPress((side: FlipperSide) => {
        callbacks.onFlipperChanged({ side, active: true });
      }),
      input.onRelease((side: FlipperSide) => {
        callbacks.onFlipperChanged({ side, active: false });
      }),
    );
  }

  return {
    start(): void {
      subscribe();
      input.start();
      source.start();
    },
    stop(): void {
      for (const u of unsubs) u();
      unsubs.length = 0;
      source.stop();
      input.stop();
    },
  };
}
