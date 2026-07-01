import type { BackendApi, PaymentSnapshot, TournamentInfo } from '../application/ports/backend-api';
import type { PaymentStatus } from '@flipper/contracts';

interface RawPayment {
  url?: string;
  reference: string;
  receivedSol: number;
  targetSol: number;
  remainingSol: number;
  status: PaymentStatus;
}

interface RawTournament {
  id: string;
  status: string;
  participants: number;
  maxParticipants: number;
  entryFeeSol: number;
  prizeSol: number;
  winnerShort: string | null;
}

function mapPayment(raw: RawPayment): PaymentSnapshot {
  return {
    url: raw.url ?? null,
    reference: raw.reference,
    receivedSol: raw.receivedSol,
    targetSol: raw.targetSol,
    remainingSol: raw.remainingSol,
    status: raw.status,
  };
}

// HTTP implementation of the BackendApi port (fetch lives in infrastructure, never above).
export function createHttpBackendApi(backendUrl: string): BackendApi {
  async function postJson<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${backendUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data: unknown = await res.json();
    return data as T;
  }

  async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${backendUrl}${path}`);
    const data: unknown = await res.json();
    return data as T;
  }

  return {
    async createPayment(amountSol, label, message): Promise<PaymentSnapshot> {
      return mapPayment(
        await postJson<RawPayment>('/payment/request', { amountSol, label, message }),
      );
    },
    async pollPayment(reference): Promise<PaymentSnapshot> {
      return mapPayment(await getJson<RawPayment>(`/payment/${reference}`));
    },
    async refundPayment(reference): Promise<void> {
      await postJson(`/payment/${reference}/refund`, {});
    },
    async getOrCreateTournament(): Promise<TournamentInfo> {
      const active = await getJson<RawTournament | { active: false }>('/tournament/active');
      if ('active' in active) {
        return await postJson<RawTournament>('/tournament/create');
      }
      return active;
    },
    async joinTournament(tournamentId, reference): Promise<TournamentInfo> {
      return await postJson<RawTournament>(`/tournament/${tournamentId}/join`, { reference });
    },
    async startGame(): Promise<void> {
      await postJson('/game/start');
    },
  };
}
