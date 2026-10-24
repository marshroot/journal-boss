import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { ChevronsUp, AlertCircle, RefreshCw } from 'lucide-react';
import InteractiveGlowCard from './InteractiveGlowCard';
import { apiFetch } from '../../lib/api';

interface LeaderEntry {
  rank: number;
  name: string;
  points: number;
  avatar: string;
  isSelf?: boolean;
  hasIncrease?: boolean;
  isDivider?: boolean;
}

// 2x slower stagger orchestration
const listContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// 2x slower item slide-in animation
const listItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

// Default avatar initials helper
function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

export default function LeaderboardWidget() {
  const [tab, setTab] = useState<'group' | 'flow'>('group');

  const containerRef = useRef<HTMLDivElement>(null);
  const isIntersecting = useInView(containerRef, { once: false, amount: 0.1 });
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    setIsInView(isIntersecting);
  }, [isIntersecting]);
  const [groupData, setGroupData] = useState<LeaderEntry[]>([]);
  const [flowData, setFlowData] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selfRowRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Hover avatar preview state
  const [previewUser, setPreviewUser] = useState<{
    avatar: string;
    name: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
    isFallback: boolean;
    initials: string;
  } | null>(null);

  const hoverTimeoutRef = useRef<any>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleAvatarMouseEnter = (
    e: React.MouseEvent,
    avatar: string,
    name: string,
    isFallback: boolean
  ) => {
    // Instantly preload the avatar image over the network during the 300ms hover delay
    if (avatar) {
      const img = new Image();
      img.src = avatar;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 180;
    const popupHeight = 220;

    // Position popup to the left of the avatar, aligned to top/bottom of it (Math.max prevents going above screen)
    // Shifted 4px closer (from -6 to -2)
    const x = rect.left - popupWidth - 2;
    const y = Math.max(12, rect.bottom - popupHeight);

    // Calculate avatar center point relative to viewport
    const avatarCenterX = rect.left + rect.width / 2;
    const avatarCenterY = rect.top + rect.height / 2;

    // Calculate transform origin relative to popup's top-left corner
    const originX = avatarCenterX - x;
    const originY = avatarCenterY - y;

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    hoverTimeoutRef.current = setTimeout(() => {
      setPreviewUser({
        avatar,
        name,
        x,
        y,
        originX,
        originY,
        isFallback,
        initials: getInitials(name)
      });
    }, 300); // 0.3 second delay
  };

  const handleAvatarMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setPreviewUser(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  const fetchLeaderboards = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupRes, streamRes] = await Promise.all([
        apiFetch('/api/Leaderboard/group'),
        apiFetch('/api/Leaderboard/stream')
      ]);

      if (!groupRes.ok) {
        const errData = await groupRes.json().catch(() => ({}));
        throw new Error(errData.message || `Ошибка сервера (${groupRes.status})`);
      }
      if (!streamRes.ok) {
        const errData = await streamRes.json().catch(() => ({}));
        throw new Error(errData.message || `Ошибка сервера (${streamRes.status})`);
      }

      const groupList = await groupRes.json();
      const streamList = await streamRes.json();

      setGroupData(groupList);
      setFlowData(streamList);
    } catch (err: any) {
      console.error('[Leaderboard] Failed to load:', err);
      setError(err.message || 'Ошибка подключения к серверу.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const data = tab === 'group' ? groupData : flowData;
  const selfEntry = data.find(e => e.isSelf);
  const selfPoints = selfEntry?.points;

  // Auto-scroll to the logged-in student (self) row INSIDE the scrollable container only (not the whole page)
  useEffect(() => {
    if (!loading && data.length > 0) {
      const timer = setTimeout(() => {
        if (selfRowRef.current && listRef.current) {
          const container = listRef.current;
          const row = selfRowRef.current;
          const containerTop = container.getBoundingClientRect().top;
          const rowTop = row.getBoundingClientRect().top;
          const relativeRowTop = rowTop - containerTop + container.scrollTop;
          const targetScrollTop = relativeRowTop - (container.clientHeight / 2) + (row.clientHeight / 2);
          
          container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [tab, loading, groupData, flowData, data]);

  return (
    <InteractiveGlowCard
      className="dash-card bento-col-8"
      containerRef={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      glowColor="rgba(0, 255, 194, 0.06)"
      style={{
        background: 'var(--os-s1)',
        borderColor: 'rgb(var(--os-fg-rgb) / 0.05)',
      }}
    >
      <div className="dash-card-header" style={{ padding: 0 }}>
        <h4 className="dash-card-title">Таблица лидеров</h4>
        <div className="tab-switch">
          <button
            className={`tab-switch-item ${tab === 'group' ? 'active' : ''}`}
            onClick={() => setTab('group')}
          >
            Группа
          </button>
          <button
            className={`tab-switch-item ${tab === 'flow' ? 'active' : ''}`}
            onClick={() => setTab('flow')}
          >
            Поток
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '1rem' }}>
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="leaderboard-row"
              style={{
                height: '68px',
                background: 'rgb(var(--os-fg-rgb) / 0.01)',
                borderColor: 'rgb(var(--os-fg-rgb) / 0.02)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                borderRadius: '12px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                width: '24px',
                height: '14px',
                background: 'rgb(var(--os-fg-rgb) / 0.04)',
                borderRadius: '3px'
              }} className="animate-pulse" />
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgb(var(--os-fg-rgb) / 0.04)',
                marginLeft: '12px'
              }} className="animate-pulse" />
              <div style={{
                width: '180px',
                height: '14px',
                background: 'rgb(var(--os-fg-rgb) / 0.04)',
                borderRadius: '3px',
                marginLeft: '16px'
              }} className="animate-pulse" />
              <div style={{
                width: '40px',
                height: '14px',
                background: 'rgb(var(--os-fg-rgb) / 0.04)',
                borderRadius: '3px',
                marginLeft: 'auto'
              }} className="animate-pulse" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '2.5rem 1rem',
          textAlign: 'center',
          color: '#30ff44'
        }}>
          <AlertCircle size={28} />
          <p style={{ fontSize: '0.85rem', color: '#7dffc4', margin: 0 }}>{error}</p>
          <button
            onClick={fetchLeaderboards}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'rgba(0, 230, 150, 0.1)',
              border: '1px solid rgba(0, 230, 150, 0.2)',
              borderRadius: '8px',
              color: '#30ff44',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 230, 150, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 230, 150, 0.1)'}
          >
            <RefreshCw size={14} />
            Попробовать снова
          </button>
        </div>
      ) : (
        <motion.div
          ref={listRef}
          key={tab} // Re-trigger animation when tab changes
          variants={listContainerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="leaderboard-list"
        >
          {data.map((entry, index) => {
            if (entry.isDivider) {
              return (
                <div key={`divider-${index}`} className="leaderboard-divider-row">
                  •••
                </div>
              );
            }
            return (
              <motion.div
                ref={entry.isSelf ? selfRowRef : null}
                key={entry.rank}
                className={`leaderboard-row ${entry.isSelf ? 'self' : ''}`}
                variants={listItemVariants}
                onMouseMove={handleMouseMove}
              >
                <span
                  className="leaderboard-rank"
                  style={entry.isSelf ? { color: '#30ff44' } : entry.rank <= 3 && tab === 'flow' ? { color: '#00ffc2' } : { color: '#6b6b6b' }}
                >
                  {entry.rank}.
                </span>
                
                {entry.avatar ? (
                  <img
                    src={entry.avatar}
                    alt=""
                    className="leaderboard-avatar"
                    onMouseEnter={(e) => handleAvatarMouseEnter(e, entry.avatar, entry.name, false)}
                    onMouseLeave={handleAvatarMouseLeave}
                  />
                ) : (
                  <div 
                    className="leaderboard-avatar-fallback"
                    onMouseEnter={(e) => handleAvatarMouseEnter(e, '', entry.name, true)}
                    onMouseLeave={handleAvatarMouseLeave}
                    style={entry.isSelf ? {
                      background: 'linear-gradient(135deg, #30ff44 0%, #30ff44 100%)'
                    } : {
                      background: 'linear-gradient(135deg, #30ff44 0%, #00ffc2 100%)'
                    }}
                  >
                    {getInitials(entry.name)}
                  </div>
                )}
                
                <span className="leaderboard-name" style={entry.isSelf ? { fontWeight: 700, color: 'var(--os-fg)' } : { color: 'var(--os-fg)' }}>
                  {entry.name}
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {entry.hasIncrease && (
                      <ChevronsUp size={14} style={{ color: '#7dffc4', display: 'inline-block' }} />
                    )}
                    <span
                      className="leaderboard-points"
                      style={entry.isSelf ? { color: 'var(--os-fg)', fontWeight: 700 } : { color: '#7dffc4' }}
                    >
                      {entry.points}
                    </span>
                  </div>
                  {!entry.isSelf && selfPoints !== undefined && (
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        marginTop: '1px',
                        color: (entry.points - selfPoints) > 0 ? '#ffaa00' : 'rgb(var(--os-fg-rgb) / 0.35)',
                        fontFamily: 'monospace'
                      }}
                    >
                      {(entry.points - selfPoints) > 0 ? `+${entry.points - selfPoints}` : entry.points - selfPoints}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
      {createPortal(
        <AnimatePresence>
          {previewUser && (
            <motion.div
              key={previewUser.name}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.3 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              style={{
                position: 'fixed',
                left: `${previewUser.x}px`,
                top: `${previewUser.y}px`,
                zIndex: 999999,
                transformOrigin: `${previewUser.originX}px ${previewUser.originY}px`,
                background: 'rgb(var(--os-bg-rgb) / 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgb(var(--os-fg-rgb) / 0.08)',
                borderRadius: '16px',
                padding: '0.75rem',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 255, 194, 0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem',
                pointerEvents: 'none',
                width: '180px',
              }}
            >
              {previewUser.isFallback ? (
                <div style={{
                  width: '156px',
                  height: '156px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #30ff44 0%, #00ffc2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3.5rem',
                  fontWeight: 'bold',
                  color: 'var(--os-fg)',
                }}>
                  {previewUser.initials}
                </div>
              ) : (
                <img
                  src={previewUser.avatar}
                  alt=""
                  style={{
                    width: '156px',
                    height: '156px',
                    borderRadius: '12px',
                    objectFit: 'cover',
                    border: '2px solid rgb(var(--os-fg-rgb) / 0.1)',
                    background: 'rgb(var(--os-fg-rgb) / 0.03)',
                  }}
                />
              )}
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--os-fg)',
                textAlign: 'center',
                lineHeight: '1.3',
              }}>
                {previewUser.name}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </InteractiveGlowCard>
  );
}
