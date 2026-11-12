import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ScrollView } from 'react-native';
import { dragTarget, moveExercise, type ExerciseLayout } from './exercise-reorder';

type Drag = {
  ids: string[];
  layouts: Map<string, ExerciseLayout>;
  from: number;
  to: number;
  dy: number;
  startScroll: number;
};
export function useExerciseDrag(
  exercises: { rowId: string }[],
  scrollRef: RefObject<ScrollView | null>,
  onReorder: (ids: string[]) => void,
) {
  const layouts = useRef(new Map<string, ExerciseLayout>());
  const viewport = useRef({ top: 0, height: 0, contentHeight: 0, offset: 0 });
  const [drag, setDrag] = useState<Drag>();
  const [previousExercises, setPreviousExercises] = useState(exercises);
  if (previousExercises !== exercises) {
    setPreviousExercises(exercises);
    setDrag(undefined);
  }
  const active = useRef<Drag | undefined>(undefined);
  const finger = useRef({ dy: 0, pageY: 0 });
  function update() {
    const current = active.current;
    if (!current) return;
    const dy = finger.current.dy + viewport.current.offset - current.startScroll;
    const origin = current.layouts.get(current.ids[current.from])!;
    const first = current.layouts.get(current.ids[0])!;
    const last = current.layouts.get(current.ids.at(-1)!)!;
    const bounded = Math.max(
      first.y - origin.y,
      Math.min(last.y + last.height - origin.y - origin.height, dy),
    );
    const next = {
      ...current,
      dy: bounded,
      to: dragTarget(current.ids, current.layouts, current.from, bounded),
    };
    active.current = next;
    setDrag(next);
  }
  function cancel() {
    active.current = undefined;
    setDrag(undefined);
  }
  // Stop safely if a remote update replaces the draft during a gesture.
  useEffect(() => {
    active.current = undefined;
  }, [exercises]);
  useEffect(() => {
    if (!drag) return;
    const interval = setInterval(() => {
      const view = viewport.current;
      const y = finger.current.pageY - view.top;
      const speed = y < 64 ? -10 : y > view.height - 64 ? 10 : 0;
      const next = Math.max(0, Math.min(view.contentHeight - view.height, view.offset + speed));
      if (!speed || next === view.offset) return;
      view.offset = next;
      scrollRef.current?.scrollTo({ y: next, animated: false });
      update();
    }, 32);
    return () => clearInterval(interval);
    // The interval reads gesture and viewport refs, not each rendered drag position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, scrollRef]);
  function offset(rowId: string) {
    if (!drag) return 0;
    const index = drag.ids.indexOf(rowId);
    const height = drag.layouts.get(drag.ids[drag.from])!.height + 6;
    if (index === drag.from) return drag.dy;
    if (index > drag.from && index <= drag.to) return -height;
    if (index < drag.from && index >= drag.to) return height;
    return 0;
  }
  return {
    getScroll() {
      return viewport.current.offset;
    },
    setLayout(rowId: string, layout: ExerciseLayout) {
      layouts.current.set(rowId, layout);
      // A held card can start moving while the collapse layout is still arriving.
      if (active.current) {
        active.current.layouts.set(rowId, layout);
        update();
      }
    },
    setScroll(offset: number) {
      viewport.current.offset = offset;
    },
    setContentHeight(height: number) {
      viewport.current.contentHeight = height;
    },
    setViewport(top: number, height: number) {
      viewport.current.top = top;
      viewport.current.height = height;
    },
    activeId: drag?.ids[drag.from],
    offset,
    cancel,
    start(rowId: string, pageY: number) {
      const ids = exercises.map((row) => row.rowId);
      const from = ids.indexOf(rowId);
      if (from < 0 || ids.some((id) => !layouts.current.has(id))) return;
      finger.current = { dy: 0, pageY };
      const next = {
        ids,
        layouts: new Map(layouts.current),
        from,
        to: from,
        dy: 0,
        startScroll: viewport.current.offset,
      };
      active.current = next;
      setDrag(next);
    },
    move(dy: number, pageY: number) {
      finger.current = { dy, pageY };
      update();
    },
    end() {
      const current = active.current;
      cancel();
      if (current && current.from !== current.to)
        onReorder(moveExercise(current.ids, current.from, current.to));
    },
  };
}
