export interface StartOverlay {
  show: () => void;
  hide: () => void;
  destroy: () => void;
}

export function createStartOverlay(parent: HTMLElement = document.body): StartOverlay {
  const root = document.createElement('div');
  root.className =
    'pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity duration-200';
  root.style.opacity = '1';

  const panel = document.createElement('div');
  panel.className =
    'rounded-2xl border border-white/10 bg-black/60 px-10 py-8 text-center backdrop-blur-md';

  const title = document.createElement('h1');
  title.className = 'text-5xl font-bold tracking-widest text-white';
  title.textContent = 'FLIPPER 12';

  const sub = document.createElement('p');
  sub.className = 'mt-4 text-lg uppercase tracking-[0.3em] text-white/70';
  sub.textContent = 'Press SPACE to start';

  panel.appendChild(title);
  panel.appendChild(sub);
  root.appendChild(panel);
  parent.appendChild(root);

  let visible = true;

  function apply(): void {
    root.style.opacity = visible ? '1' : '0';
    root.style.display = visible ? 'flex' : 'none';
  }

  return {
    show(): void {
      if (visible) return;
      visible = true;
      apply();
    },
    hide(): void {
      if (!visible) return;
      visible = false;
      apply();
    },
    destroy(): void {
      root.remove();
    },
  };
}
