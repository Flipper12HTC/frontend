import type { PaymentStatus } from '@flipper/contracts';

// What the screen needs from the backend. The frontend never talks to Solana directly;
// it only calls these endpoints and renders the result.
export interface PaymentSnapshot {
  url: string | null; // "solana:" URL to put in the QR (only present on creation)
  reference: string;
  receivedSol: number;
  targetSol: number;
  remainingSol: number;
  status: PaymentStatus;
}

export interface TournamentInfo {
  id: string;
  status: string;
  participants: number;
  maxParticipants: number;
  entryFeeSol: number;
  prizeSol: number;
  winnerShort: string | null;
}

export interface BackendApi {
  createPayment(amountSol: number, label: string, message: string): Promise<PaymentSnapshot>;
  pollPayment(reference: string): Promise<PaymentSnapshot>;
  refundPayment(reference: string): Promise<void>;
  getOrCreateTournament(): Promise<TournamentInfo>;
  joinTournament(tournamentId: string, reference: string): Promise<TournamentInfo>;
  startGame(): Promise<void>;
}
