import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { attachKeyboardForwarder } from './infrastructure/keyboard-forwarder';
import { createScene } from './adapters/scene/scene';
import { createBall } from './adapters/meshes/ball';
import { createFlipper } from './adapters/meshes/flipper';
import type { Flipper } from './adapters/meshes/flipper';
import { createStartOverlay } from './adapters/hud/start-overlay';
import { WsGameSource } from '@flipper/game-sources';

const WS_URL = 'ws://localhost:8080/ws';
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8080';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const { scene, render, resize, onMeshesReady } = createScene(canvas);
const ball = createBall(scene);
const source: GameSource = new WsGameSource({ url: WS_URL });

let flipperLeft: Flipper | null = null;
let flipperRight: Flipper | null = null;

onMeshesReady(({ flipperLeft: leftMesh, flipperRight: rightMesh }) => {
  flipperLeft = createFlipper(scene, leftMesh, { side: 'left' });
  flipperRight = createFlipper(scene, rightMesh, { side: 'right' });
});

const startOverlay = createStartOverlay(() => {
  startOverlay.hide();
  void fetch(`${BACKEND_URL}/game/start`, { method: 'POST' }).catch(() => {
    /* backend unreachable — overlay already hidden, map stays visible */
  });
});
startOverlay.mount();
startOverlay.show();

const orchestrator = createRendererOrchestrator(source, {
  onBallMoved(position) {
    ball.setPosition(position);
    ball.setVisible(true);
  },
  onFlipperChanged(state) {
    flipperLeft?.setState(state);
    flipperRight?.setState(state);
  },
  onScoreChanged() {
    startOverlay.hide();
  },
  onGameOver() {
    ball.setVisible(false);
    setTimeout(() => {
      startOverlay.show();
    }, 3000);
  },
});

attachKeyboardForwarder({ backendUrl: BACKEND_URL });

window.addEventListener('resize', resize);

void fetch(`${BACKEND_URL}/game/state`)
  .then((r) => (r.ok ? r.json() : null))
  .then((data: unknown) => {
    if (data && typeof data === 'object' && 'status' in data) {
      const status = (data as { status: unknown }).status;
      if (status === 'running') startOverlay.hide();
    }
  })
  .catch(() => {
    /* backend unreachable, keep overlay */
  });

function loop(): void {
  requestAnimationFrame(loop);
  render();
}

orchestrator.start();
loop();
