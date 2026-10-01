import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { cryptoAvailable, orderLabel, verifyRace } from "../lib/fairness";
import { formatWhen } from "../lib/format";
import { usePageTitle } from "../lib/usePageTitle";

const SCRIPT = `// Node.js 18+ — save as verify.mjs and run: node verify.mjs
import { createHash, createHmac } from "node:crypto";

const names = [/* participant names in lane order */];
const serverSeed = "...";
const clientSeed = "...";

const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const namesHash = sha(names.join("\\n"));
console.log("seed hash ", sha(serverSeed));
console.log("names hash", namesHash);

const label = \`race-v3:order:\${namesHash}:\${clientSeed}\`;
let counter = 0, block = Buffer.alloc(0), offset = 0;
const next = () => {
  if (offset + 4 > block.length) {
    block = createHmac("sha256", serverSeed).update(\`\${label}:\${counter++}\`).digest();
    offset = 0;
  }
  const value = block.readUInt32BE(offset);
  offset += 4;
  return value;
};
const below = (n) => {
  const limit = Math.floor(2 ** 32 / n) * n;
  let value = next();
  while (value >= limit) value = next();
  return value % n;
};
const order = names.map((_, lane) => lane);
for (let i = order.length - 1; i > 0; i--) {
  const j = below(i + 1);
  [order[i], order[j]] = [order[j], order[i]];
}
order.forEach((lane, index) => console.log(index + 1, names[lane]));`;

