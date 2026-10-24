import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';

type Child={id:number;fullName:string;studyGroupName:string|null};
type Grade={id:number;value:number;comment:string|null;createdAt:string;startAt:string;subject:string;topic:string|null};
type Homework={id:number;title:string;description:string;deadline:string|null;subject:string;topic:string|null;submission:{id:number;submittedAt:string;teacherScore:number|null;teacherComment:string|null}|null};

export default function ParentProgressPage(){
  const [children,setChildren]=useState<Child[]>([]); const [selected,setSelected]=useState<number|null>(null);
  const [grades,setGrades]=useState<Grade[]>([]); const [homework,setHomework]=useState<Homework[]>([]); const [error,setError]=useState('');
  const load=async(id:number)=>{try{setError('');const [g,h]=await Promise.all([apiJson<Grade[]>(`/api/parent/${id}/grades`),apiJson<Homework[]>(`/api/parent/${id}/homework`)]);setGrades(g);setHomework(h)}catch(e:any){setError(e?.message??'Не удалось загрузить данные ребёнка.')}};
  useEffect(()=>{void (async()=>{try{const c=await apiJson<Child[]>('/api/parent/children');setChildren(c);if(c[0]){setSelected(c[0].id);await load(c[0].id)}}catch(e:any){setError(e?.message??'Не удалось загрузить детей')}})()},[]);
  const change=(id:number)=>{setSelected(id);void load(id)};
  return <div className="p-6 md:p-8 text-white space-y-6"><div><p className="text-xs uppercase tracking-[.25em] text-white/40">Родитель</p><h1 className="text-3xl font-semibold mt-2">Учебный прогресс ребёнка</h1></div>
    {error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
    {children.length>0&&<select className="input max-w-md" value={selected??''} onChange={e=>change(Number(e.target.value))}>{children.map(c=><option key={c.id} value={c.id}>{c.fullName}{c.studyGroupName?` · ${c.studyGroupName}`:''}</option>)}</select>}
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-xl font-semibold">Оценки</h2><div className="mt-4 divide-y divide-white/10">{grades.map(g=><div key={g.id} className="py-3 flex flex-wrap justify-between gap-3"><div><div className="font-medium">{g.subject}</div><div className="text-sm text-white/45">{new Date(g.startAt).toLocaleString('ru-RU')}{g.topic?` · ${g.topic}`:''}</div>{g.comment&&<div className="text-sm text-white/55 mt-1">{g.comment}</div>}</div><div className="text-2xl font-semibold text-violet-200">{g.value}/10</div></div>)}{grades.length===0&&<div className="py-6 text-white/40">Оценок пока нет.</div>}</div></section>
    <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><h2 className="text-xl font-semibold">Домашние задания</h2><div className="mt-4 grid gap-3">{homework.map(h=><article key={h.id} className="rounded-xl border border-white/10 p-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="font-medium">{h.title}</div><div className="text-sm text-violet-300">{h.subject}</div></div><div className="text-sm text-white/45">{h.deadline?`До ${new Date(h.deadline).toLocaleString('ru-RU')}`:'Без срока'}</div></div><p className="mt-2 text-sm text-white/60 whitespace-pre-wrap">{h.description}</p><div className="mt-3 text-sm">{h.submission?<span className="text-violet-300">Сдано {new Date(h.submission.submittedAt).toLocaleString('ru-RU')}{h.submission.teacherScore!=null?` · оценка ${h.submission.teacherScore}/10`:''}</span>:<span className="text-amber-200">Пока не сдано</span>}{h.submission?.teacherComment&&<div className="text-white/50 mt-1">{h.submission.teacherComment}</div>}</div></article>)}{homework.length===0&&<div className="py-6 text-white/40">Домашних заданий пока нет.</div>}</div></section>
  </div>
}
