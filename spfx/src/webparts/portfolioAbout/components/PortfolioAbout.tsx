import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { ActionButton } from '../../../common/ActionButton';
import { lines } from '../../../common/links';
import styles from './PortfolioAbout.module.scss';

export interface IPortfolioAboutProps {
  title: string;
  text: string;
  buttonText: string;
  buttonUrl: string;
  icon: string;
  highlights: string;
  imageUrl: string;
  imageAlt: string;
}

const PortfolioAbout: React.FC<IPortfolioAboutProps> = (props) => {
  const highlights = lines(props.highlights);

  return (
    <section className={[styles.about, props.imageUrl ? styles.withImage : ''].join(' ')}>
      <div className={styles.intro}>
        <h2 className={styles.title}>{props.title}</h2>
        {props.text && <p className={styles.text}>{props.text}</p>}
        <ActionButton text={props.buttonText} url={props.buttonUrl} className={styles.button} />
      </div>
      <div className={styles.highlight}>
        {props.icon && <Icon iconName={props.icon} className={styles.icon} aria-hidden={true} />}
        {highlights.length > 0 && (
          <ul className={styles.highlightList}>
            {highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      {props.imageUrl && (
        <div className={styles.image}>
          <img src={props.imageUrl} alt={props.imageAlt} />
        </div>
      )}
    </section>
  );
};

export default PortfolioAbout;
