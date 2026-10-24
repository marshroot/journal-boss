import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';

interface Grade { id:number; value:number; comment?:string|null; startAt:string; topic?:string|null; subject:string; group:string; }
export default function LocalGradesPage(){
 const [rows,setRows]=useState<Grade[]>([]); const [error,setError]=useState('');
 useEffect(()=>{ apiJson<Grade[]>('/api/assessment/grades/student').then(setRows).catch(e=>setError(e?.message??'Не удалось загрузить оценки.')); },[]);
 return <div className="p-4 md:p-6 space-y-5"><div><h1 className="text-2xl font-semibold text-white">Оценки</h1><p className="text-sm text-slate-400 mt-1">Оценки по занятиям</p></div>{error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}{rows.length===0&&!error&&<div className="rounded-xl border border-white/10 p-8 text-center text-slate-400">Оценок пока нет.</div>}<div className="grid gap-3">{rows.map(g=><article key={g.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"><div><div className="font-medium text-white">{g.subject}</div><div className="text-sm text-slate-400">{new Date(g.startAt).toLocaleString('ru-RU')} · {g.group}</div>{g.topic&&<div className="mt-1 text-xs text-slate-500">{g.topic}</div>}{g.comment&&<div className="mt-1 text-sm text-slate-400">{g.comment}</div>}</div><div className="text-2xl font-semibold text-violet-300">{g.value}/10</div></article>)}</div></div>
}
