import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { createScoreboardView } from './adapters/components/scoreboard-view';
import { MockGameSource, WsGameSource } from '@flipper/game-sources';

const WS_URL = 'ws://localhost:8080/ws';

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

const view = createScoreboardView(root);
const orchestrator = createRendererOrchestrator(pickSource(), view);
orchestrator.start();
