import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { ActionButton } from '../../../common/ActionButton';
import { linkTarget } from '../../../common/links';
import { SectionHeader } from '../../../common/SectionHeader';
import { ISectionItem } from '../../../common/types';
import styles from './SupportTools.module.scss';

export interface ISupportToolsProps {
  title: string;
  subtitle: string;
  items: ISectionItem[];
  helpTitle: string;
  helpText: string;
  helpIcon: string;
  helpButtonText: string;
  helpButtonUrl: string;
}

const SupportTools: React.FC<ISupportToolsProps> = (props) => (
  <section className={styles.supportTools}>
    <div className={[styles.container, props.helpTitle ? '' : styles.noHelp].join(' ')}>
      <div>
        <SectionHeader title={props.title} subtitle={props.subtitle} />
        <ul className={styles.grid}>
          {(props.items ?? []).map((item, index) => {
            const body = (
              <>
                <Icon iconName={item.icon || 'Page'} className={styles.icon} aria-hidden={true} />
                <span className={styles.label}>{item.title}</span>
              </>
            );
            return (
              <li key={item.uniqueId ?? index} className={styles.cell}>
                {item.url ? (
                  <a className={styles.tool} href={item.url} {...linkTarget(item.url)}>
                    {body}
                  </a>
                ) : (
                  <div className={styles.tool}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {props.helpTitle && (
        <aside className={styles.help}>
          <div className={styles.helpBody}>
            {props.helpIcon && <Icon iconName={props.helpIcon} className={styles.helpIcon} aria-hidden={true} />}
            <div>
              <h2 className={styles.helpTitle}>{props.helpTitle}</h2>
              {props.helpText && <p className={styles.helpText}>{props.helpText}</p>}
            </div>
          </div>
          <ActionButton text={props.helpButtonText} url={props.helpButtonUrl} className={styles.helpButton} />
        </aside>
      )}
    </div>
  </section>
);

export default SupportTools;
