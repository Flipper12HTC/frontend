import type { Scoreboard } from '../../domain/scoreboard';
import type { ScoreboardView } from '../../application/renderer-orchestrator';

export interface ScoreboardViewOptions {
  onStart: () => void;
}

function ac(text: string): string {
  return text
    .split(' ')
    .map(word => {
      let upper = true;
      return [...word]
        .map(char => {
          if (!/[a-zA-ZÀ-ÿ]/.test(char)) return char;
          const out = upper ? char.toUpperCase() : char.toLowerCase();
          upper = !upper;
          return out;
        })
        .join('');
    })
    .join(' ');
}

function makeBubble(size: number, left: string, duration: number, delay: number): HTMLDivElement {
  const b = document.createElement('div');
  b.className = 'bubble';
  b.style.cssText = `width:${size}px;height:${size}px;left:${left};bottom:-${size + 10}px;animation-duration:${duration}s;animation-delay:${delay}s`;
  return b;
}

export function createScoreboardView(
  root: HTMLElement,
  options: ScoreboardViewOptions,
): ScoreboardView {
  root.innerHTML = '';
  root.className =
    'flex flex-col items-center justify-center gap-6 p-8 w-full min-h-screen text-center';

  document.body.appendChild(makeBubble(44, '8%', 7, -3));
  document.body.appendChild(makeBubble(26, '25%', 10, -6));
  document.body.appendChild(makeBubble(36, '65%', 8, -1));
  document.body.appendChild(makeBubble(18, '82%', 12, -8));

  const logoWrap = document.createElement('div');
  logoWrap.className = 'flex flex-col items-center gap-2';

  const logoTitle = document.createElement('div');
  logoTitle.className = 'outlined font-display uppercase';
  logoTitle.style.fontSize = 'clamp(2.5rem, 7vw, 5rem)';
  logoTitle.textContent = 'FLIPPER 12';

  const logoPlank = document.createElement('div');
  logoPlank.className = 'plank';
  logoPlank.style.fontSize = 'clamp(1.4rem, 3.5vw, 2.2rem)';
  logoPlank.textContent = 'HeTiC';

  logoWrap.append(logoTitle, logoPlank);

  const banner = document.createElement('div');
  banner.className = 'plank text-score-md opacity-0 transition-opacity';
  banner.style.minWidth = '180px';

  const scoreEl = document.createElement('div');
  scoreEl.className = 'outlined font-display leading-none';
  scoreEl.style.fontSize = 'clamp(5rem, 14vw, 10rem)';
  scoreEl.textContent = '0';

  const finalEl = document.createElement('div');
  finalEl.className = 'outlined-sm font-display hidden';
  finalEl.style.fontSize = 'clamp(1rem, 2.5vw, 1.5rem)';

  const metaEl = document.createElement('div');
  metaEl.className = 'flex gap-10 font-hud text-score-md';
  metaEl.style.color = 'rgba(255,255,255,0.9)';
  const ballsEl = document.createElement('span');
  const multEl = document.createElement('span');
  metaEl.append(ballsEl, multEl);

  const ballsRow = document.createElement('div');
  ballsRow.className = 'flex gap-3';
  const ballDots: HTMLDivElement[] = [];
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'w-5 h-5 rounded-full transition-all duration-300';
    dot.style.background = '#e2d147';
    dot.style.border = '2px solid #4a5200';
    dot.style.boxShadow = '2px 2px 0 #4a5200';
    ballDots.push(dot);
    ballsRow.appendChild(dot);
  }

  const button = document.createElement('button');
  button.className = 'plank transition-transform hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed';
  button.style.fontSize = 'clamp(1.4rem, 3vw, 2rem)';
  button.style.cursor = 'pointer';
  button.textContent = ac('JOUER') + ' !';
  button.addEventListener('click', () => options.onStart());

  const hint = document.createElement('p');
  hint.className = 'font-hud text-sm tracking-widest';
  hint.style.color = 'rgba(255,255,255,0.7)';
  hint.textContent = ac('OU APPUIE SUR ESPACE');

  root.append(logoWrap, banner, finalEl, scoreEl, metaEl, ballsRow, button, hint);

  function applyDots(ballsLeft: number, status: string): void {
    const visibleCount = status === 'idle' ? 3 : Math.max(0, ballsLeft);
    ballDots.forEach((dot, i) => {
      dot.style.opacity = i < visibleCount ? '1' : '0.2';
      dot.style.background = i < visibleCount ? '#e2d147' : 'rgba(255,255,255,0.3)';
    });
  }

  return {
    render(state: Scoreboard): void {
      scoreEl.textContent = String(state.score);
      ballsEl.textContent = `${ac('BULLES')} ${String(Math.max(0, state.ballsLeft))}`;
      multEl.textContent = `x${String(state.multiplier)}`;
      applyDots(state.ballsLeft, state.status);

      if (state.status === 'idle') {
        banner.textContent = ac('PRET') + ' !';
        banner.style.opacity = '1';
        finalEl.classList.add('hidden');
        scoreEl.textContent = String(state.score);
        button.textContent = ac('JOUER') + ' !';
        button.disabled = false;
        button.classList.remove('hidden');
        hint.classList.remove('hidden');
      } else if (state.status === 'running') {
        banner.textContent = ac('EN JEU') + ' !';
        banner.style.opacity = '1';
        finalEl.classList.add('hidden');
        button.classList.add('hidden');
        hint.classList.add('hidden');
      } else {
        banner.textContent = ac('GAME OVER') + ' !';
        banner.style.opacity = '1';
        finalEl.textContent = `${ac('SCORE FINAL')} — ${String(state.finalScore ?? state.score)}`;
        finalEl.classList.remove('hidden');
        button.textContent = ac('REJOUER') + ' !';
        button.disabled = false;
        button.classList.remove('hidden');
        hint.classList.remove('hidden');
      }
    },
  };
}
