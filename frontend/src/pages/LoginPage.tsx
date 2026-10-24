import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../lib/auth';
import { API_BASE } from '../lib/apiBase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getAccessToken()) navigate('/dashboard', { replace: true });
  }, [navigate]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message ?? 'Не удалось войти.');
        return;
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Сервер недоступен. Проверьте, запущен ли backend.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="os-login">
      <div className="os-login-left">
        <p className="os-label mb-8 flex items-center gap-3"><span className="os-dot" /> myJournal</p>
        <h1>Вход в <span className="os-grad-text">систему</span></h1>
      </div>
      <form onSubmit={submit}>
        <p className="text-[17px] leading-relaxed text-[color:var(--os-dim)] mb-12">Используйте логин и пароль от журнала Top Academy или локальную учётную запись.</p>

        <label className="os-label block">Логин</label>
        <input
          value={login}
          onChange={e => setLogin(e.target.value)}
          autoComplete="username"
          className="os-field"
          placeholder="Введите логин"
          required
        />

        <label className="os-label block mt-10">Пароль</label>
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          className="os-field"
          placeholder="Введите пароль"
          required
        />

        {error && <p className="mt-6 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="os-cta mt-12 w-full h-[58px] px-7 text-[18px] disabled:opacity-50"
        >
          {loading ? 'Входим…' : 'Войти'}
          <span aria-hidden="true" className="os-arrow">→</span>
        </button>
      </form>
    </div>
  );
}
