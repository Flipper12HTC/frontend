import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { createParticleEffects } from './adapters/effects/particles';
import { createLeaderboardView } from './adapters/components/leaderboard-view';
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

interface ScoreDto {
  playerId: string;
  points: number;
  achievedAt: string;
}

interface ScoresResponseDto {
  scores: ScoreDto[];
}

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const effects = createParticleEffects(canvas);
const leaderboard = createLeaderboardView();
leaderboard.mount();

const source = pickSource();
const orchestrator = createRendererOrchestrator(source, effects);
orchestrator.start();

async function refreshLeaderboard(): Promise<void> {
  try {
    const r = await fetch(`${BACKEND_URL}/scores/top?limit=10`);
    if (!r.ok) return;
    const data = (await r.json()) as ScoresResponseDto;
    leaderboard.render(
      data.scores.map((s, i) => ({
        rank: i + 1,
        playerId: s.playerId,
        points: s.points,
        achievedAt: s.achievedAt,
      })),
    );
  } catch {
    /* backend unreachable */
  }
}

void refreshLeaderboard();
source.on('game_over', () => {
  setTimeout(() => {
    void refreshLeaderboard();
  }, 200);
});
let last = performance.now();
function loop(now: number): void {
  const delta = now - last;
  last = now;
  effects.tick(delta);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
