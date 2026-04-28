import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { KeyboardInput } from './infrastructure/keyboard-input';
import { createScene } from './adapters/scene/scene';
import { createBall } from './adapters/meshes/ball';
import { createFlipper } from './adapters/meshes/flipper';
import { createHud } from './adapters/hud/hud';
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

const { scene, render, resize } = createScene(canvas);
const ball = createBall(scene);
const flipperLeft = createFlipper(scene, { side: 'left' });
const flipperRight = createFlipper(scene, { side: 'right' });
const hud = createHud();
hud.mount();

const source = pickSource();
const input = new KeyboardInput();

const orchestrator = createRendererOrchestrator(source, input, {
  onBallMoved(position) {
    ball.setPosition(position);
  },
  onFlipperChanged(state) {
    flipperLeft.setState(state);
    flipperRight.setState(state);
    hud.setStatus(`flipper ${state.side} ${state.active ? 'active' : 'rest'}`);
  },
  onScoreChanged(score, ballsLeft) {
    hud.setStatus(`score ${String(score)} · balls ${String(ballsLeft)}`);
  },
  onGameOver(finalScore) {
    hud.showGameOver(finalScore);
  },
});

window.addEventListener('resize', resize);

function loop(): void {
  requestAnimationFrame(loop);
  render();
}

orchestrator.start();
loop();
