import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '../lib/api';
import { getCurrentUser, AuthUser } from '../lib/auth';

interface Attachment { id:number; fileName:string; contentType:string; sizeBytes:number; createdAt:string; uploader:string }
interface HomeworkRow {
  homeworkId: number;
  title: string;
  description: string;
  deadline?: string | null;
  subject: string;
  topic?: string | null;
  submission?: { id: number; answer: string; submittedAt: string; teacherScore?: number | null; teacherComment?: string | null } | null;
}

export default function LocalHomeworkPage() {
  const [rows, setRows] = useState<HomeworkRow[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [children, setChildren] = useState<{id:number; fullName:string; studyGroupName:string|null}[]>([]);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState<Record<number, Attachment[]>>({});

  const loadAttachments = async (data: HomeworkRow[]) => {
    const entries = await Promise.all(data.map(async hw => { try { return [hw.homeworkId, await apiJson<Attachment[]>(`/api/attachments/homework/${hw.homeworkId}`)] as const; } catch { return [hw.homeworkId, []] as const; } }));
    setAttachments(Object.fromEntries(entries));
  };

  const downloadAttachment = async (homeworkId:number, a:Attachment) => {
    try { const r = await apiFetch(`/api/attachments/homework/${homeworkId}/${a.id}/download`); if(!r.ok) throw new Error(`Ошибка скачивания: ${r.status}`); const blob=await r.blob(); const url=URL.createObjectURL(blob); const el=document.createElement('a'); el.href=url; el.download=a.fileName; el.click(); URL.revokeObjectURL(url); } catch(e:any) { setError(e?.message ?? 'Не удалось скачать файл.'); }
  };

  const load = async () => {
    try {
      setError('');
      const u = await getCurrentUser();
      if (!u) throw new Error('Сессия истекла.');
      setUser(u);
      if (u.role === 'Parent') {
        const childRows = await apiJson<{id:number; fullName:string; studyGroupName:string|null}[]>('/api/parent/children');
        setChildren(childRows);
        const childId = selectedChild && childRows.some(x => x.id === selectedChild)
          ? selectedChild
          : childRows[0]?.id ?? null;
        setSelectedChild(childId);
        if (childId == null) {
          setRows([]);
          return;
        }
        const data = await apiJson<HomeworkRow[]>(`/api/assessment/student?studentId=${childId}`);
        setRows(data);
        await loadAttachments(data);
        return;
      }
      const data = await apiJson<HomeworkRow[]>('/api/assessment/student');
      setRows(data);
      await loadAttachments(data);
      setAnswers(Object.fromEntries(data.map(x => [x.homeworkId, x.submission?.answer ?? ''])));
    } catch (e: any) { setError(e?.message ?? 'Не удалось загрузить ДЗ.'); }
  };
  useEffect(() => { void load(); }, []);

  const loadChild = async (childId: number) => {
    setSelectedChild(childId);
    setError('');
    try {
      const data = await apiJson<HomeworkRow[]>(`/api/assessment/student?studentId=${childId}`);
      setRows(data);
      await loadAttachments(data);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить домашние задания ребёнка.');
    }
  };

  const submit = async (id: number) => {
    if (!answers[id]?.trim()) return;
    setBusy(id); setError('');
    try {
      await apiJson(`/api/assessment/homework/${id}/submit`, { method: 'POST', body: JSON.stringify({ answer: answers[id] }) });
      await load();
    } catch (e: any) { setError(e?.message ?? 'Не удалось отправить работу.'); }
    finally { setBusy(null); }
  };

  return <div className="p-4 md:p-6 space-y-5">
    <div><h1 className="text-2xl font-semibold text-white">Домашние задания</h1><p className="text-sm text-slate-400 mt-1">{user?.role === 'Parent' ? 'Домашние задания детей — только просмотр' : 'Задания вашей учебной группы'}</p></div>
    {user?.role === 'Parent' && children.length > 0 && (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <label className="block text-sm text-slate-400 mb-2">Ребёнок</label>
        <select className="input max-w-md" value={selectedChild ?? ''} onChange={e => void loadChild(Number(e.target.value))}>
          {children.map(child => <option key={child.id} value={child.id}>{child.fullName}{child.studyGroupName ? ` · ${child.studyGroupName}` : ''}</option>)}
        </select>
      </div>
    )}
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
    {rows.length === 0 && !error && <div className="rounded-xl border border-white/10 p-8 text-center text-slate-400">Домашних заданий пока нет.</div>}
    <div className="grid gap-4">{rows.map(hw => <article key={hw.homeworkId} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">{hw.title}</h2><p className="text-sm text-violet-300">{hw.subject}</p></div><div className="text-sm text-slate-400">{hw.deadline ? `До ${new Date(hw.deadline).toLocaleString('ru-RU')}` : 'Без срока'}</div></div>
      {hw.topic && <p className="mt-2 text-xs text-slate-500">Тема пары: {hw.topic}</p>}
      <p className="mt-4 whitespace-pre-wrap text-slate-300">{hw.description}</p>{attachments[hw.homeworkId]?.length>0&&<div className="mt-4 rounded-lg border border-white/10 p-3 space-y-2"><div className="text-sm font-medium text-slate-300">Файлы задания</div>{attachments[hw.homeworkId].map(a=><button key={a.id} type="button" onClick={()=>void downloadAttachment(hw.homeworkId,a)} className="block w-full text-left rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"><div className="truncate text-sm text-violet-200">{a.fileName}</div><div className="text-xs text-slate-500">{Math.ceil(a.sizeBytes/1024)} KB · {a.uploader}</div></button>)}</div>}
      {user?.role === 'Student' && <div className="mt-4 space-y-3"><textarea value={answers[hw.homeworkId] ?? ''} onChange={e => setAnswers(a => ({...a, [hw.homeworkId]: e.target.value}))} className="min-h-36 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-violet-400/50" placeholder="Ваш ответ…" />
        <div className="flex flex-wrap gap-2">
          <button disabled={busy===hw.homeworkId} onClick={() => void submit(hw.homeworkId)} className="rounded-lg bg-violet-500/20 px-4 py-2 text-sm text-violet-200 hover:bg-violet-500/30 disabled:opacity-50">{busy===hw.homeworkId ? 'Отправляем…' : hw.submission ? 'Обновить работу' : 'Сдать работу'}</button>
        </div>
      </div>}
      {hw.submission && <div className="mt-4 rounded-lg border border-white/10 bg-black/10 p-3 text-sm"><div className="text-slate-400">Сдано: {new Date(hw.submission.submittedAt).toLocaleString('ru-RU')}</div><div className="mt-2 whitespace-pre-wrap text-slate-300">{hw.submission.answer}</div>{hw.submission.teacherScore != null && <div className="mt-2 font-medium text-violet-300">Оценка преподавателя: {hw.submission.teacherScore}/10</div>}{hw.submission.teacherComment && <div className="mt-1 text-slate-400">Комментарий: {hw.submission.teacherComment}</div>}</div>}
    </article>)}</div>
  </div>;
}
