import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { attachKeyboardForwarder } from './infrastructure/keyboard-forwarder';
import { createScene } from './adapters/scene/scene';
import { createBall } from './adapters/meshes/ball';
import { createFlipper } from './adapters/meshes/flipper';
import type { Flipper } from './adapters/meshes/flipper';
import { WsGameSource } from '@flipper/game-sources';
import { createSoundManager } from './adapters/audio/sound-manager';

const WS_URL = 'ws://localhost:8080/ws';
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8080';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const coordsDiv = document.createElement('div');
coordsDiv.className = 'debug-coords';
document.body.appendChild(coordsDiv);

let debugActive = false;

const { scene, render, resize, onMeshesReady, toggleDebug, updateDebugBall, addBallTrail, triggerShake, jellyfishBumpers } =
  createScene(canvas);
const ball = createBall(scene);
const source: GameSource = new WsGameSource({ url: WS_URL });

let flipperLeft: Flipper | null = null;
let flipperRight: Flipper | null = null;

onMeshesReady(({ flipperLeft: leftMesh, flipperRight: rightMesh }) => {
  flipperLeft = createFlipper(scene, leftMesh, { side: 'left' });
  flipperRight = createFlipper(scene, rightMesh, { side: 'right' });
});

const soundManager = createSoundManager();
soundManager.attach(source);

const orchestrator = createRendererOrchestrator(source, {
  onBallMoved(position) {
    ball.setPosition(position);
    ball.setVisible(position.y >= 0);
    updateDebugBall(position);
    addBallTrail(position);
    if (debugActive) {
      coordsDiv.textContent =
        `X: ${position.x.toFixed(3)}  Y: ${position.y.toFixed(3)}  Z: ${position.z.toFixed(3)}`;
    }
  },
  onFlipperChanged(state) {
    flipperLeft?.setState(state);
    flipperRight?.setState(state);
  },
  onScoreChanged() {},
  onGameOver() {
    ball.setVisible(false);
  },
  onBumperHit(id) {
    triggerShake();
    jellyfishBumpers.hit(id);
  },
});

attachKeyboardForwarder({
  backendUrl: BACKEND_URL,
  isStartAllowed: () => true,
});

let mutedSound = false;
window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    debugActive = !debugActive;
    toggleDebug();
    coordsDiv.style.display = debugActive ? 'block' : 'none';
    if (!debugActive) coordsDiv.textContent = '';
  }
  if (e.key === 'm' || e.key === 'M') {
    mutedSound = !mutedSound;
    soundManager.setMuted(mutedSound);
  }
});

window.addEventListener('resize', resize);

let lastFrameTime = performance.now();
function loop(): void {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  jellyfishBumpers.tick(dt);
  render();
}

orchestrator.start();
loop();
