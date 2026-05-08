import { type DragEvent, useState } from 'react';
import type { WidgetItem, WidgetType } from '../types';

export const PINNED_DND_MIME = 'application/x-pinned-id';
export const GRID_DND_MIME = 'application/x-widget-id';
export const INLINE_DND_MIME = 'application/x-inline-type';

export type AcceptState = false | true | 'blocked';

export function reorderPinned(
  items: WidgetItem[],
  fromId: string,
  dropIdx: number | null,
): WidgetItem[] | null {
  const fromIdx = items.findIndex((w) => w.id === fromId);
  let toIdx = dropIdx == null ? items.length : dropIdx;
  if (fromIdx === -1 || toIdx === fromIdx || toIdx === fromIdx + 1) return null;
  const next = [...items];
  const [moved] = next.splice(fromIdx, 1);
  if (toIdx > fromIdx) toIdx -= 1;
  next.splice(toIdx, 0, moved);
  return next;
}

interface Options {
  items: WidgetItem[];
  setItems: (next: WidgetItem[]) => void;
  computeIdx: (e: DragEvent, container: Element) => number;
  onAcceptFromGrid?: (id: string, beforeIdx: number) => void;
  onAcceptInline?: (type: WidgetType, beforeIdx: number) => void;
}

export function usePinnedReorder({
  items,
  setItems,
  computeIdx,
  onAcceptFromGrid,
  onAcceptInline,
}: Options) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);
  const [acceptingExternal, setAcceptingExternal] = useState<AcceptState>(false);

  const dragHandleProps = (id: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      setDraggingId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData(PINNED_DND_MIME, id);
    },
    onDragEnd: () => {
      setDraggingId(null);
      setDropIdx(null);
    },
  });

  const containerProps = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      const types = e.dataTransfer.types;
      const fromGrid = !!onAcceptFromGrid && types.includes(GRID_DND_MIME);
      const fromPin = types.includes(PINNED_DND_MIME);
      const fromInline = !!onAcceptInline && types.includes(INLINE_DND_MIME);
      if (!fromGrid && !fromPin && !fromInline) return;
      const pinnedTypes = items.map((w) => w.type);
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
      setDropIdx(computeIdx(e, e.currentTarget));
      if (fromGrid || fromInline) setAcceptingExternal(true);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      const gridId = onAcceptFromGrid ? e.dataTransfer.getData(GRID_DND_MIME) : '';
      const pinId = e.dataTransfer.getData(PINNED_DND_MIME);
      const inlineType = (
        onAcceptInline ? e.dataTransfer.getData(INLINE_DND_MIME) : ''
      ) as WidgetType | '';
      const pinnedTypes = items.map((w) => w.type);
      if (gridId && onAcceptFromGrid) {
        e.preventDefault();
        const t = window.__draggingGridWidgetType;
        if (!(t && pinnedTypes.includes(t))) {
          onAcceptFromGrid(gridId, dropIdx == null ? items.length : dropIdx);
        }
      } else if (pinId) {
        e.preventDefault();
        const next = reorderPinned(items, pinId, dropIdx);
        if (next) setItems(next);
      } else if (inlineType && onAcceptInline) {
        e.preventDefault();
        if (!pinnedTypes.includes(inlineType)) {
          onAcceptInline(inlineType, dropIdx == null ? items.length : dropIdx);
        }
      }
      setDraggingId(null);
      setDropIdx(null);
      setAcceptingExternal(false);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setDropIdx(null);
        setAcceptingExternal(false);
      }
    },
  };

  return {
    draggingId,
    setDraggingId,
    dropIdx,
    setDropIdx,
    acceptingExternal,
    dragHandleProps,
    containerProps,
  };
}
