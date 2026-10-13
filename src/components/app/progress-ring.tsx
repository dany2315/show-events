export function GoalBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`relative h-2.5 overflow-hidden rounded-full bg-muted ${className ?? ""}`}>
      <div
        className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-[#b8862f] via-gold to-[#f3d48b] transition-[width] duration-1000 rtl:bg-gradient-to-l"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
