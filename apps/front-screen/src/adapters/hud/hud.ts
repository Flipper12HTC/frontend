export interface HudHandle {
  setStatus: (text: string) => void;
  showGameOver: (finalScore: number) => void;
  mount: () => HTMLElement;
}

function injectStyles(): void {
  if (document.getElementById('hud-styles')) return;
  const s = document.createElement('style');
  s.id = 'hud-styles';
  s.textContent = `
    @keyframes hud-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes game-over-appear {
      from { opacity: 0; transform: scale(0.9); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes game-over-glow {
      0%,100% { text-shadow: 0 0 20px #f97316, 0 0 50px #ea580c; }
      50%     { text-shadow: 0 0 40px #f97316, 0 0 90px #dc2626; }
    }
  `;
  document.head.appendChild(s);
}

export function createHud(): HudHandle {
  injectStyles();

  const root = document.createElement('div');
  root.style.cssText = `
    position: fixed;
    top: 1.25rem;
    left: 1.5rem;
    pointer-events: none;
    user-select: none;
    z-index: 10;
    animation: hud-in 0.6s ease-out both;
  `;

  const status = document.createElement('div');
  status.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    color: #7dd3fc;
    opacity: 0.65;
    text-shadow: 0 0 8px #0ea5e9;
  `;
  status.textContent = 'FLIPPER 12';
  root.appendChild(status);

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    text-align: center;
    gap: 1rem;
    animation: game-over-appear 0.5s ease-out both, game-over-glow 1.5s ease-in-out infinite;
  `;

  const gameOverLine = document.createElement('div');
  gameOverLine.style.cssText = `
    font-family: 'DotGothic16', monospace;
    font-size: clamp(2rem, 7vw, 4.5rem);
    color: #f97316;
    letter-spacing: 0.25em;
  `;
  gameOverLine.textContent = 'GAME OVER';

  const scoreLine = document.createElement('div');
  scoreLine.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(0.9rem, 2.5vw, 1.3rem);
    color: #fed7aa;
    letter-spacing: 0.4em;
    opacity: 0.75;
  `;

  overlay.append(gameOverLine, scoreLine);

  return {
    setStatus(text: string): void {
      status.textContent = text;
    },
    showGameOver(finalScore: number): void {
      scoreLine.textContent = String(finalScore).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      overlay.style.display = 'flex';
    },
    mount(): HTMLElement {
      document.body.appendChild(root);
      document.body.appendChild(overlay);
      return root;
    },
  };
}
