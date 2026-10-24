import { apiFetch } from '../../lib/api';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Search, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import InteractiveGlowCard from './InteractiveGlowCard';
import { API_BASE } from '../../lib/apiBase';

interface HomeworkItem {
  id: number;
  name_spec: string;
  theme: string;
  completion_time: string | null;
  creation_time: string | null;
  status: number;
  homework_stud: any;
  fetchedType: number;
  apiStatus: number;
}

const getHomeworkStatus = (hw: any) => {
  if (hw.status === 5) {
    return 5;
  }
  if (hw.homework_stud) {
    if (hw.homework_stud.mark !== null && hw.homework_stud.mark !== undefined) {
      return 1;
    }
    return 2;
  }
  if (hw.completion_time) {
    const cleanDateStr = hw.completion_time.replace(' ', 'T');
    const deadlineDate = new Date(cleanDateStr);
    deadlineDate.setHours(23, 59, 59, 999);
    const now = new Date();
    if (deadlineDate < now) {
      return 0;
    }
  }
  return 3;
};

const getStatusBadge = (status: number) => {
  switch (status) {
    case 5:
      return {
        text: 'Удалено преподавателем',
        color: '#6b6b6b',
        glow: 'rgba(109, 100, 87, 0.2)',
        bg: 'rgba(109, 100, 87, 0.05)'
      };
    case 0:
      return {
        text: 'Просрочено',
        color: '#ff5555',
        glow: 'rgba(255, 85, 85, 0.25)',
        bg: 'rgba(255, 85, 85, 0.05)'
      };
    case 1:
      return {
        text: 'Проверено',
        color: 'var(--accent-purple-muted, #7dffc4)',
        glow: 'rgba(125, 255, 196, 0.25)',
        bg: 'rgba(125, 255, 196, 0.05)'
      };
    case 2:
      return {
        text: 'На проверке',
        color: '#30ff44',
        glow: 'rgba(255, 145, 0, 0.25)',
        bg: 'rgba(255, 145, 0, 0.05)'
      };
    case 3:
    default:
      return {
        text: 'Текущее',
        color: 'var(--accent-purple-soft, #00ffc2)',
        glow: 'rgba(0, 255, 194, 0.25)',
        bg: 'rgba(0, 255, 194, 0.05)'
      };
  }
};

const pluralizeDays = (days: number) => {
  const absDays = Math.abs(days);
  const lastDigit = absDays % 10;
  const lastTwoDigits = absDays % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${absDays} дней`;
  }
  if (lastDigit === 1) {
    return `${absDays} день`;
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${absDays} дня`;
  }
  return `${absDays} дней`;
};

const getRelativeDateString = (dateStr: string | null) => {
  if (!dateStr) return '—';
  try {
    const cleanDateStr = dateStr.replace(' ', 'T');
    const targetDate = new Date(cleanDateStr);
    if (isNaN(targetDate.getTime())) return dateStr;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    
    const diffMs = targetDay.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'сегодня';
    if (diffDays === 1) return 'завтра';
    if (diffDays === -1) return 'вчера';
    
    if (diffDays > 0) {
      return `через ${pluralizeDays(diffDays)}`;
    } else {
      return `${pluralizeDays(Math.abs(diffDays))} назад`;
    }
  } catch (e) {
    return dateStr;
  }
};

const formatCompletionTime = (timeStr: string | null) => {
  if (!timeStr) return '—';
  try {
    const datePart = timeStr.split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return datePart;
  } catch (e) {
    return timeStr;
  }
};

const compareHomeworks = (a: any, b: any) => {
  const dateA = new Date((a.creation_time || a.completion_time || '').replace(' ', 'T')).getTime() || 0;
  const dateB = new Date((b.creation_time || b.completion_time || '').replace(' ', 'T')).getTime() || 0;
  return dateB - dateA; // Descending (newest first)
};

const filterHomeworks = (items: any[]) => {
  return items.filter(hw => {
    const status = getHomeworkStatus(hw);
    if (status === 3) return true;
    if (status === 0) {
      // If it's a lab, check if it's older than 6 months (180 days)
      if (hw.fetchedType === 1) {
        const targetDateStr = hw.creation_time || hw.completion_time;
        if (!targetDateStr) return false;
        const targetDate = new Date(targetDateStr.replace(' ', 'T'));
        const now = new Date();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setDate(now.getDate() - 180);
        if (targetDate < sixMonthsAgo) return false;
      }
      return true;
    }
    if (status === 5) {
      if (hw.homework_stud) return false;
      
      const targetDateStr = hw.creation_time || hw.completion_time;
      if (!targetDateStr) return false;
      const targetDate = new Date(targetDateStr.replace(' ', 'T'));
      const now = new Date();
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(now.getDate() - 180);
      return targetDate >= sixMonthsAgo;
    }
    return false;
  });
};

