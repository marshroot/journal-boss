import { useEffect, useState } from 'react';
import { apiBlob } from '../lib/api';

interface ChatImageProps {
  id: number;
  alt?: string;
  className?: string;
}

/// Renders a chat image through the authorized download endpoint: fetches a Blob
/// with the Bearer token (an <img src> cannot send headers) and shows an object URL.
export default function ChatImage({ id, alt, className }: ChatImageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    apiBlob(`/api/chat/attachments/${id}/download`)
      .then(blob => {
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (failed) return <span className="text-xs text-red-300">Не удалось загрузить изображение</span>;
  if (!url) return <span className="text-xs opacity-50">Загрузка изображения…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" title={alt ?? 'Открыть изображение'}>
      <img
        src={url}
        alt={alt ?? 'Изображение'}
        className={className ?? 'max-h-64 max-w-full rounded-lg border border-white/10'}
        loading="lazy"
      />
    </a>
  );
}
