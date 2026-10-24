import { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import InteractiveGlowCard from './InteractiveGlowCard';
import { apiFetch } from '../../lib/api';

interface RewardItem {
  date: string;
  amount: number;
  type: 'DIAMOND' | 'COIN';
  achievementName: string;
  action: number;
  badge: number;
}

const ACHIEVEMENT_TRANSLATIONS: Record<string, string> = {
  'WORK_IN_CLASS': 'Поощрение от преподавателя за работу на уроке',
  'HOMETASK_INTIME': 'Сдача ДЗ вовремя',
  'INTIME_LABORATORY_WORK': 'Сдача лаб. работы вовремя',
  'REDO_HOMETASK': 'Пересдача ДЗ',
  'PAIR_VISIT': 'Посещение пары',
  'EVALUATION_LESSON_MARK': 'Оценка занятия',
  'ASSESMENT': 'Оценка',
  '5_VISITS_WITHOUT_GAP': 'Серия 5 посещений',
  '10_VISITS_WITHOUT_GAP': 'Серия 10 посещений',
  '20_VISITS_WITHOUT_GAP': 'Серия 20 посещений',
  '5_VISITS_WITHOUT_DELAY': '5 посещений без опозданий',
  '10_VISITS_WITHOUT_DELAY': '10 посещений без опозданий',
  '20_VISITS_WITHOUT_DELAY': '20 посещений без опозданий',
  'FILL_IN_PROFILE': 'Заполнение профиля',
  'SURVEY': 'Опрос',
  'COMPETITION': 'Соревнование',
  'MARKET_ORDER': 'Покупка в маркете',
  'AUTO_MARK_EXPIRED_HOMEWORK': 'Автооценка просроченного ДЗ',
  'UNCONFIRMED_ATTRIBUTE': 'Неподтвержденный атрибут'
};

const listContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  },
};

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const datePart = dateStr.split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

