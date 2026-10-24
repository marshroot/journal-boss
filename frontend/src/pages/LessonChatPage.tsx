import { useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { useSearchParams } from 'react-router-dom';
import { ImagePlus, Send, X } from 'lucide-react';
import { getAccessToken } from '../lib/auth';
import { API_BASE } from '../lib/apiBase';
import { apiUpload } from '../lib/api';
import ChatImage from '../components/ChatImage';

type Attachment = { id: number; fileName: string; contentType: string; sizeBytes: number };
type Msg = { id: number; userId: number; userName: string; message: string; attachment?: Attachment | null; createdAt: string };

export default function LessonChatPage() {
  const [params] = useSearchParams();
  const lessonId = Number(params.get('lessonId'));
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [pendingImage, setPendingImage] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const connection = useRef<HubConnection | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!Number.isInteger(lessonId) || lessonId <= 0 || !token) { setError('Не удалось определить пару или авторизацию.'); return; }
    const c = new HubConnectionBuilder().withUrl(`${API_BASE}/hubs/lesson-chat`, { accessTokenFactory: () => getAccessToken() ?? '' }).withAutomaticReconnect().configureLogging(LogLevel.Warning).build();
    connection.current = c;
    c.on('History', (items: Msg[]) => setMessages(items));
    c.on('Message', (m: Msg) => setMessages(xs => xs.some(x => x.id === m.id) ? xs : [...xs, m]));
    c.onreconnecting(() => setConnected(false));
    c.onreconnected(() => { setConnected(true); void c.invoke('JoinLesson', lessonId).catch(e => setError(e?.message ?? 'Нет доступа к чату.')); });
    void c.start().then(() => c.invoke('JoinLesson', lessonId)).then(() => setConnected(true)).catch(e => setError(e?.message ?? 'Не удалось подключиться к чату.'));
    return () => { void c.stop(); connection.current = null; };
  }, [lessonId, token]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const uploaded = await apiUpload<Attachment>('/api/chat/attachments/upload', file);
      setPendingImage(uploaded);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить изображение.'); }
    finally { setUploading(false); }
  }

  async function send() {
    if (!connection.current || sending) return;
    const m = text.trim();
    if (!m && !pendingImage) return;
    setSending(true);
    try {
      await connection.current.invoke('SendMessage', lessonId, m, pendingImage?.id ?? null);
      setText(''); setPendingImage(null);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Не удалось отправить сообщение.'); }
    finally { setSending(false); }
  }

  return (
    <div className="p-6 md:p-8 text-white max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-[.25em] text-white/40">Учебная пара</p>
          <h1 className="text-3xl font-semibold mt-2">Чат пары</h1>
        </div>
        <div className={connected ? 'text-violet-300' : 'text-amber-300'}>{connected ? '● Подключено' : '● Подключение…'}</div>
      </div>
      {error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200">{error}</div>}
      <div className="rounded-2xl border border-white/10 bg-white/[.04] overflow-hidden">
        <div className="h-[55vh] overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && <div className="text-white/35 text-center py-12">Сообщений пока нет.</div>}
          {messages.map(m => (
            <div key={m.id} className="rounded-xl border border-white/10 p-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{m.userName}</span>
                <span className="text-xs text-white/35">{new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {m.attachment && <div className="mt-2"><ChatImage id={m.attachment.id} alt={m.attachment.fileName} /></div>}
              {m.message && <div className="mt-1 text-white/75 whitespace-pre-wrap break-words">{m.message}</div>}
            </div>
          ))}
          <div ref={bottom} />
        </div>
        {pendingImage && (
          <div className="border-t border-white/10 px-3 py-2 flex items-center gap-2 text-sm text-violet-200">
            <ImagePlus size={15} />
            <span className="truncate flex-1">{pendingImage.fileName} ({Math.ceil(pendingImage.sizeBytes / 1024)} КБ)</span>
            <button type="button" onClick={() => setPendingImage(null)} className="rounded-lg border border-white/15 p-1 hover:bg-white/10" title="Убрать изображение"><X size={14} /></button>
          </div>
        )}
        <div className="border-t border-white/10 p-3 flex gap-2 items-end">
          <label className={`rounded-xl border border-white/15 p-2.5 cursor-pointer hover:bg-white/5 ${uploading ? 'opacity-50 pointer-events-none' : ''}`} title="Прикрепить изображение">
            {uploading ? '…' : <ImagePlus size={18} />}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading} onChange={e => { void pickImage(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </label>
          <textarea className="input flex-1 min-h-12" maxLength={2000} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Сообщение…" />
          <button disabled={!connected || sending || (!text.trim() && !pendingImage)} onClick={() => void send()} className="rounded-xl bg-violet-400 px-5 py-2 font-medium text-black disabled:opacity-40 flex items-center gap-2"><Send size={16} />Отправить</button>
        </div>
      </div>
      <p className="mt-3 text-xs text-white/35">PNG, JPEG, WebP или GIF до 10 МБ. Изображение увидят только участники чата этой пары.</p>
    </div>
  );
}
