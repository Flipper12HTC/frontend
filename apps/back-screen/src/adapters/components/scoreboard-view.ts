import type { Scoreboard } from '../../domain/scoreboard';
import type { ScoreboardView } from '../../application/renderer-orchestrator';

export function createScoreboardView(root: HTMLElement): ScoreboardView {
  root.innerHTML = '';
  root.className = 'flex flex-col items-center gap-6 p-8 text-center';

  const scoreEl = document.createElement('div');
  scoreEl.className = 'text-score-xl font-display tracking-widest text-white';
  scoreEl.textContent = '0';

  const metaEl = document.createElement('div');
  metaEl.className = 'flex gap-8 text-score-md font-hud text-score-muted';

  const ballsEl = document.createElement('span');
  const multEl = document.createElement('span');
  metaEl.append(ballsEl, multEl);

  const overlayEl = document.createElement('div');
  overlayEl.className =
    'mt-4 text-score-md font-display text-neon-pink uppercase tracking-widest';

  root.append(scoreEl, metaEl, overlayEl);

  return {
    render(state: Scoreboard): void {
      scoreEl.textContent = String(state.score);
      ballsEl.textContent = `BALLS ${String(state.ballsLeft)}`;
      multEl.textContent = `x${String(state.multiplier)}`;
      overlayEl.textContent = state.gameOver
        ? `GAME OVER — ${String(state.finalScore ?? state.score)}`
        : '';
    },
  };
}
