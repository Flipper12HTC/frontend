import { WebSocketServer } from 'ws';

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`[mock-backend] WebSocket server running on ws://localhost:${PORT}/ws`);

// Scripted game state
let ballX = 0;
let ballY = 0;
let score = 0;
let ballsLeft = 3;
let tick = 0;

function broadcast(wss, data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

wss.on('connection', (ws) => {
  console.log('[mock-backend] Client connected');

  ws.on('close', () => {
    console.log('[mock-backend] Client disconnected');
  });
});

// Emit ball position at 60 Hz
setInterval(() => {
  tick++;

  // Simple sinusoidal ball movement
  ballX = Math.sin(tick * 0.05) * 3;
  ballY = Math.cos(tick * 0.03) * 5;

  broadcast(wss, {
    type: 'ball_position',
    payload: { x: ballX, y: ballY, z: 0 },
  });

  // Score update every 120 ticks (~2s)
  if (tick % 120 === 0) {
    score += 100;
    broadcast(wss, {
      type: 'score_update',
      payload: { score, ballsLeft },
    });
  }

  // Game over after 600 ticks (~10s)
  if (tick === 600) {
    broadcast(wss, {
      type: 'game_over',
      payload: { finalScore: score },
    });
    tick = 0;
    score = 0;
    ballsLeft = 3;
  }
}, 1000 / 60);
