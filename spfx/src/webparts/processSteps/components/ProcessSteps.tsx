import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { SectionHeader } from '../../../common/SectionHeader';
import { ISectionItem } from '../../../common/types';
import styles from './ProcessSteps.module.scss';

export interface IProcessStepsProps {
  title: string;
  subtitle: string;
  items: ISectionItem[];
}

const ProcessSteps: React.FC<IProcessStepsProps> = ({ title, subtitle, items }) => {
  const steps = items ?? [];
  return (
    <section className={styles.processSteps}>
      <div className={styles.container}>
        <SectionHeader title={title} subtitle={subtitle} />
        <ol className={styles.steps} style={{ '--step-count': Math.max(steps.length, 1) } as React.CSSProperties}>
          {steps.map((step, index) => (
            <li key={step.uniqueId ?? index} className={styles.step}>
              <div className={styles.marker}>
                <span className={styles.number} aria-hidden={true}>
                  {index + 1}
                </span>
                {step.icon && <Icon iconName={step.icon} className={styles.icon} aria-hidden={true} />}
              </div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              {step.description && <p className={styles.stepDescription}>{step.description}</p>}
              {index < steps.length - 1 && <Icon iconName="ChevronRight" className={styles.chevron} aria-hidden={true} />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

export default ProcessSteps;
