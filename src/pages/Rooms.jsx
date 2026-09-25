import { useState } from "react";
import { Link } from "react-router-dom";
import { loadJson, saveJson } from "../lib/storage";
import { usePageTitle } from "../lib/usePageTitle";

const KEY = "duck-race-rooms";

export default function Rooms() {
  usePageTitle("My Rooms - Duck Race");
  const [rooms, setRooms] = useState(() => loadJson(KEY, []));
  const [title, setTitle] = useState("");
  const [names, setNames] = useState("Alex\nSam\nJordan\nRiley");

  function persist(next) {
    setRooms(next);
    saveJson(KEY, next);
  }

  function createRoom(event) {
    event.preventDefault();
    const list = names
      .split("\n")
      .map((name) => name.trim())
      .filter(Boolean);
    if (!title.trim() || list.length < 2) return;
    persist([
      {
        id: crypto.randomUUID(),
        title: title.trim(),
        names: list,
        createdAt: Date.now(),
      },
      ...rooms,
    ]);
    setTitle("");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">My Rooms</h1>
      <p className="mb-8 text-gray-600">
        Save name lists on this device and open them in a race. The original site stores rooms on an account; this React copy keeps them in your browser.
      </p>

      <form onSubmit={createRoom} className="mb-10 rounded-2xl border border-gray-100 bg-gray-50 p-6">
        <label className="mb-2 block text-sm font-semibold">Room name</label>
        <input
          className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Friday classroom"
          required
        />
        <label className="mb-2 block text-sm font-semibold">Names, one per line</label>
        <textarea
          className="mb-4 h-40 w-full rounded-xl border border-gray-200 bg-white px-3 py-2"
          value={names}
          onChange={(event) => setNames(event.target.value)}
        />
        <button className="rounded-xl bg-sky-500 px-5 py-2 font-semibold text-white" type="submit">
          Save room
        </button>
      </form>

      {rooms.length === 0 ? (
        <p className="rounded-2xl bg-sky-50 px-6 py-10 text-center text-sky-700">Quack, quack, quack... no rooms yet.</p>
      ) : (
        <ul className="space-y-4">
          {rooms.map((room) => (
            <li key={room.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">{room.title}</h2>
                <p className="text-sm text-gray-500">{room.names.length} ducks · {room.names.slice(0, 4).join(", ")}</p>
              </div>
              <div className="flex gap-2">
                <Link to={`/?room=${room.id}#game`} className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
                  Race
                </Link>
                <button
                  type="button"
                  className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
                  onClick={() => persist(rooms.filter((item) => item.id !== room.id))}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
