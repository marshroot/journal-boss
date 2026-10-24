import { motion } from 'motion/react';
import { Compass, ArrowRight, ArrowDownRight } from 'lucide-react';

interface HeroProps {
  isDark: boolean;
  onExploreClick: () => void;
  onBookClick: () => void;
}

const EASE = [0.91, 0.03, 0.12, 1] as [number, number, number, number];

export default function Hero({ isDark, onExploreClick, onBookClick }: HeroProps) {
  void isDark;
  return (
    <section id="home" className="os-hero relative overflow-hidden pt-[88px]">
      <div className="os-hero-name-wrap">
        <motion.h1
          initial={{ y: '40%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.6, ease: EASE }}
          className="os-hero-name"
        >
          myJournal
        </motion.h1>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }} className="os-bar">
        <div className="os-bar-cell flex-[2.2] justify-center">✦ Электронный журнал колледжа</div>
        <div className="os-bar-cell flex-1 justify-center">
          Расписание <span className="text-[#30ff44] mx-1.5">+</span> оценки
        </div>
        <button onClick={onBookClick} className="os-bar-cta flex-1">
          Войти
          <ArrowRight className="w-5 h-5 os-arrow" />
        </button>
      </motion.div>

      <div className="os-hero-meta">
        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4, delay: 1, ease: EASE }} className="os-status">
          <span className="os-dot" /> Онлайн-уроки, доска и чаты группы
        </motion.div>
      </div>

      <div className="os-editorial" data-anim>
        <div className="os-vertical-label">Учебный процесс</div>
        <div>
          <h2 className="os-display">
            Вся учёба<br />
            <span className="os-grad-text">в одном месте.</span>
            <ArrowDownRight className="inline-block w-[0.5em] h-[0.5em] ml-6 text-[color:var(--os-muted)] stroke-[1.25]" />
          </h2>
        </div>
        <div className="os-editorial-side">
          <p>
            myJournal объединяет расписание, оценки, посещаемость, домашние задания, учебные материалы,
            онлайн-уроки с доской и чаты группы. Студенты, преподаватели, администраторы и родители работают в одном журнале.
          </p>
          <button onClick={onExploreClick} className="os-ghost mt-8">
            Обзор модулей
            <Compass className="w-4 h-4 text-[#30ff44]" />
          </button>
        </div>
      </div>

      <div className="os-stats" data-anim>
        <div><p className="os-num">4</p><p className="os-label">роли: студент, преподаватель, админ, родитель</p></div>
        <div><p className="os-num">Live</p><p className="os-label">видеоконференции и демонстрация экрана</p></div>
        <div><p className="os-num">24/7</p><p className="os-label">доступ к журналу и материалам</p></div>
      </div>

      <div className="os-marquee" aria-hidden="true">
        <div className="os-marquee-track">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i}>Расписание — <em>Оценки</em> — Онлайн-уроки — <em>Доска</em> — Чаты —&nbsp;</span>
          ))}
        </div>
      </div>
    </section>
  );
}
