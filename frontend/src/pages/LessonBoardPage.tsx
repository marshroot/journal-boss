import { useState } from "react";
import { apiJson } from "../lib/api";
import { PenTool, Radio, Square } from "lucide-react";
import LessonBoardCanvas, { type BoardState } from "../components/LessonBoardCanvas";

export default function LessonBoardPage() {
  const q = new URLSearchParams(location.search);
  const lessonId = Number(q.get("lessonId"));
  const [board, setBoard] = useState<BoardState | null>(null);
  const [students, setStudents] = useState<{ id: number; fullName: string; login: string }[]>([]);
  const [showPerm, setShowPerm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const validLesson = Number.isInteger(lessonId) && lessonId > 0;

  const onBoard = (b: BoardState | null) => {
    setBoard(b);
    if (b?.isTeacher && students.length === 0) {
      void apiJson<{ id: number; fullName: string; login: string }[]>(`/api/lessons/${lessonId}/board/students`)
        .then(setStudents)
        .catch(() => {});
    }
  };

  const changeMode = async (mode: "view" | "all" | "selected", editorIds?: number[]) => {
    try {
      const ids = mode === "selected" ? (editorIds ?? []).join(",") : "";
      const r = await apiJson<{ ok: boolean; mode: string; editorIds: string }>(`/api/lessons/${lessonId}/board/mode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, editorIds: ids })
      });
      setBoard(b => b ? { ...b, mode: r.mode as BoardState["mode"], editorIds: ids ? ids.split(",").map(Number) : [] } : b);
      setRefreshKey(k => k + 1);
      setShowPerm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить права.");
    }
  };

  const toggleBroadcast = async () => {
    if (!lessonId) return;
    setBusy(true); setError("");
    try {
      await apiJson(`/api/lessons/${lessonId}/board/broadcast/${board?.isBroadcast ? "stop" : "start"}`, { method: "POST" });
      setRefreshKey(k => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось изменить трансляцию доски.");
    } finally { setBusy(false); }
  };

  if (!validLesson) return <div className="page-shell board-page">{error && <div className="notice notice-error">{error || "Некорректный ID пары."}</div>}</div>;

  return (
    <div className="page-shell board-page" style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
      <div className="board-header" style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", flexWrap: "wrap" }}>
        <span className="flex items-center gap-2"><PenTool size={15} /> Доска пары #{lessonId}</span>
        {board && (
          <span style={{ fontSize: 13, opacity: 0.7 }}>
            {board.mode === "view" ? "Только просмотр" : board.mode === "all" ? "Рисуют все" : "Рисуют выбранные"}
          </span>
        )}
        {board?.isBroadcast && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 border border-violet-400/40 px-2.5 py-0.5 text-xs text-violet-200">
            <Radio size={12} /> Транслируется всем · обновление каждые 3 с
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {board?.isTeacher && (
            <button onClick={() => void toggleBroadcast()} disabled={busy}
              className={`rounded-lg px-3 py-1 text-xs text-white disabled:opacity-50 ${board.isBroadcast ? "bg-red-500/80" : "bg-violet-500/80"}`}>
              {board.isBroadcast ? <span className="inline-flex items-center gap-1"><Square size={12} /> Остановить показ</span> : <span className="inline-flex items-center gap-1"><Radio size={12} /> Показать доску всем</span>}
            </button>
          )}
          {board?.isTeacher && (
            <button onClick={() => setShowPerm(s => !s)} className="rounded-lg bg-white/10 px-3 py-1 text-xs text-white">Права</button>
          )}
        </span>
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      {showPerm && board?.isTeacher && (
        <PermPanel
          mode={board.mode}
          editorIds={board.editorIds ?? []}
          students={students}
          onClose={() => setShowPerm(false)}
          onChange={changeMode}
        />
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <LessonBoardCanvas lessonId={lessonId} refreshKey={refreshKey} onBoard={onBoard} pollMs={3000} height="100%" />
      </div>
    </div>
  );
}

function PermPanel({
  mode, editorIds, students, onClose, onChange
}: {
  mode: "view" | "all" | "selected";
  editorIds: number[];
  students: { id: number; fullName: string; login: string }[];
  onClose: () => void;
  onChange: (mode: "view" | "all" | "selected", editorIds?: number[]) => void;
}) {
  const [sel, setSel] = useState<number[]>([...editorIds]);
  return (
    <div className="absolute right-4 top-16 z-30 w-80 rounded-2xl border border-white/10 bg-black/90 backdrop-blur p-4 text-white text-sm">
      <div className="flex items-center justify-between mb-3">
        <strong>Права на доску</strong>
        <button onClick={onClose} className="text-white/50 text-xs">✕</button>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="mode" checked={mode === "view"} onChange={() => onChange("view")} />
          <span>Только просмотр</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="mode" checked={mode === "all"} onChange={() => onChange("all")} />
          <span>Рисуют все студенты</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="mode" checked={mode === "selected"} onChange={() => onChange("selected", sel)} />
          <span>Рисуют выбранные</span>
        </label>
        {mode === "selected" && (
          <div className="max-h-60 overflow-y-auto rounded-lg bg-white/5 p-2 space-y-1">
            {students.length === 0 && <div className="text-white/40 text-xs">Студентов в группе нет.</div>}
            {students.map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sel.includes(s.id)}
                  onChange={e => {
                    const next = e.target.checked ? [...sel, s.id] : sel.filter(x => x !== s.id);
                    setSel(next);
                    onChange("selected", next);
                  }}
                />
                <span>{s.fullName || s.login}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
