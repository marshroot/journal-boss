import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <main className="not-found-screen">
      <div className="not-found-card">
        <div className="page-heading-icon"><Compass size={21} /></div>
        <p className="page-eyebrow">404 · myJournal</p>
        <h1>Раздел не найден</h1>
        <p>Такой страницы нет или ссылка устарела. Вернитесь в журнал и продолжите работу.</p>
        <Link to="/dashboard" className="primary-btn">
          <ArrowLeft size={15} /> Вернуться на главную
        </Link>
      </div>
    </main>
  );
}
