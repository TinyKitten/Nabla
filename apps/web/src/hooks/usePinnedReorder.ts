import { type DragEvent, useState } from 'react';
import type { WidgetItem } from '../types';

export const PINNED_DND_MIME = 'application/x-pinned-id';

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
}

export function usePinnedReorder({ items, setItems, computeIdx }: Options) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

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
      if (!e.dataTransfer.types.includes(PINNED_DND_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropIdx(computeIdx(e, e.currentTarget));
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      const fromId = e.dataTransfer.getData(PINNED_DND_MIME);
      if (!fromId) return;
      e.preventDefault();
      const next = reorderPinned(items, fromId, dropIdx);
      if (next) setItems(next);
      setDraggingId(null);
      setDropIdx(null);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setDropIdx(null);
      }
    },
  };

  return {
    draggingId,
    setDraggingId,
    dropIdx,
    setDropIdx,
    dragHandleProps,
    containerProps,
  };
}
