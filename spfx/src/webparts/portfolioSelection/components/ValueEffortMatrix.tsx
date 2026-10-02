import * as React from 'react';
import { IEvaluatedInitiative, IPortfolioEvaluation } from '../../../methodology';
import { fmtCurrency, fmtIndex, fmtIpp } from '../../../common/portfolio/format';
import styles from '../../../common/portfolio/Portfolio.module.scss';

const WIDTH = 640;
const HEIGHT = 360;
const PAD = { left: 44, right: 16, top: 16, bottom: 36 };

const GROUPS: { key: string; label: string; color: string; match: (e: IEvaluatedInitiative) => boolean }[] = [
  { key: 'active', label: 'Portfólio ativo', color: '#0f4c75', match: (e) => e.stage === 'active' },
  { key: 'select', label: 'Sugerida para seleção', color: '#2e9e5b', match: (e) => e.stage === 'candidate' && e.selection?.suggestion === 'select' },
  { key: 'queue', label: 'Em fila', color: '#e3b505', match: (e) => e.stage === 'candidate' && e.selection?.suggestion === 'queue' },
  { key: 'discard', label: 'Sugerida para descarte', color: '#d64541', match: (e) => e.stage === 'candidate' && e.selection?.suggestion === 'discard' }
];

const QUADRANTS = [
  { label: 'Ganhos rápidos', x: 0, y: 1 },
  { label: 'Apostas estratégicas', x: 1, y: 1 },
  { label: 'Complementares', x: 0, y: 0 },
  { label: 'Esforços questionáveis', x: 1, y: 0 }
];

/** Matriz Valor (VP) × Custo-Risco (CR), bolhas proporcionais ao custo estimado (seção 6.2). */
export const ValueEffortMatrix: React.FC<{ evaluation: IPortfolioEvaluation }> = ({ evaluation }) => {
  const points = evaluation.items
    .filter((e) => e.vp !== undefined && e.cr !== undefined)
    .map((e) => ({ entry: e, group: GROUPS.find((g) => g.match(e)) }))
    .filter((p) => p.group !== undefined);
  if (points.length === 0) {
    return <p className={styles.empty}>Nenhuma iniciativa com notas completas.</p>;
  }
  const maxCost = Math.max(1, ...points.map((p) => p.entry.item.cost ?? 0));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (cr: number): number => PAD.left + (cr / 100) * plotW;
  const y = (vp: number): number => PAD.top + plotH - (vp / 100) * plotH;
  const radius = (cost: number | undefined): number => 5 + 14 * Math.sqrt((cost ?? 0) / maxCost);

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', maxWidth: WIDTH, height: 'auto' }} role="img" aria-label="Matriz valor por custo e risco das iniciativas">
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="#f8fafc" stroke="#e1e8ef" />
        <line x1={x(50)} x2={x(50)} y1={PAD.top} y2={PAD.top + plotH} stroke="#c8d2dc" strokeDasharray="4 3" />
        <line x1={PAD.left} x2={PAD.left + plotW} y1={y(50)} y2={y(50)} stroke="#c8d2dc" strokeDasharray="4 3" />
        {QUADRANTS.map((q) => (
          <text
            key={q.label}
            x={q.x === 0 ? PAD.left + 8 : PAD.left + plotW - 8}
            y={q.y === 1 ? PAD.top + 16 : PAD.top + plotH - 8}
            textAnchor={q.x === 0 ? 'start' : 'end'}
            fontSize={11}
            fill="#6b7785"
          >
            {q.label}
          </text>
        ))}
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <text x={x(tick)} y={PAD.top + plotH + 14} textAnchor="middle" fontSize={10} fill="#4a5561">
              {tick}
            </text>
            <text x={PAD.left - 6} y={y(tick) + 3} textAnchor="end" fontSize={10} fill="#4a5561">
              {tick}
            </text>
          </g>
        ))}
        <text x={PAD.left + plotW / 2} y={HEIGHT - 4} textAnchor="middle" fontSize={11} fill="#0b3b5c">
          Custo-Risco Ponderado (CR)
        </text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle" fontSize={11} fill="#0b3b5c" transform={`rotate(-90 12 ${PAD.top + plotH / 2})`}>
          Valor Ponderado (VP)
        </text>
        {points
          .sort((a, b) => (b.entry.item.cost ?? 0) - (a.entry.item.cost ?? 0))
          .map(({ entry, group }) => (
            <circle
              key={entry.item.id}
              cx={x(entry.cr as number)}
              cy={y(entry.vp as number)}
              r={radius(entry.item.cost)}
              fill={group?.color}
              fillOpacity={0.55}
              stroke={group?.color}
              strokeWidth={1.5}
            >
              <title>
                {`${entry.item.title}\nVP ${fmtIndex(entry.vp)} · CR ${fmtIndex(entry.cr)} · IPP ${fmtIpp(entry.ipp)}\nCusto ${fmtCurrency(entry.item.cost)} · ${group?.label}`}
              </title>
            </circle>
          ))}
      </svg>
      <ul className={styles.legend}>
        {GROUPS.map((g) => (
          <li key={g.key}>
            <span className={styles.dot} style={{ background: g.color }} aria-hidden={true} />
            {g.label}
          </li>
        ))}
      </ul>
    </div>
  );
};
