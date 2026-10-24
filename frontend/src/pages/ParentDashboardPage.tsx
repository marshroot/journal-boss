import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, Clock3, GraduationCap, TrendingUp } from 'lucide-react';
import { apiJson } from '../lib/api';

type Child = { id: number; fullName: string; studyGroupName: string | null };
type Grade = { id: number; value: number; comment: string | null; createdAt: string; startAt: string; subject: string; topic: string | null };
type Homework = { id: number; title: string; description: string; deadline: string | null; subject: string; topic: string | null; submission: { id: number; submittedAt: string; teacherScore: number | null; teacherComment: string | null } | null };
type Attendance = { id: number; status: string; updatedAt: string; startAt: string; topic: string | null; subject: string };
type Lesson = { id: number; startAt: string; endAt: string; lessonNumber: number; room: string | null; topic: string | null; subject: string; teacher: string; groupName: string };
type Material = { id: number; title: string; publishedAt: string | null; updatedAt: string; subject: string; startAt: string };

const attendanceLabels: Record<string, string> = {
  Present: 'Присутствовал',
  Absent: 'Отсутствовал',
  Late: 'Опоздал',
  Excused: 'Уважительная причина',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ParentDashboardPage() {
  const navigate = useNavigate();
  const [children, setChildren] = useState<Child[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [schedule, setSchedule] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadChild = async (id: number) => {
    setLoading(true);
    setError('');
    try {
      const [g, h, a, s, m] = await Promise.all([
        apiJson<Grade[]>(`/api/parent/${id}/grades`),
        apiJson<Homework[]>(`/api/parent/${id}/homework`),
        apiJson<Attendance[]>(`/api/parent/${id}/attendance`),
        apiJson<Lesson[]>(`/api/parent/${id}/schedule`),
        apiJson<Material[]>(`/api/parent/${id}/materials`),
      ]);
      setGrades(g);
      setHomework(h);
      setAttendance(a);
      setSchedule(s);
      setMaterials(m);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить данные ребёнка.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiJson<Child[]>('/api/parent/children');
        setChildren(data);
        if (data[0]) {
          setSelected(data[0].id);
          await loadChild(data[0].id);
        } else {
          setLoading(false);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Не удалось загрузить список детей.');
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const average = grades.length ? grades.reduce((sum, x) => sum + x.value, 0) / grades.length : null;
    const pendingHomework = homework.filter(x => !x.submission).length;
    const present = attendance.filter(x => x.status === 'Present').length;
    const late = attendance.filter(x => x.status === 'Late').length;
    return { average, pendingHomework, present, late };
  }, [grades, homework, attendance]);

  const upcoming = schedule.filter(x => new Date(x.endAt).getTime() >= Date.now()).slice(0, 4);
  const recentGrades = grades.slice(0, 5);
  const pendingHomework = homework.filter(x => !x.submission).slice(0, 4);
  const recentAttendance = attendance.slice(0, 5);
  const recentMaterials = materials.slice(0, 4);
  const child = children.find(x => x.id === selected);

  return (
    <div className="p-6 md:p-8 text-white space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.25em] text-violet-300/60">Родитель</p>
          <h1 className="text-3xl font-semibold mt-2">Кабинет родителя</h1>
          <p className="text-white/45 mt-2">Оценки, домашние задания, посещаемость и расписание ребёнка в одном месте.</p>
        </div>
        {children.length > 0 && (
          <label className="w-full lg:w-auto">
            <span className="sr-only">Выберите ребёнка</span>
            <select className="input w-full lg:min-w-80" value={selected ?? ''} onChange={e => { const id = Number(e.target.value); setSelected(id); void loadChild(id); }}>
              {children.map(c => <option key={c.id} value={c.id}>{c.fullName}{c.studyGroupName ? ` · ${c.studyGroupName}` : ''}</option>)}
            </select>
          </label>
        )}
      </header>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}

      {!loading && children.length === 0 && (
        <section className="rounded-2xl border border-dashed border-white/15 p-10 text-center">
          <GraduationCap className="mx-auto text-violet-300" size={36} />
          <h2 className="mt-4 text-xl font-semibold">Ребёнок ещё не привязан</h2>
          <p className="mt-2 text-white/45">Попросите администратора связать ваш профиль с профилем ученика.</p>
        </section>
      )}

      {children.length > 0 && (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard icon={<TrendingUp size={18} />} label="Средняя оценка" value={stats.average == null ? '—' : `${stats.average.toFixed(1)}/10`} />
            <StatCard icon={<Clock3 size={18} />} label="Невыполненных ДЗ" value={String(stats.pendingHomework)} tone={stats.pendingHomework > 0 ? 'warning' : 'normal'} />
            <StatCard icon={<CheckCircle2 size={18} />} label="Присутствовал" value={String(stats.present)} />
            <StatCard icon={<CalendarDays size={18} />} label="Опоздания" value={String(stats.late)} tone={stats.late > 0 ? 'warning' : 'normal'} />
          </section>

          <div className="grid xl:grid-cols-[1.15fr_.85fr] gap-5">
            <section className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
              <SectionHeader title="Ближайшие занятия" icon={<CalendarDays size={18} />} onClick={() => navigate('/schedule')} action="Открыть расписание" />
              <div className="divide-y divide-white/10">
                {upcoming.map(lesson => (
                  <div key={lesson.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{lesson.subject}</div>
                      <div className="text-sm text-white/45 mt-1">{formatDateTime(lesson.startAt)} · пара {lesson.lessonNumber}{lesson.room ? ` · ауд. ${lesson.room}` : ''}</div>
                      {lesson.topic && <div className="text-sm text-white/60 mt-2 truncate">{lesson.topic}</div>}
                    </div>
                    <div className="text-xs text-white/35 whitespace-nowrap">{lesson.teacher}</div>
                  </div>
                ))}
                {upcoming.length === 0 && <Empty text="Ближайших занятий нет." />}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
              <SectionHeader title="Последние оценки" icon={<TrendingUp size={18} />} onClick={() => navigate('/parent/progress')} action="Все оценки" />
              <div className="divide-y divide-white/10">
                {recentGrades.map(g => (
                  <div key={g.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0"><div className="font-medium truncate">{g.subject}</div><div className="text-xs text-white/40 mt-1">{formatDate(g.startAt)}{g.topic ? ` · ${g.topic}` : ''}</div></div>
                    <div className="text-xl font-semibold text-violet-200">{g.value}/10</div>
                  </div>
                ))}
                {recentGrades.length === 0 && <Empty text="Оценок пока нет." />}
              </div>
            </section>
          </div>

          <div className="grid xl:grid-cols-2 gap-5">
            <section className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
              <SectionHeader title="Что нужно сделать" icon={<Clock3 size={18} />} onClick={() => navigate('/parent/progress')} action="Все задания" />
              <div className="divide-y divide-white/10">
                {pendingHomework.map(h => (
                  <div key={h.id} className="p-4">
                    <div className="flex items-start justify-between gap-4"><div className="font-medium">{h.title}</div><div className="text-xs text-amber-200 whitespace-nowrap">{h.deadline ? `До ${formatDateTime(h.deadline)}` : 'Без срока'}</div></div>
                    <div className="text-sm text-violet-300 mt-1">{h.subject}</div>
                  </div>
                ))}
                {pendingHomework.length === 0 && <Empty text="Невыполненных заданий нет." />}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
              <SectionHeader title="Посещаемость" icon={<CheckCircle2 size={18} />} onClick={() => navigate('/parent/attendance')} action="Подробно" />
              <div className="divide-y divide-white/10">
                {recentAttendance.map(row => (
                  <div key={row.id} className="p-4 flex items-center justify-between gap-4"><div><div className="font-medium">{row.subject}</div><div className="text-xs text-white/40 mt-1">{formatDateTime(row.startAt)}</div></div><span className="text-sm text-violet-200">{attendanceLabels[row.status] ?? row.status}</span></div>
                ))}
                {recentAttendance.length === 0 && <Empty text="Данных о посещаемости пока нет." />}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[.03] overflow-hidden">
            <SectionHeader title="Учебные материалы" icon={<BookOpen size={18} />} onClick={() => navigate('/materials')} action="Открыть материалы" />
            <div className="grid md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
              {recentMaterials.map(m => <div key={m.id} className="p-4"><div className="font-medium truncate">{m.title}</div><div className="text-xs text-violet-300 mt-1">{m.subject}</div><div className="text-xs text-white/35 mt-2">{formatDate(m.publishedAt ?? m.updatedAt)}</div></div>)}
              {recentMaterials.length === 0 && <div className="p-6 text-white/40">Опубликованных материалов пока нет.</div>}
            </div>
          </section>

          {child && <div className="text-xs text-white/30">Выбран: {child.fullName}{child.studyGroupName ? ` · ${child.studyGroupName}` : ''}</div>}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone = 'normal' }: { icon: React.ReactNode; label: string; value: string; tone?: 'normal' | 'warning' }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-center gap-2 text-violet-300">{icon}<span className="text-xs uppercase tracking-[.14em] text-white/40">{label}</span></div><div className={`mt-3 text-2xl font-semibold ${tone === 'warning' ? 'text-amber-200' : 'text-white'}`}>{value}</div></div>;
}
function SectionHeader({ title, icon, action, onClick }: { title: string; icon: React.ReactNode; action: string; onClick: () => void }) {
  return <div className="p-5 flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-semibold">{icon}<span>{title}</span></div><button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200">{action}<ArrowRight size={14} /></button></div>;
}
function Empty({ text }: { text: string }) { return <div className="p-6 text-white/40">{text}</div>; }
