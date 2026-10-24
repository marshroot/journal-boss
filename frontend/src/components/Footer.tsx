import { useState, useEffect } from 'react';
import { ArrowUp, Clock } from 'lucide-react';

interface FooterProps {
  isDark: boolean;
}

export default function Footer({ isDark }: FooterProps) {
  const [utcTime, setUtcTime] = useState('15:14:26');

  // Clock ticking effect
  useEffect(() => {
    const timer = setInterval(() => {
      const date = new Date();
      const h = String(date.getUTCHours()).padStart(2, '0');
      const m = String(date.getUTCMinutes()).padStart(2, '0');
      const s = String(date.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className={`py-12 border-t px-4 md:px-8 lg:px-16 transition-colors duration-500 relative z-10 ${
      isDark ? 'bg-slate-950 border-white/5 text-gray-405' : 'bg-[color:var(--os-fg)] border-border-color text-text-secondary'
    }`}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
        
        {/* Brand block left */}
        <div className="flex flex-col gap-2 text-center md:text-left">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <span className={`font-bold tracking-wide text-md ${isDark ? 'text-white' : 'text-text-primary'}`}>
              myJournal
            </span>
          </div>
          <p className="text-[11px] max-w-xs leading-relaxed text-text-dim">
            Электронный журнал колледжа: расписание, оценки, посещаемость, домашние задания, материалы и онлайн-уроки.
          </p>
        </div>

        {/* Nav columns center */}
        <div className="flex gap-8 text-xs font-mono">
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-text-dim uppercase text-[10px]">Реестр</span>
            <a href="#home" className="hover:text-accent-purple transition-colors">Главная база</a>
            <a href="#voyages" className="hover:text-accent-purple transition-colors">Модули myJournal</a>
            <a href="#worlds" className="hover:text-accent-purple transition-colors">Предметы CS</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-text-dim uppercase text-[10px]">Операции</span>
            <span className="text-text-dim italic">myJournal</span>
          </div>
        </div>

        {/* UTC Clock & Back to Top right */}
        <div className="flex flex-col items-center md:items-end gap-3 font-mono text-xs">
          <div className={`flex items-center gap-2 p-2 rounded-lg ${
            isDark ? 'bg-white/5 text-white' : 'bg-stone-150 text-text-primary'
          }`}>
            <Clock className="w-3.5 h-3.5 text-accent-purple" />
            <span>Universal Time: {utcTime} UTC</span>
          </div>
          
          <button
            onClick={handleScrollTop}
            className={`p-2.5 rounded-full border transition-all hover:scale-105 cursor-pointer ${
              isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-border-color text-text-primary hover:bg-stone-200'
            }`}
            title="Наверх"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>

      </div>

      <div className="max-w-6xl mx-auto border-t border-gray-150 dark:border-white/5 mt-8 pt-6 flex flex-col sm:flex-row justify-between text-[10px] text-text-dim gap-4">
        <span>© 2026-2027 Проект myJournal.</span>
        <div className="flex gap-4">
          <span className="hover:underline cursor-pointer">Правила пользования</span>
          <span className="hover:underline cursor-pointer">Безопасность API</span>
          <span className="hover:underline cursor-pointer">Политика конфиденциальности</span>
        </div>
      </div>
    </footer>
  );
}
