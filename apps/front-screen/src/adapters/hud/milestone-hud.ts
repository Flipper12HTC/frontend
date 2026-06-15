const MILESTONES: Array<{ score: number; label: string }> = [
  { score:   5_000, label: 'NICE !' },
  { score:  10_000, label: 'KRABBY PATTY !' },
  { score:  25_000, label: 'BARNACLES !' },
  { score:  50_000, label: 'HOLY SARDINES !' },
  { score: 100_000, label: 'BIKINI BOTTOM LEGEND !' },
];

export interface MilestoneHud {
  checkScore: (score: number) => void;
  reset: () => void;
}

export function createMilestoneHud(): MilestoneHud {
  const el = document.createElement('div');
  el.className = 'milestone-hud';
  document.body.appendChild(el);

  const reached = new Set<number>();
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function flash(label: string): void {
    if (hideTimer) clearTimeout(hideTimer);
    el.textContent = label;
    el.classList.remove('milestone-show');
    void el.offsetHeight;
    el.classList.add('milestone-show');
    hideTimer = setTimeout(() => {
      el.classList.remove('milestone-show');
    }, 2600);
  }

  return {
    checkScore(score: number): void {
      for (const m of MILESTONES) {
        if (!reached.has(m.score) && score >= m.score) {
          reached.add(m.score);
          flash(m.label);
          break; // one at a time
        }
      }
    },

    reset(): void {
      reached.clear();
      el.classList.remove('milestone-show');
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    },
  };
}
