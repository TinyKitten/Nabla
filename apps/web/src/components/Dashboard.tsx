import {
  type DragEvent,
  type CSSProperties,
  Fragment,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { Icon } from './Icon';
import { Widget } from './Widgets';
import { usePinnedReorder } from '../hooks/usePinnedReorder';
import type { ShellContext } from './AppShell';

const COLUMN_WIDTH = 280;
const GAP = 16;

const dashboardDropIndicatorStyle: CSSProperties = {
  width: COLUMN_WIDTH,
  height: 4,
  background: 'var(--accent)',
  borderRadius: 2,
  boxShadow: '0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent)',
};

function DashboardDropIndicator() {
  return <div style={dashboardDropIndicatorStyle} />;
}

function computeIdxFromGrid(e: DragEvent, container: Element) {
  const items = Array.from(container.querySelectorAll<HTMLElement>('[data-dashboard-tile]'));
  if (items.length === 0) return 0;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (const item of items) {
    const idxStr = item.getAttribute('data-dashboard-idx');
    if (idxStr === null) continue;
    const idx = Number(idxStr);
    const r = item.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = e.clientY < cy ? idx : idx + 1;
    }
  }
  return bestIdx;
}

function useColumnCount(itemCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const fit = Math.max(1, Math.floor((w + GAP) / (COLUMN_WIDTH + GAP)));
      setCount(fit);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, Math.min(count, Math.max(itemCount, 1))] as const;
}

export function Dashboard() {
  const { pinned, setPinned, pinWidget, isMobile } = useOutletContext<ShellContext>();
  const { draggingId, dropIdx, acceptingExternal, dragHandleProps, containerProps } =
    usePinnedReorder({
      items: pinned,
      setItems: setPinned,
      computeIdx: computeIdxFromGrid,
      onAcceptFromGrid: pinWidget,
    });

  const [columnsRef, colCount] = useColumnCount(pinned.length);

  const tintBg =
    acceptingExternal === 'blocked'
      ? 'color-mix(in oklab, #e63946 5%, transparent)'
      : acceptingExternal
      ? 'color-mix(in oklab, var(--accent) 6%, transparent)'
      : 'transparent';

  if (pinned.length === 0) {
    const blocked = acceptingExternal === 'blocked';
    const accenting = acceptingExternal === true;
    return (
      <div
        {...containerProps}
        className="jp-text"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: blocked ? '#e63946' : accenting ? 'var(--accent)' : 'var(--ink-3)',
          padding: 24,
          textAlign: 'center',
          background: tintBg,
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <Icon
          name="pin"
          size={22}
          style={{ color: blocked ? '#e63946' : accenting ? 'var(--accent)' : 'var(--ink-4)' }}
        />
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {blocked
            ? 'すでにピン留め済み'
            : accenting
            ? 'ここにドロップしてピン留め'
            : 'ピン留めしたウィジェットがありません'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-4)', maxWidth: 320 }}>
          右パネルのウィジェットをここにドラッグするか、ピン留めすると表示されます。
        </div>
      </div>
    );
  }

  const cols: number[][] = Array.from({ length: colCount }, () => []);
  pinned.forEach((_, i) => {
    cols[i % colCount].push(i);
  });
  const tailColumn = pinned.length % colCount;

  return (
    <div
      {...containerProps}
      className="scroll-area"
      style={{
        flex: 1,
        padding: isMobile ? '20px 14px 24px' : '24px 28px 28px',
        background: tintBg,
        transition: 'background 0.15s',
      }}
    >
      <div
        ref={columnsRef}
        style={{
          display: 'flex',
          gap: GAP,
          alignItems: 'flex-start',
        }}
      >
        {cols.map((indices, c) => (
          <div
            key={c}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: GAP,
              width: COLUMN_WIDTH,
              flexShrink: 0,
            }}
          >
            {indices.map((i) => {
              const w = pinned[i];
              const isDragging = draggingId === w.id;
              const showInsertBefore =
                dropIdx === i &&
                (acceptingExternal === true || (draggingId !== null && draggingId !== w.id));
              return (
                <Fragment key={w.id}>
                  {showInsertBefore && <DashboardDropIndicator />}
                  <div
                    data-dashboard-tile
                    data-dashboard-idx={i}
                    style={{
                      opacity: isDragging ? 0.4 : 1,
                      transition: 'opacity 0.12s',
                    }}
                  >
                    <Widget
                      widget={{ ...w, size: 'md' }}
                      isPinned
                      onRemove={() => setPinned((p) => p.filter((x) => x.id !== w.id))}
                      onUnpin={() => setPinned((p) => p.filter((x) => x.id !== w.id))}
                      dragHandleProps={dragHandleProps(w.id)}
                    />
                  </div>
                </Fragment>
              );
            })}
            {dropIdx === pinned.length &&
              c === tailColumn &&
              (acceptingExternal === true || draggingId !== null) && <DashboardDropIndicator />}
          </div>
        ))}
      </div>
    </div>
  );
}
