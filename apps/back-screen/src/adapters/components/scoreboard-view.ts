import type { Scoreboard } from '../../domain/scoreboard';
import type { ScoreboardView } from '../../application/renderer-orchestrator';

const MAX_BALLS = 3;

function formatScore(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function injectStyles(): void {
  if (document.getElementById('sb-styles')) return;
  const s = document.createElement('style');
  s.id = 'sb-styles';
  s.textContent = `
    @keyframes ice-glow {
      0%,100% { text-shadow: 0 0 20px #38bdf8, 0 0 50px #0ea5e9, 0 0 90px #0284c7; }
      50%      { text-shadow: 0 0 35px #7dd3fc, 0 0 70px #38bdf8, 0 0 130px #0ea5e9; }
    }
    @keyframes score-pop {
      0%   { transform: scale(1); }
      35%  { transform: scale(1.06); }
      100% { transform: scale(1); }
    }
    @keyframes game-over-pulse {
      0%,100% { opacity: 1;   text-shadow: 0 0 20px #f97316, 0 0 50px #ea580c; }
      50%     { opacity: 0.8; text-shadow: 0 0 40px #f97316, 0 0 90px #dc2626; }
    }
    @keyframes divider-glow {
      0%,100% { opacity: 0.5; }
      50%     { opacity: 1; }
    }
    @keyframes snow-fall {
      0%   { transform: translateY(-20px) rotate(0deg);   opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 0.5; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
  `;
  document.head.appendChild(s);
}

function createSnowflakes(container: HTMLElement): void {
  const styleRules: string[] = [];
  for (let i = 0; i < 28; i++) {
    const left = Math.random() * 100;
    const size = 2 + Math.random() * 3;
    const dur  = 7 + Math.random() * 13;
    const del  = Math.random() * 16;
    styleRules.push(
      `.sf-${i}{position:fixed;top:-10px;left:${left.toFixed(1)}%;` +
      `width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;` +
      `border-radius:50%;background:rgba(190,225,255,0.65);` +
      `animation:snow-fall ${dur.toFixed(1)}s linear ${del.toFixed(1)}s infinite;` +
      `pointer-events:none;z-index:0;}`,
    );
  }
  const style = document.createElement('style');
  style.textContent = styleRules.join('');
  document.head.appendChild(style);

  for (let i = 0; i < 28; i++) {
    const f = document.createElement('div');
    f.className = `sf-${i}`;
    container.appendChild(f);
  }
}

function createForestSVG(): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 900 160');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.cssText = 'width:100%;display:block;';

  const backTrees: [number, number, number][] = [
    [75, 60, 48], [165, 42, 58], [258, 66, 46], [345, 48, 60],
    [435, 64, 48], [525, 44, 58], [615, 58, 48], [705, 40, 60],
    [795, 62, 48], [878, 46, 56],
  ];
  for (const [x, top, hw] of backTrees) {
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', `${x},${top} ${x + hw},155 ${x - hw},155`);
    poly.setAttribute('fill', '#07160a');
    svg.appendChild(poly);
  }

  const frontTrees: [number, number, number][] = [
    [18, 28, 54],  [128, 8, 72],  [232, 32, 64], [328, 12, 74],
    [422, 24, 66], [522, 6, 74],  [618, 28, 66], [714, 4, 76],
    [810, 22, 66], [905, 12, 70],
  ];
  for (const [x, top, hw] of frontTrees) {
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', `${x},${top} ${x + hw},155 ${x - hw},155`);
    poly.setAttribute('fill', '#0d2a14');
    svg.appendChild(poly);
  }

  const ground = document.createElementNS(ns, 'rect');
  ground.setAttribute('x', '0');
  ground.setAttribute('y', '150');
  ground.setAttribute('width', '900');
  ground.setAttribute('height', '10');
  ground.setAttribute('fill', '#061008');
  svg.appendChild(ground);

  return svg;
}

function makeDivider(): HTMLElement {
  const d = document.createElement('div');
  d.style.cssText = `
    width: 80%;
    height: 1px;
    background: linear-gradient(90deg, transparent, #38bdf8 30%, #7dd3fc 50%, #38bdf8 70%, transparent);
    animation: divider-glow 3s ease-in-out infinite;
  `;
  return d;
}

