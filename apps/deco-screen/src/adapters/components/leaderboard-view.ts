export interface ScoreEntry {
  rank: number;
  playerId: string;
  points: number;
  achievedAt: string;
}

export interface LeaderboardView {
  render: (entries: ScoreEntry[]) => void;
  mount: () => HTMLElement;
}

export function createLeaderboardView(): LeaderboardView {
  const root = document.createElement('section');
  root.className = 'sb-leaderboard';

  const title = document.createElement('h1');
  title.className = 'sb-lb-title';
  title.textContent = 'HIGH SCORES';
  root.appendChild(title);

  const panel = document.createElement('div');
  panel.className = 'sb-lb-panel';
  root.appendChild(panel);

  const list = document.createElement('ol');
  list.className = 'sb-lb-list';
  panel.appendChild(list);

  let previousKeys = new Set<string>();
  const keyOf = (e: ScoreEntry): string => `${e.playerId}:${e.points}:${e.achievedAt}`;

  return {
    render(entries: ScoreEntry[]): void {
      list.innerHTML = '';

      if (entries.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'sb-lb-empty';
        empty.textContent = 'No scores yet — pull the plunger to claim the throne!';
        list.appendChild(empty);
        previousKeys = new Set();
        return;
      }

      const nextKeys = new Set<string>();
      for (const e of entries) {
        const key = keyOf(e);
        nextKeys.add(key);

        const li = document.createElement('li');
        li.className = `sb-lb-row sb-lb-row--${e.rank}`;
        if (!previousKeys.has(key)) li.classList.add('is-new');

        const rank = document.createElement('span');
        rank.className = 'sb-lb-rank';
        rank.textContent = String(e.rank);

        const player = document.createElement('span');
        player.className = 'sb-lb-player';
        player.textContent = e.playerId;

        const points = document.createElement('span');
        points.className = 'sb-lb-points';
        points.textContent = e.points.toLocaleString('en-US');

        li.append(rank, player, points);
        list.appendChild(li);
      }
      previousKeys = nextKeys;
    },
    mount(): HTMLElement {
      document.body.appendChild(root);
      return root;
    },
  };
}
