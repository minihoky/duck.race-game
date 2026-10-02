const GRADIENT = "linear-gradient(180deg, #5eead4 0%, #22d3ee 30%, #0ea5e9 70%, #2563eb 100%)";
const LINE_GRADIENT = "linear-gradient(90deg, rgba(34,211,238,0) 0%, #22d3ee 35%, #0ea5e9 100%)";

// Sporty italic wordmark: first word in white, the rest in a cyan-to-blue gradient,
// with speed lines trailing from the first letter of the second word.
export default function Wordmark({ name, className = "" }) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  const head = words[0] || "";
  const tail = words.slice(1).join(" ");

  return (
    <span
      className={`relative inline-flex select-none items-baseline whitespace-nowrap font-extrabold leading-none tracking-tight ${className}`}
      style={{ transform: "skewX(-11deg)", transformOrigin: "left bottom", filter: "drop-shadow(0 2px 6px rgba(2, 8, 23, 0.7))" }}
      aria-label={name}
    >
      <span className="text-white" aria-hidden="true">
        {head}
      </span>
      {tail && (
        <span className="relative ml-[0.04em]" aria-hidden="true">
          <span
            className="inline-block pb-[0.08em]"
            style={{ backgroundImage: GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", WebkitTextFillColor: "transparent" }}
          >
            {tail}
          </span>
          <span className="pointer-events-none absolute left-[0.06em] top-full" aria-hidden="true">
            <span className="absolute right-0 block h-[0.075em] rounded-full" style={{ top: "0.02em", width: "1.2em", backgroundImage: LINE_GRADIENT }} />
            <span className="absolute right-0 block h-[0.075em] rounded-full" style={{ top: "0.16em", width: "0.85em", backgroundImage: LINE_GRADIENT }} />
            <span className="absolute right-0 block h-[0.075em] rounded-full" style={{ top: "0.30em", width: "0.5em", backgroundImage: LINE_GRADIENT }} />
          </span>
        </span>
      )}
    </span>
  );
}
