import { euclideanRhythm } from "@/lib/euclid";

export function EuclideanDots({ density }: { density: number }) {
  const hits = euclideanRhythm(density, 16);
  return (
    <div className="flex gap-1.5" aria-label="Euclidean rhythm preview, 16 steps">
      {hits.map((on, i) => (
        <div
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${on ? "bg-koji-accent shadow-[0_0_8px_rgba(110,231,183,0.45)]" : "bg-koji-line"}`}
        />
      ))}
    </div>
  );
}
