import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { createScoreboardView } from './adapters/components/scoreboard-view';
import { MockGameSource, WsGameSource } from '@flipper/game-sources';

const WS_URL = 'ws://localhost:8080/ws';
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8080';

function pickSource(): GameSource {
  const kind = import.meta.env.VITE_GAME_SOURCE ?? (import.meta.env.DEV ? 'mock' : 'ws');
  if (kind === 'ws') {
    return new WsGameSource({ url: WS_URL });
  }
  return new MockGameSource();
}

const root = document.createElement('main');
root.id = 'root';
document.body.appendChild(root);

const view = createScoreboardView(root, {
  onStart: () => {
    void requestStart();
  },
});

const orchestrator = createRendererOrchestrator(pickSource(), view);
orchestrator.start();

let lastStartAt = 0;

async function requestStart(): Promise<void> {
  if (orchestrator.getStatus() === 'running') return;
  const now = Date.now();
  if (now - lastStartAt < 500) return;
  lastStartAt = now;
  try {
    await fetch(`${BACKEND_URL}/game/start`, { method: 'POST' });
  } catch {
    /* backend unreachable */
  }
}

interface GameStateDto {
  status?: string;
  score?: number;
  ballsLeft?: number;
  multiplier?: number;
}

fetch(`${BACKEND_URL}/game/state`)
  .then((r) => (r.ok ? (r.json() as Promise<GameStateDto>) : null))
  .then((data) => {
    if (!data) return;
    if (data.status === 'running' || data.status === 'over' || data.status === 'idle') {
      orchestrator.setStatus(data.status);
    }
  })
  .catch(() => {
    /* backend unreachable */
  });

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    void requestStart();
  }
});
