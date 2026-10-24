import { FormEvent, useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import { getCurrentUser, AuthUser } from '../lib/auth';

const ROLES = [
  { value: 'Admin', label: 'Администратор' },
  { value: 'Teacher', label: 'Преподаватель' },
  { value: 'Student', label: 'Студент' },
  { value: 'Parent', label: 'Родитель / куратор (одинаковые права)' },
] as const;

type AdminUser = { id: number; login: string; fullName: string; role: string; studyGroupId?: number | null; studyGroupName?: string | null; createdAt: string };
type Group = { id: number; name: string };


const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label ?? role;

export default function AdminUsersPage() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [parentId, setParentId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [parentStudents, setParentStudents] = useState<AdminUser[]>([]);
  const [form, setForm] = useState({ login: '', fullName: '', role: 'Student', password: '', studyGroupId: '' });

  async function load() {
    setLoading(true); setError('');
    try {
      const me = await getCurrentUser();
      setCurrentUser(me);
      if (me?.role !== 'Admin') { setError('Раздел доступен только администратору.'); return; }
      const [userList, groupList] = await Promise.all([apiJson<AdminUser[]>('/api/admin/users'), apiJson<Group[]>('/api/admin/academic/groups')]);
      setUsers(userList); setGroups(groupList);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить пользователей.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ login: '', fullName: '', role: 'Student', password: '', studyGroupId: '' });
  }

  function edit(user: AdminUser) {
    setEditingId(user.id);
    setForm({ login: user.login, fullName: user.fullName, role: user.role, password: '', studyGroupId: user.studyGroupId ? String(user.studyGroupId) : '' });
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editingId == null) {
        await apiJson('/api/admin/users', { method: 'POST', body: JSON.stringify({ ...form, studyGroupId: form.studyGroupId ? Number(form.studyGroupId) : null }) });
      } else {
        await apiJson(`/api/admin/users/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ login: form.login, fullName: form.fullName, role: form.role, newPassword: form.password || null, studyGroupId: form.studyGroupId ? Number(form.studyGroupId) : null }),
        });
      }
      resetForm(); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить пользователя.'); }
    finally { setSaving(false); }
  }

  async function remove(user: AdminUser) {
    if (!confirm(`Удалить пользователя «${user.fullName}»?`)) return;
    try { await apiJson(`/api/admin/users/${user.id}`, { method: 'DELETE' }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось удалить пользователя.'); }
  }

  if (currentUser && currentUser.role !== 'Admin') return <div className="p-8 text-white">Раздел доступен только администратору.</div>;

  return (
    <div className="p-6 md:p-8 text-white space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">Администрирование</p>
        <h1 className="text-3xl font-semibold mt-2">Пользователи</h1>
        <p className="text-white/50 mt-2">Создание аккаунтов преподавателей, студентов и родителей.</p>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

      <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 grid gap-4 md:grid-cols-6">
        <input className="input" placeholder="Логин" value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} required />
        <input className="input" placeholder="ФИО" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} required />
        <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        {form.role === 'Student' && <select className="input" value={form.studyGroupId} onChange={e => setForm({ ...form, studyGroupId: e.target.value })}><option value="">Группа студента</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>}
        <input className="input" type="password" minLength={8} placeholder={editingId ? 'Новый пароль (не менять)' : 'Пароль, от 8 символов'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editingId} />
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4 py-3 font-medium disabled:opacity-50">{saving ? 'Сохраняем…' : editingId ? 'Сохранить' : 'Создать'}</button>
          {editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-white/10 px-4">Отмена</button>}
        </div>
      </form>

      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
        <div><h2 className="text-xl font-semibold">Родитель → студент</h2><p className="text-sm text-white/40 mt-1">Связывает аккаунт родителя с аккаунтом ребёнка для последующего просмотра оценок, посещаемости и ДЗ.</p></div>
        <div className="grid md:grid-cols-3 gap-3">
          <select className="input" value={parentId ?? ''} onChange={e => setParentId(e.target.value ? Number(e.target.value) : null)}><option value="">Выберите родителя</option>{users.filter(u => u.role === 'Parent').map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
          <select className="input" value={studentId ?? ''} onChange={e => setStudentId(e.target.value ? Number(e.target.value) : null)}><option value="">Выберите студента</option>{users.filter(u => u.role === 'Student').map(u => <option key={u.id} value={u.id}>{u.fullName} — {u.studyGroupName ?? 'без группы'}</option>)}</select>
          <button type="button" className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-4" disabled={!parentId || !studentId} onClick={async () => { try { await apiJson(`/api/admin/users/parents/${parentId}/students/${studentId}`, { method: 'POST' }); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось связать пользователей.'); } }}>Связать</button>
        </div>
        {parentId && <button type="button" className="text-sm text-white/50 hover:text-white" onClick={async () => { try { setParentStudents(await apiJson<AdminUser[]>(`/api/admin/users/parents/${parentId}/students`)); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить связи.'); } }}>Показать детей выбранного родителя</button>}
        {parentStudents.length > 0 && <div className="space-y-2">{parentStudents.map(s => <div key={s.id} className="flex justify-between border-t border-white/10 pt-2"><span>{s.fullName} <span className="text-white/35">{s.studyGroupName ?? 'без группы'}</span></span><button className="text-red-300 text-sm" onClick={async () => { await apiJson(`/api/admin/users/parents/${parentId}/students/${s.id}`, { method: 'DELETE' }); setParentStudents(parentStudents.filter(x => x.id !== s.id)); }}>Удалить связь</button></div>)}</div>}
      </section>

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        {loading ? <div className="p-6 text-white/50">Загрузка…</div> : users.map(user => (
          <div key={user.id} className="grid grid-cols-[1fr_1fr_160px_130px] gap-4 items-center px-5 py-4 border-b border-white/10 last:border-b-0">
            <div><div className="font-medium">{user.fullName || 'Без имени'}</div><div className="text-sm text-white/40">{user.login || 'без логина'}</div></div>
            <div className="text-white/60">{roleLabel(user.role)}{user.role === 'Student' && <div className="text-xs text-white/35 mt-1">{user.studyGroupName ?? 'Без группы'}</div>}</div>
            <div className="text-sm text-white/40">{new Date(user.createdAt).toLocaleDateString('ru-RU')}</div>
            <div className="flex gap-2 justify-end"><button onClick={() => edit(user)} className="rounded-lg border border-white/10 px-3 py-2 text-sm">Изменить</button>{user.id !== currentUser?.id && <button onClick={() => remove(user)} className="rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-300">Удалить</button>}</div>
          </div>
        ))}
        {!loading && users.length === 0 && <div className="p-6 text-white/50">Пользователей пока нет.</div>}
      </div>
    </div>
  );
}
