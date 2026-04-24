import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { createParticleEffects } from './adapters/effects/particles';
import { MockGameSource, WsGameSource } from '@flipper/game-sources';

const WS_URL = 'ws://localhost:8080/ws';

function pickSource(): GameSource {
  const kind = import.meta.env.VITE_GAME_SOURCE ?? (import.meta.env.DEV ? 'mock' : 'ws');
  if (kind === 'ws') {
    return new WsGameSource({ url: WS_URL });
  }
  return new MockGameSource();
}

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const effects = createParticleEffects(canvas);
const orchestrator = createRendererOrchestrator(pickSource(), effects);
orchestrator.start();

let last = performance.now();
function loop(now: number): void {
  const delta = now - last;
  last = now;
  effects.tick(delta);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
