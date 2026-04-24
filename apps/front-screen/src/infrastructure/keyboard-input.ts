import type { FlipperSide, InputSink, Unsubscribe } from '../application/ports/input-sink';

type Handler = (side: FlipperSide) => void;

const DEFAULT_LEFT_KEYS: ReadonlySet<string> = new Set(['KeyA', 'ArrowLeft']);
const DEFAULT_RIGHT_KEYS: ReadonlySet<string> = new Set(['KeyD', 'ArrowRight']);

export interface KeyboardInputOptions {
  leftKeys?: ReadonlySet<string>;
  rightKeys?: ReadonlySet<string>;
  target?: Pick<Document, 'addEventListener' | 'removeEventListener'>;
}

export class KeyboardInput implements InputSink {
  private readonly leftKeys: ReadonlySet<string>;
  private readonly rightKeys: ReadonlySet<string>;
  private readonly target: Pick<Document, 'addEventListener' | 'removeEventListener'>;
  private readonly pressHandlers = new Set<Handler>();
  private readonly releaseHandlers = new Set<Handler>();
  private readonly down = { left: false, right: false };
  private running = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const side = this.match(event.code);
    if (side === null) return;
    if (this.down[side]) return;
    this.down[side] = true;
    for (const h of this.pressHandlers) h(side);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const side = this.match(event.code);
    if (side === null) return;
    if (!this.down[side]) return;
    this.down[side] = false;
    for (const h of this.releaseHandlers) h(side);
  };

  constructor(options: KeyboardInputOptions = {}) {
    this.leftKeys = options.leftKeys ?? DEFAULT_LEFT_KEYS;
    this.rightKeys = options.rightKeys ?? DEFAULT_RIGHT_KEYS;
    this.target = options.target ?? document;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.target.addEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.addEventListener('keyup', this.handleKeyUp as EventListener);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.target.removeEventListener('keydown', this.handleKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.handleKeyUp as EventListener);
    this.pressHandlers.clear();
    this.releaseHandlers.clear();
    this.down.left = false;
    this.down.right = false;
  }

  onPress(handler: Handler): Unsubscribe {
    this.pressHandlers.add(handler);
    return () => {
      this.pressHandlers.delete(handler);
    };
  }

  onRelease(handler: Handler): Unsubscribe {
    this.releaseHandlers.add(handler);
    return () => {
      this.releaseHandlers.delete(handler);
    };
  }

  private match(code: string): FlipperSide | null {
    if (this.leftKeys.has(code)) return 'left';
    if (this.rightKeys.has(code)) return 'right';
    return null;
  }
}
