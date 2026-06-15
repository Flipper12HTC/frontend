import './style.css';
import type { GameSource } from './application/ports/game-source';
import { createRendererOrchestrator } from './application/renderer-orchestrator';
import { attachKeyboardForwarder } from './infrastructure/keyboard-forwarder';
import { createScene } from './adapters/scene/scene';
import { createBall } from './adapters/meshes/ball';
import { createFlipper } from './adapters/meshes/flipper';
import { createStartOverlay } from './adapters/hud/start-overlay';
import { createComboHud } from './adapters/hud/combo-hud';
import { createMilestoneHud } from './adapters/hud/milestone-hud';
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
const flipperLeft = createFlipper(scene, { side: 'left' });
const flipperRight = createFlipper(scene, { side: 'right' });

const comboHud = createComboHud();
const milestoneHud = createMilestoneHud();

const source = pickSource();

const startOverlay = createStartOverlay(() => {
  void fetch(`${BACKEND_URL}/game/start`, { method: 'POST' })
    .then((r) => {
      if (r.ok) startOverlay.hide();
    })
    .catch(() => {
      /* backend unreachable, keep overlay */
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
    flipperLeft.setState(state);
    flipperRight.setState(state);
  },
  onScoreChanged(score) {
    startOverlay.hide();
    milestoneHud.checkScore(score);
  },
  onGameOver() {
    ball.setVisible(false);
    comboHud.reset();
    milestoneHud.reset();
    setTimeout(() => {
      startOverlay.show();
    }, 3000);
  },
  onBumperHit(id) {
    flashBumper(id);
    comboHud.registerHit();
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
  ball.animate(performance.now());
  render();
}

orchestrator.start();
loop();
