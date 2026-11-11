export type ExerciseLayout = { y: number; height: number };

/** Compare the leading edge against sibling centers, including variable-height cards. */
export function dragTarget(
  ids: string[],
  layouts: Map<string, ExerciseLayout>,
  from: number,
  dy: number,
) {
  const origin = layouts.get(ids[from]);
  if (!origin) return from;
  let target = from;
  for (let index = from + 1; index < ids.length && dy > 0; index++) {
    const layout = layouts.get(ids[index]);
    if (layout && origin.y + origin.height + dy > layout.y + layout.height / 2) target = index;
  }
  for (let index = from - 1; index >= 0 && dy < 0; index--) {
    const layout = layouts.get(ids[index]);
    if (layout && origin.y + dy < layout.y + layout.height / 2) target = index;
  }
  return target;
}

export function moveExercise(ids: string[], from: number, to: number) {
  const next = [...ids];
  const [id] = next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
