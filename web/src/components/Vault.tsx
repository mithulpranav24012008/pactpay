// The vault card: the 3D scene (loaded lazily) with an SVG fallback drawn from the same segments
// when WebGL is unavailable. The held figure is DOM text over the canvas, not 3D text.
import { lazy, Suspense, useMemo } from 'react';
import { money, cents, POSE_LABEL, vaultSegments, type Pose, type Segment } from '../lib/escrow';
import type { Contract } from '../types';

const Vault3D = lazy(() => import('./Vault3D'));

const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();

const SVG_COLOR: Record<Pose, string> = {
  held: '#0070e0', checking: '#5aa2ff', failed: '#e8a33d', released: '#003087', returned: '#d9363e', unfunded: '#c5ccd6',
};

function arcPath(s: Segment, rIn = 62, rOut = 96) {
  // SVG y grows downward, so negate angles to keep the 3D scene's clockwise order.
  const p = (r: number, a: number) => `${(Math.cos(-a) * r).toFixed(2)} ${(Math.sin(-a) * r).toFixed(2)}`;
  const large = s.end - s.start > Math.PI ? 1 : 0;
  return `M ${p(rOut, s.start)} A ${rOut} ${rOut} 0 ${large} 0 ${p(rOut, s.end)} L ${p(rIn, s.end)} A ${rIn} ${rIn} 0 ${large} 1 ${p(rIn, s.start)} Z`;
}

function FlatVault({ segments, selectedId, onSelect }: { segments: Segment[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <svg viewBox="-110 -110 220 220" className="vault-flat" aria-hidden="true">
      {segments.map((s) => (
        <path key={s.id} d={arcPath(s)} fill={SVG_COLOR[s.pose]} stroke={s.id === selectedId ? '#001435' : 'none'}
          strokeWidth={1} onClick={() => onSelect(s.id)} style={{ cursor: 'pointer' }} />
      ))}
    </svg>
  );
}

export interface VaultCardProps {
  contract: Contract;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  reduced: boolean;
}

export function VaultCard({ contract, selectedId, hoveredId, onSelect, onHover, reduced }: VaultCardProps) {
  const segments = useMemo(() => vaultSegments(contract), [contract]);
  const focus = contract.milestones.find((m) => m.id === (hoveredId ?? selectedId));
  const focusSeg = segments.find((s) => s.id === focus?.id);
  return (
    <div className="vault" role="img"
      aria-label={`Escrow vault for ${contract.title}: ${money(cents(contract.totals.held), contract.currency)} held, ${money(cents(contract.totals.released), contract.currency)} paid out, ${money(cents(contract.totals.returned), contract.currency)} returned`}>
      <div className="vault-stage">
        {hasWebGL ? (
          <Suspense fallback={<FlatVault segments={segments} selectedId={selectedId} onSelect={onSelect} />}>
            <Vault3D segments={segments} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} reduced={reduced} />
          </Suspense>
        ) : (
          <FlatVault segments={segments} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>
      <div className="vault-read" aria-live="polite">
        {focus && focusSeg ? (
          <>
            <span className="vault-label">{focus.title}</span>
            <span className="vault-figure num">{money(cents(focus.amount), contract.currency)}</span>
            <span className="vault-label">{POSE_LABEL[focusSeg.pose]}</span>
          </>
        ) : (
          <>
            <span className="vault-label">Held in escrow</span>
            <span className="vault-figure num">{money(cents(contract.totals.held), contract.currency)}</span>
            <span className="vault-label">of {money(cents(contract.total), contract.currency)}</span>
          </>
        )}
      </div>
      <ul className="vault-key" aria-label="Vault key">
        {(['held', 'failed', 'released', 'returned'] as Pose[]).map((p) => (
          <li key={p}><i style={{ background: SVG_COLOR[p] }} />{POSE_LABEL[p]}</li>
        ))}
      </ul>
    </div>
  );
}
