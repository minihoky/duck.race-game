import { useState } from "react";
import { formatClock } from "../lib/format";

export default function Scoreboard({ title, elapsed, sponsors = [], headline }) {
  const [failed, setFailed] = useState({});
  const frame = sponsors.length ? Math.floor(Math.max(0, elapsed) / 4000) % sponsors.length : 0;
  const visible = sponsors.length
    ? [0, 1, 2, 3].map((offset) => sponsors[(frame + offset) % sponsors.length]).filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
    : [];

  return (
    <div className="rounded-2xl bg-[#101820] p-3 shadow-[inset_0_0_0_1px_rgba(214,178,94,0.85)]">
      <div className="mb-3 flex items-end justify-between gap-3 text-[#7dffa1]">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.28em] text-[#d6b25e]">STADIUM BOARD</p>
          <p className="led truncate text-lg font-bold text-[#d8ffe4] sm:text-2xl">{headline || title}</p>
        </div>
        <p className="led shrink-0 text-3xl font-bold sm:text-5xl">{formatClock(elapsed)}</p>
      </div>
      {visible.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {visible.map((sponsor) => (
            <div key={sponsor.id} className="flex h-16 items-center justify-center overflow-hidden rounded-lg bg-[#07140c] ring-1 ring-[#1f6b3a] sm:h-20">
              {failed[sponsor.id] ? (
                <span className="px-2 text-center text-xs font-semibold tracking-wide text-[#7dffa1]">{sponsor.name}</span>
              ) : (
                <img
                  src={`/api/sponsors/${sponsor.id}/image`}
                  alt={sponsor.name}
                  className="max-h-14 max-w-full object-contain sm:max-h-16"
                  onError={() => setFailed((current) => ({ ...current, [sponsor.id]: true }))}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-16 items-center justify-center rounded-lg bg-[#07140c] ring-1 ring-[#1f6b3a] sm:h-20">
          <p className="led text-sm tracking-[0.35em] text-[#7dffa1]">OFFICIAL RACE</p>
        </div>
      )}
    </div>
  );
}