// 2x slower container stagger delay
const listContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.16,
    },
  },
};

// 2x slower item fade-up duration
const listItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function HomeworkTracker() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isIntersecting = useInView(containerRef, { once: false, amount: 0.1 });
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    setIsInView(isIntersecting);
  }, [isIntersecting]);

  useEffect(() => {
    const fetchTrackerData = async () => {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        setLoading(false);
        return;
      }
      try {
        const urls = [
          `${API_BASE}/api/Homework/list?status=3&type=0&page=1`,
          `${API_BASE}/api/Homework/list?status=3&type=1&page=1`,
          `${API_BASE}/api/Homework/list?status=0&type=0&page=1`,
          `${API_BASE}/api/Homework/list?status=0&type=1&page=1`,
          `${API_BASE}/api/Homework/list?status=5&type=0&page=1`,
          `${API_BASE}/api/Homework/list?status=5&type=1&page=1`
        ];
        
        const fetchDataset = async (url: string, index: number) => {
          try {
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, index * 60));
            }
            const res = await apiFetch(url.replace(API_BASE, ''));
            if (res.ok) {
              const data = await res.json();
              return Array.isArray(data) ? data : [];
            }
            console.warn(`[HomeworkTracker] HTTP error ${res.status} for ${url}`);
          } catch (err) {
            console.error(`[HomeworkTracker] Fetch failed for ${url}:`, err);
          }
          return [];
        };

        const datasets = await Promise.all(urls.map((url, idx) => fetchDataset(url, idx)));
        
        const currentHws = (datasets[0] || []).map((item: any) => ({ ...item, fetchedType: 0, apiStatus: 3 }));
        const currentLabs = (datasets[1] || []).map((item: any) => ({ ...item, fetchedType: 1, apiStatus: 3 }));
        const overdueHws = (datasets[2] || []).map((item: any) => ({ ...item, fetchedType: 0, apiStatus: 0 }));
        const overdueLabs = (datasets[3] || []).map((item: any) => ({ ...item, fetchedType: 1, apiStatus: 0 }));
        const deletedHws = (datasets[4] || []).map((item: any) => ({ ...item, fetchedType: 0, apiStatus: 5 }));
        const deletedLabs = (datasets[5] || []).map((item: any) => ({ ...item, fetchedType: 1, apiStatus: 5 }));
        
        // Merge and deduplicate by id
        const mergedMap = new Map<number, any>();
        [...currentHws, ...currentLabs, ...overdueHws, ...overdueLabs, ...deletedHws, ...deletedLabs].forEach(item => {
          mergedMap.set(item.id, item);
        });
        
        const merged = Array.from(mergedMap.values());
        
        // Filter & Sort purely chronologically (no status grouping)
        const filteredMerged = filterHomeworks(merged);
        
        filteredMerged.sort(compareHomeworks);
        
        setHomeworks(filteredMerged);
        const anyHasMore = datasets.some(data => Array.isArray(data) && data.length >= 6);
        setHasMore(filteredMerged.length > 0 ? anyHasMore : false);
      } catch (err) {
        console.error('[HomeworkTracker] Error fetching tracker data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTrackerData();
  }, []);

  const handleLoadMore = async () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;

    const nextPage = page + 1;
    setLoadingMore(true);

    try {
      const urls = [
        `${API_BASE}/api/Homework/list?status=3&type=0&page=${nextPage}`,
        `${API_BASE}/api/Homework/list?status=3&type=1&page=${nextPage}`,
        `${API_BASE}/api/Homework/list?status=0&type=0&page=${nextPage}`,
        `${API_BASE}/api/Homework/list?status=0&type=1&page=${nextPage}`,
        `${API_BASE}/api/Homework/list?status=5&type=0&page=${nextPage}`,
        `${API_BASE}/api/Homework/list?status=5&type=1&page=${nextPage}`
      ];

      const fetchDataset = async (url: string, index: number) => {
        try {
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, index * 60));
          }
          const res = await apiFetch(url.replace(API_BASE, ''));
          if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data : [];
          }
          console.warn(`[HomeworkTracker] LoadMore HTTP error ${res.status} for ${url}`);
        } catch (err) {
          console.error(`[HomeworkTracker] LoadMore Fetch failed for ${url}:`, err);
        }
        return [];
      };

      const datasets = await Promise.all(urls.map((url, idx) => fetchDataset(url, idx)));

      const currentHws = (datasets[0] || []).map((item: any) => ({ ...item, fetchedType: 0, apiStatus: 3 }));
      const currentLabs = (datasets[1] || []).map((item: any) => ({ ...item, fetchedType: 1, apiStatus: 3 }));
      const overdueHws = (datasets[2] || []).map((item: any) => ({ ...item, fetchedType: 0, apiStatus: 0 }));
      const overdueLabs = (datasets[3] || []).map((item: any) => ({ ...item, fetchedType: 1, apiStatus: 0 }));
      const deletedHws = (datasets[4] || []).map((item: any) => ({ ...item, fetchedType: 0, apiStatus: 5 }));
      const deletedLabs = (datasets[5] || []).map((item: any) => ({ ...item, fetchedType: 1, apiStatus: 5 }));

      // 1. Process new items of this page only
      const newMergedMap = new Map<number, any>();
      [...currentHws, ...currentLabs, ...overdueHws, ...overdueLabs, ...deletedHws, ...deletedLabs].forEach(item => {
        newMergedMap.set(item.id, item);
      });
      const newMerged = Array.from(newMergedMap.values());

      // 2. Filter & Sort new items
      const filteredNewPageItems = filterHomeworks(newMerged);
      filteredNewPageItems.sort(compareHomeworks);

      setHomeworks(prev => {
        // 3. Filter out items that are already in prev to avoid duplicates
        const uniqueNewPageItems = filteredNewPageItems.filter(newItem => !prev.some(existing => existing.id === newItem.id));

        // 4. Append to the end of prev so they strictly appear at the bottom
        return [...prev, ...uniqueNewPageItems];
      });

      const anyHasMore = datasets.some(data => Array.isArray(data) && data.length >= 6);
      setHasMore(filteredNewPageItems.length > 0 ? anyHasMore : false);
      setPage(nextPage);
    } catch (err) {
      console.error('[HomeworkTracker] Error loading more tracker data:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = homeworks.filter(
    (hw) =>
      (hw.name_spec || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (hw.theme || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleItemClick = (hw: HomeworkItem) => {
    navigate('/homework', {
      state: {
        activeTab: 'homework',
        selectedHwId: hw.id,
        selectedStatus: hw.apiStatus,
        selectedType: hw.fetchedType
      }
    });
  };

  return (
    <InteractiveGlowCard
      className="dash-card bento-col-8"
      containerRef={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      glowColor="rgba(0, 255, 194, 0.08)"
      style={{
        background: 'var(--os-s1)',
        borderColor: 'rgb(var(--os-fg-rgb) / 0.05)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div className="dash-card-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem', padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 className="dash-card-title">Домашние задания</h4>
          <span style={{ fontSize: '0.68rem', color: '#6b6b6b', fontFamily: "'Fira Code', monospace" }}>
            Доступно: {homeworks.length}{hasMore ? '+' : ''} дз
          </span>
        </div>
        <div className="journal-search">
          <Search size={14} style={{ color: '#6b6b6b', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Поиск по предмету или теме..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <motion.div
        variants={listContainerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="hw-tracker-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          marginTop: '1rem',
          flex: 1,
          overflowY: 'auto',
          maxHeight: '340px'
        }}
      >
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="hw-item animate-pulse"
                style={{
                  height: '76px',
                  background: 'rgb(var(--os-fg-rgb) / 0.015)',
                  border: '1px solid rgb(var(--os-fg-rgb) / 0.04)',
                  borderRadius: '10px'
                }}
              />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((hw) => {
              const calculatedStatus = getHomeworkStatus(hw);
              const badge = getStatusBadge(calculatedStatus);
              return (
                <motion.div
                  key={hw.id}
                  className="hw-item"
                  layout
                  variants={listItemVariants}
                  exit={{ opacity: 0, x: 50, scale: 0.95, transition: { duration: 0.44 } }} // 2x slower exit (0.22s * 2 = 0.44s)
                  onClick={() => handleItemClick(hw)}
                  style={{ display: 'flex', width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hw-subject">{hw.name_spec}</div>
                    <div className="hw-name" style={{ wordBreak: 'break-word' }}>{hw.theme}</div>
                    <div className="hw-deadline" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      <span>Срок сдачи: {formatCompletionTime(hw.completion_time)} ({getRelativeDateString(hw.completion_time)})</span>
                      <span
                        className="hw-badge"
                        style={{
                          color: badge.color,
                          boxShadow: `0 0 8px ${badge.glow}`,
                          background: badge.bg,
                          borderColor: badge.color,
                          fontSize: '0.68rem',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          border: '1px solid currentColor',
                          fontWeight: 600,
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {badge.text}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {!loading && hasMore && (
          <button
            className="btn-journal secondary"
            style={{
              margin: '1rem auto 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '0.72rem',
              background: 'rgba(0, 230, 150, 0.04)',
              border: '1px solid rgba(0, 230, 150, 0.2)',
              color: 'var(--accent-purple)',
              cursor: 'pointer'
            }}
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <span>Показать еще</span>
            )}
          </button>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#6b6b6b', fontSize: '0.82rem' }}>
            Ничего не найдено
          </div>
        )}
      </motion.div>
    </InteractiveGlowCard>
  );
}
