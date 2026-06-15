import type { Scoreboard } from '../../domain/scoreboard';
import type { ScoreboardView } from '../../application/renderer-orchestrator';

export interface ScoreboardViewOptions {
  onStart: () => void;
}

function spawnCssBubbles(): void {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden;';
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    b.className = 'css-bubble';
    const size = 14 + Math.random() * 42;
    b.style.cssText = [
      `width:${size}px`,
      `height:${size}px`,
      `left:${(Math.random() * 100).toFixed(1)}%`,
      `bottom:-${size}px`,
      `animation-delay:-${(Math.random() * 16).toFixed(1)}s`,
      `animation-duration:${(9 + Math.random() * 11).toFixed(1)}s`,
    ].join(';');
    wrap.appendChild(b);
  }
  document.body.appendChild(wrap);
}

export function createScoreboardView(
  root: HTMLElement,
  options: ScoreboardViewOptions,
): ScoreboardView {
  spawnCssBubbles();

  root.innerHTML = '';
  root.style.cssText = [
    'position:relative',
    'z-index:1',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:1.6rem',
    'padding:3rem 2rem',
    'width:100%',
    'min-height:100vh',
    'text-align:center',
  ].join(';');

  // ── Title ──────────────────────────────────────────────────────
  const title = document.createElement('div');
  title.style.cssText = `
    font-family: 'Bangers', cursive;
    font-size: clamp(2rem, 5vw, 3.5rem);
    letter-spacing: 0.18em;
    color: #00e5ff;
    text-shadow: 0 0 12px rgba(0,229,255,0.65), 0 0 28px rgba(0,229,255,0.3);
  `;
  title.textContent = '— FLIPPER 12 —';

  // ── Status banner ──────────────────────────────────────────────
  const banner = document.createElement('div');
  banner.style.cssText = `
    font-family: 'Bangers', cursive;
    font-size: clamp(1.1rem, 2.8vw, 1.7rem);
    letter-spacing: 0.28em;
    transition: color 0.4s, text-shadow 0.4s;
  `;

  // ── Score label ────────────────────────────────────────────────
  const scoreLabel = document.createElement('div');
  scoreLabel.style.cssText = `
    font-family: 'Bangers', cursive;
    font-size: 0.85rem;
    letter-spacing: 0.55em;
    color: rgba(255,215,0,0.45);
    margin-bottom: -1rem;
  `;
  scoreLabel.textContent = 'S C O R E';

  // ── Score value ────────────────────────────────────────────────
  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = `
    font-family: 'Bangers', cursive;
    font-size: clamp(5rem, 15vw, 10rem);
    color: #ffd700;
    text-shadow:
      0 0 10px rgba(255,215,0,0.9),
      0 0 24px rgba(255,215,0,0.55),
      0 0 50px rgba(255,140,0,0.38),
      0 0 90px rgba(255,100,0,0.18);
    letter-spacing: 0.04em;
    line-height: 1;
  `;
  scoreEl.textContent = '0';

  // ── Multiplier ─────────────────────────────────────────────────
  const multEl = document.createElement('div');
  multEl.style.cssText = `
    font-family: 'Bangers', cursive;
    font-size: clamp(1.3rem, 3.5vw, 2.2rem);
    letter-spacing: 0.12em;
    color: #ff6b35;
    text-shadow: 0 0 8px rgba(255,107,53,0.65);
    min-height: 2.5rem;
  `;

  // ── Ball indicators (bubble style) ─────────────────────────────
  const ballsRow = document.createElement('div');
  ballsRow.style.cssText = 'display:flex;gap:1.1rem;align-items:center;justify-content:center;';
  const ballDots: HTMLDivElement[] = [];
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'ball-bubble';
    ballDots.push(dot);
    ballsRow.appendChild(dot);
  }

  // ── Start button (hexagonal gold) ──────────────────────────────
  const button = document.createElement('button');
  button.className = 'start-btn';
  button.textContent = 'PRESS START';
  button.addEventListener('click', () => {
    options.onStart();
  });

  // ── Keyboard hint ──────────────────────────────────────────────
  const hint = document.createElement('p');
  hint.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.75rem;
    letter-spacing: 0.35em;
    color: rgba(255,255,255,0.28);
    margin-top: -0.6rem;
  `;
  hint.textContent = 'OR PRESS SPACE';

  // ── Final score (shown on game over) ───────────────────────────
  const finalEl = document.createElement('div');
  finalEl.style.cssText = `
    font-family: 'Bangers', cursive;
    font-size: clamp(1.1rem, 3vw, 1.9rem);
    letter-spacing: 0.14em;
    color: #ffd700;
    text-shadow: 0 0 12px rgba(255,215,0,0.6);
    display: none;
  `;

  root.append(title, banner, finalEl, scoreLabel, scoreEl, multEl, ballsRow, button, hint);

  // ── Internal state ─────────────────────────────────────────────
  let prevScore = -1;
  let prevMult = 1;

  function applyDots(ballsLeft: number, status: string): void {
    const active = status === 'idle' ? 3 : Math.max(0, ballsLeft);
    ballDots.forEach((dot, i) => {
      if (i < active) {
        dot.classList.remove('empty');
      } else {
        dot.classList.add('empty');
      }
    });
  }

  return {
    render(state: Scoreboard): void {
      // Score — animate only when value changes
      if (state.score !== prevScore) {
        prevScore = state.score;
        scoreEl.textContent = state.score.toLocaleString();
        scoreEl.classList.remove('score-pop');
        void scoreEl.offsetHeight; // force reflow to restart animation
        scoreEl.classList.add('score-pop');
      }

      // Multiplier — flash on change
      if (state.multiplier !== prevMult) {
        prevMult = state.multiplier;
        multEl.classList.remove('mult-flash');
        void multEl.offsetHeight;
        multEl.classList.add('mult-flash');
      }
      multEl.textContent = state.multiplier > 1 ? `✕ ${String(state.multiplier)}` : '';

      applyDots(state.ballsLeft, state.status);

      if (state.status === 'idle') {
        banner.textContent = 'READY';
        banner.style.color = '#00e5ff';
        banner.style.textShadow = '0 0 10px rgba(0,229,255,0.7)';
        finalEl.style.display = 'none';
        button.textContent = 'PRESS START';
        button.disabled = false;
        button.style.display = '';
        hint.style.display = '';
      } else if (state.status === 'running') {
        banner.textContent = 'IN PLAY';
        banner.style.color = '#44ff88';
        banner.style.textShadow = '0 0 10px rgba(68,255,136,0.7)';
        finalEl.style.display = 'none';
        button.style.display = 'none';
        hint.style.display = 'none';
      } else {
        banner.textContent = 'GAME OVER';
        banner.style.color = '#ff4455';
        banner.style.textShadow = '0 0 12px rgba(255,68,85,0.85)';
        finalEl.textContent = `FINAL — ${(state.finalScore ?? state.score).toLocaleString()}`;
        finalEl.style.display = '';
        button.textContent = 'RESTART';
        button.disabled = false;
        button.style.display = '';
        hint.style.display = '';
      }
    },
  };
}
