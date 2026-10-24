import { useCallback, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRemoteParticipants,
  useLocalParticipant,
  useDataChannel,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState, MediaDeviceFailure, Track } from "livekit-client";
import "@livekit/components-styles";
import { apiJson } from "../lib/api";

type Props = {
  url: string;
  token: string;
  lessonId: number;
  isTeacher: boolean;
  onClose: () => void;
};

const SCREEN_SHARE_TOPIC = "jornal.screen-share";

type ScreenShareMessage = { action: "request" | "stop" };

/**
 * Bridges the teacher request to the participant browser. A backend cannot open the
 * screen capture dialog on its own, so the teacher asks through the LiveKit data
 * channel and the participant confirms locally.
 */
function ScreenShareBridge() {
  const { localParticipant } = useLocalParticipant();
  const [request, setRequest] = useState<ScreenShareMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useDataChannel<typeof SCREEN_SHARE_TOPIC>(SCREEN_SHARE_TOPIC, (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as ScreenShareMessage;
      if (parsed?.action === "request") setRequest(parsed);
      if (parsed?.action === "stop") {
        setRequest(null);
        void localParticipant.setScreenShareEnabled(false);
      }
    } catch {
      // Ignore malformed payloads from other clients.
    }
  });

  const start = useCallback(async () => {
    setBusy(true);
    try {
      await localParticipant.setScreenShareEnabled(true);
      setMessage("Демонстрация экрана включена.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Не удалось включить демонстрацию экрана.");
    } finally {
      setBusy(false);
      setRequest(null);
    }
  }, [localParticipant]);

  const decline = useCallback(() => {
    setRequest(null);
    setMessage("Запрос на демонстрацию экрана отклонён.");
  }, []);

  if (!request && !message) return null;

  return (
    <div className="absolute left-1/2 top-20 z-30 w-[min(28rem,90vw)] -translate-x-1/2 rounded-2xl border border-violet-400/30 bg-black/90 p-4 text-white shadow-xl">
      {request && (
        <>
          <div className="text-sm font-medium">Преподаватель просит показать экран</div>
          <div className="mt-1 text-xs text-white/50">
            Доступ к экрану откроется только после вашего подтверждения.
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void start()}
              disabled={busy}
              className="rounded-xl bg-violet-400 px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {busy ? "Запуск…" : "Разрешить"}
            </button>
            <button
              onClick={decline}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm"
            >
              Отклонить
            </button>
          </div>
        </>
      )}
      {message && !request && <div className="text-xs text-white/70">{message}</div>}
    </div>
  );
}

