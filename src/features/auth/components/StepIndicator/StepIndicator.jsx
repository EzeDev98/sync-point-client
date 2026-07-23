import styles from './StepIndicator.module.css';

/**
 * Numbered progress dots for the multi-step registration form.
 * Replaces .step-indicator / .step / .step-number / .step-label / .step-line,
 * which were hand-assembled in Register.
 *
 * Steps are passed as data so the markup for each is generated once:
 *   steps={['Basic info', 'Security']}
 */
function StepIndicator({ steps = [], current = 1 }) {
  return (
    <div className={styles.indicator}>
      {steps.map((label, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === current;
        const isComplete = stepNumber < current;

        const stepClassNames = [
          styles.step,
          isActive ? styles.active : '',
          isComplete ? styles.complete : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div className={styles.segment} key={label}>
            {index > 0 && <span className={styles.line} aria-hidden="true" />}
            <div className={stepClassNames} aria-current={isActive ? 'step' : undefined}>
              <span className={styles.number}>{stepNumber}</span>
              <span className={styles.label}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default StepIndicator;