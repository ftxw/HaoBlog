"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

interface DragSortItem {
  id: string;
}

type SortStrategy = "vertical" | "horizontal" | "rect";

export function useDragSort<T extends DragSortItem>({
  items,
  onReorder,
  onCommit,
  strategy = "vertical",
}: {
  items: T[];
  onReorder: (nextIds: string[]) => void;
  onCommit: (ids: string[]) => void | Promise<void>;
  strategy?: SortStrategy;
}) {
  const ids = useMemo(() => items.map((x) => x.id), [items]);
  const idsRef = useRef(ids);
  const initialIdsRef = useRef<string[]>(ids);

  useEffect(() => {
    idsRef.current = ids;
  }, [ids]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback(() => {
    initialIdsRef.current = idsRef.current;
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const cur = idsRef.current;
      const oldIndex = cur.indexOf(String(active.id));
      const newIndex = cur.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const next = arrayMove(cur, oldIndex, newIndex);
      idsRef.current = next;
      onReorder(next);
    },
    [onReorder]
  );

  const handleDragEnd = useCallback(() => {
    const next = idsRef.current;
    const initial = initialIdsRef.current;
    if (
      initial.length === next.length &&
      initial.every((id, i) => id === next[i])
    ) {
      return;
    }
    void onCommit(next);
  }, [onCommit]);

  const handleDragCancel = useCallback(() => {
    const initial = initialIdsRef.current;
    idsRef.current = initial;
    onReorder(initial);
  }, [onReorder]);

  const strategyImpl = useMemo(() => {
    if (strategy === "horizontal") return horizontalListSortingStrategy;
    if (strategy === "rect") return rectSortingStrategy;
    return verticalListSortingStrategy;
  }, [strategy]);

  return {
    ids,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    strategy: strategyImpl,
  };
}

export function reorderItemsByIds<T extends DragSortItem>(
  items: T[],
  ids: string[]
): T[] {
  const map = new Map(items.map((x) => [x.id, x]));
  const set = new Set(ids);
  return [
    ...ids.map((id) => map.get(id)).filter((x): x is T => Boolean(x)),
    ...items.filter((x) => !set.has(x.id)),
  ];
}
