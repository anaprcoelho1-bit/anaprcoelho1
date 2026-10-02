import * as React from 'react';
import styles from './InstitutionalFooter.module.scss';

export interface IInstitutionalFooterProps {
  logoUrl: string;
  logoAlt: string;
  orgShortName: string;
  orgName: string;
  centerTitle: string;
  centerText: string;
  unitShortName: string;
  unitName: string;
}

const InstitutionalFooter: React.FC<IInstitutionalFooterProps> = (props) => (
  <footer className={styles.footer}>
    <div className={styles.container}>
      <div className={styles.org}>
        {props.logoUrl ? (
          <img className={styles.logo} src={props.logoUrl} alt={props.logoAlt} />
        ) : (
          <div className={styles.wordmark}>
            <span className={styles.wordmarkShort}>{props.orgShortName}</span>
            <span className={styles.wordmarkName}>{props.orgName}</span>
          </div>
        )}
      </div>
      <div className={styles.center}>
        {props.centerTitle && <p className={styles.centerTitle}>{props.centerTitle}</p>}
        {props.centerText && <p className={styles.centerText}>{props.centerText}</p>}
      </div>
      <div className={styles.unit}>
        <span className={styles.unitShort}>{props.unitShortName}</span>
        <span className={styles.unitName}>{props.unitName}</span>
      </div>
    </div>
  </footer>
);

export default InstitutionalFooter;
