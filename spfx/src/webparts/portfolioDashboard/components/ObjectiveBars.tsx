import * as React from 'react';
import { niceScale, type ICategoryCount } from '../services/aggregate';
import styles from './PortfolioDashboard.module.scss';

export const ObjectiveBars: React.FC<{ data: ICategoryCount[] }> = ({ data }) => {
  if (data.length === 0) {
    return <p className={styles.message}>Nenhuma iniciativa com objetivo estratégico informado.</p>;
  }

  const scale = niceScale(Math.max(...data.map((item) => item.count)));
  const ticks: number[] = [];
  for (let tick = 0; tick <= scale.max; tick += scale.step) {
    ticks.push(tick);
  }

  return (
    <div className={styles.bars}>
      <ul className={styles.barList}>
        {data.map((item) => (
          <li key={item.label} className={styles.barRow}>
            <span className={styles.barLabel} title={item.label}>
              {item.label}
            </span>
            <span className={styles.barTrack}>
              <span
                className={styles.bar}
                style={{ width: `${(item.count / scale.max) * 100}%` }}
                title={`${item.label}: ${item.count}`}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.axis} aria-hidden={true}>
        <span />
        <span className={styles.axisTicks}>
          {ticks.map((tick) => (
            <span key={tick} style={{ left: `${(tick / scale.max) * 100}%` }}>
              {tick}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};
