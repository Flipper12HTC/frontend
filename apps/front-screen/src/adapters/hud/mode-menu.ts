import type { GameMode, MenuModel } from '../../domain/menu';

export interface ModeMenuHandle {
  render: (menu: MenuModel) => void;
  show: () => void;
  hide: () => void;
  mount: () => void;
  dispose: () => void;
}

interface OptionMeta {
  title: string;
  desc: string;
}

const META: Record<GameMode, OptionMeta> = {
  user: { title: '🎮 PARTIE SOLO', desc: 'Paie 0.8 SOL · partie classée on-chain' },
  tournament: { title: '🏆 TOURNOI', desc: 'Entrée 0.11 SOL · cashprize 1 SOL · 10 joueurs' },
};

// Arrow-key menu overlay rendered on top of the 3D canvas (UC-G01 main menu).
export function createModeMenu(): ModeMenuHandle {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed;inset:0;z-index:30;display:none;',
    'flex-direction:column;align-items:center;justify-content:center;gap:2rem;',
    'background:radial-gradient(circle at 50% 30%, #0b2a4a 0%, #04101f 70%);',
    'font-family:system-ui,sans-serif;color:#e8f4ff;',
  ].join('');

  const title = document.createElement('h1');
  title.textContent = 'FLIPPER 12';
  title.style.cssText =
    'font-size:3rem;letter-spacing:.4rem;margin:0;text-shadow:0 0 18px #2aa3ff;';

  const subtitle = document.createElement('p');
  subtitle.textContent = '← →  pour choisir · ENTRÉE pour valider';
  subtitle.style.cssText = 'margin:0;opacity:.7;letter-spacing:.1rem;';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:2rem;';

  const cards = new Map<GameMode, HTMLDivElement>();
  const order: GameMode[] = ['user', 'tournament'];
  for (const mode of order) {
    const card = document.createElement('div');
    const t = document.createElement('div');
    t.textContent = META[mode].title;
    t.style.cssText = 'font-size:1.6rem;font-weight:700;margin-bottom:.6rem;';
    const d = document.createElement('div');
    d.textContent = META[mode].desc;
    d.style.cssText = 'font-size:.95rem;opacity:.8;max-width:18rem;';
    card.append(t, d);
    card.style.cssText = [
      'width:22rem;padding:2rem;border-radius:1rem;text-align:center;',
      'background:rgba(255,255,255,.04);border:2px solid transparent;transition:all .15s;',
    ].join('');
    cards.set(mode, card);
    row.appendChild(card);
  }

  root.append(title, subtitle, row);

  function render(menu: MenuModel): void {
    menu.options.forEach((mode, i) => {
      const card = cards.get(mode);
      if (!card) return;
      const selected = i === menu.selectedIndex;
      card.style.borderColor = selected ? '#2aa3ff' : 'transparent';
      card.style.background = selected ? 'rgba(42,163,255,.18)' : 'rgba(255,255,255,.04)';
      card.style.transform = selected ? 'scale(1.05)' : 'scale(1)';
      card.style.boxShadow = selected ? '0 0 28px rgba(42,163,255,.5)' : 'none';
    });
  }

  return {
    render,
    show(): void {
      root.style.display = 'flex';
    },
    hide(): void {
      root.style.display = 'none';
    },
    mount(): void {
      document.body.appendChild(root);
    },
    dispose(): void {
      root.remove();
    },
  };
}
