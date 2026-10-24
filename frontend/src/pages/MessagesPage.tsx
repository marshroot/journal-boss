import { useEffect, useMemo, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { MessageCircle, Search, Send, UserRound, Users, Plus, X, ImagePlus } from 'lucide-react';
import { apiJson, apiUpload } from '../lib/api';
import ChatImage from '../components/ChatImage';


interface Attachment { id:number; fileName:string; contentType:string; sizeBytes:number; }
interface Contact { id:number; fullName:string; role:string; unreadCount:number; lastMessageAt:string|null; }
interface Message { id:number; senderId:number; recipientId:number; senderName:string; message:string; attachment?:Attachment|null; createdAt:string; isRead:boolean; }
interface GroupInfo { id:number; name:string; ownerId:number; createdAt:string; }
interface GroupMember { id:number; fullName:string; role:string; }
interface GroupMessage { id:number; groupId:number; userId:number; userName:string; message:string; attachment?:Attachment|null; createdAt:string; }

const roleLabel = (role:string) => role === 'Admin' ? 'Администратор' : role === 'Teacher' ? 'Преподаватель' : role === 'Parent' ? 'Родитель' : 'Студент';

export default function MessagesPage(){
  const [contacts,setContacts]=useState<Contact[]>([]);
  const [selected,setSelected]=useState<Contact|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [text,setText]=useState('');
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState('Подключение…');
  const [error,setError]=useState('');
  const [tab,setTab]=useState<'direct'|'groups'>('direct');
  const [groups,setGroups]=useState<GroupInfo[]>([]);
  const [selectedGroup,setSelectedGroup]=useState<GroupInfo|null>(null);
  const [groupMessages,setGroupMessages]=useState<GroupMessage[]>([]);
  const [groupText,setGroupText]=useState('');
  const [groupMembers,setGroupMembers]=useState<GroupMember[]>([]);
  const [showCreate,setShowCreate]=useState(false);
  const [newGroupName,setNewGroupName]=useState('');
  const [allUsers,setAllUsers]=useState<{id:number;fullName:string;role:string}[]>([]);
  const [selectedMembers,setSelectedMembers]=useState<number[]>([]);
  const [pendingImage,setPendingImage]=useState<Attachment|null>(null);
  const [pendingGroupImage,setPendingGroupImage]=useState<Attachment|null>(null);
  const [uploading,setUploading]=useState(false);
  const connectionRef=useRef<HubConnection|null>(null);
  const selectedRef=useRef<Contact|null>(null);
  const bottomRef=useRef<HTMLDivElement>(null);
  const currentUserId=useMemo(()=>Number(JSON.parse(localStorage.getItem('authUser')||'{}')?.id||0),[]);
  const isStaff = useMemo(() => { const r = JSON.parse(localStorage.getItem('authUser')||'{}')?.role; return r === 'Admin' || r === 'Teacher'; }, []);

  useEffect(()=>{
    let mounted=true;
    void apiJson<Contact[]>('/api/messages/contacts').then(data=>{if(mounted)setContacts(data)}).catch(e=>setError(e instanceof Error?e.message:'Не удалось загрузить контакты.'));
    const connection=new HubConnectionBuilder().withUrl('/hubs/lesson-chat',{accessTokenFactory:()=>localStorage.getItem('accessToken')||''}).withAutomaticReconnect().configureLogging(LogLevel.Warning).build();
    connection.on('DirectMessage',(m:Message)=>{
      if(!mounted)return;
      const current=selectedRef.current;
      const isCurrent=!!current && (m.senderId===current.id || m.recipientId===current.id);
      if(isCurrent) {
        setMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,m]);
        if(m.senderId===current?.id) void connection.invoke('MarkDirectRead',current.id).catch(()=>{});
      } else if(m.recipientId===currentUserId) {
        setContacts(prev=>prev.map(c=>c.id===m.senderId?{...c,unreadCount:(c.unreadCount||0)+1,lastMessageAt:m.createdAt}:c));
      }
    });
    connection.on('DirectHistory',(rows:Message[])=>{if(mounted)setMessages(rows)});
    connection.on('GroupMessage',(m:GroupMessage)=>{
      if(!mounted)return;
      if(selectedGroup && m.groupId===selectedGroup.id) setGroupMessages(prev=>prev.some(x=>x.id===m.id)?prev:[...prev,m]);
    });
    connection.on('GroupHistory',(payload:{groupId:number;history:GroupMessage[]})=>{
      if(!mounted)return;
      if(selectedGroup && payload.groupId===selectedGroup.id) setGroupMessages(payload.history);
    });
    connection.onreconnecting(()=>setStatus('Переподключение…'));
    connection.onreconnected(()=>setStatus('Онлайн'));
    connection.onclose(()=>setStatus('Отключено'));
    connection.start().then(()=>{if(mounted){setStatus('Онлайн');connectionRef.current=connection}}).catch(e=>{if(mounted){setStatus('Ошибка');setError(e instanceof Error?e.message:'Не удалось подключиться к сообщениям.')}});
    return()=>{mounted=false;void connection.stop();connectionRef.current=null};
  },[]);

  useEffect(()=>{
    if(!selected || !connectionRef.current) return;
    selectedRef.current=selected;
    setContacts(prev=>prev.map(c=>c.id===selected.id?{...c,unreadCount:0}:c));
    void connectionRef.current.invoke('MarkDirectRead',selected.id).catch(()=>{});
    void connectionRef.current.invoke('GetDirectHistory',selected.id).catch(e=>setError(e?.message||'Не удалось загрузить переписку.'));
  },[selected]);

  useEffect(()=>{
    if(tab!=='groups')return;
    let mounted=true;
    void apiJson<GroupInfo[]>('/api/chat-groups').then(data=>{if(mounted)setGroups(data)}).catch(e=>setError(e instanceof Error?e.message:'Не удалось загрузить группы.'));
    return()=>{mounted=false};
  },[tab, showCreate]);

  useEffect(()=>{
    if(!selectedGroup || !connectionRef.current) return;
    void connectionRef.current.invoke('JoinGroup',selectedGroup.id).catch(e=>setError(e?.message||'Не удалось загрузить чат группы.'));
    void apiJson<GroupMember[]>(`/api/chat-groups/${selectedGroup.id}/members`).then(setGroupMembers).catch(()=>{});
  },[selectedGroup]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages,groupMessages]);

  const filtered=contacts.filter(c=>`${c.fullName} ${roleLabel(c.role)}`.toLowerCase().includes(query.toLowerCase()));
  const pickImage = async (file: File | undefined, forGroup: boolean) => {
    if (!file) return;
    setUploading(true); setError('');
    try {
      const uploaded = await apiUpload<Attachment>('/api/chat/attachments/upload', file);
      if (forGroup) setPendingGroupImage(uploaded); else setPendingImage(uploaded);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить изображение.'); }
    finally { setUploading(false); }
  };
  const send=async()=>{const value=text.trim();if((!value&&!pendingImage)||!selected||!connectionRef.current)return;setText('');const image=pendingImage;setPendingImage(null);try{await connectionRef.current.invoke('SendDirectMessage',selected.id,value,image?.id??null)}catch(e){setText(value);setPendingImage(image);setError(e instanceof Error?e.message:'Не удалось отправить сообщение.')}};
  const sendGroup=async()=>{const value=groupText.trim();if((!value&&!pendingGroupImage)||!selectedGroup||!connectionRef.current)return;setGroupText('');const image=pendingGroupImage;setPendingGroupImage(null);try{await connectionRef.current.invoke('SendGroupMessage',selectedGroup.id,value,image?.id??null)}catch(e){setGroupText(value);setPendingGroupImage(image);setError(e instanceof Error?e.message:'Не удалось отправить сообщение.')}};

  const openCreate = async () => {
    setNewGroupName('');
    setSelectedMembers([]);
    setShowCreate(true);
    try {
      const users = await apiJson<{id:number;fullName:string;role:string}[]>('/api/admin/users/simple');
      setAllUsers(users);
    } catch { setAllUsers([]); }
  };

  const createGroup = async () => {
    if(!newGroupName.trim()) return;
    try {
      await apiJson<GroupInfo>('/api/chat-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newGroupName,memberIds:selectedMembers})});
      setShowCreate(false);
      void apiJson<GroupInfo[]>('/api/chat-groups').then(setGroups).catch(()=>{});
    } catch(e){ setError(e instanceof Error?e.message:'Не удалось создать группу.'); }
  };

  return <div className="page-shell">
    <div className="page-heading"><div className="page-heading-icon"><MessageCircle size={20}/></div><div><div className="page-eyebrow">Коммуникации</div><h1>Сообщения</h1><p>Личные сообщения и групповые чаты в реальном времени.</p></div><div className="page-heading-status">● {status}</div></div>
    {error&&<div className="notice notice-error">{error}</div>}
    <div className="messages-tabs">
      <button className={tab==='direct'?'active':''} onClick={()=>setTab('direct')}>Личные</button>
      <button className={tab==='groups'?'active':''} onClick={()=>setTab('groups')}>Группы {groups.length>0?`(${groups.length})`:''}</button>
    </div>
    {tab==='direct' && <div className="messages-layout">
      <aside className="messages-contacts panel">
        <div className="panel-title">Контакты <span>{contacts.length}</span></div>
        <label className="messages-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск контакта"/></label>
        <div className="messages-contact-list">{filtered.map(c=><button key={c.id} className={`messages-contact ${selected?.id===c.id?'active':''}`} onClick={()=>{setError('');selectedRef.current=c;setSelected(c)}}><div className="avatar-mini"><UserRound size={16}/></div><div className="messages-contact-copy"><strong>{c.fullName}</strong><small>{roleLabel(c.role)}</small></div>{c.unreadCount>0&&<span className="messages-unread" aria-label={`Непрочитанных: ${c.unreadCount}`}>{c.unreadCount>99?'99+':c.unreadCount}</span>}</button>)}{filtered.length===0&&<div className="empty-state">Контакты не найдены.</div>}</div>
      </aside>
      <section className="messages-thread panel">
        {!selected?<div className="messages-empty"><div className="empty-icon"><MessageCircle size={28}/></div><h2>Выберите собеседника</h2><p>История переписки и новые сообщения появятся здесь.</p></div>:<>
          <header className="thread-header"><div className="avatar-mini large"><UserRound size={18}/></div><div><strong>{selected.fullName}</strong><span>{roleLabel(selected.role)}</span></div></header>
          <div className="thread-body">{messages.length===0?<div className="empty-state">Сообщений пока нет. Начните диалог.</div>:messages.map(m=><div key={m.id} className={`message-bubble ${m.senderId===currentUserId?'mine':''}`}>{m.attachment&&<div className="mb-1"><ChatImage id={m.attachment.id} alt={m.attachment.fileName} className="max-h-56 max-w-full rounded-lg"/></div>}{m.message&&<div>{m.message}</div>}<time>{new Date(m.createdAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div>)}<div ref={bottomRef}/></div>
          {pendingImage&&<div className="thread-attachment-preview"><ImagePlus size={14}/><span className="truncate">{pendingImage.fileName}</span><button type="button" onClick={()=>setPendingImage(null)} title="Убрать изображение"><X size={14}/></button></div>}
          <div className="thread-composer">
            <label className={`icon-btn ${uploading?'disabled':''}`} title="Прикрепить изображение">{uploading?'…':<ImagePlus size={17}/>}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading} onChange={e=>{void pickImage(e.target.files?.[0],false);e.currentTarget.value=''}}/></label>
            <textarea value={text} maxLength={4000} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="Напишите сообщение…"/>
            <button disabled={(!text.trim()&&!pendingImage)||status!=='Онлайн'} onClick={()=>void send()}><Send size={17}/></button>
          </div>
        </>}
      </section>
    </div>}
    {tab==='groups' && <div className="messages-layout">
      <aside className="messages-contacts panel">
        <div className="panel-title" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span>Группы <span>{groups.length}</span></span>
          {isStaff && <button className="icon-btn" onClick={openCreate} title="Создать группу"><Plus size={16}/></button>}
        </div>
        <div className="messages-contact-list">{groups.map(g=><button key={g.id} className={`messages-contact ${selectedGroup?.id===g.id?'active':''}`} onClick={()=>setSelectedGroup(g)}><div className="avatar-mini"><Users size={16}/></div><div className="messages-contact-copy"><strong>{g.name}</strong><small>Групповой чат</small></div></button>)}{groups.length===0&&<div className="empty-state">Групп пока нет.</div>}</div>
      </aside>
      <section className="messages-thread panel">
        {!selectedGroup?<div className="messages-empty"><div className="empty-icon"><Users size={28}/></div><h2>Выберите группу</h2><p>История и новые сообщения появятся здесь.</p></div>:<>
          <header className="thread-header"><div className="avatar-mini large"><Users size={18}/></div><div><strong>{selectedGroup.name}</strong><span>{groupMembers.length} участник(ов)</span></div></header>
          <div className="thread-body">{groupMessages.length===0?<div className="empty-state">Сообщений пока нет. Начните диалог.</div>:groupMessages.map(m=><div key={m.id} className={`message-bubble ${m.userId===currentUserId?'mine':''}`}>{m.userId!==currentUserId&&<div className="message-author">{m.userName}</div>}{m.attachment&&<div className="mb-1"><ChatImage id={m.attachment.id} alt={m.attachment.fileName} className="max-h-56 max-w-full rounded-lg"/></div>}{m.message&&<div>{m.message}</div>}<time>{new Date(m.createdAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div>)}<div ref={bottomRef}/></div>
          {pendingGroupImage&&<div className="thread-attachment-preview"><ImagePlus size={14}/><span className="truncate">{pendingGroupImage.fileName}</span><button type="button" onClick={()=>setPendingGroupImage(null)} title="Убрать изображение"><X size={14}/></button></div>}
          <div className="thread-composer">
            <label className={`icon-btn ${uploading?'disabled':''}`} title="Прикрепить изображение">{uploading?'…':<ImagePlus size={17}/>}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" disabled={uploading} onChange={e=>{void pickImage(e.target.files?.[0],true);e.currentTarget.value=''}}/></label>
            <textarea value={groupText} maxLength={2000} onChange={e=>setGroupText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void sendGroup()}}} placeholder="Напишите сообщение…"/>
            <button disabled={(!groupText.trim()&&!pendingGroupImage)||status!=='Онлайн'} onClick={()=>void sendGroup()}><Send size={17}/></button>
          </div>
        </>}
      </section>
    </div>}
    {showCreate && <div className="modal-overlay" onClick={()=>setShowCreate(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Создать групповой чат</h3><button onClick={()=>setShowCreate(false)}><X size={18}/></button></div>
        <div className="modal-body">
          <label className="form-label">Название группы</label>
          <input className="form-input" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Например: Группа ПИ-21"/>
          <label className="form-label">Участники</label>
          <div className="member-list">
            {allUsers.map(u=><label key={u.id} className="member-item"><input type="checkbox" checked={selectedMembers.includes(u.id)} onChange={e=>setSelectedMembers(s=>e.target.checked?[...s,u.id]:s.filter(x=>x!==u.id))}/><span>{u.fullName}</span><small>{roleLabel(u.role)}</small></label>)}
          </div>
        </div>
        <div className="modal-footer"><button className="btn-primary" onClick={()=>void createGroup()} disabled={!newGroupName.trim()}>Создать</button></div>
      </div>
    </div>}
  </div>;
}
