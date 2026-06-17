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

interface FlowerSpec {
  src: string;
  leftPct: number;
  bottomPct: number;
  size: number;
  opacity: number;
  rotate: number;
  delay: number;
}

const FLOWERS: FlowerSpec[] = [
  // scattered in the water (left side)
  { src: 'BlueFlower.png',   leftPct:  3, bottomPct: 62, size: 70, opacity: .45, rotate:  -8, delay:  0   },
  { src: 'PurpleFlower.png', leftPct:  9, bottomPct: 48, size: 55, opacity: .40, rotate:   6, delay: -1.5 },
  { src: 'GreenFlower.png',  leftPct:  5, bottomPct: 35, size: 50, opacity: .40, rotate: -10, delay: -3   },
  // right side mirror
  { src: 'RedFlower.png',    leftPct: 88, bottomPct: 62, size: 65, opacity: .45, rotate:  10, delay: -0.8 },
  { src: 'YellowFlower.png', leftPct: 93, bottomPct: 44, size: 55, opacity: .40, rotate:  -6, delay: -2.2 },
  { src: 'BlueFlower.png',   leftPct: 90, bottomPct: 30, size: 48, opacity: .40, rotate:   8, delay: -4   },
  // dense garden along the sand line
  { src: 'RedFlower.png',    leftPct: 25, bottomPct: 23, size: 36, opacity: .95, rotate:  -5, delay: -1   },
  { src: 'YellowFlower.png', leftPct: 32, bottomPct: 21, size: 32, opacity: .95, rotate:   4, delay: -2.4 },
  { src: 'GreenFlower.png',  leftPct: 40, bottomPct: 24, size: 38, opacity: .95, rotate:  -8, delay: -3.2 },
  { src: 'PurpleFlower.png', leftPct: 59, bottomPct: 22, size: 34, opacity: .95, rotate:   6, delay: -1.8 },
  { src: 'BlueFlower.png',   leftPct: 67, bottomPct: 25, size: 36, opacity: .95, rotate:  -4, delay: -0.5 },
  { src: 'RedFlower.png',    leftPct: 75, bottomPct: 21, size: 32, opacity: .95, rotate:   7, delay: -2.8 },
];

function spawnBubbles(host: HTMLElement, count = 24): void {
  for (let i = 0; i < count; i++) {
    const b = document.createElement('div');
    b.className = 'dc-bubble';
    const size = 10 + Math.random() * 44;
    b.style.width  = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left   = `${Math.random() * 100}%`;
    b.style.animationDuration = `${8 + Math.random() * 12}s`;
    b.style.animationDelay   = `${-Math.random() * 16}s`;
    host.appendChild(b);
  }
}

function spawnFlowers(host: HTMLElement): void {
  for (const f of FLOWERS) {
    const img = document.createElement('img');
    img.src       = `/image/${f.src}`;
    img.alt       = '';
    img.className = 'dc-flower';
    img.style.left           = `${f.leftPct}%`;
    img.style.bottom         = `${f.bottomPct}%`;
    img.style.width          = `${f.size}px`;
    img.style.opacity        = String(f.opacity);
    img.style.animationDelay = `${f.delay}s`;
    img.style.transform      = `rotate(${f.rotate}deg)`;
    host.appendChild(img);
  }
}

function spawnHouses(host: HTMLElement): void {
  const houses = [
    { cls: 'dc-house--bob',       src: 'BobHouse.png',       alt: "SpongeBob's Pineapple"    },
    { cls: 'dc-house--squidward', src: 'SquidwardHouse.png', alt: "Squidward's Easter Island" },
    { cls: 'dc-house--krusty',    src: 'KrabRestaurant.png', alt: 'The Krusty Krab'           },
    { cls: 'dc-house--sandy',     src: 'SandyHouse.png',     alt: "Sandy's Treedome"          },
    { cls: 'dc-house--patrick',   src: 'PatrickHouse.png',   alt: "Patrick's Rock"            },
  ];
  for (const h of houses) {
    const wrap = document.createElement('div');
    wrap.className = `dc-house ${h.cls}`;
    const img = document.createElement('img');
    img.src = `/image/${h.src}`;
    img.alt = h.alt;
    wrap.appendChild(img);
    host.appendChild(wrap);
  }
}

function ensureBackgroundLayers(): void {
  const layers: Array<{ id: string; cls: string; fill?: (el: HTMLElement) => void }> = [
    { id: 'dc-flowers', cls: 'dc-flowers', fill: spawnFlowers },
    { id: 'dc-sand',    cls: 'dc-sand' },
    { id: 'dc-houses',  cls: 'dc-houses', fill: spawnHouses  },
    { id: 'dc-bubbles', cls: 'dc-bubbles', fill: (el) => spawnBubbles(el) },
  ];
  for (const layer of layers) {
    if (document.getElementById(layer.id)) continue;
    const el = document.createElement('div');
    el.id        = layer.id;
    el.className = layer.cls;
    if (layer.fill) layer.fill(el);
    document.body.appendChild(el);
  }
}

function rankClass(rank: number): string {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
}

function createEntry(e: ScoreEntry, delayIndex: number): HTMLLIElement {
  const li = document.createElement('li');
  li.className = `dc-entry${e.rank === 1 ? ' is-first' : ''}`;
  li.style.animationDelay = `${delayIndex * 0.06}s`;

  const rank = document.createElement('span');
  rank.className = `dc-rank ${rankClass(e.rank)}`;
  rank.textContent = String(e.rank).padStart(2, '0');

  const player = document.createElement('span');
  player.className = 'dc-player';
  player.textContent = e.playerId;

  const points = document.createElement('span');
  points.className = 'dc-points';
  points.textContent = e.points.toLocaleString();

  li.append(rank, player, points);
  return li;
}

export function createLeaderboardView(): LeaderboardView {
  ensureBackgroundLayers();

  const root = document.createElement('section');
  root.className = 'dc-root';

  // Logo image
  const logo = document.createElement('img');
  logo.src       = '/image/Flipper12.png';
  logo.alt       = 'Flipper 12';
  logo.className = 'dc-logo';
  root.appendChild(logo);

  // Title
  const title = document.createElement('h1');
  title.className   = 'dc-title';
  title.textContent = '— HIGH SCORES —';
  root.appendChild(title);

  // Two-column grid
  const columns = document.createElement('div');
  columns.className = 'dc-columns';

  const listLeft  = document.createElement('ol');
  listLeft.className  = 'dc-list';
  const listRight = document.createElement('ol');
  listRight.className = 'dc-list';

  columns.append(listLeft, listRight);
  root.appendChild(columns);

  return {
    render(entries: ScoreEntry[]): void {
      listLeft.innerHTML  = '';
      listRight.innerHTML = '';

      if (entries.length === 0) {
        const empty = document.createElement('li');
        empty.className   = 'dc-empty';
        empty.textContent = 'no scores yet — play to claim the throne';
        listLeft.appendChild(empty);
        return;
      }

      const left  = entries.slice(0, 5);
      const right = entries.slice(5, 10);

      left.forEach((e, i)  => listLeft.appendChild(createEntry(e, i)));
      right.forEach((e, i) => listRight.appendChild(createEntry(e, i + 5)));
    },

    mount(): HTMLElement {
      document.body.appendChild(root);
      return root;
    },
  };
}
