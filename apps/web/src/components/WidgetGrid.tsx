import { type DragEvent, useState } from 'react';
import { Icon } from './Icon';
import { Widget } from './Widgets';
import type { WidgetItem, WidgetType } from '../types';

function PinnedBadge() {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 0 2px var(--bg-elev)',
        }}
      >
        <Icon name="pin" size={11} />
      </div>
      {hovered && (
        <div
          role="tooltip"
          className="jp-text"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--ink)',
            color: 'var(--bg-elev)',
            fontSize: 11,
            lineHeight: 1.5,
            padding: '6px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            pointerEvents: 'none',
          }}
        >
          ピン留めバーに表示中
        </div>
      )}
    </div>
  );
}

interface WidgetGridProps {
  widgets: WidgetItem[];
  onReorder: (next: WidgetItem[]) => void;
  onOpen?: (w: WidgetItem) => void;
  onRemove?: (id: string) => void;
  onRefresh?: (id: string) => void;
  onPin?: (id: string) => void;
  onUnpin?: (type: WidgetType) => void;
  accent?: string;
  pinnedTypes?: WidgetType[];
}

export function WidgetGrid({
  widgets,
  onReorder,
  onOpen,
  onRemove,
  onRefresh,
  onPin,
  onUnpin,
  accent,
  pinnedTypes = [],
}: WidgetGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => (e: DragEvent<HTMLElement>) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData('application/x-widget-id', id);
    const w = widgets.find((x) => x.id === id);
    if (w) window.__draggingGridWidgetType = w.type;
  };
  const handleDragOver = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (id !== draggingId) setOverId(id);
  };
  const handleDrop = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggingId || draggingId === id) return;
    const ids = widgets.map((w) => w.id);
    const fromIdx = ids.indexOf(draggingId);
    const toIdx = ids.indexOf(id);
    const next = [...widgets];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 132px)',
        gap: 16,
        gridAutoRows: 'min-content',
        gridAutoFlow: 'dense',
      }}
    >
      {widgets.map((w) => {
        const span =
          w.size === 'lg'
            ? { gridColumn: 'span 2', gridRow: 'span 2' }
            : w.size === 'md'
            ? { gridColumn: 'span 2', gridRow: 'span 1' }
            : {};
        const isPinned = pinnedTypes.includes(w.type);
        return (
          <div
            key={w.id}
            onDragOver={handleDragOver(w.id)}
            onDrop={handleDrop(w.id)}
            style={{
              ...span,
              position: 'relative',
              opacity: draggingId === w.id ? 0.4 : 1,
              transform: overId === w.id && draggingId !== w.id ? 'scale(1.02)' : 'scale(1)',
              transition: 'transform 0.15s, opacity 0.12s',
            }}
          >
            <Widget
              widget={w}
              accent={accent}
              onOpen={() => onOpen && onOpen(w)}
              onRemove={() => onRemove && onRemove(w.id)}
              onRefresh={() => onRefresh && onRefresh(w.id)}
              onPin={onPin && !isPinned ? () => onPin(w.id) : undefined}
              onUnpin={onUnpin && isPinned ? () => onUnpin(w.type) : undefined}
              isPinned={isPinned}
              dragHandleProps={{
                draggable: true,
                onDragStart: (e) => {
                  e.dataTransfer.setData('application/x-pinned-type', w.type);
                  return handleDragStart(w.id)(e);
                },
                onDragEnd: () => {
                  setDraggingId(null);
                  setOverId(null);
                  window.__draggingGridWidgetType = null;
                },
              }}
            />
            {isPinned && <PinnedBadge />}
          </div>
        );
      })}
    </div>
  );
}