export function createScoreboardView(root: HTMLElement): ScoreboardView {
  injectStyles();

  root.innerHTML = '';
  root.style.cssText = `
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    min-height: 100vh;
    padding: 4rem 3rem 0;
    overflow: hidden;
  `;

  createSnowflakes(root);

  const content = document.createElement('div');
  content.style.cssText = `
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
    width: 100%;
    flex: 1;
  `;

  // Titre
  const titleEl = document.createElement('div');
  titleEl.style.cssText = `
    font-family: 'DotGothic16', monospace;
    font-size: clamp(1.2rem, 3.5vw, 2rem);
    letter-spacing: 0.35em;
    color: #bae6fd;
    text-shadow: 0 0 18px #38bdf8;
    text-align: center;
    opacity: 0.9;
  `;
  titleEl.textContent = '❄  F L I P P E R  1 2  ❄';

  // Score
  const scoreSection = document.createElement('div');
  scoreSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.5rem;';

  const scoreLabelEl = document.createElement('div');
  scoreLabelEl.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(0.65rem, 1.5vw, 0.85rem);
    letter-spacing: 0.5em;
    color: #7dd3fc;
    opacity: 0.55;
  `;
  scoreLabelEl.textContent = 'SCORE';

  const scoreEl = document.createElement('div');
  scoreEl.style.cssText = `
    font-family: 'Orbitron', monospace;
    font-weight: 900;
    font-size: clamp(4rem, 13vw, 9rem);
    letter-spacing: 0.06em;
    color: #7dd3fc;
    line-height: 1;
    animation: ice-glow 3s ease-in-out infinite;
    transition: opacity 0.3s ease;
  `;
  scoreEl.textContent = '0';
  scoreSection.append(scoreLabelEl, scoreEl);

  // Billes
  const ballsSection = document.createElement('div');
  ballsSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.75rem;';

  const ballsDotsEl = document.createElement('div');
  ballsDotsEl.style.cssText = 'display:flex;gap:1.25rem;';

  const ballDots: HTMLElement[] = [];
  for (let i = 0; i < MAX_BALLS; i++) {
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: clamp(1rem, 2.5vw, 1.8rem);
      height: clamp(1rem, 2.5vw, 1.8rem);
      border-radius: 50%;
      transition: all 0.4s ease;
    `;
    ballDots.push(dot);
    ballsDotsEl.appendChild(dot);
  }

  const ballsLabelEl = document.createElement('div');
  ballsLabelEl.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(0.6rem, 1.2vw, 0.8rem);
    letter-spacing: 0.45em;
    color: #bae6fd;
    opacity: 0.45;
  `;
  ballsLabelEl.textContent = 'BILLES';
  ballsSection.append(ballsDotsEl, ballsLabelEl);

  // Multiplicateur
  const multSection = document.createElement('div');
  multSection.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0.4rem;';

  const multEl = document.createElement('div');
  multEl.style.cssText = `
    font-family: 'Orbitron', monospace;
    font-weight: 700;
    font-size: clamp(1.8rem, 5vw, 3.5rem);
    color: #e0f2fe;
    letter-spacing: 0.12em;
    text-shadow: 0 0 12px #7dd3fc;
  `;
  multEl.textContent = '× 1';

  const multLabelEl = document.createElement('div');
  multLabelEl.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(0.6rem, 1.2vw, 0.8rem);
    letter-spacing: 0.45em;
    color: #bae6fd;
    opacity: 0.45;
  `;
  multLabelEl.textContent = 'MULTIPLICATEUR';
  multSection.append(multEl, multLabelEl);

  // Game Over
  const overlayEl = document.createElement('div');
  overlayEl.style.cssText = 'display:none;flex-direction:column;align-items:center;gap:0.75rem;';

  const gameOverTextEl = document.createElement('div');
  gameOverTextEl.style.cssText = `
    font-family: 'DotGothic16', monospace;
    font-size: clamp(1.8rem, 5vw, 3rem);
    letter-spacing: 0.3em;
    color: #f97316;
    animation: game-over-pulse 1.4s ease-in-out infinite;
  `;
  gameOverTextEl.textContent = 'GAME OVER';

  const finalScoreEl = document.createElement('div');
  finalScoreEl.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(0.85rem, 2vw, 1.1rem);
    color: #fed7aa;
    letter-spacing: 0.25em;
    opacity: 0.75;
  `;
  overlayEl.append(gameOverTextEl, finalScoreEl);

  content.append(
    titleEl,
    makeDivider(),
    scoreSection,
    makeDivider(),
    ballsSection,
    multSection,
    overlayEl,
  );

  // Forêt en bas
  const forestWrapper = document.createElement('div');
  forestWrapper.style.cssText = 'width:100%;position:relative;z-index:2;margin-top:auto;';
  forestWrapper.appendChild(createForestSVG());

  root.append(content, forestWrapper);

  function updateBalls(ballsLeft: number): void {
    for (let i = 0; i < MAX_BALLS; i++) {
      const dot = ballDots[i];
      if (!dot) continue;
      if (i < ballsLeft) {
        dot.style.background = '#7dd3fc';
        dot.style.boxShadow = '0 0 10px #38bdf8, 0 0 22px #0ea5e9';
        dot.style.border = 'none';
      } else {
        dot.style.background = 'transparent';
        dot.style.boxShadow = 'none';
        dot.style.border = '2px solid #1e3a5f';
      }
    }
  }

  function triggerScorePop(): void {
    scoreEl.style.animation = 'none';
    void scoreEl.offsetHeight;
    scoreEl.style.animation = 'score-pop 0.3s ease-out, ice-glow 3s ease-in-out 0.3s infinite';
  }

  updateBalls(MAX_BALLS);

  return {
    render(state: Scoreboard): void {
      const formatted = formatScore(state.score);
      if (scoreEl.textContent !== formatted) {
        scoreEl.textContent = formatted;
        triggerScorePop();
      }

      multEl.textContent = `× ${String(state.multiplier)}`;
      updateBalls(state.ballsLeft);

      if (state.gameOver) {
        overlayEl.style.display = 'flex';
        finalScoreEl.textContent = `SCORE FINAL : ${formatScore(state.finalScore ?? state.score)}`;
        scoreEl.style.opacity = '0.25';
      } else {
        overlayEl.style.display = 'none';
        scoreEl.style.opacity = '1';
      }
    },
  };
}
