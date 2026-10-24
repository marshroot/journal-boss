import { API_BASE } from './apiBase';
export interface AuthUser {
  id: number;
  login: string;
  fullName: string;
  role: 'Admin' | 'Teacher' | 'Student' | 'Parent';
  studyGroupId?: number | null;
  studyGroupName?: string | null;
}

export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

export function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('authUser');
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = getAccessToken();
  if (!token) return null;

  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    logout();
    return null;
  }

  const user = await response.json() as AuthUser;
  localStorage.setItem('authUser', JSON.stringify(user));
  return user;
}

