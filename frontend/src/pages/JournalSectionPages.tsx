import { FormEvent, useEffect, useState } from 'react';
import { Bell, CheckCircle2, ChevronDown, CreditCard, HelpCircle, Mail, MessageCircle, Phone, Send, ShieldAlert, Trophy, User, WalletCards } from 'lucide-react';
import { getCurrentUser, logout, AuthUser } from '../lib/auth';
import { apiJson } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import AwardsWidget from '../components/journal/AwardsWidget';

const purple = 'text-violet-300';
const card = 'rounded-2xl border border-white/10 bg-white/[0.025]';

function Header({ eyebrow, title, description, icon: Icon }: { eyebrow: string; title: string; description: string; icon: any }) {
  return <div className="mb-6 flex items-start gap-4">
    <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-300"><Icon size={20} /></div>
    <div><p className="text-xs font-medium uppercase tracking-[.22em] text-white/35">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{description}</p></div>
  </div>;
}

export function AnnouncementsPage() {
  type Announcement = { id:number; title:string; body:string; publishedAt:string };
  const [items,setItems]=useState<Announcement[]>([]);
  const [user,setUser]=useState<AuthUser|null>(null);
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [busy,setBusy]=useState(false);
  const [editingId,setEditingId]=useState<number|null>(null);
  const [error,setError]=useState('');
  const canManage=user?.role==='Admin';

  async function load(){
    setError('');
    try {
      const [u,rows]=await Promise.all([getCurrentUser(),apiJson<Announcement[]>('/api/announcements')]);
      setUser(u); setItems(rows);
    } catch(e) { setError(e instanceof Error?e.message:'Не удалось загрузить объявления'); }
  }
  useEffect(()=>{void load()},[]);

  async function create(e:FormEvent){
    e.preventDefault();
    if(!title.trim()||!body.trim()) return;
    setBusy(true); setError('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? `/api/announcements/${editingId}` : '/api/announcements';
      await apiJson(url,{method,body:JSON.stringify({title,body})});
      setTitle(''); setBody(''); setEditingId(null); await load();
    } catch(e) { setError(e instanceof Error?e.message:(editingId?'Не удалось сохранить объявление':'Не удалось опубликовать объявление')); }
    finally { setBusy(false); }
  }

  function startEdit(item: Announcement){
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function cancelEdit(){
    setEditingId(null);
    setTitle('');
    setBody('');
  }

  async function remove(id:number){
    if(!confirm('Удалить это объявление?')) return;
    try { await apiJson(`/api/announcements/${id}`,{method:'DELETE'}); setItems(x=>x.filter(a=>a.id!==id)); }
    catch(e) { setError(e instanceof Error?e.message:'Не удалось удалить объявление'); }
  }

  return <div className="max-w-5xl">
    <Header eyebrow="Информация" title="Объявления" description="Важные новости журнала, учебные обновления и уведомления по сервису." icon={Bell}/>
    {error&&<div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
    {canManage&&<form onSubmit={create} className={`${card} mb-4 p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3"><div className="text-sm font-semibold text-white">{editingId?'Редактирование объявления':'Новое объявление'}</div>{editingId&&<button type="button" onClick={cancelEdit} className="text-xs text-white/45 hover:text-white">Отмена</button>}</div>
      <div className="grid gap-3">
        <input className="input" value={title} onChange={e=>setTitle(e.target.value)} maxLength={160} placeholder="Заголовок объявления" aria-label="Заголовок объявления"/>
        <textarea className="input min-h-28 resize-y" value={body} onChange={e=>setBody(e.target.value)} maxLength={5000} placeholder="Текст объявления" aria-label="Текст объявления"/>
        <div className="flex justify-end"><button disabled={busy||!title.trim()||!body.trim()} className="rounded-xl bg-violet-400 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">{busy?(editingId?'Сохраняем…':'Публикуем…'):(editingId?'Сохранить изменения':'Опубликовать')}</button></div>
      </div>
    </form>}
    <div className="space-y-3">
      {items.length===0?<div className={`${card} p-8 text-center text-sm text-white/35`}>Опубликованных объявлений пока нет.</div>:items.map(x=><article key={x.id} className={`${card} p-5 transition hover:border-violet-400/20 hover:bg-white/[.035]`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-semibold text-white">{x.title}</h2>
          <div className="flex items-center gap-2"><span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/40">{new Date(x.publishedAt).toLocaleDateString('ru-RU')}</span>{canManage&&<><button type="button" onClick={()=>startEdit(x)} className="rounded-lg border border-violet-400/20 px-2.5 py-1 text-[11px] text-violet-200 hover:bg-violet-500/10">Изменить</button><button type="button" onClick={()=>void remove(x.id)} className="rounded-lg border border-red-400/20 px-2.5 py-1 text-[11px] text-red-300 hover:bg-red-500/10">Удалить</button></>}</div>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/55">{x.body}</p>
      </article>)}
    </div>
  </div>;
}
export function AwardsPage() {
  return <div><Header eyebrow="Достижения" title="Награды" description="Ваши достижения, прогресс и игровые бонусы собраны в одном разделе." icon={Trophy}/><div className="bento-grid"><AwardsWidget /></div></div>;
}

export function ReviewsPage() {
  const [text,setText]=useState('');
  const [saved,setSaved]=useState<string[]>(()=>JSON.parse(localStorage.getItem('journal-reviews')||'[]'));
  const submit=(e:FormEvent)=>{e.preventDefault();if(!text.trim())return;const next=[text.trim(),...saved].slice(0,10);setSaved(next);localStorage.setItem('journal-reviews',JSON.stringify(next));setText('');};
  return <div className="max-w-5xl"><Header eyebrow="Обратная связь" title="Отзывы о студенте" description="Оставляйте заметки о прогрессе, участии и сильных сторонах. Записи сохраняются в этом браузере." icon={MessageCircle}/><form onSubmit={submit} className={`${card} p-5`}><label className="text-sm font-medium text-white">Новая заметка</label><textarea value={text} onChange={e=>setText(e.target.value)} className="input mt-3 min-h-32 resize-y" placeholder="Напишите, что получилось хорошо, над чем стоит поработать…"/><div className="mt-3 flex justify-end"><button className="rounded-xl bg-[color:var(--os-fg)] px-4 py-2 text-sm font-semibold text-[color:var(--os-bg)] transition hover:bg-violet-100"><Send size={15} className="mr-2 inline"/>Сохранить отзыв</button></div></form><div className="mt-4 space-y-3">{saved.length===0?<div className={`${card} p-8 text-center text-sm text-white/35`}>Пока нет сохранённых заметок.</div>:saved.map((x,i)=><div key={i} className={`${card} p-4 text-sm leading-6 text-white/65`}>{x}</div>)}</div></div>;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [user,setUser]=useState<AuthUser|null>(null);
  useEffect(()=>{void getCurrentUser().then(setUser)},[]);
  return <div className="max-w-4xl"><Header eyebrow="Аккаунт" title="Личный кабинет" description="Основные данные профиля и настройки текущей сессии." icon={User}/><div className="grid gap-4 md:grid-cols-[1fr_300px]"><section className={`${card} p-6`}><div className="grid gap-4 sm:grid-cols-2"><Info label="ФИО" value={user?.fullName||'Загрузка…'}/><Info label="Логин" value={user?.login||'—'}/><Info label="Роль" value={roleName(user?.role)}/><Info label="ID пользователя" value={user?.id?String(user.id):'—'}/></div></section><section className={`${card} p-6`}><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-xl font-semibold text-violet-300">{initials(user?.fullName||'?')}</div><div className="mt-4 font-semibold text-white">Сессия активна</div><p className="mt-1 text-sm text-white/40">Данные профиля загружены с сервера журнала.</p><button onClick={()=>{logout();navigate('/login',{replace:true});}} className="mt-5 w-full rounded-xl border border-red-400/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">Выйти из аккаунта</button></section></div></div>;
}

function Info({label,value}:{label:string;value:string}) { return <div className="rounded-xl border border-white/8 bg-black/10 p-4"><div className="text-xs uppercase tracking-wider text-white/30">{label}</div><div className="mt-2 text-sm text-white/80">{value}</div></div>; }
function roleName(role?:string){return role==='Admin'?'Администратор':role==='Teacher'?'Преподаватель':role==='Parent'?'Родитель':role==='Student'?'Студент':role||'—';}
function initials(name:string){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();}

export function FaqPage() {
  const qs=[['Как открыть расписание?','Выберите «Расписание» в левом меню. Данные загружаются с сервера и обновляются при открытии раздела.'],['Где находятся домашние задания?','Раздел «ДЗ» показывает опубликованные задания, сроки, вложения и ваши отправленные решения.'],['Как открыть учебный материал?','Перейдите в «Учебные материалы». Преподаватели могут редактировать и публиковать материалы, студенты — просматривать опубликованные.'],['Почему недоступна онлайн-пара?','Онлайн-комната доступна только для занятия, которое запущено преподавателем и для которого сервер выдал токен подключения.']];
  const [open,setOpen]=useState(0);
  return <div className="max-w-4xl"><Header eyebrow="Помощь" title="F.A.Q." description="Короткие ответы на основные вопросы по журналу." icon={HelpCircle}/><div className="space-y-2">{qs.map(([q,a],i)=><div key={q} className={card}><button type="button" className="flex w-full items-center justify-between gap-4 p-5 text-left" onClick={()=>setOpen(open===i?-1:i)}><span className="font-medium text-white">{q}</span><ChevronDown size={18} className={`shrink-0 text-white/40 transition ${open===i?'rotate-180 text-violet-300':''}`}/></button>{open===i&&<div className="px-5 pb-5 text-sm leading-6 text-white/50">{a}</div>}</div>)}</div></div>;
}

export function ContactsPage() {
  return <div className="max-w-5xl"><Header eyebrow="Связь" title="Контакты" description="Каналы для вопросов по учебному процессу и работе сервиса." icon={Phone}/><div className="grid gap-4 md:grid-cols-3">{[['Учебный отдел','support@journal.local','Вопросы по занятиям и расписанию',Mail],['Техническая поддержка','help@journal.local','Ошибки, доступ и работа приложения',ShieldAlert],['Онлайн-поддержка','Пн–Пт · 09:00–18:00','Ответим в рабочее время',MessageCircle]].map(([t,v,d,I]:any)=><div key={String(t)} className={`${card} p-5`}><I size={19} className="text-violet-300"/><div className="mt-4 font-semibold text-white">{t}</div><div className="mt-2 text-sm text-violet-300">{v}</div><div className="mt-2 text-sm leading-6 text-white/45">{d}</div></div>)}</div></div>;
}

function RequestPage({complaint=false}:{complaint?:boolean}) {
  const key=complaint?'journal-complaints':'journal-appeals'; const [subject,setSubject]=useState(''); const [text,setText]=useState(''); const [sent,setSent]=useState(false);
  const submit=(e:FormEvent)=>{e.preventDefault();if(!subject.trim()||!text.trim())return;const rows=JSON.parse(localStorage.getItem(key)||'[]');rows.unshift({subject,text,createdAt:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(rows.slice(0,20)));setSubject('');setText('');setSent(true);};
  return <div className="max-w-4xl"><Header eyebrow="Обращения" title={complaint?'Жалобы':'Обращения'} description={complaint?'Сообщите о проблеме или нарушении — обращение будет сохранено для дальнейшей обработки.':'Задайте вопрос администрации или сообщите о ситуации, требующей внимания.'} icon={complaint?ShieldAlert:MessageCircle}/><form onSubmit={submit} className={`${card} p-6`}><div className="grid gap-4"><input className="input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder={complaint?'Тема жалобы':'Тема обращения'}/><textarea className="input min-h-40 resize-y" value={text} onChange={e=>setText(e.target.value)} placeholder={complaint?'Опишите проблему подробно…':'Опишите ваш вопрос или предложение…'}/><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-white/35">Не указывайте пароли и другие секретные данные.</span><button className="rounded-xl bg-[color:var(--os-fg)] px-5 py-2.5 text-sm font-semibold text-[color:var(--os-bg)] hover:bg-violet-100"><Send size={15} className="mr-2 inline"/>Отправить</button></div>{sent&&<div className="flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-sm text-violet-200"><CheckCircle2 size={16}/>Обращение сохранено.</div>}</div></form></div>;
}
export function AppealsPage(){return <RequestPage/>}
export function ComplaintsPage(){return <RequestPage complaint/>}
