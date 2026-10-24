import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate, useInView } from 'motion/react';
import { SlidersHorizontal } from 'lucide-react';
import InteractiveGlowCard from './InteractiveGlowCard';
import { apiFetch } from '../../lib/api';

interface AttendanceWidgetProps {
  isFiltersOpen: boolean;
  setIsFiltersOpen: (open: boolean) => void;
}

interface Visit {
  date_visit: string;
  spec_name: string;
  teacher_name?: string;
  lesson_theme?: string;
  status_was?: number | null;
}

const getBarPath = (x: number, y: number, width: number, yBottom: number, r: number) => {
  const height = yBottom - y;
  const radius = Math.min(r, height, width / 2);
  if (radius <= 0) {
    return `M ${x} ${yBottom} L ${x} ${y} L ${x + width} ${y} L ${x + width} ${yBottom} Z`;
  }
  return `M ${x} ${yBottom} L ${x} ${y + radius} A ${radius} ${radius} 0 0 1 ${x + radius} ${y} L ${x + width - radius} ${y} A ${radius} ${radius} 0 0 1 ${x + width} ${y + radius} L ${x + width} ${yBottom} Z`;
};

export default function AttendanceWidget({ isFiltersOpen, setIsFiltersOpen }: AttendanceWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  // Filter States
  const [selectedPeriod, setSelectedPeriod] = useState<'semester' | '3months' | '6months' | 'alltime'>('semester');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [lateStatus, setLateStatus] = useState<'present' | 'absent' | 'exclude'>('present');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setError('Не найдена авторизация. Войдите в аккаунт заново.');
      setLoading(false);
      return;
    }

    const visitsCacheKey = 'visits_data_jwt';
    const cachedVisits = sessionStorage.getItem(visitsCacheKey);
    let hasCache = false;

    if (cachedVisits) {
      try {
        setVisits(JSON.parse(cachedVisits));
        setLoading(false);
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached visits data', e);
      }
    }

    let isMounted = true;
    apiFetch('/api/Leaderboard/visits')
      .then(res => {
        if (!res.ok) throw new Error('Не удалось загрузить историю журнала.');
        return res.json();
      })
      .then(vData => {
        if (isMounted) {
          setVisits(vData);
          sessionStorage.setItem(visitsCacheKey, JSON.stringify(vData));
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted && !hasCache) {
          setError(err.message || 'Ошибка при получении данных.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Unique list of subjects
  const subjects = Array.from(new Set(visits.map(v => v.spec_name).filter(Boolean))).sort();

  // Helper date calculations
  const getSemesterStart = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    if (month >= 9 && month <= 11) {
      return new Date(now.getFullYear(), 8, 1);
    } else if (month === 12) {
      return new Date(now.getFullYear(), 11, 1);
    } else {
      return new Date(now.getFullYear() - 1, 11, 1);
    }
  };

  const get3MonthsAgo = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d;
  };

  const get6MonthsAgo = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d;
  };

  // Client-side filtering & aggregation
  const getFilteredAttendance = () => {
    let filtered = visits;

    // 1. Filter by subject
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(v => v.spec_name === selectedSubject);
    }

    // 2. Filter by period
    let startDate: Date | null = null;
    if (selectedPeriod === 'semester') {
      startDate = getSemesterStart();
    } else if (selectedPeriod === '3months') {
      startDate = get3MonthsAgo();
    } else if (selectedPeriod === '6months') {
      startDate = get6MonthsAgo();
    }

    if (startDate) {
      filtered = filtered.filter(v => {
        if (!v.date_visit) return false;
        const dv = new Date(v.date_visit);
        return dv >= startDate!;
      });
    }

    // Calculate totalClasses and missed based on lateStatus rules
    let totalClasses = 0;
    let missed = 0;

    for (const v of filtered) {
      if (v.status_was === undefined || v.status_was === null) continue;
      const status = Number(v.status_was);

      if (status === 0 || status === 1 || status === 2) {
        if (status === 2) {
          // Late arrival
          if (lateStatus === 'present') {
            totalClasses++;
          } else if (lateStatus === 'absent') {
            totalClasses++;
            missed++;
          } else if (lateStatus === 'exclude') {
            // Do not add to totalClasses, do not add to missed
          }
        } else {
          totalClasses++;
          if (status === 0) {
            missed++;
          }
        }
      }
    }

    const attendancePercent = totalClasses > 0 ? Math.round(((totalClasses - missed) / totalClasses) * 100) : 0;

    // 3. Group by month for chart
    const monthlyStats: { [key: string]: { total: number; missed: number } } = {};

    for (const v of filtered) {
      if (!v.date_visit || v.status_was === undefined || v.status_was === null) continue;
      const dv = new Date(v.date_visit);
      if (isNaN(dv.getTime())) continue;

      const year = dv.getFullYear();
      const month = String(dv.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      const status = Number(v.status_was);
      if (status === 0 || status === 1 || status === 2) {
        if (!monthlyStats[key]) {
          monthlyStats[key] = { total: 0, missed: 0 };
        }

        if (status === 2) {
          if (lateStatus === 'present') {
            monthlyStats[key].total++;
          } else if (lateStatus === 'absent') {
            monthlyStats[key].total++;
            monthlyStats[key].missed++;
          } else if (lateStatus === 'exclude') {
            // skip
          }
        } else {
          monthlyStats[key].total++;
          if (status === 0) {
            monthlyStats[key].missed++;
          }
        }
      }
    }

    const sortedKeys = Object.keys(monthlyStats).sort();
    const chartData: number[] = [];
    const months: string[] = [];
    const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

    for (const key of sortedKeys) {
      const stats = monthlyStats[key];
      if (stats.total > 0) {
        const pct = Math.round(((stats.total - stats.missed) / stats.total) * 100);
        chartData.push(pct);

        const [yearStr, monthStr] = key.split('-');
        const monthIndex = parseInt(monthStr, 10) - 1;
        const shortYear = yearStr.slice(-2);
        months.push(selectedPeriod === 'alltime' ? `${monthNames[monthIndex]} '${shortYear}` : monthNames[monthIndex]);
      }
    }

    // Limit to last 8 active months (except for 'alltime' to show full history)
    let finalChartData = chartData;
    let finalMonths = months;
    if (selectedPeriod !== 'alltime' && chartData.length > 8) {
      finalChartData = chartData.slice(-8);
      finalMonths = months.slice(-8);
    }

    // Calculate diff (last month vs previous month)
    let diffText = "+0% за месяц";
    if (finalChartData.length >= 2) {
      const last = finalChartData[finalChartData.length - 1];
      const prev = finalChartData[finalChartData.length - 2];
      const diff = last - prev;
      diffText = `${diff >= 0 ? '+' : ''}${diff}% за месяц`;
    }

    return {
      attendancePercent,
      totalClasses,
      missed,
      chartData: finalChartData,
      months: finalMonths,
      diffText
    };
  };

  const {
    attendancePercent,
    totalClasses,
    missed,
    chartData,
    months,
    diffText
  } = getFilteredAttendance();

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isIntersecting = useInView(containerRef, { once: false, amount: 0.1 });
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    setIsInView(isIntersecting);
  }, [isIntersecting]);

  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    if (!loading && isInView) {
      setAnimatedValue(0);
      const controls = animate(0, attendancePercent, {
        duration: 1.2,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (latest) => {
          setAnimatedValue(Math.round(latest));
        }
      });
      return controls.stop;
    }
  }, [attendancePercent, loading, isInView]);

  const svgWidth = 600;
  const svgHeight = 130;
  const paddingLeft = 45;
  const paddingRight = 4; // Minimal padding to prevent clipping of the rightmost dot
  const paddingTop = 15;
  const paddingBottom = 25;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Dynamically calculate minVal/maxVal and grid lines based on actual chart data (similar to AverageGradeWidget)
  const minDataVal = chartData.length > 0 ? Math.min(...chartData) : 70;
  let minVal = 70;
  let gridVals = [70, 80, 90, 100];

  if (minDataVal < 70) {
    if (minDataVal >= 50) {
      minVal = 50;
      gridVals = [50, 60, 70, 80, 90, 100];
    } else if (minDataVal >= 30) {
      minVal = 30;
      gridVals = [30, 40, 50, 60, 70, 80, 90, 100];
    } else {
      minVal = 0;
      gridVals = [0, 20, 40, 60, 80, 100];
    }
  }

  const maxVal = 100;

  const points = chartData.map((val, i) => ({
    x: paddingLeft + (i / Math.max(1, chartData.length - 1)) * chartWidth,
    y: paddingTop + chartHeight - ((val - minVal) / Math.max(1, maxVal - minVal)) * chartHeight,
  }));

  // Generate smooth cubic bezier curve path
  let linePath = '';
  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaPath = points.length > 0 ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z` : '';


  if (error) {
    return (
      <InteractiveGlowCard
        className="dash-card bento-col-6"
        glowColor="rgba(0, 255, 194, 0.08)"
        contentClassName="chart-layout"
        style={{
          background: 'var(--os-s1)',
          borderColor: 'rgba(0, 255, 194, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          color: 'rgb(var(--os-fg-rgb) / 0.5)',
          padding: '2rem',
          textAlign: 'center'
        }}
      >
        <p style={{ color: '#ff5555', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Ошибка загрузки посещаемости</p>
        <p style={{ fontSize: '0.75rem', color: 'rgb(var(--os-fg-rgb)/0.4)' }}>{error}</p>
      </InteractiveGlowCard>
    );
  }

  const isDiffPositive = diffText ? !diffText.startsWith('-') : true;

  return (
    <InteractiveGlowCard
      className="dash-card bento-col-6"
      containerRef={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      glowColor="rgba(0, 255, 194, 0.08)"
      contentClassName="chart-layout"
      style={{
        background: 'var(--os-s1)',
        borderColor: 'rgb(var(--os-fg-rgb) / 0.05)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
      }}
    >
      <div>
        <div className="dash-card-header">
          <h4 className="dash-card-title">Посещаемость занятий</h4>
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="filter-toggle-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: isFiltersOpen ? 'rgb(var(--os-fg-rgb)/0.08)' : 'transparent',
              border: '1px solid rgb(var(--os-fg-rgb) / 0.08)',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '0.72rem',
              color: 'var(--os-fg)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <SlidersHorizontal size={12} /> Фильтры
          </button>
        </div>

        {/* Collapsible Filter Panel */}
        <AnimatePresence>
          {isFiltersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{
                overflow: 'hidden',
                borderBottom: '1px solid rgb(var(--os-fg-rgb)/0.05)',
                paddingBottom: '0.75rem',
                marginBottom: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.6rem'
              }}
            >
              {/* Row 1: Period & Chart Type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '0.65rem', color: 'rgb(var(--os-fg-rgb)/0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Период</label>
                  <div style={{ display: 'flex', background: 'rgb(var(--os-fg-rgb)/0.03)', borderRadius: '6px', padding: '2px', border: '1px solid rgb(var(--os-fg-rgb)/0.05)' }}>
                    {(['semester', '3months', '6months', 'alltime'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setSelectedPeriod(p)}
                        style={{
                          flex: 1,
                          background: selectedPeriod === p ? 'rgb(var(--os-fg-rgb)/0.1)' : 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: selectedPeriod === p ? '#ffffff' : 'rgb(var(--os-fg-rgb)/0.5)',
                          fontSize: '0.68rem',
                          padding: '4px 6px',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {p === 'semester' ? 'Семестр' : p === '3months' ? '3 мес' : p === '6months' ? '6 мес' : 'Всё'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: '90px' }}>
                  <label style={{ fontSize: '0.65rem', color: 'rgb(var(--os-fg-rgb)/0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Вид графика</label>
                  <div style={{ display: 'flex', background: 'rgb(var(--os-fg-rgb)/0.03)', borderRadius: '6px', padding: '2px', border: '1px solid rgb(var(--os-fg-rgb)/0.05)' }}>
                    <button
                      onClick={() => setChartType('line')}
                      style={{
                        background: chartType === 'line' ? 'rgb(var(--os-fg-rgb)/0.1)' : 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        color: chartType === 'line' ? '#ffffff' : 'rgb(var(--os-fg-rgb)/0.5)',
                        fontSize: '0.68rem',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Линии
                    </button>
                    <button
                      onClick={() => setChartType('bar')}
                      style={{
                        background: chartType === 'bar' ? 'rgb(var(--os-fg-rgb)/0.1)' : 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        color: chartType === 'bar' ? '#ffffff' : 'rgb(var(--os-fg-rgb)/0.5)',
                        fontSize: '0.68rem',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Столбцы
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Subject Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.65rem', color: 'rgb(var(--os-fg-rgb)/0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Предмет</label>
                <select
                  value={selectedSubject}
                  onChange={e => setSelectedSubject(e.target.value)}
                  style={{
                    background: 'rgb(var(--os-fg-rgb)/0.03)',
                    border: '1px solid rgb(var(--os-fg-rgb)/0.05)',
                    borderRadius: '6px',
                    color: 'var(--os-fg)',
                    fontSize: '0.75rem',
                    padding: '6px 8px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all" style={{ background: 'var(--os-s1)', color: 'var(--os-fg)' }}>Все предметы</option>
                  {subjects.map(sub => (
                    <option key={sub} value={sub} style={{ background: 'var(--os-s1)', color: 'var(--os-fg)' }}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* Row 3: Late Status Options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.65rem', color: 'rgb(var(--os-fg-rgb)/0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Статус опозданий</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {[
                    { id: 'present', label: 'Опоздание = Был' },
                    { id: 'absent', label: 'Опоздание = Пропуск' },
                    { id: 'exclude', label: 'Опоздание = Исключить' }
                  ].map(item => {
                    const isActive = lateStatus === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setLateStatus(item.id as any)}
                        style={{
                          background: isActive ? 'rgb(var(--os-fg-rgb)/0.1)' : 'rgb(var(--os-fg-rgb)/0.02)',
                          border: `1px solid ${isActive ? 'rgb(var(--os-fg-rgb)/0.2)' : 'rgb(var(--os-fg-rgb)/0.05)'}`,
                          borderRadius: '12px',
                          color: isActive ? '#ffffff' : 'rgb(var(--os-fg-rgb)/0.4)',
                          fontSize: '0.65rem',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem', paddingLeft: '0.25rem' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <div className="skeleton-line animate-pulse" style={{ width: '60px', height: '28px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
              <div className="skeleton-line animate-pulse" style={{ width: '80px', height: '14px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: 'var(--os-fg)',
                fontFamily: "'Fira Code', monospace",
              }}>
                {loading ? '...' : animatedValue}%
              </span>
              <span style={{
                fontSize: '0.78rem',
                color: isDiffPositive ? '#7dffc4' : '#30ff44',
                fontWeight: 600,
              }}>
                {diffText}
              </span>
            </div>
          )}

          {loading ? (
            <div className="skeleton-line animate-pulse" style={{ width: '120px', height: '14px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
          ) : (
            <div style={{ fontSize: '0.7rem', color: '#6b6b6b', textAlign: 'right' }}>
              Всего пар: {totalClasses} | Пропущено: {missed}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Spline/Bar Chart */}
      <div className="chart-container-wrapper">
        {!loading && points.length > 0 && (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <linearGradient id="attendanceSparkGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00ffc2" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#00ffc2" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            
            {/* Area fill (Line only) */}
            {chartType === 'line' && (
               <motion.g
                 initial={{ opacity: 0 }}
                 animate={{ opacity: isInView ? 1 : 0 }}
                 transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
               >
                <path
                  d={areaPath}
                  fill="url(#attendanceSparkGradient)"
                />
              </motion.g>
            )}

            {/* Line Path (Line only) */}
            {chartType === 'line' && (
              <motion.path
                d={linePath}
                className="attendance-sparkline-path"
                strokeWidth="3"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: isInView ? 1 : 0 }}
                transition={{ duration: 1.0, ease: "easeOut" }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(0, 255, 194, 0.4))' }}
              />
            )}

            {/* Glowing Bar Chart rendering */}
            {chartType === 'bar' && points.map((p, i) => {
              const barWidth = Math.min(36, (chartWidth / Math.max(1, points.length)) * 0.5);
              const barPath = getBarPath(p.x - barWidth / 2, p.y, barWidth, paddingTop + chartHeight, 4);
              return (
                <motion.path
                  key={`${i}-${points.length}`}
                  d={barPath}
                  fill="url(#attendanceSparkGradient)"
                  stroke="#00ffc2"
                  strokeWidth="1"
                  strokeOpacity="0.15"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: isInView ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                  style={{
                    filter: hoveredIndex === i ? 'drop-shadow(0 0 6px rgba(0, 255, 194, 0.4))' : 'none',
                    cursor: 'pointer',
                    transformOrigin: `${p.x}px ${paddingTop + chartHeight}px`
                  }}
                />
              );
            })}
          </svg>
        )}

        {/* Horizontal grid lines and Y-axis labels */}
        {gridVals.map((val) => {
          const yVal = paddingTop + chartHeight - ((val - minVal) / Math.max(1, maxVal - minVal)) * chartHeight;
          const yPct = (yVal / svgHeight) * 100;
          return (
            <div key={val}>
              <div
                className="chart-grid-line-x"
                style={{ top: `${yPct}%` }}
              />
              <div
                className="chart-axis-label-y"
                style={{ top: `${yPct}%` }}
              >
                {val}%
              </div>
            </div>
          );
        })}

        {/* Vertical grid lines and X-axis labels */}
        {!loading && points.map((p, i) => {
          const xPct = (p.x / svgWidth) * 100;
          
          let showLabel = true;
          if (points.length > 24) {
            showLabel = i % 4 === 0;
          } else if (points.length > 16) {
            showLabel = i % 3 === 0;
          } else if (points.length > 8) {
            showLabel = i % 2 === 0;
          }

          return (
            <div key={i}>
              {chartType === 'line' && showLabel && (
                <div
                  className="chart-grid-line-y"
                  style={{ left: `${xPct}%` }}
                />
              )}
              {showLabel && (
                <div
                  className="chart-axis-label-x"
                  style={{ left: `${xPct}%` }}
                >
                  {months[i]}
                </div>
              )}
            </div>
          );
        })}

        {/* Glowing interactive dots (Line only) */}
        {!loading && chartType === 'line' && points.map((p, i) => {
          const xPct = (p.x / svgWidth) * 100;
          const yPct = (p.y / svgHeight) * 100;
          const isActive = hoveredIndex === i;
          return (
            <motion.div
              key={i}
              className={`chart-interactive-dot ${isActive ? 'active' : ''}`}
              initial={{ scale: 0 }}
              animate={{ scale: isInView ? 1 : 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              style={{
                left: `${xPct}%`,
                top: `${yPct}%`,
                x: '-50%',
                y: '-50%',
                backgroundColor: 'var(--os-s1)',
                border: '2px solid #00ffc2',
                boxShadow: isActive
                  ? '0 0 10px rgba(0, 255, 194, 0.8), 0 0 20px rgba(0, 255, 194, 0.4)'
                  : '0 0 4px rgba(0, 255, 194, 0.3)',
              }}
            />
          );
        })}

        {/* Hover triggers */}
        {!loading && points.map((p, i) => {
          const xPct = (p.x / svgWidth) * 100;
          return (
            <div
              key={i}
              className="chart-hover-target"
              style={{ left: `${xPct}%` }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}

        {/* Floating Tooltip */}
        {!loading && hoveredIndex !== null && chartData[hoveredIndex] !== undefined && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(points[hoveredIndex].x / svgWidth) * 100}%`,
              top: `${(points[hoveredIndex].y / svgHeight) * 100}%`,
            }}
          >
            {months[hoveredIndex]}: {chartData[hoveredIndex]}%
          </div>
        )}
      </div>
      </InteractiveGlowCard>
  );
}
