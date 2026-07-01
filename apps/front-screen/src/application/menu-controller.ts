import type { BackendApi, PaymentSnapshot, TournamentInfo } from './ports/backend-api';
import type { GameMode, MenuModel } from '../domain/menu';
import { createMenu, moveSelection, selectedMode, LAUNCH_FEE_SOL } from '../domain/menu';

export interface PaymentContext {
  mode: GameMode;
  tournament: TournamentInfo | null;
}

// The view is a pure rendering surface; the controller never touches the DOM itself.
export interface MenuView {
  renderMenu: (menu: MenuModel) => void;
  showMenu: () => void;
  hideMenu: () => void;
  showPayment: (snapshot: PaymentSnapshot, context: PaymentContext) => void;
  updatePayment: (snapshot: PaymentSnapshot) => void;
  hidePayment: () => void;
  onConfirmed: (mode: GameMode) => void;
}

type Phase = 'menu' | 'paying' | 'playing';

export interface MenuController {
  start: () => void;
  move: (dir: -1 | 1) => void;
  confirm: () => void;
  cancel: () => void;
  dispose: () => void;
}

const POLL_INTERVAL_MS = 2000;

// Drives: menu selection -> create payment -> poll until confirmed -> join/start.
export function createMenuController(api: BackendApi, view: MenuView): MenuController {
  let menu = createMenu();
  let phase: Phase = 'menu';
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let current: { reference: string; context: PaymentContext } | null = null;

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function onConfirmed(): Promise<void> {
    if (!current) return;
    const { context, reference } = current;
    if (context.mode === 'tournament' && context.tournament) {
      await api.joinTournament(context.tournament.id, reference);
    }
    await api.startGame();
    current = null;
    phase = 'playing';
    view.hidePayment();
    view.onConfirmed(context.mode);
  }

  async function poll(): Promise<void> {
    if (!current) return;
    const snapshot = await api.pollPayment(current.reference);
    view.updatePayment(snapshot);
    if (snapshot.status === 'confirmed') {
      stopPolling();
      await onConfirmed();
    }
  }

  async function beginPayment(mode: GameMode): Promise<void> {
    let tournament: TournamentInfo | null = null;
    let amountSol = LAUNCH_FEE_SOL;
    let label = 'Flipper 12 - launch';
    if (mode === 'tournament') {
      tournament = await api.getOrCreateTournament();
      amountSol = tournament.entryFeeSol;
      label = 'Flipper 12 - tournament entry';
    }
    const snapshot = await api.createPayment(amountSol, label, label);
    current = { reference: snapshot.reference, context: { mode, tournament } };
    phase = 'paying';
    view.showPayment(snapshot, current.context);
    pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }

  return {
    start(): void {
      phase = 'menu';
      view.renderMenu(menu);
      view.showMenu();
    },
    move(dir): void {
      if (phase !== 'menu') return;
      menu = moveSelection(menu, dir);
      view.renderMenu(menu);
    },
    confirm(): void {
      if (phase !== 'menu') return;
      view.hideMenu();
      void beginPayment(selectedMode(menu));
    },
    cancel(): void {
      if (phase !== 'paying' || !current) return;
      stopPolling();
      void api.refundPayment(current.reference);
      current = null;
      phase = 'menu';
      view.hidePayment();
      view.renderMenu(menu);
      view.showMenu();
    },
    dispose(): void {
      stopPolling();
    },
  };
}
