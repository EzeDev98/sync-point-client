// Draggable floating refresh button.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './FloatingRefreshButton.module.css';

const BUTTON_SIZE = 52;
const EDGE_MARGIN = 16;
const DRAG_THRESHOLD = 6;
const SPIN_DELAY_MS = 260;

function buildSpiralPath({ turns = 3, pointsPerTurn = 24, radius = 20, center = 24 }) {
  const totalPoints = turns * pointsPerTurn;
  const coords = [];

  for (let i = 0; i <= totalPoints; i += 1) {
    const theta = (i / pointsPerTurn) * Math.PI * 2;
    const r = (i / totalPoints) * radius;
    const x = center + r * Math.cos(theta);
    const y = center + r * Math.sin(theta);
    coords.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return `M${coords.join(' L')}`;
}

function FloatingRefreshButton() {
  const spiralPath = useMemo(() => buildSpiralPath({}), []);

  const [position, setPosition] = useState({
    left: EDGE_MARGIN,
    top: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const dragState = useRef(null);

  const handlePointerDown = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current) return;

    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragState.current.moved = true;
    }

    const maxLeft = window.innerWidth - BUTTON_SIZE;
    const maxTop = window.innerHeight - BUTTON_SIZE;

    const nextLeft = Math.min(Math.max(dragState.current.originLeft + dx, 0), maxLeft);
    const nextTop = Math.min(Math.max(dragState.current.originTop + dy, 0), maxTop);

    setPosition({ left: nextLeft, top: nextTop });
  }, []);

  const handlePointerUp = useCallback((e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);

    const wasDrag = dragState.current?.moved;
    dragState.current = null;

    if (!wasDrag) {
      setIsReloading(true);
      setTimeout(() => window.location.reload(), SPIN_DELAY_MS);
    }
  }, []);

  useEffect(() => {
    function handleResize() {
      setPosition((prev) => {
        if (prev.top === null) return prev;
        const maxLeft = window.innerWidth - BUTTON_SIZE;
        const maxTop = window.innerHeight - BUTTON_SIZE;
        return {
          left: Math.min(prev.left, maxLeft),
          top: Math.min(prev.top, maxTop),
        };
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const style =
    position.top === null
      ? { left: position.left, bottom: EDGE_MARGIN }
      : { left: position.left, top: position.top };

  return (
    <button
      type="button"
      aria-label="Refresh page"
      className={[styles.button, isDragging ? styles.dragging : '', isReloading ? styles.reloading : '']
        .filter(Boolean)
        .join(' ')}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <svg viewBox="0 0 48 48" className={styles.icon} aria-hidden="true">
        <path
          d={spiralPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

export default FloatingRefreshButton;
