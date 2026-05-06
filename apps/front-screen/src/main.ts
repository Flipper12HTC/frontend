import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { KeyboardInput } from './infrastructure/keyboard-input';
import { createScene } from './adapters/scene/scene';
import { createBall } from './adapters/meshes/ball';
import { createFlipper } from './adapters/meshes/flipper';
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

const source = pickSource();
const input = new KeyboardInput();

const orchestrator = createRendererOrchestrator(source, input, {
  onBallMoved(position) {
    ball.setPosition(position);
    ball.setVisible(true);
  },
  onFlipperChanged(state) {
    flipperLeft.setState(state);
    flipperRight.setState(state);
  },
  onGameOver() {
    ball.setVisible(false);
  },
});

window.addEventListener('resize', resize);

function loop(): void {
  requestAnimationFrame(loop);
  render();
}

orchestrator.start();
loop();
