export interface HudHandle {
  setStatus: (text: string) => void;
  showGameOver: (finalScore: number) => void;
  mount: () => HTMLElement;
}

export function createHud(): HudHandle {
  const root = document.createElement('div');
  root.className =
    'fixed top-4 left-4 text-white font-mono text-sm select-none pointer-events-none';
  root.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';

  const status = document.createElement('div');
  status.textContent = 'Flipper 12';
  root.appendChild(status);

  const overlay = document.createElement('div');
  overlay.className =
    'fixed inset-0 flex items-center justify-center text-white font-mono text-5xl pointer-events-none';
  overlay.style.display = 'none';

  return {
    setStatus(text: string): void {
      status.textContent = text;
    },
    showGameOver(finalScore: number): void {
      overlay.textContent = `GAME OVER — ${String(finalScore)}`;
      overlay.style.display = 'flex';
    },
    mount(): HTMLElement {
      document.body.appendChild(root);
      document.body.appendChild(overlay);
      return root;
    },
  };
}
