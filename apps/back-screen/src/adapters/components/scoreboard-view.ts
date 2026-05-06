import type { Scoreboard } from '../../domain/scoreboard';
import type { ScoreboardView } from '../../application/renderer-orchestrator';

export interface ScoreboardViewOptions {
  onStart: () => void;
}

export function createScoreboardView(
  root: HTMLElement,
  options: ScoreboardViewOptions,
): ScoreboardView {
  root.innerHTML = '';
  root.className =
    'flex flex-col items-center justify-center gap-8 p-8 w-full min-h-screen text-center';

  const banner = document.createElement('div');
  banner.className =
    'text-score-md font-display text-neon-pink uppercase tracking-widest opacity-0 transition-opacity';
  banner.textContent = '';

  const scoreEl = document.createElement('div');
  scoreEl.className = 'text-score-xl font-display tracking-widest text-white leading-none';
  scoreEl.textContent = '0';

  const metaEl = document.createElement('div');
  metaEl.className = 'flex gap-10 text-score-md font-hud text-score-muted';
  const ballsEl = document.createElement('span');
  const multEl = document.createElement('span');
  metaEl.append(ballsEl, multEl);

  const ballsRow = document.createElement('div');
  ballsRow.className = 'flex gap-3';
  const ballDots: HTMLDivElement[] = [];
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'w-4 h-4 rounded-full bg-neon-cyan transition-opacity';
    ballDots.push(dot);
    ballsRow.appendChild(dot);
  }

  const button = document.createElement('button');
  button.className =
    'mt-2 px-12 py-4 bg-neon-pink text-black font-display text-3xl tracking-widest hover:bg-white transition disabled:opacity-30 disabled:cursor-not-allowed';
  button.textContent = 'PRESS START';
  button.addEventListener('click', () => {
    options.onStart();
  });

  const hint = document.createElement('p');
  hint.className = 'text-white/50 font-hud text-sm tracking-widest';
  hint.textContent = 'OR PRESS SPACE';

  const finalEl = document.createElement('div');
  finalEl.className =
    'text-score-md font-display text-neon-yellow uppercase tracking-widest hidden';

  root.append(banner, finalEl, scoreEl, metaEl, ballsRow, button, hint);

  function applyDots(ballsLeft: number, status: string): void {
    const visibleCount = status === 'idle' ? 3 : Math.max(0, ballsLeft);
    ballDots.forEach((dot, i) => {
      dot.style.opacity = i < visibleCount ? '1' : '0.15';
    });
  }

  return {
    render(state: Scoreboard): void {
      scoreEl.textContent = String(state.score);
      ballsEl.textContent = `BALLS ${String(Math.max(0, state.ballsLeft))}`;
      multEl.textContent = `x${String(state.multiplier)}`;
      applyDots(state.ballsLeft, state.status);

      if (state.status === 'idle') {
        banner.textContent = 'READY';
        banner.style.opacity = '1';
        finalEl.classList.add('hidden');
        button.textContent = 'PRESS START';
        button.disabled = false;
        button.classList.remove('hidden');
        hint.classList.remove('hidden');
      } else if (state.status === 'running') {
        banner.textContent = 'IN PLAY';
        banner.style.opacity = '0.5';
        finalEl.classList.add('hidden');
        button.classList.add('hidden');
        hint.classList.add('hidden');
      } else {
        banner.textContent = 'GAME OVER';
        banner.style.opacity = '1';
        finalEl.textContent = `FINAL — ${String(state.finalScore ?? state.score)}`;
        finalEl.classList.remove('hidden');
        button.textContent = 'RESTART';
        button.disabled = false;
        button.classList.remove('hidden');
        hint.classList.remove('hidden');
      }
    },
  };
}
