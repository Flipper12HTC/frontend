export interface StartOverlayHandle {
  show: () => void;
  hide: () => void;
  setEnabled: (enabled: boolean, reason?: string) => void;
  mount: () => HTMLElement;
}

function injectStyles(): void {
  if (document.getElementById('overlay-styles')) return;
  const s = document.createElement('style');
  s.id = 'overlay-styles';
  s.textContent = `
    @keyframes title-glow {
      0%,100% { text-shadow: 0 0 20px #38bdf8, 0 0 60px #0ea5e9, 0 0 100px #0284c7; }
      50%      { text-shadow: 0 0 35px #7dd3fc, 0 0 90px #38bdf8, 0 0 150px #0ea5e9; }
    }
    @keyframes btn-shimmer {
      0%   { background-position: 200% center; }
      100% { background-position: -200% center; }
    }
    @keyframes subtitle-fade {
      0%,100% { opacity: 0.45; }
      50%     { opacity: 0.7; }
    }
    .start-btn {
      background: linear-gradient(90deg, #0369a1, #38bdf8, #7dd3fc, #38bdf8, #0369a1);
      background-size: 200% auto;
      animation: btn-shimmer 3.5s linear infinite;
      color: #060d17;
      border: none;
      cursor: pointer;
      font-family: 'DotGothic16', monospace;
      letter-spacing: 0.25em;
      padding: clamp(0.75rem, 2vw, 1.1rem) clamp(2rem, 5vw, 3.5rem);
      font-size: clamp(0.9rem, 2.5vw, 1.3rem);
      border-radius: 2px;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .start-btn:hover:not(:disabled) {
      transform: scale(1.04);
      filter: brightness(1.15);
    }
    .start-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      animation: none;
      background: #1e3a5f;
      color: #60a5fa;
    }
  `;
  document.head.appendChild(s);
}

export function createStartOverlay(onStart: () => void): StartOverlayHandle {
  injectStyles();

  const root = document.createElement('div');
  root.style.cssText = `
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, rgba(6,13,23,0.88) 0%, rgba(6,20,8,0.88) 100%);
    backdrop-filter: blur(6px);
    z-index: 50;
  `;

  const title = document.createElement('h1');
  title.style.cssText = `
    font-family: 'DotGothic16', monospace;
    font-size: clamp(2rem, 7vw, 4.5rem);
    letter-spacing: 0.35em;
    color: #7dd3fc;
    animation: title-glow 2.5s ease-in-out infinite;
    margin-bottom: 0.4rem;
  `;
  title.textContent = 'FLIPPER 12';

  const subtitle = document.createElement('p');
  subtitle.style.cssText = `
    font-family: 'Share Tech Mono', monospace;
    font-size: clamp(0.55rem, 1.2vw, 0.75rem);
    color: #bae6fd;
    letter-spacing: 0.55em;
    margin-bottom: 3rem;
    animation: subtitle-fade 4s ease-in-out infinite;
  `;
  subtitle.textContent = '— WINTER EDITION —';

  const button = document.createElement('button');
  button.className = 'start-btn';
  button.textContent = 'PRESS START';
  button.addEventListener('click', () => {
    if (!(button as HTMLButtonElement).disabled) onStart();
  });

  const hint = document.createElement('p');
  hint.style.cssText = `
    margin-top: 1.5rem;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.65rem;
    color: #7dd3fc;
    letter-spacing: 0.4em;
    opacity: 0.35;
  `;
  hint.textContent = 'OR PRESS SPACE';

  const reasonEl = document.createElement('p');
  reasonEl.style.cssText = `
    margin-top: 0.6rem;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.7rem;
    color: #fbbf24;
    letter-spacing: 0.2em;
    display: none;
  `;

  root.append(title, subtitle, button, hint, reasonEl);

  const handler = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !(button as HTMLButtonElement).disabled && root.style.display !== 'none') {
      e.preventDefault();
      onStart();
    }
  };
  document.addEventListener('keydown', handler);

  return {
    show(): void { root.style.display = 'flex'; },
    hide(): void { root.style.display = 'none'; },
    setEnabled(enabled: boolean, reason?: string): void {
      (button as HTMLButtonElement).disabled = !enabled;
      if (enabled) {
        reasonEl.style.display = 'none';
      } else if (reason) {
        reasonEl.textContent = reason;
        reasonEl.style.display = 'block';
      }
    },
    mount(): HTMLElement {
      document.body.appendChild(root);
      return root;
    },
  };
}
