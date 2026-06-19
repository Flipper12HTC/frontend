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
  root.style.cssText = [
    'position:fixed;inset:0;display:flex;flex-direction:column;',
    'align-items:center;justify-content:center;z-index:50;',
    'background:radial-gradient(ellipse at 50% 40%,',
    '  rgba(0,80,180,0.88) 0%,rgba(0,20,70,0.97) 100%);',
    'backdrop-filter:blur(6px);',
  ].join('');

  // Bulles décoratives en fond
  const bubbles = document.createElement('div');
  bubbles.style.cssText = [
    'position:absolute;inset:0;overflow:hidden;pointer-events:none;',
  ].join('');
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    const size = 8 + Math.random() * 30;
    const left = Math.random() * 100;
    const delay = Math.random() * 6;
    const dur   = 4 + Math.random() * 5;
    b.style.cssText = [
      `position:absolute;bottom:-${size}px;left:${left}%;`,
      `width:${size}px;height:${size}px;border-radius:50%;`,
      `border:1.5px solid rgba(120,200,255,0.45);`,
      `background:radial-gradient(circle at 35% 30%,rgba(180,230,255,0.25),transparent 70%);`,
      `animation:rise ${dur}s ${delay}s linear infinite;`,
    ].join('');
    bubbles.appendChild(b);
  }

  // Keyframes pour les bulles montantes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rise {
      0%   { transform: translateY(0)    scale(1);   opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 0.6; }
      100% { transform: translateY(-105vh) scale(1.2); opacity: 0; }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-8px); }
    }
    @keyframes glow-pulse {
      0%, 100% { text-shadow: 0 0 20px #ff8800, 0 2px 0 #884400; }
      50%       { text-shadow: 0 0 40px #ffcc00, 0 0 80px rgba(255,160,0,0.5), 0 2px 0 #884400; }
    }
    @keyframes btn-idle {
      0%, 100% { box-shadow: 0 0 28px rgba(255,180,0,0.75), 0 4px 0 #886600; }
      50%       { box-shadow: 0 0 55px rgba(255,220,0,0.95), 0 0 90px rgba(255,150,0,0.4), 0 4px 0 #886600; }
    }
  `;

  // Logo éponge
  const logo = document.createElement('div');
  logo.style.cssText = [
    'font-size:80px;margin-bottom:6px;',
    'filter:drop-shadow(0 0 24px #ffcc00) drop-shadow(0 0 48px rgba(255,180,0,0.5));',
    'animation:float 3s ease-in-out infinite;',
  ].join('');
  logo.textContent = '🧽';

  const title = document.createElement('h1');
  title.style.cssText = [
    'font-family:"Arial Black",Impact,sans-serif;',
    'font-size:clamp(2.2rem,7vw,3.8rem);font-weight:900;',
    'letter-spacing:0.10em;margin:0 0 2px;',
    'color:#ffe600;',
    'animation:glow-pulse 2.5s ease-in-out infinite;',
    'text-transform:uppercase;text-align:center;',
  ].join('');
  title.textContent = 'BIKINI BOTTOM';

  const subtitle = document.createElement('h2');
  subtitle.style.cssText = [
    'font-family:"Arial Black",Impact,sans-serif;',
    'font-size:clamp(1rem,3.5vw,2rem);font-weight:700;',
    'letter-spacing:0.28em;margin:0 0 36px;',
    'color:#66ddff;text-shadow:0 0 16px #0088ff,0 0 32px rgba(0,150,255,0.4);',
    'text-transform:uppercase;text-align:center;',
  ].join('');
  subtitle.textContent = 'P  I  N  B  A  L  L';

  const button = document.createElement('button');
  button.style.cssText = [
    'padding:18px 56px;',
    'background:linear-gradient(135deg,#ff8800 0%,#ffcc00 60%,#ff9900 100%);',
    'color:#003366;font-family:"Arial Black",Impact,sans-serif;',
    'font-size:clamp(1.1rem,3.5vw,1.6rem);font-weight:900;',
    'letter-spacing:0.14em;border:3px solid #ffeeaa;cursor:pointer;',
    'border-radius:10px;',
    'animation:btn-idle 2s ease-in-out infinite;',
    'text-transform:uppercase;transition:transform 0.12s,filter 0.12s;',
  ].join('');
  button.textContent = '▶  PRESS START';

  button.addEventListener('mouseenter', () => {
    if (!button.disabled) {
      button.style.transform = 'scale(1.07)';
      button.style.filter    = 'brightness(1.15)';
    }
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = '';
    button.style.filter    = '';
  });
  button.addEventListener('click', () => {
    if (!button.disabled) onStart();
  });

  const hint = document.createElement('p');
  hint.style.cssText = [
    'margin-top:14px;color:rgba(160,210,255,0.55);',
    'font-family:monospace;font-size:0.85rem;letter-spacing:0.06em;',
  ].join('');
  hint.textContent = 'ou appuie sur ESPACE';

  const reasonEl = document.createElement('p');
  reasonEl.style.cssText = [
    'margin-top:8px;color:#ffdd55;font-family:monospace;',
    'font-size:0.8rem;display:none;',
  ].join('');

  root.appendChild(style);
  root.appendChild(bubbles);
  root.append(logo, title, subtitle, button, hint, reasonEl);

  const handler = (e: KeyboardEvent): void => {
    if (e.code === 'Space' && !button.disabled && root.style.display !== 'none') {
      e.preventDefault();
      onStart();
    }
  };
  document.addEventListener('keydown', handler);

  return {
    show(): void { root.style.display = 'flex'; },
    hide(): void { root.style.display = 'none'; },
    isVisible(): boolean { return root.style.display !== 'none'; },
    setEnabled(enabled: boolean, reason?: string): void {
      button.disabled = !enabled;
      button.style.opacity = enabled ? '1' : '0.38';
      button.style.cursor  = enabled ? 'pointer' : 'not-allowed';
      if (enabled) {
        reasonEl.style.display = 'none';
        reasonEl.textContent   = '';
      } else if (reason) {
        reasonEl.textContent   = reason;
        reasonEl.style.display = 'block';
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
