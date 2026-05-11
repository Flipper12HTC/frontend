import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { attachKeyboardForwarder } from './infrastructure/keyboard-forwarder';
import { createScene } from './adapters/scene/scene';
import { createBall } from './adapters/meshes/ball';
import { createFlipper } from './adapters/meshes/flipper';
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

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const { scene, render, resize, flashBumper } = createScene(canvas);
const ball = createBall(scene);
const flipperLeft  = createFlipper(scene, { side: 'left' });
const flipperRight = createFlipper(scene, { side: 'right' });

const source = pickSource();

const orchestrator = createRendererOrchestrator(source, {
  onBallMoved(position) {
    ball.setPosition(position);
    ball.setVisible(true);
  },
  onFlipperChanged(state) {
    flipperLeft.setState(state);
    flipperRight.setState(state);
  },
  onBumperHit(x, z) {
    flashBumper(x, z);
  },
  onGameOver() {
    ball.setVisible(false);
  },
});

attachKeyboardForwarder({ backendUrl: BACKEND_URL });

window.addEventListener('resize', resize);

function loop(): void {
  requestAnimationFrame(loop);
  render();
}

orchestrator.start();
loop();
