export interface Scoreboard {
  readonly score: number;
  readonly ballsLeft: number;
  readonly multiplier: number;
  readonly gameOver: boolean;
  readonly finalScore: number | null;
}

export const INITIAL_SCOREBOARD: Scoreboard = {
  score: 0,
  ballsLeft: 3,
  multiplier: 1,
  gameOver: false,
  finalScore: null,
};

export function withScore(
  state: Scoreboard,
  score: number,
  ballsLeft: number,
  multiplier: number = state.multiplier,
): Scoreboard {
  return { ...state, score, ballsLeft, multiplier };
}

export function withBallDrained(state: Scoreboard, ballsLeft: number): Scoreboard {
  return { ...state, ballsLeft };
}

export function withGameOver(state: Scoreboard, finalScore: number): Scoreboard {
  return { ...state, gameOver: true, finalScore };
}
