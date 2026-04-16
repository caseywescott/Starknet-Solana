/** Euclidean rhythm: `pulses` onsets in `steps` (bucket / Bresenham). */
export function euclideanRhythm(pulses: number, steps: number): boolean[] {
  const pattern = new Array<boolean>(steps).fill(false);
  if (steps <= 0) return pattern;
  const p = Math.max(0, Math.min(pulses, steps));
  let bucket = 0;
  for (let i = 0; i < steps; i++) {
    bucket += p;
    if (bucket >= steps) {
      pattern[i] = true;
      bucket -= steps;
    }
  }
  return pattern;
}
