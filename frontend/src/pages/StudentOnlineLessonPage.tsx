import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import { getCurrentUser, AuthUser } from '../lib/auth';
import OnlineLessonPanel from './OnlineLessonPanel';
import LessonBoardCanvas from '../components/LessonBoardCanvas';
import { ChevronDown, ChevronUp, Radio } from 'lucide-react';

type Current = { id:number; subjectName:string; groupName:string; topic:string|null; startAt:string; endAt:string; online:{id:number;roomName:string;status:string;startedAt:string}|null; board:{isBroadcast:boolean;broadcastStartedAt:string|null}|null };
type Room = { url:string; token:string };

export default function StudentOnlineLessonPage(){
  const [current,setCurrent]=useState<Current|null>(null);
  const [user,setUser]=useState<AuthUser|null>(null);
  const [room,setRoom]=useState<Room|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [joining,setJoining]=useState(false);
  const [boardCollapsed,setBoardCollapsed]=useState(false);

  const isTeacher=user?.role==='Teacher'||user?.role==='Admin';

  const load=async()=>{
    try{
      setError('');
      const u=await getCurrentUser();
      setUser(u);
      if(!u)return;
      const endpoint = u.role==='Teacher'||u.role==='Admin' ? '/api/lessons/teacher/current' : '/api/lessons/student/current';
      const data=await apiJson<Current>(endpoint);
      setCurrent(data);
    }catch(e:any){
      setError(e?.message??'Не удалось проверить текущую пару.');
    }finally{setLoading(false)}
  };

  useEffect(()=>{void load();const id=window.setInterval(()=>void load(),8000);return()=>window.clearInterval(id)},[]);

  // When the teacher starts projecting the board, expand it automatically.
  useEffect(()=>{ if(current?.board?.isBroadcast) setBoardCollapsed(false); },[current?.board?.isBroadcast,current?.board?.broadcastStartedAt]);

  const join=async()=>{
    if(!current?.online)return;
    setJoining(true);
    try{
      setError('');
      const data=await apiJson<Room>(`/api/lessons/${current.id}/online/token`,{method:'POST'});
      setRoom(data);
    }catch(e:any){
      setError(e?.message??'Не удалось подключиться к онлайн-паре.');
    }finally{setJoining(false)}
  };

  // A teacher can deep-link to a specific lesson with ?lessonId=N.
  const requestedLessonId=Number(new URLSearchParams(window.location.search).get('lessonId'));
  const targetLessonId=Number.isFinite(requestedLessonId)&&requestedLessonId>0?requestedLessonId:current?.id;

  if(loading)return <div className="p-6 text-slate-300">Проверяем текущую пару…</div>;
  return <div className="p-6 md:p-8 text-white space-y-5">
    <div><p className="text-xs uppercase tracking-[.25em] text-white/40">{isTeacher ? 'Преподаватель' : 'Студент'}</p><h1 className="text-3xl font-semibold mt-2">Текущая пара</h1></div>
    {error&&<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</div>}
    {!current&& !error&&<div className="rounded-2xl border border-white/10 p-8 text-white/45">Сейчас пары нет.</div>}
    {current&&<section className="rounded-2xl border border-white/10 bg-white/[.04] p-6 space-y-5">
      <div><div className="text-sm text-violet-300">{current.subjectName} · {current.groupName}</div><h2 className="text-2xl font-semibold mt-1">Пара идёт сейчас</h2><div className="text-white/45 mt-2">{new Date(current.startAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} – {new Date(current.endAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</div>{current.topic&&<div className="mt-3 text-white/70">Тема: {current.topic}</div>}</div>
      <div className="flex flex-wrap gap-3">
        <button onClick={()=>window.location.assign(`/lesson-chat?lessonId=${current.id}`)} className="rounded-xl border border-white/15 px-5 py-3">Чат пары</button>
        <button onClick={()=>window.location.assign(`/lesson-board?lessonId=${current.id}`)} className="rounded-xl border border-white/15 px-5 py-3">Доска</button>
        {current.online
          ?<button onClick={()=>void join()} disabled={joining} className="rounded-xl bg-violet-400 px-5 py-3 font-medium text-black disabled:opacity-50">{joining?'Подключение…':'Подключиться к онлайн-паре'}</button>
          :<div className="rounded-xl border border-white/10 p-4 text-white/45">{isTeacher ? 'Запустите онлайн-пару на странице «Текущая пара».' : 'Преподаватель ещё не запустил онлайн-пару.'}</div>}
      </div>
    </section>}
    {current?.board?.isBroadcast && (
      <section className="rounded-2xl border border-violet-400/30 bg-violet-400/5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-violet-400/20">
          <div className="flex items-center gap-2 text-violet-200">
            <Radio size={16} className="animate-pulse" />
            <span className="font-medium">Преподаватель показывает доску</span>
            <span className="text-xs text-white/40">обновление каждые 3 с</span>
          </div>
          <button onClick={()=>setBoardCollapsed(c=>!c)} className="rounded-lg border border-white/15 p-1.5 hover:bg-white/5" title={boardCollapsed?'Развернуть доску':'Свернуть доску'}>
            {boardCollapsed?<ChevronDown size={16}/>:<ChevronUp size={16}/>}
          </button>
        </div>
        {!boardCollapsed && <LessonBoardCanvas lessonId={current.id} pollMs={3000} height="60vh"/>}
      </section>
    )}
    {room&&targetLessonId&&<OnlineLessonPanel url={room.url} token={room.token} lessonId={targetLessonId} isTeacher={isTeacher} onClose={()=>setRoom(null)}/>}
  </div>;
}
