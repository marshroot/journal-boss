import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AverageGradeWidget from '../components/journal/AverageGradeWidget';
import LeaderboardWidget from '../components/journal/LeaderboardWidget';
import HomeworkTracker from '../components/journal/HomeworkTracker';
import AttendanceWidget from '../components/journal/AttendanceWidget';
import AwardsWidget from '../components/journal/AwardsWidget';

export default function JournalDashboard() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return location.state?.activeTab || 'dashboard';
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Sync activeTab from route state
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Hardware-aware smart deferral to ensure smooth sidebar transition animation
  useEffect(() => {
    let idleId: any;
    
    const scheduleRender = () => {
      if (typeof (window as any).requestIdleCallback === 'function') {
        idleId = (window as any).requestIdleCallback(() => {
          setIsReady(true);
        }, { timeout: 200 }); // Maximum fallback timeout of 200ms
      } else {
        idleId = setTimeout(() => {
          setIsReady(true);
        }, 150);
      }
    };

    setIsReady(false);
    
    // Double requestAnimationFrame ensures that the browser has scheduled the transition
    // and performed at least one paint cycle before we start checking for idle time.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduleRender();
      });
    });

    return () => {
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, [activeTab]);

  return (
    <>
      {isReady && activeTab === 'dashboard' && (
        <div className="bento-grid">
          {/* Row 1: Average Grade + Attendance */}
          <AverageGradeWidget isFiltersOpen={isFiltersOpen} setIsFiltersOpen={setIsFiltersOpen} />
          <AttendanceWidget isFiltersOpen={isFiltersOpen} setIsFiltersOpen={setIsFiltersOpen} />

          {/* Row 2: Homework */}
          <HomeworkTracker />

          {/* Row 3: Leaderboard (moved to bottom) + Awards */}
          <LeaderboardWidget />
          <AwardsWidget />
        </div>
      )}

      {/* Placeholder tabs */}
      {isReady && activeTab !== 'dashboard' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}>
          <div className="dash-card" style={{
            maxWidth: '480px',
            textAlign: 'center',
            padding: '3rem',
            background: 'var(--os-s1)',
            borderColor: 'rgb(var(--os-fg-rgb) / 0.05)',
          }}>
            <h3 style={{
              color: '#30ff44',
              marginBottom: '1rem',
              fontFamily: "'Fira Code', monospace",
              fontSize: '1.2rem',
            }}>
              [{activeTab.toUpperCase()}]
            </h3>
            <p style={{
              color: '#7dffc4',
              maxWidth: '400px',
              margin: '0 auto',
              lineHeight: 1.6,
              fontSize: '0.85rem',
            }}>
              Раздел находится в разработке. Следите за обновлениями — мы активно работаем над улучшением функционала мода.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
