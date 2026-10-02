import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { SectionHeader } from '../../../common/SectionHeader';
import { ISectionItem } from '../../../common/types';
import styles from './AnalysisCriteria.module.scss';

export interface IAnalysisCriteriaProps {
  title: string;
  subtitle: string;
  items: ISectionItem[];
}

const AnalysisCriteria: React.FC<IAnalysisCriteriaProps> = ({ title, subtitle, items }) => (
  <section className={styles.analysisCriteria}>
    <div className={styles.container}>
      <SectionHeader title={title} subtitle={subtitle} />
      <ul className={styles.grid}>
        {(items ?? []).map((item, index) => (
          <li key={item.uniqueId ?? index} className={styles.card}>
            {item.icon && <Icon iconName={item.icon} className={styles.icon} aria-hidden={true} />}
            <h3 className={styles.cardTitle}>{item.title}</h3>
            {item.description && <p className={styles.cardDescription}>{item.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default AnalysisCriteria;
