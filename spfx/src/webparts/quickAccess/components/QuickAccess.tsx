import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { accentOf } from '../../../common/accents';
import { linkTarget } from '../../../common/links';
import { SectionHeader } from '../../../common/SectionHeader';
import { ISectionItem } from '../../../common/types';
import styles from './QuickAccess.module.scss';

export interface IQuickAccessProps {
  title: string;
  subtitle: string;
  items: ISectionItem[];
}

const QuickAccess: React.FC<IQuickAccessProps> = ({ title, subtitle, items }) => (
  <section className={styles.quickAccess}>
    <div className={styles.container}>
      <SectionHeader title={title} subtitle={subtitle} />
      <ul className={styles.grid}>
        {(items ?? []).map((item, index) => {
          const accent = accentOf(item.accent);
          const body = (
            <>
              <Icon iconName={item.icon || 'Link'} className={styles.icon} style={{ color: accent.color }} aria-hidden={true} />
              <div className={styles.text}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                {item.description && <p className={styles.cardDescription}>{item.description}</p>}
              </div>
              {item.url && <Icon iconName="Forward" className={styles.arrow} aria-hidden={true} />}
            </>
          );
          return (
            <li key={item.uniqueId ?? index} className={styles.cell}>
              {item.url ? (
                <a className={styles.card} href={item.url} style={{ background: accent.background }} {...linkTarget(item.url)}>
                  {body}
                </a>
              ) : (
                <div className={styles.card} style={{ background: accent.background }}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  </section>
);

export default QuickAccess;
