import { useEffect, useRef, useState } from 'react';
import { apiJson } from '../lib/api';

type Student = { id: number; fullName: string; status: string };
type Grade = { studentId: number; value: number; comment: string | null };
type Homework = { id: number; title: string; description: string; deadline: string | null };
type Lesson = {
  id: number; startAt: string; endAt: string; lessonNumber: number; room: string | null; topic: string | null;
  startedAt: string | null; completedAt: string | null; groupName: string; subjectName: string;
  students: Student[]; grades: Grade[]; homeworks: Homework[];
  materials: { id: number; title: string; isPublished: boolean }[];
  attachments: { id: number; fileName: string; sizeBytes: number }[];
  online: { id: number; roomName: string; status: string; startedAt: string } | null;
  board: { isBroadcast: boolean; broadcastStartedAt: string | null } | null;
};

const ATTENDANCE: [string, string][] = [['Present', 'Присутствует'], ['Late', 'Опоздал'], ['Absent', 'Отсутствует'], ['Excused', 'Уважительная']];
const fmtTime = (v: string) => new Date(v).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const card = 'rounded-2xl border border-white/10 p-5';
const btn = 'rounded-xl border border-white/15 px-4 py-2 hover:bg-white/5 disabled:opacity-50';

export default function TeacherCurrentLessonPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState('');
  const [gradeDraft, setGradeDraft] = useState<Record<number, { value: string; comment: string }>>({});
  const [hw, setHw] = useState({ title: '', description: '', deadline: '' });
  // Draft inputs are initialised once per lesson so the 30 s auto-refresh never overwrites what the teacher is typing.
  const initForLesson = useRef<number | null>(null);

  async function load() {
    try {
      const x = await apiJson<Lesson | null>('/api/teacher/current-lesson');
      setLesson(x);
      if (x && initForLesson.current !== x.id) {
        initForLesson.current = x.id;
        setTopic(x.topic ?? '');
        const draft: Record<number, { value: string; comment: string }> = {};
        x.grades.forEach(g => { draft[g.studentId] = { value: String(g.value), comment: g.comment ?? '' }; });
        setGradeDraft(draft);
      }
      setError('');
    } catch (e) {
      setLesson(null);
      setError(e instanceof Error ? e.message : 'Не удалось загрузить текущую пару.');
    } finally { setLoaded(true); }
  }
  useEffect(() => { void load(); const t = setInterval(() => void load(), 30000); return () => clearInterval(t); }, []);

  async function run(action: () => Promise<unknown>, okMessage?: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); if (okMessage) setNotice(okMessage); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка выполнения действия.'); }
    finally { setBusy(false); }
  }
  const post = (url: string) => apiJson(url, { method: 'POST' });

  const saveTopic = () => lesson && run(() => apiJson(`/api/lessons/${lesson.id}/topic`, { method: 'PUT', body: JSON.stringify({ topic }) }), 'Тема сохранена и доступна студентам.');
  const saveAttendance = (items: { studentId: number; status: string }[]) => lesson && run(() => apiJson(`/api/lessons/${lesson.id}/attendance`, { method: 'PUT', body: JSON.stringify({ items }) }));
  const markAllPresent = () => lesson && saveAttendance(lesson.students.map(s => ({ studentId: s.id, status: 'Present' })));

  function saveGrades() {
    if (!lesson) return;
    const items: { studentId: number; value: number; comment: string | null }[] = [];
    for (const [id, d] of Object.entries(gradeDraft)) {
      if (d.value.trim() === '') continue;
      const value = Number(d.value.replace(',', '.'));
      if (Number.isNaN(value) || value < 0 || value > 10) { setError('Оценка должна быть числом от 0 до 10.'); return; }
      items.push({ studentId: Number(id), value, comment: d.comment.trim() || null });
    }
    if (items.length === 0) { setError('Введите хотя бы одну оценку.'); return; }
    void run(() => apiJson(`/api/assessment/lesson/${lesson.id}/grades`, { method: 'PUT', body: JSON.stringify({ items }) }), 'Оценки сохранены.');
  }

  function createHomework() {
    if (!lesson) return;
    if (!hw.title.trim() || !hw.description.trim()) { setError('Укажите название и условие ДЗ.'); return; }
    void run(async () => {
      await apiJson(`/api/assessment/lesson/${lesson.id}/homework`, { method: 'POST', body: JSON.stringify({ title: hw.title, description: hw.description, deadline: hw.deadline ? new Date(hw.deadline).toISOString() : null }) });
      setHw({ title: '', description: '', deadline: '' });
    }, 'ДЗ создано и доступно студентам группы.');
  }

  const startLesson = () => lesson && run(() => post(`/api/lessons/${lesson.id}/start`), 'Пара начата.');
  const completeLesson = () => { if (lesson && confirm('Завершить пару? Активная онлайн-трансляция тоже будет закрыта.')) void run(() => post(`/api/lessons/${lesson.id}/complete`), 'Пара завершена.'); };
  const startOnline = () => lesson && run(async () => { await post(`/api/lessons/${lesson.id}/online/start`); if (!lesson.startedAt) await post(`/api/lessons/${lesson.id}/start`); }, 'Онлайн-пара запущена.');
  const endOnline = () => lesson && run(() => post(`/api/lessons/${lesson.id}/online/end`), 'Онлайн-пара завершена.');
  const startBoard = () => lesson && run(async () => { await post(`/api/lessons/${lesson.id}/board/broadcast/start`); window.open(`/lesson-board?lessonId=${lesson.id}`, '_blank'); }, 'Доска включена и выводится на экраны участников пары.');
  const stopBoard = () => lesson && run(() => post(`/api/lessons/${lesson.id}/board/broadcast/stop`), 'Показ доски остановлен.');

  const status = !lesson ? '' : lesson.completedAt ? 'Завершена' : lesson.startedAt ? 'Идёт' : 'Ожидает начала';
  const finished = !!lesson?.completedAt;

  return <div className="p-6 md:p-8 text-white space-y-6">
    <div><p className="text-xs uppercase tracking-[.25em] text-violet-200/60">Рабочее место преподавателя</p><h1 className="text-3xl font-semibold mt-2">Текущая пара</h1></div>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}
    {notice && <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-violet-300">{notice}</div>}
    {!loaded && <div className={`${card} text-white/50`}>Загрузка…</div>}
    {loaded && !lesson && !error && <div className={`${card} text-white/60`}>Сейчас у вас нет пары по расписанию. Расписание на неделю: <a className="underline" href="/teacher/lessons">мои пары</a>.</div>}
    {lesson && <>
      <section className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-5 flex flex-wrap justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold">{lesson.subjectName}</div>
          <div className="text-white/60 mt-1">{lesson.groupName} · пара {lesson.lessonNumber}{lesson.room ? ` · ${lesson.room}` : ''} · {fmtTime(lesson.startAt)} — {fmtTime(lesson.endAt)}</div>
          <div className="mt-2 text-sm"><span className="rounded-full bg-white/10 px-3 py-1">{status}</span>{lesson.online && <span className="ml-2 rounded-full bg-violet-500/20 text-violet-300 px-3 py-1">Онлайн идёт</span>}{lesson.board?.isBroadcast && <span className="ml-2 rounded-full bg-violet-500/20 text-violet-300 px-3 py-1">Доска транслируется</span>}</div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {!lesson.startedAt && !finished && <button disabled={busy} onClick={() => void startLesson()} className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4 py-2 disabled:opacity-50">Начать пару</button>}
          {lesson.startedAt && !finished && <button disabled={busy} onClick={completeLesson} className="rounded-xl border border-red-400/40 text-red-300 px-4 py-2 disabled:opacity-50">Завершить пару</button>}
        </div>
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        <div className={card}>
          <h2 className="font-semibold text-lg">Тема пары</h2>
          <textarea className="input w-full mt-3 min-h-24" maxLength={500} value={topic} onChange={e => setTopic(e.target.value)} placeholder="Например: «Производная функции»" />
          <button disabled={busy} onClick={() => void saveTopic()} className="mt-3 rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4 py-2 disabled:opacity-50">Сохранить тему</button>
        </div>
        <div className={card}>
          <h2 className="font-semibold text-lg">Онлайн-трансляция</h2>
          <p className="text-sm text-white/50 mt-2">Комната создаётся в LiveKit, студенты группы подключаются со своей страницы «Онлайн-пара».</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {!lesson.online
              ? <button disabled={busy || finished} onClick={() => void startOnline()} className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4 py-2 disabled:opacity-50">Начать онлайн-пару</button>
              : <><a href={`/online-lesson?lessonId=${lesson.id}`} className="rounded-xl bg-violet-400 text-black px-4 py-2">Открыть трансляцию</a><button disabled={busy} onClick={() => void endOnline()} className={btn}>Завершить трансляцию</button></>}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <a href={`/lesson-chat?lessonId=${lesson.id}`} className={`${btn} text-center`}>Чат</a>
            <a href={`/lesson-board?lessonId=${lesson.id}`} className={`${btn} text-center`}>Доска</a>
            <a href={`/code-lab?lessonId=${lesson.id}`} className={`${btn} text-center`}>Code Lab</a>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold text-lg">Доска пары — показ на экраны участников</h2>
        <p className="text-sm text-white/50 mt-2">
          «Показать доску» включает трансляцию: у студентов группы на странице «Текущая пара» доска
          откроется автоматически и будет обновляться каждые 3 секунды. Права рисования настраиваются
          на самой доске кнопкой «Права» (по умолчанию при трансляции — только просмотр).
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {!lesson.board?.isBroadcast
            ? <button disabled={busy || finished} onClick={() => void startBoard()} className="rounded-xl bg-violet-400 text-black px-4 py-2 font-medium disabled:opacity-50">Включить доску и показать всем</button>
            : <>
              <a href={`/lesson-board?lessonId=${lesson.id}`} className="rounded-xl bg-violet-400 text-black px-4 py-2 font-medium">Открыть доску</a>
              <button disabled={busy} onClick={() => void stopBoard()} className={btn}>Остановить показ</button>
            </>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-5 flex flex-wrap items-center justify-between gap-3"><div className="font-semibold">Студенты · {lesson.students.length}</div>
          <button disabled={busy || lesson.students.length === 0} onClick={() => void markAllPresent()} className={btn}>Отметить всех присутствующими</button></div>
        {lesson.students.length === 0 && <div className="p-5 border-t border-white/10 text-white/50">В группе нет студентов.</div>}
        {lesson.students.map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-white/10">
          <div className="min-w-48">{s.fullName}</div>
          <div className="flex flex-wrap gap-2">{ATTENDANCE.map(([v, l]) => <button key={v} disabled={busy} onClick={() => void saveAttendance([{ studentId: s.id, status: v }])} className={`rounded-lg px-3 py-1.5 text-xs border ${s.status === v ? 'bg-[color:var(--os-fg)] text-[color:var(--os-bg)] border-white' : 'border-white/15 hover:bg-white/5'}`}>{l}</button>)}</div>
          <div className="flex items-center gap-2">
            <input aria-label={`Оценка ${s.fullName}`} className="input w-20" inputMode="decimal" placeholder="0–10" value={gradeDraft[s.id]?.value ?? ''} onChange={e => setGradeDraft(d => ({ ...d, [s.id]: { value: e.target.value, comment: d[s.id]?.comment ?? '' } }))} />
            <input aria-label={`Комментарий ${s.fullName}`} className="input w-48" placeholder="Комментарий" maxLength={500} value={gradeDraft[s.id]?.comment ?? ''} onChange={e => setGradeDraft(d => ({ ...d, [s.id]: { value: d[s.id]?.value ?? '', comment: e.target.value } }))} />
          </div>
        </div>)}
        {lesson.students.length > 0 && <div className="p-4 border-t border-white/10"><button disabled={busy} onClick={saveGrades} className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4 py-2 disabled:opacity-50">Сохранить оценки</button></div>}
      </section>

      <section className="grid xl:grid-cols-2 gap-5">
        <div className={card}>
          <h2 className="font-semibold text-lg">Домашнее задание</h2>
          {lesson.homeworks.length === 0 ? <p className="text-white/50 mt-2 text-sm">ДЗ к этой паре ещё нет.</p>
            : <ul className="mt-2 space-y-1 text-sm">{lesson.homeworks.map(h => <li key={h.id} className="flex justify-between gap-3"><span>{h.title}</span><span className="text-white/40">{h.deadline ? `до ${new Date(h.deadline).toLocaleDateString('ru-RU')}` : 'без срока'}</span></li>)}</ul>}
          <a href={`/teacher/lessons?lessonId=${lesson.id}`} className="inline-block mt-2 text-sm underline text-violet-200">Проверка работ →</a>
          <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
            <input className="input w-full" placeholder="Название ДЗ" maxLength={200} value={hw.title} onChange={e => setHw({ ...hw, title: e.target.value })} />
            <textarea className="input w-full min-h-20" placeholder="Условие" value={hw.description} onChange={e => setHw({ ...hw, description: e.target.value })} />
            <input type="datetime-local" className="input w-full" value={hw.deadline} onChange={e => setHw({ ...hw, deadline: e.target.value })} />
            <button disabled={busy} onClick={createHomework} className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4 py-2 disabled:opacity-50">Создать ДЗ</button>
          </div>
        </div>
        <div className="space-y-5">
          <div className={card}>
            <div className="flex justify-between items-center"><h2 className="font-semibold text-lg">Материалы</h2><a href={`/materials?lessonId=${lesson.id}`} className="text-sm underline text-violet-200">Открыть редактор →</a></div>
            {lesson.materials.length === 0 ? <p className="text-white/50 mt-2 text-sm">Материалов нет.</p>
              : <ul className="mt-2 space-y-1 text-sm">{lesson.materials.map(m => <li key={m.id} className="flex justify-between gap-3"><span>{m.title}</span><span className={m.isPublished ? 'text-violet-300' : 'text-amber-300'}>{m.isPublished ? 'опубликован' : 'черновик'}</span></li>)}</ul>}
          </div>
          <div className={card}>
            <h2 className="font-semibold text-lg">Вложения</h2>
            {lesson.attachments.length === 0 ? <p className="text-white/50 mt-2 text-sm">Файлов нет.</p>
              : <ul className="mt-2 space-y-1 text-sm">{lesson.attachments.map(a => <li key={a.id} className="flex justify-between gap-3"><span>{a.fileName}</span><span className="text-white/40">{Math.max(1, Math.round(a.sizeBytes / 1024))} КБ</span></li>)}</ul>}
          </div>
        </div>
      </section>
    </>}
  </div>;
}
