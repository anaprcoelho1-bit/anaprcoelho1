import * as React from 'react';
import { ActionButton } from '../../../common/ActionButton';
import { lines } from '../../../common/links';
import styles from './PortfolioHero.module.scss';

export interface IPortfolioHeroProps {
  title: string;
  subtitle: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl: string;
  asideWords: string;
  asideTagline: string;
}

const PortfolioHero: React.FC<IPortfolioHeroProps> = (props) => {
  const words = lines(props.asideWords);
  const backgroundStyle: React.CSSProperties | undefined = props.imageUrl
    ? { backgroundImage: `url("${props.imageUrl.replace(/"/g, '%22')}")` }
    : undefined;

  return (
    <section className={styles.hero}>
      <div className={styles.media} style={backgroundStyle} aria-hidden={true} />
      <div className={styles.fade} aria-hidden={true} />
      <div className={styles.inner}>
        <div className={styles.content}>
          <h1 className={styles.title}>{props.title}</h1>
          {props.subtitle && <p className={styles.subtitle}>{props.subtitle}</p>}
          {props.description && <p className={styles.description}>{props.description}</p>}
          <ActionButton text={props.buttonText} url={props.buttonUrl} showChevron={true} />
        </div>
      </div>
      {(words.length > 0 || props.asideTagline) && (
        <aside className={styles.aside}>
          <ul className={styles.words}>
            {words.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
          <span className={styles.rule} aria-hidden={true} />
          {props.asideTagline && <p className={styles.tagline}>{props.asideTagline}</p>}
        </aside>
      )}
    </section>
  );
};

export default PortfolioHero;
