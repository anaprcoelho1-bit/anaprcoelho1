import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import styles from './Common.module.scss';
import { linkTarget } from './links';

export interface IActionButtonProps {
  text?: string;
  url?: string;
  showChevron?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** Botão de ação do layout (ex.: "Saiba mais", "Consultar Portfólio"). Oculto quando não há texto. */
export const ActionButton: React.FC<IActionButtonProps> = ({ text, url, showChevron, className, style }) => {
  if (!text) {
    return null;
  }
  return (
    <a
      className={[styles.button, className].filter(Boolean).join(' ')}
      href={url || '#'}
      style={style}
      {...linkTarget(url)}
    >
      <span>{text}</span>
      {showChevron && <Icon iconName="ChevronRight" className={styles.buttonIcon} aria-hidden={true} />}
    </a>
  );
};
