import { toDataURL } from 'qrcode';
import type { PaymentSnapshot } from '../../application/ports/backend-api';
import type { PaymentContext } from '../../application/menu-controller';

export interface WalletQrHandle {
  show: (snapshot: PaymentSnapshot, context: PaymentContext) => void;
  update: (snapshot: PaymentSnapshot) => void;
  hide: () => void;
  mount: () => void;
  dispose: () => void;
}

function fmt(sol: number): string {
  return sol.toFixed(3);
}

// Wallet-connect QR overlay: shows the Solana Pay QR + a live payment progress bar.
// The player scans with Phantom (Devnet) and the bar refreshes as SOL arrives,
// supporting partial payments ("0.78 / 0.80 SOL").
export function createWalletQr(opts: { onCancel: () => void }): WalletQrHandle {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed;inset:0;z-index:40;display:none;',
    'flex-direction:column;align-items:center;justify-content:center;gap:1.2rem;',
    'background:rgba(4,16,31,.94);font-family:system-ui,sans-serif;color:#e8f4ff;',
  ].join('');

  const heading = document.createElement('h2');
  heading.style.cssText = 'margin:0;font-size:1.6rem;letter-spacing:.1rem;';

  const sub = document.createElement('p');
  sub.textContent = 'Scanne avec ton wallet (Phantom · Devnet)';
  sub.style.cssText = 'margin:0;opacity:.75;';

  const img = document.createElement('img');
  img.alt = 'Solana Pay QR code';
  img.style.cssText = 'width:260px;height:260px;border-radius:.8rem;background:#fff;padding:.4rem;';

  const amount = document.createElement('div');
  amount.style.cssText = 'font-size:1.3rem;font-weight:700;';

  const barOuter = document.createElement('div');
  barOuter.style.cssText =
    'width:320px;height:14px;border-radius:7px;background:rgba(255,255,255,.12);overflow:hidden;';
  const barInner = document.createElement('div');
  barInner.style.cssText =
    'height:100%;width:0%;background:linear-gradient(90deg,#2aa3ff,#36e0a8);transition:width .3s;';
  barOuter.appendChild(barInner);

  const status = document.createElement('p');
  status.style.cssText = 'margin:0;min-height:1.4rem;opacity:.9;';

  const cancel = document.createElement('button');
  cancel.textContent = '✕ Annuler (remboursement)';
  cancel.style.cssText = [
    'margin-top:.6rem;padding:.6rem 1.2rem;border:none;border-radius:.6rem;cursor:pointer;',
    'background:rgba(255,80,80,.18);color:#ff9b9b;font-size:.95rem;',
  ].join('');
  cancel.addEventListener('click', () => {
    opts.onCancel();
  });

  root.append(heading, sub, img, amount, barOuter, status, cancel);

  function renderQr(url: string | null): void {
    if (!url) return;
    void toDataURL(url, { width: 260, margin: 1 })
      .then((dataUrl) => {
        img.src = dataUrl;
      })
      .catch(() => undefined);
  }

  function paint(snapshot: PaymentSnapshot): void {
    amount.textContent = `${fmt(snapshot.receivedSol)} / ${fmt(snapshot.targetSol)} SOL`;
    const pct =
      snapshot.targetSol > 0 ? Math.min(100, (snapshot.receivedSol / snapshot.targetSol) * 100) : 0;
    barInner.style.width = `${pct.toFixed(1)}%`;

    switch (snapshot.status) {
      case 'pending':
        status.textContent = 'En attente du paiement…';
        break;
      case 'partial':
        status.textContent = `Il manque ${fmt(snapshot.remainingSol)} SOL`;
        break;
      case 'confirmed':
        status.textContent = 'Paiement confirmé ✓';
        break;
      case 'cancelled':
      case 'refunded':
        status.textContent = 'Annulé · remboursé';
        break;
      default:
        status.textContent = '';
    }
  }

  return {
    show(snapshot, context): void {
      heading.textContent =
        context.mode === 'tournament'
          ? `Entrée tournoi · cashprize ${context.tournament ? fmt(context.tournament.prizeSol) : '?'} SOL`
          : 'Lance ta partie';
      renderQr(snapshot.url);
      paint(snapshot);
      root.style.display = 'flex';
    },
    update(snapshot): void {
      paint(snapshot);
    },
    hide(): void {
      root.style.display = 'none';
    },
    mount(): void {
      document.body.appendChild(root);
    },
    dispose(): void {
      root.remove();
    },
  };
}
