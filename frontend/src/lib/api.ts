import { getAccessToken, logout } from './auth';
import { API_BASE } from './apiBase';

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401) logout();
  return response;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? `Ошибка API: ${response.status}`);
  return data as T;
}

/// Authorized binary download (chat images, attachments) as a Blob.
export async function apiBlob(path: string): Promise<Blob> {
  const response = await apiFetch(path);
  if (!response.ok) throw new Error(`Ошибка загрузки файла: ${response.status}`);
  return response.blob();
}

/// Uploads a file to an upload endpoint and returns the parsed JSON (throws Error with server message).
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  const response = await apiFetch(path, { method: 'POST', body });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message ?? `Ошибка загрузки: ${response.status}`);
  return data as T;
}
