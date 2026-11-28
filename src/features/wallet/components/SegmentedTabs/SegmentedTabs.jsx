// Two-segment control with a label and description per segment.
import styles from './SegmentedTabs.module.css';

function SegmentedTabs({ tabs = [], value, onChange, ariaLabel = 'Select a mode' }) {
  return (
    <div className={styles.selector} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const isActive = tab.value === value;

        return (
          <button
            type="button"
            key={tab.value}
            role="tab"
            aria-selected={isActive}
            className={[styles.tab, isActive ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(tab.value)}
          >
            <span className={styles.label}>{tab.label}</span>
            {tab.description && <span className={styles.description}>{tab.description}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedTabs;
