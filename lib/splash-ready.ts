const waiters: Array<() => void> = [];
let finished = false;

export function markSplashFinished() {
  if (finished) return;
  finished = true;
  const pending = waiters.splice(0);
  pending.forEach((resolve) => resolve());
}

export function whenSplashFinished() {
  if (finished) return Promise.resolve();
  return new Promise<void>((resolve) => {
    waiters.push(resolve);
    setTimeout(() => {
      markSplashFinished();
    }, 2500);
  });
}

export function splashHasFinished() {
  return finished;
}

let settled: Promise<void> | null = null;

export function whenHomeSettled() {
  if (!settled) {
    settled = whenSplashFinished().then(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 700);
        })
    );
  }
  return settled;
}
