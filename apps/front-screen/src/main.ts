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

// Debug HUD — coordinates display, hidden by default.
const coordsDiv = document.createElement('div');
coordsDiv.style.cssText =
  'position:fixed;top:8px;left:8px;background:rgba(0,0,0,.75);color:#0ff;' +
  'padding:6px 10px;font:13px monospace;border-radius:4px;display:none;z-index:999;pointer-events:none';
document.body.appendChild(coordsDiv);

let debugActive = false;

const { scene, render, resize, onMeshesReady, toggleDebug, updateDebugBall } = createScene(canvas);
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
    ball.setVisible(position.y >= 0);
    updateDebugBall(position);
    if (debugActive) {
      coordsDiv.textContent =
        `X: ${position.x.toFixed(3)}  Y: ${position.y.toFixed(3)}  Z: ${position.z.toFixed(3)}`;
    }
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

attachKeyboardForwarder({
  backendUrl: BACKEND_URL,
  isStartAllowed: () => startOverlay.isVisible(),
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    debugActive = !debugActive;
    toggleDebug();
    coordsDiv.style.display = debugActive ? 'block' : 'none';
    if (!debugActive) coordsDiv.textContent = '';
  }
});

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