function TeacherControls({ lessonId }: { lessonId: number }) {
  const remote = useRemoteParticipants();
  const local = useLocalParticipant();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function muteOne(identity: string, muted: boolean) {
    setBusy(identity);
    try {
      await apiJson(`/api/lessons/${lessonId}/online/mute`, {
        method: "POST",
        body: JSON.stringify({ identity, muted })
      });
      setNotice(muted ? "Микрофон выключен." : "Микрофон включён.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка.");
    } finally { setBusy(null); setTimeout(() => setNotice(""), 2500); }
  }

  async function muteAll() {
    setBusy("all");
    try {
      const r = await apiJson<{ muted: number }>(`/api/lessons/${lessonId}/online/mute-all`, { method: "POST" });
      setNotice(`Выключены микрофоны у ${r.muted} участник(ов).`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка.");
    } finally { setBusy(null); setTimeout(() => setNotice(""), 2500); }
  }

  async function requestScreenShare(identity: string) {
    setBusy(`ss-${identity}`);
    try {
      await apiJson(`/api/lessons/${lessonId}/online/screen-share/request`, {
        method: "POST",
        body: JSON.stringify({ identity })
      });
      setNotice("Запрос на демонстрацию экрана отправлен участнику.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка.");
    } finally { setBusy(null); setTimeout(() => setNotice(""), 2500); }
  }

  async function stopScreenShare(identity: string) {
    setBusy(`ss-${identity}`);
    try {
      await apiJson(`/api/lessons/${lessonId}/online/screen-share`, {
        method: "POST",
        body: JSON.stringify({ identity, muted: true })
      });
      setNotice("Демонстрация экрана остановлена.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка.");
    } finally { setBusy(null); setTimeout(() => setNotice(""), 2500); }
  }

  async function screenShareAll() {
    setBusy("ss-all");
    try {
      const r = await apiJson<{ stopped: number }>(`/api/lessons/${lessonId}/online/screen-share-all`, { method: "POST" });
      setNotice(`Демонстрация экрана остановлена у ${r.stopped} участник(ов).`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка.");
    } finally { setBusy(null); setTimeout(() => setNotice(""), 2500); }
  }

  async function removeParticipant(identity: string) {
    setBusy(`rm-${identity}`);
    try {
      await apiJson(`/api/lessons/${lessonId}/online/remove-participant`, {
        method: "POST",
        body: JSON.stringify({ identity })
      });
      setNotice("Участник отключён от пары.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Ошибка.");
    } finally { setBusy(null); setTimeout(() => setNotice(""), 2500); }
  }

  return (
    <div className="absolute left-4 top-16 z-20 w-80 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-md p-4 text-white text-sm">
      <div className="flex items-center justify-between mb-3">
        <strong className="text-base">Управление парой</strong>
        <button onClick={muteAll} disabled={busy === "all"} className="rounded-lg bg-red-500/80 px-3 py-1 text-xs disabled:opacity-50">
          {busy === "all" ? "…" : "Выключить всем"}
        </button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/50">Демонстрация экрана</span>
        <button onClick={screenShareAll} disabled={busy === "ss-all"} className="rounded-lg bg-orange-500/80 px-3 py-1 text-xs disabled:opacity-50">
          {busy === "ss-all" ? "…" : "Забрать у всех"}
        </button>
      </div>
      {notice && <div className="mb-2 rounded bg-violet-500/20 px-2 py-1 text-xs text-violet-200">{notice}</div>}
      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {remote.length === 0 && <div className="text-white/40 text-xs">Студенты пока не подключились.</div>}
        {remote.map(p => {
          const audioTrack = Array.from(p.trackPublications.values()).find(t => t.kind === Track.Kind.Audio);
          const isMuted = audioTrack?.isMuted ?? true;
          const screenTrack = Array.from(p.trackPublications.values()).find(t => t.source === Track.Source.ScreenShare && t.kind === Track.Kind.Video);
          const isSharing = !!screenTrack && !screenTrack.isMuted;
          return (
            <div key={p.identity} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name || p.identity}</div>
                <div className="text-[10px] text-white/40">
                  {isMuted ? "микрофон выключен" : "микрофон включён"}
                  {" · "}
                  {isSharing ? "показывает экран" : "экран не показан"}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => muteOne(p.identity, !isMuted)}
                  disabled={busy === p.identity}
                  className={`rounded-lg px-2.5 py-1 text-xs disabled:opacity-50 ${isMuted ? "bg-emerald-500/70" : "bg-amber-500/70"}`}
                  title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
                >
                  {isMuted ? "🎤 Вкл." : "🎤 Выкл."}
                </button>
                <button
                  onClick={() => (isSharing ? stopScreenShare(p.identity) : requestScreenShare(p.identity))}
                  disabled={busy === `ss-${p.identity}`}
                  className={`rounded-lg px-2.5 py-1 text-xs disabled:opacity-50 ${isSharing ? "bg-red-500/70" : "bg-sky-500/70"}`}
                  title={isSharing ? "Остановить демонстрацию" : "Запросить демонстрацию экрана"}
                >
                  {isSharing ? "🖥 Стоп" : "🖥 Дать"}
                </button>
                <button
                  onClick={() => removeParticipant(p.identity)}
                  disabled={busy === `rm-${p.identity}`}
                  className="rounded-lg bg-rose-500/70 px-2.5 py-1 text-xs disabled:opacity-50"
                  title="Отключить участника от пары"
                >
                  ⛔
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-white/10 text-[10px] text-white/40">
        Вы: {local.localParticipant.name || local.localParticipant.identity}
      </div>
    </div>
  );
}

function ConnectionBanner() {
  const state = useConnectionState();

  if (state === ConnectionState.Connected) return null;

  const label =
    state === ConnectionState.Connecting
      ? "Подключение к комнате…"
      : state === ConnectionState.Reconnecting
        ? "Соединение потеряно, восстанавливаем…"
        : "Нет соединения с комнатой.";

  return (
    <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border border-white/10 bg-black/85 px-4 py-2 text-xs text-white/80">
      {label}
    </div>
  );
}

export default function OnlineLessonPanel({ url, token, lessonId, isTeacher, onClose }: Props) {
  const [error, setError] = useState("");
  const [mediaProblem, setMediaProblem] = useState("");
  const [connected, setConnected] = useState(false);

  return <div className="fixed inset-0 z-50 bg-black/95 p-3 md:p-6">
    <div className="h-full rounded-2xl border border-white/10 overflow-hidden bg-[#111] relative">
      <button onClick={onClose} className="absolute z-20 right-4 top-4 rounded-xl bg-black/70 border border-white/10 px-4 py-2 text-white">Закрыть</button>
      {error && <div className="absolute z-30 left-1/2 top-16 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-xs text-red-200">{error}</div>}
      {mediaProblem && <div className="absolute z-30 left-1/2 top-28 -translate-x-1/2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs text-amber-200">{mediaProblem}</div>}
      {!connected && !error && <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/60">Подключение к онлайн-паре…</div>}
      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect
        audio
        video
        options={{ adaptiveStream: true, dynacast: true }}
        style={{ height: "100%" }}
        onConnected={() => setConnected(true)}
        onDisconnected={(reason) => {
          setConnected(false);
          setError(reason ? `Соединение с комнатой завершено (${reason}).` : "Соединение с комнатой завершено.");
        }}
        onError={(e) => setError(e.message)}
        onMediaDeviceFailure={(failure, kind) =>
          setMediaProblem(
            failure === MediaDeviceFailure.PermissionDenied
              ? "Нет доступа к камере или микрофону. Разрешите доступ в настройках браузера."
              : failure === MediaDeviceFailure.NotFound
                ? "Камера или микрофон не найдены."
                : failure === MediaDeviceFailure.DeviceInUse
                  ? "Камера или микрофон заняты другим приложением."
                  : `Не удалось получить доступ к ${kind === "videoinput" ? "камере" : "микрофону"}.`
          )
        }
      >
        <ConnectionBanner />
        <ScreenShareBridge />
        {isTeacher && <TeacherControls lessonId={lessonId} />}
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  </div>;
}
