export interface StartOverlayHandle {
  show: () => void;
  hide: () => void;
  isVisible: () => boolean;
  setEnabled: (enabled: boolean, reason?: string) => void;
  mount: () => HTMLElement;
  dispose: () => void;
}

export function createStartOverlay(onStart: () => void): StartOverlayHandle {
  const root = document.createElement('div');
  root.className =
    'fixed inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur z-50';

  const title = document.createElement('h1');
  title.className = 'text-white font-display text-6xl tracking-widest mb-8';
  title.textContent = 'FLIPPER 12';

  const button = document.createElement('button');
  button.className =
    'px-12 py-4 bg-neon-pink text-black font-display text-3xl tracking-widest hover:bg-white transition disabled:opacity-40 disabled:cursor-not-allowed';
  button.textContent = 'PRESS START';
  button.addEventListener('click', () => {
    if (!button.disabled) onStart();
  });

  const hint = document.createElement('p');
  hint.className = 'mt-4 text-white/60 font-mono text-sm';
  hint.textContent = 'or press SPACE';

  const reasonEl = document.createElement('p');
  reasonEl.className = 'mt-2 text-yellow-400 font-mono text-xs hidden';

  root.append(title, button, hint, reasonEl);

  const handler = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !button.disabled && root.style.display !== 'none') {
      e.preventDefault();
      onStart();
    }
  };
  document.addEventListener('keydown', handler);

  return {
    show(): void {
      root.style.display = 'flex';
    },
    hide(): void {
      root.style.display = 'none';
    },
    isVisible(): boolean {
      return root.style.display !== 'none';
    },
    setEnabled(enabled: boolean, reason?: string): void {
      button.disabled = !enabled;
      if (enabled) {
        reasonEl.classList.add('hidden');
        reasonEl.textContent = '';
      } else if (reason) {
        reasonEl.textContent = reason;
        reasonEl.classList.remove('hidden');
      }
    },
    mount(): HTMLElement {
      document.body.appendChild(root);
      return root;
    },
    dispose(): void {
      document.removeEventListener('keydown', handler);
      root.remove();
    },
  };
}
