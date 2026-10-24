import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { apiJson } from '../lib/api';
import { getCollabUrl } from '../lib/collab';

export default function CollaborativeCodeEditor({ exerciseId, fileId, initialCode, language, onCodeChange, readOnly = false }: {
  exerciseId: number;
  fileId?: number;
  initialCode: string;
  language: string;
  onCodeChange: (code: string) => void;
  readOnly?: boolean;
}) {
  const [status, setStatus] = useState('Подключение…');
  const [participants, setParticipants] = useState<string[]>([]);
  const editorRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const applyingRemoteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        const endpoint = fileId ? `/api/code-lab/exercise/${exerciseId}/file/${fileId}/collaboration-token` : `/api/code-lab/exercise/${exerciseId}/collaboration-token`;
        const auth = await apiJson<{ token: string; room: string }>(endpoint, { method: 'POST' });
        if (cancelled) return;
        const ydoc = new Y.Doc();
        const ytext = ydoc.getText('code');
        const provider = new HocuspocusProvider({
          url: getCollabUrl(),
          name: auth.room,
          document: ydoc,
          token: auth.token,
          onStatus: ({ status }) => setStatus(status === 'connected' ? 'Онлайн' : status === 'connecting' ? 'Подключение…' : 'Отключено'),
        });
        ydocRef.current = ydoc;
        ytextRef.current = ytext;
        providerRef.current = provider;
        const observer = () => {
          const model = modelRef.current;
          if (!model || applyingRemoteRef.current) return;
          applyingRemoteRef.current = true;
          const value = ytext.toString();
          if (model.getValue() !== value) model.setValue(value);
          applyingRemoteRef.current = false;
          onCodeChange(value);
        };
        ytext.observe(observer);
        const user = JSON.parse(localStorage.getItem('authUser') || '{}');
        provider.awareness?.setLocalStateField('user', {
          name: user.fullName || user.login || 'Участник',
        });
        const updateParticipants = () => {
          const names = Array.from(provider.awareness?.getStates().values() ?? [])
            .map((state: any) => state?.user?.name)
            .filter((name): name is string => Boolean(name));
          setParticipants([...new Set(names)]);
        };
        provider.awareness?.on('change', updateParticipants);
        updateParticipants();

        provider.on('synced', () => {
          if (ytext.length === 0 && initialCode) ytext.insert(0, initialCode);
          observer();
          setStatus('Онлайн');
        });
        return () => {
          ytext.unobserve(observer);
          provider.awareness?.off('change', updateParticipants);
          provider.destroy();
          ydoc.destroy();
        };
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? `Ошибка: ${e.message}` : 'Ошибка подключения');
      }
    };
    let cleanup: (() => void) | undefined;
    setup().then(fn => { cleanup = fn; });
    return () => { cancelled = true; cleanup?.(); providerRef.current?.destroy(); ydocRef.current?.destroy(); providerRef.current = null; ydocRef.current = null; ytextRef.current = null; };
  }, [exerciseId, fileId]);

  return <div>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6,fontSize:13}}>
      <span>Совместный редактор</span><span>{status}{participants.length ? ` · ${participants.length} участн.` : ''}</span>
    </div>
    <Editor
      height="520px"
      theme="vs-dark"
      language={language}
      value={initialCode}
      onMount={(editor) => { editorRef.current = editor; modelRef.current = editor.getModel(); }}
      onChange={(value) => {
        const next = value ?? '';
        onCodeChange(next);
        const ytext = ytextRef.current;
        const model = modelRef.current;
        if (!ytext || !model || applyingRemoteRef.current || ytext.toString() === next) return;
        ytext.doc?.transact(() => ytext.delete(0, ytext.length));
        if (next) ytext.insert(0, next);
      }}
      options={{minimap:{enabled:false},fontSize:14,automaticLayout:true,readOnly}}
    />
  </div>;
}
