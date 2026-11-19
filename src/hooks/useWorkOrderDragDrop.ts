import React, { useState, useRef, useEffect } from 'react';

export interface DragJobMeta {
  id: string;
  ot: string;
  client: string;
}

interface DragState {
  jobId: string;
  jobLabel: string;
  scopeId: string;
  scopedJobIds: string[];
  sourceIndex: number;
}

interface OverState {
  jobId: string;
  scopeId: string;
  targetIndex: number;
}

interface UseWorkOrderDragDropOptions {
  enabled: boolean;
  onMove: (
    sourceJobId: string,
    targetJobId: string,
    scopedJobIds: string[],
    targetPositionNumber: number
  ) => void;
}

/**
 * Provides unified HTML5 Desktop Drag-and-Drop and Mobile Touch Drag-and-Drop
 * for reordering work orders directly to any target position within a list or column.
 */
export function useWorkOrderDragDrop({ enabled, onMove }: UseWorkOrderDragDropOptions) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [overState, setOverState] = useState<OverState | null>(null);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);

  const dragStateRef = useRef<DragState | null>(null);
  const overStateRef = useRef<OverState | null>(null);
  const justDraggedAtRef = useRef<number>(0);

  const updateDragState = (next: DragState | null) => {
    dragStateRef.current = next;
    setDragState(next);
  };

  const updateOverState = (next: OverState | null) => {
    overStateRef.current = next;
    setOverState(next);
  };

  const clearDrag = (markJustDragged: boolean) => {
    if (markJustDragged) {
      justDraggedAtRef.current = Date.now();
    }
    updateDragState(null);
    updateOverState(null);
    setTouchPos(null);
  };

  // Prevent background page scroll on mobile while a touch drag is actively in progress
  useEffect(() => {
    if (!touchPos) return;
    const preventScroll = (ev: TouchEvent) => {
      if (dragStateRef.current) {
        ev.preventDefault();
      }
    };
    window.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [touchPos]);

  const shouldSuppressClick = () => {
    return Date.now() - justDraggedAtRef.current < 200;
  };

  const getDragItemProps = (
    job: DragJobMeta,
    scopeId: string,
    scopedJobIds: string[],
    index: number
  ) => {
    const canDragItem = enabled && scopedJobIds.length > 1;

    return {
      'data-drag-job-id': job.id,
      'data-drag-scope': scopeId,
      'data-drag-index': index,
      draggable: canDragItem,
      onDragStart: (e: React.DragEvent) => {
        if (!canDragItem) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        try {
          e.dataTransfer.setData('text/plain', job.id);
        } catch {
          // Ignore browser restrictions
        }
        updateDragState({
          jobId: job.id,
          jobLabel: `${job.ot} · ${job.client}`,
          scopeId,
          scopedJobIds,
          sourceIndex: index,
        });
        updateOverState(null);
      },
      onDragEnter: (e: React.DragEvent) => {
        const active = dragStateRef.current;
        if (!enabled || !active || active.scopeId !== scopeId) return;
        e.preventDefault();
        if (active.jobId === job.id) {
          if (overStateRef.current !== null) updateOverState(null);
          return;
        }
        if (
          !overStateRef.current ||
          overStateRef.current.jobId !== job.id ||
          overStateRef.current.scopeId !== scopeId
        ) {
          updateOverState({ jobId: job.id, scopeId, targetIndex: index });
        }
      },
      onDragOver: (e: React.DragEvent) => {
        const active = dragStateRef.current;
        if (!enabled || !active || active.scopeId !== scopeId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (active.jobId === job.id) return;
        if (
          !overStateRef.current ||
          overStateRef.current.jobId !== job.id ||
          overStateRef.current.scopeId !== scopeId
        ) {
          updateOverState({ jobId: job.id, scopeId, targetIndex: index });
        }
      },
      onDrop: (e: React.DragEvent) => {
        const active = dragStateRef.current;
        if (!enabled || !active || active.scopeId !== scopeId) {
          clearDrag(false);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (active.jobId !== job.id) {
          onMove(active.jobId, job.id, active.scopedJobIds, index + 1);
        }
        clearDrag(true);
      },
      onDragEnd: () => {
        clearDrag(true);
      },
    };
  };

  const getTouchHandleProps = (
    job: DragJobMeta,
    scopeId: string,
    scopedJobIds: string[],
    index: number
  ) => {
    const canDragItem = enabled && scopedJobIds.length > 1;

    return {
      onTouchStart: (e: React.TouchEvent) => {
        if (!canDragItem || e.touches.length === 0) return;
        e.stopPropagation();
        const touch = e.touches[0];
        updateDragState({
          jobId: job.id,
          jobLabel: `${job.ot} · ${job.client}`,
          scopeId,
          scopedJobIds,
          sourceIndex: index,
        });
        updateOverState(null);
        setTouchPos({ x: touch.clientX, y: touch.clientY });
      },
      onTouchMove: (e: React.TouchEvent) => {
        const active = dragStateRef.current;
        if (!active || e.touches.length === 0) return;
        e.stopPropagation();
        const touch = e.touches[0];
        setTouchPos({ x: touch.clientX, y: touch.clientY });

        const elem = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetEl = elem?.closest('[data-drag-job-id]') as HTMLElement | null;
        if (targetEl) {
          const targetJobId = targetEl.getAttribute('data-drag-job-id');
          const targetScope = targetEl.getAttribute('data-drag-scope');
          const targetIdxRaw = targetEl.getAttribute('data-drag-index');
          if (
            targetJobId &&
            targetScope === active.scopeId &&
            targetJobId !== active.jobId
          ) {
            const targetIndex = targetIdxRaw ? Number(targetIdxRaw) : 0;
            if (
              !overStateRef.current ||
              overStateRef.current.jobId !== targetJobId
            ) {
              updateOverState({
                jobId: targetJobId,
                scopeId: targetScope,
                targetIndex,
              });
            }
            return;
          }
        }
        if (overStateRef.current !== null) {
          updateOverState(null);
        }
      },
      onTouchEnd: (e: React.TouchEvent) => {
        const active = dragStateRef.current;
        const over = overStateRef.current;
        if (!active) return;
        e.stopPropagation();
        if (over && over.scopeId === active.scopeId && over.jobId !== active.jobId) {
          onMove(active.jobId, over.jobId, active.scopedJobIds, over.targetIndex + 1);
        }
        clearDrag(true);
      },
      onTouchCancel: () => {
        clearDrag(true);
      },
    };
  };

  const getDropIndicator = (jobId: string, scopeId: string): 'before' | 'after' | null => {
    if (
      !dragState ||
      !overState ||
      dragState.scopeId !== scopeId ||
      overState.scopeId !== scopeId ||
      overState.jobId !== jobId ||
      dragState.jobId === jobId
    ) {
      return null;
    }
    return dragState.sourceIndex > overState.targetIndex ? 'before' : 'after';
  };

  return {
    draggedJobId: dragState?.jobId ?? null,
    dragScopeId: dragState?.scopeId ?? null,
    dragOverJobId: overState?.jobId ?? null,
    touchPreview:
      dragState && touchPos
        ? { label: dragState.jobLabel, x: touchPos.x, y: touchPos.y }
        : null,
    shouldSuppressClick,
    getDragItemProps,
    getTouchHandleProps,
    getDropIndicator,
  };
}
