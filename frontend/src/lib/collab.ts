export function getCollabUrl(): string {
  const configured = String(import.meta.env.VITE_COLLAB_URL ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/collab/`;
  }

  return 'ws://localhost:1234';
}
