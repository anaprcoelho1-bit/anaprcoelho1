import * as React from 'react';
import styles from './Common.module.scss';

export interface ISectionHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export const SectionHeader: React.FC<ISectionHeaderProps> = ({ title, subtitle, className }) => {
  if (!title && !subtitle) {
    return null;
  }
  return (
    <header className={[styles.header, className].filter(Boolean).join(' ')}>
      {title && <h2 className={styles.title}>{title}</h2>}
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  );
};
