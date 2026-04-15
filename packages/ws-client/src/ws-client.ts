export interface WsClientOptions {
  url: string;
  onMessage: (data: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectDelayMs?: number;
}

export interface WsClient {
  disconnect: () => void;
}

export function createWsClient(options: WsClientOptions): WsClient {
  const { url, onMessage, onOpen, onClose, reconnectDelayMs = 2000 } = options;

  let socket: WebSocket | null = null;
  let shouldReconnect = true;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect(): void {
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      onOpen?.();
    });

    socket.addEventListener('message', (event: MessageEvent) => {
      try {
        const data: unknown = JSON.parse(event.data as string);
        onMessage(data);
      } catch {
        // ignore malformed messages
      }
    });

    socket.addEventListener('close', () => {
      onClose?.();
      if (shouldReconnect) {
        reconnectTimer = setTimeout(connect, reconnectDelayMs);
      }
    });

    socket.addEventListener('error', () => {
      socket?.close();
    });
  }

  connect();

  return {
    disconnect(): void {
      shouldReconnect = false;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      socket?.close();
    },
  };
}
