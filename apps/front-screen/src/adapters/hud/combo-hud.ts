export interface ComboHud {
  registerHit: () => void;
  reset: () => void;
}

export function createComboHud(): ComboHud {
  const el = document.createElement('div');
  el.className = 'combo-hud';
  document.body.appendChild(el);

  let streak = 0;
  let lastHitAt = 0;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const HIT_WINDOW_MS = 1600;
  const RESET_DELAY_MS = 2200;

  function render(): void {
    el.style.display = '';
    el.innerHTML = `<div class="combo-count">×${streak}</div><div class="combo-label">C H A I N</div>`;
    el.classList.remove('combo-pop');
    void el.offsetHeight;
    el.classList.add('combo-pop');
  }

  return {
    registerHit(): void {
      const now = performance.now();
      if (now - lastHitAt < HIT_WINDOW_MS) {
        streak++;
      } else {
        streak = 1;
      }
      lastHitAt = now;

      if (resetTimer) clearTimeout(resetTimer);

      if (streak >= 2) render();

      resetTimer = setTimeout(() => {
        el.style.display = 'none';
        streak = 0;
      }, RESET_DELAY_MS);
    },

    reset(): void {
      streak = 0;
      lastHitAt = 0;
      el.style.display = 'none';
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    },
  };
}
