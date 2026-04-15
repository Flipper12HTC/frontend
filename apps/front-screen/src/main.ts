import './style.css';
import { createScene } from './scene/scene';
import { createBall } from './meshes/ball';
import { connectToBackend } from './net/ws';

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const { scene, render, resize } = createScene(canvas);
const ball = createBall(scene);

connectToBackend({
  onBallPosition(pos) {
    ball.setPosition(pos.x, pos.y, pos.z);
  },
  onScoreUpdate(data) {
    // back-screen handles score display
    // nothing to do here for the POC
    void data;
  },
  onGameOver(finalScore) {
    void finalScore;
  },
});

window.addEventListener('resize', resize);

function loop(): void {
  requestAnimationFrame(loop);
  render();
}

loop();