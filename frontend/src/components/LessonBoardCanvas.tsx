import { useEffect, useRef, useState } from 'react';
import { Tldraw, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { apiJson } from '../lib/api';

export interface BoardState {
  content: string;
  mode: 'view' | 'all' | 'selected';
  canEdit: boolean;
  isTeacher: boolean;
  isBroadcast: boolean;
  broadcastStartedAt?: string | null;
  updatedAt?: string;
  editorIds?: number[];
}

interface LessonBoardCanvasProps {
  lessonId: number;
  /// How often read-only viewers pull the teacher's drawing during a projection (ms).
  pollMs?: number;
  height?: number | string;
  /// Bump to force an immediate refetch (e.g. after a permission/broadcast change).
  refreshKey?: number;
  onBoard?: (board: BoardState | null) => void;
}

/**
 * Shared lesson board (tldraw). Editors draw with debounced autosave; read-only viewers
 * refresh from the server on a short interval so the teacher's board is projected
 * to their screens almost live.
 */
export default function LessonBoardCanvas({ lessonId, pollMs = 3000, height = '100%', refreshKey = 0, onBoard }: LessonBoardCanvasProps) {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const editorRef = useRef<Editor | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const lastContentRef = useRef<string>('{}');

  useEffect(() => {
    let cancelled = false;
    const load = async (applyRemoteContent: boolean) => {
      try {
        const data = await apiJson<BoardState>(`/api/lessons/${lessonId}/board`);
        if (cancelled) return;
        setError('');
        setBoard(data);
        onBoard?.(data);
        const editor = editorRef.current;
        if (editor) {
          editor.updateInstanceState({ isReadonly: !data.canEdit });
          if (applyRemoteContent && !data.canEdit && data.content && data.content !== lastContentRef.current) {
            lastContentRef.current = data.content;
            try {
              const snapshot = JSON.parse(data.content || '{}');
              if (snapshot && snapshot.store) editor.loadSnapshot(snapshot);
            } catch { /* ignore malformed snapshot */ }
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Не удалось загрузить доску.');
      }
    };
    void load(false);
    const timer = window.setInterval(() => void load(true), pollMs);
    return () => { cancelled = true; window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, pollMs, refreshKey]);

  const scheduleSave = () => {
    if (!editorRef.current) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(), 1500);
  };

  const saveNow = async () => {
    if (!editorRef.current) return;
    try {
      const content = JSON.stringify(editorRef.current.store.serialize());
      lastContentRef.current = content;
      await apiJson(`/api/lessons/${lessonId}/board`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить доску.');
    }
  };

  useEffect(() => () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); }, []);

  return (
    <div className="lesson-board-canvas" style={{ position: 'relative', height }}>
      {error && <div className="notice notice-error" style={{ position: 'absolute', zIndex: 40, left: 8, top: 8 }}>{error}</div>}
      {board && !board.canEdit && board.isBroadcast && (
        <div style={{ position: 'absolute', zIndex: 40, right: 8, top: 8, pointerEvents: 'none' }} className="rounded-full bg-violet-500/30 border border-violet-400/40 px-3 py-1 text-xs text-violet-200">
          ● Преподаватель показывает доску
        </div>
      )}
      {board && (
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor;
            try {
              const snapshot = JSON.parse(board.content || '{}');
              if (snapshot && snapshot.store) editor.loadSnapshot(snapshot);
              lastContentRef.current = board.content;
            } catch { /* ignore */ }
            editor.updateInstanceState({ isReadonly: !board.canEdit });
            editor.store.listen(() => scheduleSave(), { scope: 'document', source: 'user' });
          }}
        />
      )}
      {board?.canEdit && savedAt && (
        <div style={{ position: 'absolute', zIndex: 40, left: 8, bottom: 8, pointerEvents: 'none' }} className="rounded-full bg-black/60 px-3 py-1 text-xs text-white/70">
          Сохранено {savedAt}
        </div>
      )}
    </div>
  );
}
