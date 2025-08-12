export default function BrandHeader({ subtitle, right }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Yard-Sales</h1>
        {subtitle && <p className="text-xs uppercase tracking-wider text-neutral-500 mt-1">{subtitle}</p>}
        <p className="text-[10px] mt-1 text-neutral-600">Internal Bidding Tool · CAP PLC</p>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
