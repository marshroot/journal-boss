import { FormEvent, useEffect, useState } from 'react';
import { apiJson } from '../lib/api';

type Named = { id: number; name: string; teacherId?: number | null; teacherName?: string | null };
type Teacher = { id: number; fullName: string; login: string | null };
type Row = { id: number; groupId: number; subjectId: number; teacherId: number; groupName: string; subjectName: string; teacherName: string; startAt: string; endAt: string; room: string | null; lessonNumber: number };

export default function AdminAcademicPage() {
  const [groups, setGroups] = useState<Named[]>([]), [subjects, setSubjects] = useState<Named[]>([]), [teachers, setTeachers] = useState<Teacher[]>([]), [schedule, setSchedule] = useState<Row[]>([]);
  const [groupName, setGroupName] = useState(''), [subjectName, setSubjectName] = useState(''), [error, setError] = useState('');
  const [form, setForm] = useState({ groupId:'', subjectId:'', teacherId:'', startAt:'', endAt:'', lessonNumber:'1', room:'' });
  const [editingId, setEditingId] = useState<number | null>(null);
  async function load(){ try { const [g,s,t,r]=await Promise.all([apiJson<Named[]>('/api/admin/academic/groups'),apiJson<Named[]>('/api/admin/academic/subjects'),apiJson<Teacher[]>('/api/admin/academic/teachers'),apiJson<Row[]>('/api/admin/academic/schedule')]); setGroups(g);setSubjects(s);setTeachers(t);setSchedule(r); } catch(e){setError(e instanceof Error?e.message:'Ошибка загрузки');} }
  useEffect(()=>{void load()},[]);
  async function addNamed(path:string,name:string,setter:(v:string)=>void){ try{await apiJson(path,{method:'POST',body:JSON.stringify({name})});setter('');await load()}catch(e){setError(e instanceof Error?e.message:'Ошибка')} }
  async function assignTeacher(subjectId:number, teacherId:string){ try { await apiJson(`/api/admin/academic/subjects/${subjectId}/teacher`,{method:'PUT',body:JSON.stringify({teacherId: teacherId ? Number(teacherId) : null})}); await load(); } catch(e){setError(e instanceof Error?e.message:'Ошибка')} }
  const toLocalInput = (iso: string) => { const d = new Date(iso); const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const emptyForm = { groupId: '', subjectId: '', teacherId: '', startAt: '', endAt: '', lessonNumber: '1', room: '' };
  function startEdit(x: Row) { setEditingId(x.id); setError(''); setForm({ groupId: String(x.groupId), subjectId: String(x.subjectId), teacherId: String(x.teacherId), startAt: toLocalInput(x.startAt), endAt: toLocalInput(x.endAt), lessonNumber: String(x.lessonNumber), room: x.room ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function cancelEdit() { setEditingId(null); setForm(emptyForm); setError(''); }
  async function addSchedule(e: FormEvent) {
    e.preventDefault(); setError('');
    try {
      const body = JSON.stringify({ ...form, groupId: Number(form.groupId), subjectId: Number(form.subjectId), teacherId: Number(form.teacherId), lessonNumber: Number(form.lessonNumber), startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString() });
      if (editingId) await apiJson(`/api/admin/academic/schedule/${editingId}`, { method: 'PUT', body });
      else await apiJson('/api/admin/academic/schedule', { method: 'POST', body });
      setEditingId(null); setForm({ ...emptyForm, groupId: form.groupId, subjectId: form.subjectId, teacherId: form.teacherId });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить пару.'); }
  }
  async function removeSchedule(x: Row) {
    if (!confirm(`Удалить пару «${x.subjectName}» (${x.groupName}) ${new Date(x.startAt).toLocaleString('ru-RU')}?`)) return;
    setError('');
    try { await apiJson(`/api/admin/academic/schedule/${x.id}`, { method: 'DELETE' }); await load(); }
    catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Подтвердите') && confirm(msg)) {
        try { await apiJson(`/api/admin/academic/schedule/${x.id}?force=true`, { method: 'DELETE' }); await load(); }
        catch (e2) { setError(e2 instanceof Error ? e2.message : 'Не удалось удалить пару.'); }
      } else setError(msg || 'Не удалось удалить пару.');
    }
  }
  const scheduleByDay = (() => {
    const map = new Map<string, Row[]>();
    for (const x of schedule) { const key = new Date(x.startAt).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); const list = map.get(key) ?? []; list.push(x); map.set(key, list); }
    return [...map.entries()];
  })();
  return <div className="p-6 md:p-8 text-white space-y-6"><div><p className="text-xs uppercase tracking-[.25em] text-white/40">Администрирование</p><h1 className="text-3xl font-semibold mt-2">Учебная структура</h1><p className="text-white/50 mt-2">Группы, предметы и расписание. Преподавателя назначает только администратор.</p></div>{error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}
  <div className="grid lg:grid-cols-2 gap-5"><section className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><h2 className="text-xl font-semibold">Группы</h2><div className="flex gap-2 mt-4"><input className="input flex-1" value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Например, ИС-31"/><button className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4" onClick={()=>addNamed('/api/admin/academic/groups',groupName,setGroupName)}>Добавить</button></div><div className="mt-4 space-y-2">{groups.map(x=><div key={x.id} className="flex justify-between border-b border-white/10 py-2">{x.name}<button className="text-red-300 text-sm" onClick={async()=>{await apiJson(`/api/admin/academic/groups/${x.id}`,{method:'DELETE'});load()}}>Удалить</button></div>)}</div></section>
  <section className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><h2 className="text-xl font-semibold">Предметы</h2><div className="flex gap-2 mt-4"><input className="input flex-1" value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="Например, Программирование"/><button className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4" onClick={()=>addNamed('/api/admin/academic/subjects',subjectName,setSubjectName)}>Добавить</button></div><div className="mt-4 space-y-2">{subjects.map(x=><div key={x.id} className="flex justify-between border-b border-white/10 py-2">{x.name}<button className="text-red-300 text-sm" onClick={async()=>{await apiJson(`/api/admin/academic/subjects/${x.id}`,{method:'DELETE'});load()}}>Удалить</button></div>)}</div></section></div>
  <section className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><h2 className="text-xl font-semibold">Предметы и закреплённые преподаватели</h2><p className="text-white/50 text-sm mt-1">У каждого предмета должен быть закреплён преподаватель. Именно он будет использоваться в расписании.</p><div className="mt-4 space-y-2">{subjects.map(x=><div key={x.id} className="grid md:grid-cols-[1fr_280px] gap-3 items-center border-b border-white/10 py-3"><div><b>{x.name}</b><div className="text-white/40 text-sm">{x.teacherName ? `Преподаватель: ${x.teacherName}` : 'Преподаватель не закреплён'}</div></div><select className="input" value={x.teacherId ?? ''} onChange={e=>assignTeacher(x.id,e.target.value)}><option value="">Не закреплён</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.fullName}</option>)}</select></div>)}</div></section>
  <section className="rounded-2xl border border-white/10 bg-white/[.04] p-5"><h2 className="text-xl font-semibold">{editingId ? 'Редактирование пары' : 'Расписание'}</h2><form onSubmit={addSchedule} className="grid md:grid-cols-4 gap-3 mt-4">
    <select className="input" required value={form.groupId} onChange={e=>setForm({...form,groupId:e.target.value})}><option value="">Группа</option>{groups.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
    <select className="input" required value={form.subjectId} onChange={e=>{const sid=e.target.value;const subj=subjects.find(s=>String(s.id)===sid);setForm({...form,subjectId:sid,teacherId:subj?.teacherId?String(subj.teacherId):form.teacherId})}}><option value="">Предмет</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}{x.teacherName?` — ${x.teacherName}`:' (нет преподавателя)'}</option>)}</select>
    <select className="input" required value={form.teacherId} onChange={e=>setForm({...form,teacherId:e.target.value})}><option value="">Преподаватель</option>{teachers.map(x=><option key={x.id} value={x.id}>{x.fullName}</option>)}</select>
    <input className="input" type="number" min="1" required value={form.lessonNumber} onChange={e=>setForm({...form,lessonNumber:e.target.value})} placeholder="№ пары"/>
    <input className="input" type="datetime-local" required value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/>
    <input className="input" type="datetime-local" required value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/>
    <input className="input" maxLength={30} value={form.room} onChange={e=>setForm({...form,room:e.target.value})} placeholder="Аудитория (необязательно)"/>
    <div className="flex gap-2"><button className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4 flex-1">{editingId ? 'Сохранить изменения' : 'Добавить в расписание'}</button>{editingId && <button type="button" onClick={cancelEdit} className="rounded-xl border border-white/15 px-4">Отмена</button>}</div>
  </form><p className="text-xs text-white/40 mt-3">Преподаватель берётся из предмета. Время вводится в вашем часовом поясе. Система не позволит поставить две пары группе или преподавателю на одно время.</p></section>
  <section className="rounded-2xl border border-white/10 overflow-hidden"><div className="p-5 font-semibold">Расписание · {schedule.length}</div>{scheduleByDay.map(([day,rows])=><div key={day}><div className="px-5 py-2 bg-white/[.04] border-t border-white/10 text-sm uppercase tracking-wider text-violet-200/70">{day}</div>{rows.map(x=><div key={x.id} className={`grid md:grid-cols-[1fr_1fr_1fr_170px_150px] gap-3 px-5 py-4 border-t border-white/10 ${editingId===x.id?'bg-violet-400/10':''}`}><div><b>{x.groupName}</b><div className="text-white/40 text-sm">Пара {x.lessonNumber}</div></div><div>{x.subjectName}</div><div>{x.teacherName}</div><div className="text-white/60 text-sm">{new Date(x.startAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} — {new Date(x.endAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}{x.room&&<div>{x.room}</div>}</div><div className="flex gap-2 text-sm"><button onClick={()=>startEdit(x)} className="rounded-lg border border-white/15 px-3 py-1.5 hover:bg-white/5">Изменить</button><button onClick={()=>void removeSchedule(x)} className="rounded-lg border border-red-400/30 text-red-300 px-3 py-1.5 hover:bg-red-500/10">Удалить</button></div></div>)}</div>)}{schedule.length===0&&<div className="p-5 text-white/40">Расписание пока пустое.</div>}</section>
  </div>
}
