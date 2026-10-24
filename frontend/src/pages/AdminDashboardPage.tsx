import { useEffect, useState } from 'react';
import { Activity, BookOpen, Calendar, ClipboardList, Database, FileText, GraduationCap, ShieldCheck, Users } from 'lucide-react';
import { apiJson } from '../lib/api';
import { getCurrentUser } from '../lib/auth';

type Overview = {
  generatedAt: string;
  users: { total: number; admins: number; teachers: number; students: number; parents: number };
  academic: { groups: number; subjects: number; scheduleEntries: number; materials: number; homeworks: number };
  currentLessons: Array<{ id: number; startAt: string; endAt: string; topic: string | null; group: string; subject: string; teacher: string }>;
};

const cards = [
  ['users.total', 'Пользователи', Users],
  ['users.teachers', 'Преподаватели', GraduationCap],
  ['users.students', 'Студенты', Users],
  ['users.parents', 'Родители', Users],
  ['academic.groups', 'Группы', Users],
  ['academic.subjects', 'Предметы', BookOpen],
  ['academic.scheduleEntries', 'Пары в расписании', Calendar],
  ['academic.homeworks', 'Домашние задания', FileText],
] as const;

function valueOf(data: Overview, path: string) {
  switch (path) {
    case 'users.total': return data.users.total;
    case 'users.teachers': return data.users.teachers;
    case 'users.students': return data.users.students;
    case 'users.parents': return data.users.parents;
    case 'academic.groups': return data.academic.groups;
    case 'academic.subjects': return data.academic.subjects;
    case 'academic.scheduleEntries': return data.academic.scheduleEntries;
    case 'academic.homeworks': return data.academic.homeworks;
    default: return 0;
  }
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const me = await getCurrentUser();
        if (me?.role !== 'Admin') { setError('Раздел доступен только администратору.'); return; }
        setData(await apiJson<Overview>('/api/admin/overview'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить сводку.');
      }
    })();
  }, []);

  if (error) return <div className="p-8 text-white"><div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div></div>;
  if (!data) return <div className="p-8 text-white/50">Загрузка административной панели…</div>;

  return (
    <div className="p-6 md:p-8 text-white space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[.25em] text-white/40">Администрирование</p>
        <h1 className="text-3xl font-semibold mt-2">Панель администратора</h1>
        <p className="text-white/50 mt-2">Единая точка входа для пользователей, учебной структуры, расписания, аудита и резервных копий.</p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map(([key, label, Icon]) => (
          <div key={key} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
            <Icon size={18} className="text-violet-300" />
            <div className="text-2xl font-semibold mt-4">{valueOf(data, key)}</div>
            <div className="text-sm text-white/45 mt-1">{label}</div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <a href="/admin/users" className="rounded-2xl border border-white/10 bg-white/[.04] p-5 hover:bg-white/[.07] transition"><Users size={20}/><h2 className="font-semibold mt-4">Пользователи и роли</h2><p className="text-sm text-white/45 mt-2">Аккаунты, роли, группы и связи родитель → студент.</p></a>
        <a href="/admin/academic" className="rounded-2xl border border-white/10 bg-white/[.04] p-5 hover:bg-white/[.07] transition"><Calendar size={20}/><h2 className="font-semibold mt-4">Учебная структура</h2><p className="text-sm text-white/45 mt-2">Группы, предметы, преподаватели и расписание.</p></a>
        <a href="/admin/operations" className="rounded-2xl border border-white/10 bg-white/[.04] p-5 hover:bg-white/[.07] transition"><Database size={20}/><h2 className="font-semibold mt-4">Аудит и backup</h2><p className="text-sm text-white/45 mt-2">Audit Log, резервное копирование и восстановление.</p></a>
      </section>

      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center gap-2"><Activity size={18}/><h2 className="font-semibold">Текущие пары</h2></div>
        {data.currentLessons.length === 0 ? <div className="p-5 text-white/40">Сейчас активных пар нет.</div> : <div className="divide-y divide-white/10">{data.currentLessons.map(lesson => <div key={lesson.id} className="p-5 grid md:grid-cols-[1fr_auto] gap-3"><div><div className="font-medium">{lesson.subject} · {lesson.group}</div><div className="text-sm text-white/45 mt-1">{lesson.teacher}{lesson.topic ? ` · ${lesson.topic}` : ''}</div></div><div className="text-sm text-white/45">{new Date(lesson.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}–{new Date(lesson.endAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div></div>)}</div>}
      </section>

      <div className="flex flex-wrap gap-2 text-xs text-white/40"><span className="inline-flex items-center gap-1"><ShieldCheck size={14}/> JWT + role authorization</span><span className="inline-flex items-center gap-1"><ClipboardList size={14}/> Audit Log</span><span className="inline-flex items-center gap-1"><Database size={14}/> Backup</span></div>
      <p className="text-xs text-white/25">Сводка обновлена: {new Date(data.generatedAt).toLocaleString('ru-RU')}</p>
    </div>
  );
}
