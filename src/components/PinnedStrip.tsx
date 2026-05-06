import { type DragEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Widget } from './Widgets';
import type { WidgetItem, WidgetType } from '../types';

function DropIndicator() {
  return (
    <div
      style={{
        width: 4,
        alignSelf: 'stretch',
        background: 'var(--accent)',
        borderRadius: 2,
        flexShrink: 0,
        boxShadow: '0 0 0 4px color-mix(in oklab, var(--accent) 18%, transparent)',
      }}
    />
  );
}

interface PinnedStripProps {
  widgets: WidgetItem[];
  onReorder: (next: WidgetItem[]) => void;
  onOpen: (w: WidgetItem) => void;
  onRemove: (id: string) => void;
  onAcceptFromGrid: (id: string, beforeIdx: number) => void;
  onAcceptInline?: (type: WidgetType, beforeIdx: number) => void;
  onAdd: () => void;
}

type AcceptState = false | true | 'blocked';

export function PinnedStrip({
  widgets,
  onReorder,
  onOpen,
  onRemove,
  onAcceptFromGrid,
  onAcceptInline,
  onAdd,
}: PinnedStripProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [acceptingExternal, setAcceptingExternal] = useState<AcceptState>(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobileStrip, setIsMobileStrip] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 720,
  );
  useEffect(() => {
    const onResize = () => setIsMobileStrip(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const pinnedTypes = useMemo(() => widgets.map((w) => w.type), [widgets]);

  const computeIdxFromX = (e: DragEvent, container: Element) => {
    const items = Array.from(container.querySelectorAll('[data-pinned-item]'));
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (e.clientX < r.left + r.width / 2) return i;
    }
    return items.length;
  };

  const containerOnDragOver = (e: DragEvent<HTMLDivElement>) => {
    const types = e.dataTransfer.types;
    const fromGrid = types.includes('application/x-widget-id');
    const fromPin = types.includes('application/x-pinned-id');
    const fromInline = types.includes('application/x-inline-type');
    if (!fromGrid && !fromPin && !fromInline) return;
    let blocked = false;
    if (fromGrid) {
      const t = window.__draggingGridWidgetType;
      if (t && pinnedTypes.includes(t)) blocked = true;
    }
    if (fromInline) {
      const t = window.__draggingInlineWidgetType;
      if (t && pinnedTypes.includes(t)) blocked = true;
    }
    e.preventDefault();
    if (blocked) {
      e.dataTransfer.dropEffect = 'none';
      setDropIdx(null);
      setAcceptingExternal('blocked');
      return;
    }
    e.dataTransfer.dropEffect = fromInline ? 'copy' : 'move';
    setDropIdx(computeIdxFromX(e, e.currentTarget));
    if (fromGrid || fromInline) setAcceptingExternal(true);
  };

  const containerOnDrop = (e: DragEvent<HTMLDivElement>) => {
    const gridId = e.dataTransfer.getData('application/x-widget-id');
    const pinId = e.dataTransfer.getData('application/x-pinned-id');
    const inlineType = e.dataTransfer.getData('application/x-inline-type') as WidgetType | '';
    if (gridId) {
      e.preventDefault();
      const gridType = e.dataTransfer.getData('application/x-pinned-type') as WidgetType | '';
      if (gridType && pinnedTypes.includes(gridType)) {
        setDraggingId(null);
        setDropIdx(null);
        setAcceptingExternal(false);
        return;
      }
      onAcceptFromGrid(gridId, dropIdx == null ? widgets.length : dropIdx);
    } else if (pinId) {
      e.preventDefault();
      const fromIdx = widgets.findIndex((w) => w.id === pinId);
      let toIdx = dropIdx == null ? widgets.length : dropIdx;
      if (fromIdx !== -1 && toIdx !== fromIdx && toIdx !== fromIdx + 1) {
        const next = [...widgets];
        const [moved] = next.splice(fromIdx, 1);
        if (toIdx > fromIdx) toIdx -= 1;
        next.splice(toIdx, 0, moved);
        onReorder(next);
      }
    } else if (inlineType) {
      e.preventDefault();
      if (!pinnedTypes.includes(inlineType) && onAcceptInline) {
        onAcceptInline(inlineType, dropIdx == null ? widgets.length : dropIdx);
      }
    }
    setDraggingId(null);
    setDropIdx(null);
    setAcceptingExternal(false);
  };

  const containerOnDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDropIdx(null);
      setAcceptingExternal(false);
    }
  };

  return (
    <div
      style={{
        borderBottom: '1px solid var(--line)',
        background:
          acceptingExternal === 'blocked'
            ? 'color-mix(in oklab, #e63946 5%, var(--bg-sunken))'
            : acceptingExternal
            ? 'color-mix(in oklab, var(--accent) 6%, var(--bg-sunken))'
            : 'var(--bg-sunken)',
        transition: 'background 0.15s, padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: collapsed
          ? isMobileStrip
            ? '6px 14px'
            : '8px 24px'
          : isMobileStrip
          ? '10px 14px'
          : '12px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 10,
          color:
            acceptingExternal === 'blocked'
              ? '#e63946'
              : acceptingExternal
              ? 'var(--accent)'
              : 'var(--ink-4)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 600,
          marginBottom: 0,
        }}
      >
        <Icon name="pin" size={10} />
        <span>
          {acceptingExternal === 'blocked'
            ? 'すでにピン留め済み'
            : acceptingExternal
            ? 'ここにドロップしてピン留め'
            : 'ピン留め'}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? '展開' : '折りたたむ'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-3)',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Icon name="chevron-down" size={18} stroke={2} />
        </button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: collapsed ? '0fr' : '1fr',
          transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div
          style={{
            overflow: 'hidden',
            minHeight: 0,
            paddingTop: collapsed ? 0 : 8,
            transition: 'padding-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div
            onDragOver={containerOnDragOver}
            onDrop={containerOnDrop}
            onDragLeave={containerOnDragLeave}
            style={{
              display: 'flex',
              gap: 10,
              overflowX: 'auto',
              paddingBottom: 2,
              alignItems: 'stretch',
              minHeight: 132,
            }}
          >
            {widgets.map((w, i) => {
              const isDragging = draggingId === w.id;
              const showInsertBefore =
                dropIdx === i && (acceptingExternal || (draggingId && draggingId !== w.id));
              return (
                <Fragment key={w.id}>
                  {showInsertBefore && <DropIndicator />}
                  <div
                    data-pinned-item
                    style={{
                      flexShrink: 0,
                      position: 'relative',
                      opacity: isDragging ? 0.4 : 1,
                      transition: 'opacity 0.12s',
                      borderRadius: 18,
                    }}
                  >
                    <Widget
                      widget={w}
                      accent="var(--accent)"
                      onOpen={() => onOpen(w)}
                      onRemove={() => onRemove(w.id)}
                      onUnpin={() => onRemove(w.id)}
                      isPinned
                      dragHandleProps={{
                        draggable: true,
                        onDragStart: (e) => {
                          setDraggingId(w.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('application/x-pinned-id', w.id);
                        },
                        onDragEnd: () => {
                          setDraggingId(null);
                          setDropIdx(null);
                          setAcceptingExternal(false);
                        },
                      }}
                    />
                  </div>
                </Fragment>
              );
            })}
            {dropIdx === widgets.length && (acceptingExternal || draggingId) && <DropIndicator />}
            <button
              className="btn-icon"
              style={{
                width: 132,
                height: 132,
                border: '1px dashed var(--line-strong)',
                borderRadius: 18,
                color: 'var(--ink-4)',
                flexShrink: 0,
              }}
              title="ピン留めを追加"
              onClick={onAdd}
            >
              <Icon name="plus" size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
