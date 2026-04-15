import { createWsClient } from '@flipper/ws-client';

const WS_URL = 'ws://localhost:8080/ws';

interface BallPositionPayload {
  x: number;
  y: number;
  z: number;
}

interface ScoreUpdatePayload {
  score: number;
  ballsLeft: number;
}

interface WsMessage {
  type: string;
  payload: unknown;
}

export function connectToBackend(handlers: {
  onBallPosition: (pos: BallPositionPayload) => void;
  onScoreUpdate: (data: ScoreUpdatePayload) => void;
  onGameOver: (finalScore: number) => void;
}): void {
  createWsClient({
    url: WS_URL,
    onMessage(data: unknown) {
      const msg = data as WsMessage;

      if (msg.type === 'ball_position') {
        handlers.onBallPosition(msg.payload as BallPositionPayload);
      }

      if (msg.type === 'score_update') {
        handlers.onScoreUpdate(msg.payload as ScoreUpdatePayload);
      }

      if (msg.type === 'game_over') {
        const payload = msg.payload as { finalScore: number };
        handlers.onGameOver(payload.finalScore);
      }
    },
  });
}