function Value({ label, value, hint }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <div className="border-b border-gray-100 py-3 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">{label}</p>
        {value && (
          <button type="button" className="text-xs font-semibold text-sky-600" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <p className={`mt-1 break-all font-mono text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>{value || hint}</p>
    </div>
  );
}

function Verdict({ race, checks, error }) {
  if (!race.fairness) {
    return (
      <div className="rounded-2xl bg-gray-100 p-5">
        <p className="text-lg font-bold">Not verifiable</p>
        <p className="mt-1 text-sm text-gray-600">This race was created before public fairness proofs were added, so it has no published commitment.</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl bg-amber-50 p-5 text-amber-900">
        <p className="text-lg font-bold">Could not run the check</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }
  if (!checks) return <div className="rounded-2xl bg-sky-50 p-5 text-sky-800">Checking…</div>;
  if (checks.namesHash === false || checks.seedHash === false || checks.order === false) {
    return (
      <div className="rounded-2xl bg-red-50 p-5 text-red-800">
        <p className="text-lg font-bold">✗ Mismatch</p>
        <ul className="mt-2 space-y-1 text-sm">
          {checks.namesHash === false && <li>The participant list does not match the published names hash.</li>}
          {checks.seedHash === false && <li>The revealed server seed does not match the published seed hash.</li>}
          {checks.order === false && <li>The official finishing order does not match the order computed from the seeds.</li>}
        </ul>
      </div>
    );
  }
  if (race.status !== "finished") {
    return (
      <div className="rounded-2xl bg-sky-50 p-5 text-sky-900">
        <p className="text-lg font-bold">{race.status === "ready" ? "Commitment published" : "Race in progress"}</p>
        <p className="mt-1 text-sm">
          The participant list matches its hash. The server seed is locked behind its hash and will be revealed when the race finishes. This page then checks the
          result automatically.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-900">
      <p className="text-lg font-bold">✓ Verified</p>
      <p className="mt-1 text-sm">
        The revealed server seed matches the hash published before the race, the participant list matches its hash, and recomputing the shuffle gives exactly the
        official finishing order.
      </p>
    </div>
  );
}

function Lookup() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className="mt-6 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const id = value.trim();
        if (id) navigate(`/verify/${encodeURIComponent(id)}`);
      }}
    >
      <input className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Result ID" />
      <button type="submit" className="rounded-xl bg-sky-500 px-4 py-2 font-semibold text-white">
        Verify
      </button>
    </form>
  );
}

export default function Verify() {
  const { id } = useParams();
  const [race, setRace] = useState(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState(null);
  const [checkError, setCheckError] = useState("");
  usePageTitle("Verify a Result - Duck Race");

  useEffect(() => {
    if (!id) return undefined;
    let stop = false;
    let timer = 0;
    setRace(null);
    setError("");
    async function pull() {
      try {
        const data = await api(`/api/verify/${encodeURIComponent(id)}`);
        if (stop) return;
        setRace(data.race);
        if (data.race.status !== "finished") timer = window.setTimeout(pull, 4000);
      } catch (err) {
        if (!stop) setError(err.status === 404 ? "That result ID was not found." : err.message);
      }
    }
    pull();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [id]);

  useEffect(() => {
    if (!race || !race.fairness) return;
    if (!cryptoAvailable()) {
      setCheckError("This browser cannot run the check here. Open the page over HTTPS, or use the script below.");
      return;
    }
    let stop = false;
    setChecks(null);
    verifyRace(race)
      .then((result) => !stop && setChecks(result))
      .catch(() => !stop && setCheckError("The check could not be completed in this browser."));
    return () => {
      stop = true;
    };
  }, [race?.id, race?.status, race?.fairness?.serverSeed]);

  const fair = race?.fairness;
  const placeOf = new Map((race?.places || []).map((row) => [row.lane, row.place]));
  const official = race ? [...(race.places || [])].sort((a, b) => a.place - b.place) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600">Provably fair</p>
      <h1 className="text-3xl font-bold">Verify a race result</h1>
      <p className="mt-2 text-gray-600">
        Every official race publishes a fingerprint of its secret seed and of its participant list before it starts. After the finish the seed is revealed, and anyone
        can recompute the result.
      </p>

      {!id && <Lookup />}
      {id && error && (
        <div className="mt-8 rounded-2xl bg-red-50 p-5 text-red-800">
          <p>{error}</p>
          <Lookup />
        </div>
      )}
      {id && !error && !race && <p className="mt-8 text-gray-500">Loading the result…</p>}

      {race && (
        <>
          <div className="mt-8 rounded-2xl border border-gray-100 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{race.name}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Result ID {race.id} · {race.names.length} participants · algorithm {race.algorithm}
                </p>
                <p className="text-sm text-gray-500">
                  Created {formatWhen(race.createdAt)}
                  {race.startedAt ? ` · started ${formatWhen(race.startedAt)}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${race.status === "finished" ? "bg-emerald-100 text-emerald-800" : race.status === "racing" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>
                {race.status === "finished" ? "Finished" : race.status === "racing" ? "Racing" : "Not started"}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <Verdict race={race} checks={checks} error={checkError} />
          </div>

          {fair && (
            <div className="mt-4 rounded-2xl border border-gray-100 px-5 py-2">
              <Value label="Server seed hash · SHA-256, published at creation" value={fair.seedHash} />
              <Value label="Participant list hash · SHA-256 of names joined by new lines" value={fair.namesHash} />
              <Value label="Client seed · added by the organizer at start" value={fair.clientSeed} hint="Added when the race starts" />
              <Value label="Server seed · revealed after the finish" value={fair.serverSeed} hint="Revealed when the race finishes" />
              {fair.clientSeed && <Value label="Shuffle label" value={orderLabel(fair)} />}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold">Participants in lane order</h3>
              <ol className="mt-3 max-h-80 space-y-1 overflow-auto text-sm">
                {race.names.map((name, lane) => (
                  <li key={lane} className="flex justify-between gap-3">
                    <span>
                      <span className="text-gray-400">{lane + 1}.</span> {name}
                    </span>
                    {placeOf.has(lane) && <span className="text-gray-500">place {placeOf.get(lane)}</span>}
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold">Official finishing order</h3>
              {official.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Shown once the race starts.</p>
              ) : (
                <ol className="mt-3 max-h-80 space-y-1 overflow-auto text-sm">
                  {official.map((row, index) => {
                    const match = checks?.computed?.length ? checks.computed[index] === row.lane : null;
                    return (
                      <li key={row.lane} className={`flex justify-between gap-3 rounded px-1 ${row.place <= 3 ? "font-semibold" : ""}`}>
                        <span>
                          {row.place}. {race.names[row.lane]}
                        </span>
                        {match != null && <span className={match ? "text-emerald-600" : "text-red-600"}>{match ? "✓" : "✗"}</span>}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold">How the proof works</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>When a race is created, the server draws a secret 256-bit seed and publishes only its SHA-256 hash, together with the hash of the participant list.</li>
          <li>When the organizer starts the race, their browser adds a random client seed. The server cannot predict it, and the organizer cannot know the secret seed.</li>
          <li>
            The finishing order is a Fisher–Yates shuffle of the lanes, driven by HMAC-SHA256 with the server seed as the key and the message
            <code className="mx-1 rounded bg-gray-100 px-1">race-v3:order:&lt;names hash&gt;:&lt;client seed&gt;:&lt;counter&gt;</code>. Each 32-byte block gives eight
            32-bit numbers, and values that would bias the draw are skipped.
          </li>
          <li>After the finish, the server reveals the seed. If its hash matches the one published earlier, the seed was fixed before the race, and replaying the shuffle must give the official order.</li>
        </ol>
        <p className="mt-3 text-sm text-gray-700">
          The racing animation only shows this order. It never decides it. To check without this website, copy the values above into this script:
        </p>
        <pre className="mt-3 overflow-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">{SCRIPT}</pre>
        <p className="mt-6 text-sm">
          <Link to="/history" className="font-semibold text-sky-600">
            Back to race history
          </Link>
        </p>
      </section>
    </div>
  );
}
