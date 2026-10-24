import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, User, RefreshCw } from 'lucide-react';
import { apiJson } from '../lib/api';
import { getCurrentUser, AuthUser } from '../lib/auth';
import ScheduleWidget from '../components/journal/ScheduleWidget';

interface ScheduleItem {
  id: number;
  startAt: string;
  endAt: string;
  room?: string | null;
  lessonNumber: number;
  groupName: string;
  subjectName: string;
  teacherName: string;
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(value));
}

function PersonalSchedule() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentUser();
      if (!current) throw new Error('Сессия истекла.');
      setUser(current);

      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);

      const data = await apiJson<ScheduleItem[]>(
        `/api/schedule/personal?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`
      );
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? 'Не удалось загрузить расписание.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const key = new Date(item.startAt).toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  if (loading) return <div className="p-6 text-slate-300">Загружаем расписание…</div>;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Моё расписание</h1>
          <p className="text-sm text-slate-400 mt-1">
            {user?.role === 'Student' ? `Группа: ${user.studyGroupName ?? 'не назначена'}` :
             user?.role === 'Teacher' ? 'Ваши занятия' :
             user?.role === 'Parent' ? 'Занятия ваших детей' : 'Все занятия'}
          </p>
        </div>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">
          <RefreshCw size={16} /> Обновить
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>
      )}

      {!error && grouped.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-400">
          На ближайшие 7 дней занятий нет.
        </div>
      )}

      {grouped.map(([day, dayItems]) => (
        <section key={day} className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-medium capitalize text-slate-300">
            <Calendar size={16} /> {formatDay(day)}
          </h2>
          <div className="grid gap-3">
            {dayItems.map(item => (
              <article key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Clock size={16} />
                    {new Date(item.startAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    {' – '}
                    {new Date(item.endAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-slate-200">{item.subjectName}</div>
                  <div className="text-slate-400">Пара {item.lessonNumber}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><User size={15} /> {item.teacherName || 'Преподаватель не указан'}</span>
                  <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {item.room || 'Аудитория не указана'}</span>
                  <span>Группа: {item.groupName}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {/* The legacy schedule widget now uses the shared JWT API client; it must not depend on a removed Telegram session. */}
      {user?.role === 'Student' && (
        <details className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <summary className="cursor-pointer text-sm text-slate-300">Старое расписание журнала Top Academy</summary>
          <div className="mt-3">
            <ScheduleWidget />
          </div>
        </details>
      )}
    </div>
  );
}

export default function JournalSchedule() {
  return <PersonalSchedule />;
}