const SkeletonItem = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.6rem 0.75rem',
    borderRadius: '8px',
    background: 'rgb(var(--os-fg-rgb) / 0.01)',
    border: '1px solid rgb(var(--os-fg-rgb) / 0.02)',
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '60%' }}>
      <div className="skeleton-line animate-pulse" style={{ width: '40%', height: '8px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
      <div className="skeleton-line animate-pulse" style={{ width: '85%', height: '12px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: '20%', justifyContent: 'flex-end' }}>
      <div className="skeleton-line animate-pulse" style={{ width: '45%', height: '12px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
      <div className="skeleton-line animate-pulse" style={{ width: '16px', height: '16px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '50%' }} />
    </div>
  </div>
);

export default function AwardsWidget() {
  const [data, setData] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

  const containerRef = useRef<HTMLDivElement>(null);
  const isIntersecting = useInView(containerRef, { once: false, amount: 0.1 });
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    setIsInView(isIntersecting);
  }, [isIntersecting]);

  const fetchActivity = async () => {
    setLoading(true);
    setError(null);
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setError('Не найдена авторизация. Войдите в аккаунт заново.');
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch('/api/Leaderboard/activity');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Ошибка сервера (${res.status})`);
      }
      const list = await res.json();
      setData(list);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Не удалось загрузить историю наград.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const handleAwardClick = (e: React.MouseEvent<HTMLDivElement>, item: RewardItem) => {
    if ((window as any).triggerCelebration) {
      const burstType = item.type === 'COIN' ? 'coins' : 'gems';
      (window as any).triggerCelebration(e.clientX, e.clientY, burstType);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  return (
    <InteractiveGlowCard
      className="dash-card bento-col-4"
      containerRef={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
      glowColor="rgba(0, 230, 150, 0.08)"
      style={{
        background: 'var(--os-s1)',
        borderColor: 'rgb(var(--os-fg-rgb) / 0.05)',
      }}
    >
      <div className="dash-card-header" style={{ padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 className="dash-card-title">Ваши награды</h4>
        {!loading && error && (
          <button
            onClick={fetchActivity}
            style={{
              background: 'none',
              border: 'none',
              color: '#30ff44',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 230, 150, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '1rem' }}>
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
          <SkeletonItem />
        </div>
      ) : error ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
          textAlign: 'center',
          gap: '0.5rem',
          color: '#6b6b6b',
          marginTop: '1rem',
          border: '1px dashed rgb(var(--os-fg-rgb) / 0.05)',
          borderRadius: '8px',
          background: 'rgb(var(--os-fg-rgb) / 0.01)',
        }}>
          <AlertCircle size={24} style={{ color: '#30ff44' }} />
          <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{error}</div>
          <button
            onClick={fetchActivity}
            style={{
              marginTop: '0.5rem',
              background: 'rgba(0, 230, 150, 0.1)',
              border: '1px solid rgba(0, 230, 150, 0.2)',
              color: '#30ff44',
              borderRadius: '6px',
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 230, 150, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(0, 230, 150, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 230, 150, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 230, 150, 0.2)';
            }}
          >
            <RefreshCw size={12} />
            Повторить попытку
          </button>
        </div>
      ) : data.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem 1rem',
          color: '#6b6b6b',
          fontSize: '0.8rem',
          marginTop: '1rem',
          border: '1px dashed rgb(var(--os-fg-rgb) / 0.05)',
          borderRadius: '8px',
        }}>
          История наград пуста.
        </div>
      ) : (
        <>
          <motion.div
            variants={listContainerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            className="rewards-list"
          >
            {data.slice(0, visibleCount).map((item, index) => (
              <motion.div
                key={`${item.date}-${index}`}
                className={`reward-item-row ${item.type === 'COIN' ? 'coin' : 'gem'}`}
                variants={listItemVariants}
                onClick={(e) => handleAwardClick(e, item)}
                onMouseMove={handleMouseMove}
              >
                {/* Left: Date + Title */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.68rem', color: '#6b6b6b', fontFamily: "'Fira Code', monospace" }}>
                    {formatDate(item.date)}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--os-fg)', lineHeight: '1.25' }}>
                      {ACHIEVEMENT_TRANSLATIONS[item.achievementName] || item.achievementName.replace(/_/g, ' ')}
                    </span>
                    {item.badge === 1 && (
                      <span title="Особая награда!" style={{ display: 'inline-flex', alignItems: 'center', color: '#7dffc4', flexShrink: 0 }}>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                          <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Points + Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.82rem', flexShrink: 0 }}>
                  <span style={{
                    color: item.action === 0 
                      ? '#6b6b6b' 
                      : (item.type === 'COIN' ? '#30ff44' : '#7dffc4'),
                    fontFamily: "'Fira Code', monospace"
                  }}>
                    {item.action === 0 ? '-' : '+'}{item.amount}
                  </span>
                  <div style={{ opacity: item.action === 0 ? 0.45 : 1, display: 'flex', alignItems: 'center' }}>
                    {item.type === 'COIN' ? (
                      /* Orange Coin Icon */
                      <img 
                        src="/top-coin.png" 
                        alt="" 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          display: 'block',
                          filter: 'drop-shadow(0 0 4px rgba(0, 230, 150, 0.4))'
                        }}
                      />
                    ) : (
                      /* Green Gem Icon */
                      <img 
                        src="/top-gem.png" 
                        alt="" 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          display: 'block',
                          filter: 'drop-shadow(0 0 4px rgba(125, 255, 196, 0.4))'
                        }}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
          {visibleCount < data.length && (
            <button
              onClick={() => setVisibleCount((prev) => prev + 50)}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.55rem',
                background: 'rgb(var(--os-fg-rgb) / 0.01)',
                border: '1px solid rgb(var(--os-fg-rgb) / 0.04)',
                borderRadius: '8px',
                color: '#6b6b6b',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 230, 150, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(0, 230, 150, 0.15)';
                e.currentTarget.style.color = '#30ff44';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 230, 150, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgb(var(--os-fg-rgb) / 0.01)';
                e.currentTarget.style.borderColor = 'rgb(var(--os-fg-rgb) / 0.04)';
                e.currentTarget.style.color = '#6b6b6b';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Показать еще (+50)
            </button>
          )}
        </>
      )}
    </InteractiveGlowCard>
  );
}
