let generation = 0;
let paused = false;

const activeWork = new Set<Promise<unknown>>();

export type AccountWorkToken = number;

export function captureAccountWork(): AccountWorkToken {
  return generation;
}

export function isAccountWorkCurrent(
  token: AccountWorkToken,
): boolean {
  return !paused && token === generation;
}

export async function runAccountWork<T>(
  token: AccountWorkToken,
  action: () => Promise<T>,
): Promise<T | undefined> {
  if (!isAccountWorkCurrent(token)) return undefined;

  // Register the promise before starting the action.
  const task = Promise.resolve().then(async () => {
    if (!isAccountWorkCurrent(token)) return undefined;
    return action();
  });

  activeWork.add(task);

  try {
    return await task;
  } finally {
    activeWork.delete(task);
  }
}

export async function pauseAccountWorkForDeletion(): Promise<void> {
  if (!paused) {
    paused = true;
    generation += 1;
  }

  // No new work can start while paused. Wait for existing work so
  // deletion clears local data only after those operations settle.
  await Promise.allSettled([...activeWork]);
}

export function resumeAccountWorkAfterDeletion(): void {
  paused = false;
}