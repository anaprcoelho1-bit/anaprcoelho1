import * as React from 'react';
import { IEvaluatedInitiative } from '../../../methodology';
import { fmtDate, LIGHT_COLORS } from '../../../common/portfolio/format';
import styles from '../../../common/portfolio/Portfolio.module.scss';

const QUARTERS = 6;
const LABEL_WIDTH = 300;
const WIDTH = 1200;
const ROW = 20;
const HEADER = 22;

function quarterStart(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

/** Período previsto da iniciativa: início previsto (ou autorização) até o término projetado (ou da linha de base). */
export function plannedPeriod(e: IEvaluatedInitiative, today: Date): { start: Date; end: Date; estimated: boolean } {
  const start = e.item.plannedStart ?? e.item.authorizedOn ?? today;
  const end = e.item.projectedEnd ?? e.item.baselineEnd;
  if (end && end > start) {
    return { start, end, estimated: false };
  }
  return { start, end: addMonths(start, Math.max(1, e.item.durationMonths ?? 3)), estimated: true };
}

/** Roadmap por trimestre: o que será feito, quando e por quem (artefato 4). */
export const Roadmap: React.FC<{ items: IEvaluatedInitiative[]; today: Date }> = ({ items, today }) => {
  if (items.length === 0) {
    return <p className={styles.small}>Nenhuma iniciativa ativa ou sugerida para seleção.</p>;
  }
  const first = addMonths(quarterStart(today), -3);
  const last = addMonths(first, QUARTERS * 3);
  const span = last.getTime() - first.getTime();
  const plotWidth = WIDTH - LABEL_WIDTH;
  const x = (date: Date): number => LABEL_WIDTH + Math.max(0, Math.min(1, (date.getTime() - first.getTime()) / span)) * plotWidth;
  const rows = items
    .map((e) => ({ e, period: plannedPeriod(e, today) }))
    .sort((a, b) => a.period.start.getTime() - b.period.start.getTime());
  const height = HEADER + rows.length * ROW + 4;
  const quarters = Array.from({ length: QUARTERS }, (_, i) => addMonths(first, i * 3));

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} style={{ width: '100%', maxWidth: WIDTH, minWidth: 640, height: 'auto' }} role="img" aria-label="Roadmap do portfólio por trimestre">
        {quarters.map((q, i) => (
          <g key={q.getTime()}>
            <rect x={x(q)} y={HEADER} width={plotWidth / QUARTERS} height={height - HEADER} fill={i % 2 === 0 ? '#f8fafc' : '#ffffff'} />
            <text x={x(q) + plotWidth / QUARTERS / 2} y={15} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0b3b5c">
              {`${q.getFullYear()}-T${Math.floor(q.getMonth() / 3) + 1}`}
            </text>
          </g>
        ))}
        <line x1={x(today)} x2={x(today)} y1={HEADER - 4} y2={height} stroke="#d64541" strokeDasharray="3 3" />
        {rows.map(({ e, period }, index) => {
          const y = HEADER + index * ROW;
          const color = e.stage === 'active' ? LIGHT_COLORS[e.light?.color ?? 'Verde'] : '#7b9db3';
          const x1 = x(period.start);
          const x2 = Math.max(x1 + 3, x(period.end));
          return (
            <g key={e.item.id}>
              <text x={4} y={y + 14} fontSize={12} fill="#323130">
                {e.item.title.length > 44 ? `${e.item.title.substring(0, 43)}…` : e.item.title}
              </text>
              <rect x={x1} y={y + 5} width={x2 - x1} height={11} rx={3} fill={color} fillOpacity={e.stage === 'active' ? 0.85 : 0.45} strokeDasharray={period.estimated ? '3 2' : undefined} stroke={period.estimated ? color : 'none'}>
                <title>{`${e.item.title}\n${fmtDate(period.start)} a ${fmtDate(period.end)}${period.estimated ? ' (estimado pela duração)' : ''}\n${e.item.team || e.item.unit}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <ul className={styles.legend}>
        <li>
          <span className={styles.dot} style={{ background: LIGHT_COLORS.Verde }} aria-hidden={true} />
          Ativa (cor do semáforo)
        </li>
        <li>
          <span className={styles.dot} style={{ background: '#7b9db3' }} aria-hidden={true} />
          Sugerida para seleção
        </li>
        <li>
          <span className={styles.dot} style={{ background: '#d64541' }} aria-hidden={true} />
          Hoje
        </li>
      </ul>
    </div>
  );
};
