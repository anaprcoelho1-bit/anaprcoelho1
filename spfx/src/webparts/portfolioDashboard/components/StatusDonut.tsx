import * as React from 'react';
import { type IStatusCount } from '../services/aggregate';
import styles from './PortfolioDashboard.module.scss';

const RADIUS = 46;
const STROKE = 20;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const StatusDonut: React.FC<{ data: IStatusCount[] }> = ({ data }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const summary = data.map((item) => `${item.label}: ${item.count}`).join(', ');
  let offset = 0;

  return (
    <div className={styles.donutWrap}>
      <svg className={styles.donut} viewBox="0 0 120 120" role="img" aria-label={`${total} iniciativas. ${summary}`}>
        <circle cx="60" cy="60" r={RADIUS} fill="none" stroke="#edf1f5" strokeWidth={STROKE} />
        {total > 0 &&
          data
            .filter((item) => item.count > 0)
            .map((item) => {
              const length = (item.count / total) * CIRCUMFERENCE;
              const segment = (
                <circle
                  key={item.value}
                  cx="60"
                  cy="60"
                  r={RADIUS}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 60 60)"
                >
                  <title>{`${item.label}: ${item.count}`}</title>
                </circle>
              );
              offset += length;
              return segment;
            })}
        <text x="60" y="60" textAnchor="middle" className={styles.donutTotal}>
          {total.toLocaleString('pt-BR')}
        </text>
        <text x="60" y="75" textAnchor="middle" className={styles.donutCaption}>
          iniciativas
        </text>
      </svg>
      <ul className={styles.legend}>
        {data.map((item) => (
          <li key={item.value}>
            <span className={styles.swatch} style={{ background: item.color }} aria-hidden={true} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
