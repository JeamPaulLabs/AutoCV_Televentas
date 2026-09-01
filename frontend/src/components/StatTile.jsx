export default function StatTile({ label, value, sub, destacado }) {
  return (
    <div
      className={`glass rounded-xl px-3 py-2 ${
        destacado ? "border-t-2 border-t-xuma-green-dark" : ""
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-white leading-tight">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-white/50">{sub}</div>}
    </div>
  );
}
