import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CreditCard, RotateCcw, XCircle, CheckCircle2 } from 'lucide-react';
import { apiJson } from '../lib/api';
import { getCurrentUser, AuthUser } from '../lib/auth';

type Payment = {
  id: number; title: string; description: string | null; amount: number; currency: string;
  status: 'Pending' | 'Paid' | 'Cancelled' | 'Refunded'; provider: string; externalRef: string | null;
  payerId: number; payerName: string; studentId: number | null; studentName: string | null;
  createdAt: string; paidAt: string | null; cancelledAt: string | null;
};
type Child = { id: number; fullName: string };

const statusLabel: Record<Payment['status'], string> = {
  Pending: 'Ожидает оплаты', Paid: 'Оплачен', Cancelled: 'Отменён', Refunded: 'Возвращён',
};
const statusClass: Record<Payment['status'], string> = {
  Pending: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  Paid: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  Cancelled: 'text-white/50 border-white/15 bg-white/5',
  Refunded: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
};

const money = (p: Payment) => `${p.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ${p.currency}`;

export default function PaymentsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mine, setMine] = useState<Payment[]>([]);
  const [all, setAll] = useState<Payment[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');

  const isAdmin = user?.role === 'Admin';
  const isParent = user?.role === 'Parent';

  const load = async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);
      const requests: Promise<void>[] = [apiJson<Payment[]>('/api/payments/my').then(setMine)];
      if (me?.role === 'Admin') requests.push(apiJson<Payment[]>('/api/payments').then(setAll));
      if (me?.role === 'Parent') requests.push(apiJson<Child[]>('/api/parent/children').then(setChildren).catch(() => setChildren([])));
      await Promise.all(requests);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить платежи.'); }
  };
  useEffect(() => { void load(); }, []);

  const totalPaid = useMemo(() => mine.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0), [mine]);
  const totalPending = useMemo(() => mine.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0), [mine]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!title.trim() || !Number.isFinite(value) || value <= 0) { setError('Укажите назначение и сумму.'); return; }
    setBusy(true); setError('');
    try {
      await apiJson('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), amount: value, description: description.trim() || null, studentId: studentId ? Number(studentId) : null }),
      });
      setTitle(''); setAmount(''); setDescription(''); setStudentId('');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось создать платёж.'); }
    finally { setBusy(false); }
  }

  async function act(p: Payment, action: 'pay' | 'cancel' | 'refund') {
    if (action === 'pay' && !confirm(`Подтвердите демо-оплату «${p.title}» на ${money(p)}?\nРеальные деньги не списываются — это пример платёжной системы.`)) return;
    if (action === 'refund' && !confirm(`Вернуть платёж «${p.title}»?`)) return;
    setBusy(true); setError('');
    try {
      await apiJson(`/api/payments/${p.id}/${action}`, { method: 'POST' });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Операция не выполнена.'); }
    finally { setBusy(false); }
  }

  const rows = tab === 'all' ? all : mine;

  return (
    <div className="p-6 md:p-8 text-white space-y-6 max-w-5xl mx-auto">
      <div>
        <p className="text-xs uppercase tracking-[.25em] text-white/40">Платежи · пример интеграции</p>
        <h1 className="text-3xl font-semibold mt-2">Платёжная система (демо)</h1>
        <p className="text-white/50 mt-2">
          Создание счетов и оплата без реального провайдера: кнопка «Оплатить» имитирует успешный платёж.
          Для боевой интеграции замените <code className="text-violet-300">/api/payments/&#123;id&#125;/pay</code> на webhook провайдера (ЮKassa, Stripe).
        </p>
      </div>
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <div className="text-sm text-white/50">Оплачено всего</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-300">{totalPaid.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
          <div className="text-sm text-white/50">Ожидает оплаты</div>
          <div className="text-2xl font-semibold mt-1 text-amber-300">{totalPending.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
        <h2 className="text-xl font-semibold flex items-center gap-2"><CreditCard size={20} /> Новый счёт</h2>
        <form onSubmit={create} className="grid md:grid-cols-2 gap-3 mt-4">
          <input className="input" placeholder="Назначение (например, Оплата курса)" maxLength={200} required value={title} onChange={e => setTitle(e.target.value)} />
          <input className="input" placeholder="Сумма" inputMode="decimal" required value={amount} onChange={e => setAmount(e.target.value)} />
          <input className="input md:col-span-2" placeholder="Комментарий (необязательно)" maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} />
          {isParent && children.length > 0 && (
            <select className="input md:col-span-2" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">Платёж от себя (без привязки к ребёнку)</option>
              {children.map(c => <option key={c.id} value={c.id}>За ребёнка: {c.fullName}</option>)}
            </select>
          )}
          <div className="md:col-span-2"><button disabled={busy} className="rounded-xl bg-[color:var(--os-fg)] text-[color:var(--os-bg)] px-5 py-2 font-medium disabled:opacity-50">Создать счёт</button></div>
        </form>
      </section>

      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <div className="font-semibold">Платежи</div>
          {isAdmin && (
            <div className="messages-tabs" style={{ margin: 0 }}>
              <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>Мои</button>
              <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Все пользователи</button>
            </div>
          )}
        </div>
        {rows.length === 0 && <div className="p-5 text-white/40">Платежей пока нет.</div>}
        {rows.map(p => (
          <div key={p.id} className="grid md:grid-cols-[1fr_170px_150px_230px] gap-3 items-center px-5 py-4 border-t border-white/10">
            <div className="min-w-0">
              <div className="font-medium truncate">{p.title}</div>
              <div className="text-sm text-white/40 truncate">
                {new Date(p.createdAt).toLocaleString('ru-RU')}
                {p.studentName ? ` · за: ${p.studentName}` : ''}
                {tab === 'all' ? ` · плательщик: ${p.payerName}` : ''}
                {p.externalRef ? ` · ${p.externalRef}` : ''}
              </div>
              {p.description && <div className="text-sm text-white/50 mt-1 truncate">{p.description}</div>}
            </div>
            <div className="font-semibold">{money(p)}</div>
            <div><span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs ${statusClass[p.status]}`}>{statusLabel[p.status]}</span></div>
            <div className="flex gap-2 justify-end">
              {p.status === 'Pending' && <>
                <button disabled={busy} onClick={() => void act(p, 'pay')} className="rounded-lg bg-emerald-400/90 text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"><CheckCircle2 size={15} /> Оплатить</button>
                <button disabled={busy} onClick={() => void act(p, 'cancel')} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5 disabled:opacity-50 flex items-center gap-1.5"><XCircle size={15} /> Отменить</button>
              </>}
              {isAdmin && p.status === 'Paid' && (
                <button disabled={busy} onClick={() => void act(p, 'refund')} className="rounded-lg border border-sky-400/30 text-sky-300 px-3 py-1.5 text-sm hover:bg-sky-400/10 disabled:opacity-50 flex items-center gap-1.5"><RotateCcw size={15} /> Вернуть</button>
              )}
            </div>
          </div>
        ))}
      </section>
      <p className="text-xs text-white/35">Провайдер: {rows[0]?.provider ?? 'example'} (демо). Аудит операций: payment.create / payment.paid / payment.cancel / payment.refund.</p>
    </div>
  );
}
