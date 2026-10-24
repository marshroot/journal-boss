import { useState, useEffect, useRef } from 'react';
import { motion, animate, useMotionValue, useTransform, AnimatePresence, useInView } from 'motion/react';
import { ChevronRight, TrendingUp, SlidersHorizontal } from 'lucide-react';
import InteractiveGlowCard from './InteractiveGlowCard';
import { apiFetch } from '../../lib/api';

interface Visit {
  date_visit: string;
  spec_name: string;
  teacher_name?: string;
  lesson_theme?: string;
  control_work_mark?: number | null;
  home_work_mark?: number | null;
  lab_work_mark?: number | null;
  class_work_mark?: number | null;
  practical_work_mark?: number | null;
  final_work_mark?: number | null;
}

const getBarPath = (x: number, y: number, width: number, yBottom: number, r: number) => {
  const height = yBottom - y;
  const radius = Math.min(r, height, width / 2);
  if (radius <= 0) {
    return `M ${x} ${yBottom} L ${x} ${y} L ${x + width} ${y} L ${x + width} ${yBottom} Z`;
  }
  return `M ${x} ${yBottom} L ${x} ${y + radius} A ${radius} ${radius} 0 0 1 ${x + radius} ${y} L ${x + width - radius} ${y} A ${radius} ${radius} 0 0 1 ${x + width} ${y + radius} L ${x + width} ${yBottom} Z`;
};

interface AverageGradeWidgetProps {
  isFiltersOpen: boolean;
  setIsFiltersOpen: (open: boolean) => void;
}

export default function AverageGradeWidget({ isFiltersOpen, setIsFiltersOpen }: AverageGradeWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gradeData, setGradeData] = useState<{
    grade: number;
    trendText: string;
    gradeStatusText: string;
    rankText: string;
    chartData: number[];
    months: string[];
  } | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);

  // Filter States
  // Moved to parent component
  const [selectedPeriod, setSelectedPeriod] = useState<'semester' | '3months' | '6months' | 'alltime'>('semester');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMarkTypes, setSelectedMarkTypes] = useState<string[]>(['control', 'home', 'lab', 'class', 'practical', 'final']);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  const maxGrade = 5.0;
  const count = useMotionValue(0);
  const roundedCount = useTransform(count, (latest) => latest.toFixed(2));

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      apiFetch('/api/Leaderboard/average-grade').then(res => {
        if (!res.ok) throw new Error('Не удалось загрузить данные успеваемости.');
        return res.json();
      }),
      apiFetch('/api/Leaderboard/visits').then(res => {
        if (!res.ok) throw new Error('Не удалось загрузить историю журнала.');
        return res.json();
      })
    ])
      .then(([gData, vData]) => {
        if (isMounted) {
          setGradeData(gData);
          setVisits(vData);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
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
  const getFilteredData = () => {
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

    // 3. Group and average by month
    const monthlyMarks: { [key: string]: number[] } = {};
    const activeFields: string[] = [];
    if (selectedMarkTypes.includes('control')) activeFields.push('control_work_mark');
    if (selectedMarkTypes.includes('home')) activeFields.push('home_work_mark');
    if (selectedMarkTypes.includes('lab')) activeFields.push('lab_work_mark');
    if (selectedMarkTypes.includes('class')) activeFields.push('class_work_mark');
    if (selectedMarkTypes.includes('practical')) activeFields.push('practical_work_mark');
    if (selectedMarkTypes.includes('final')) activeFields.push('final_work_mark');

    for (const v of filtered) {
      if (!v.date_visit) continue;
      const dv = new Date(v.date_visit);
      if (isNaN(dv.getTime())) continue;

      const year = dv.getFullYear();
      const month = String(dv.getMonth() + 1).padStart(2, '0');
      const key = `${year}-${month}`;

      if (!monthlyMarks[key]) {
        monthlyMarks[key] = [];
      }

      for (const field of activeFields) {
        const val = (v as any)[field];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (!isNaN(num)) {
            monthlyMarks[key].push(num);
          }
        }
      }
    }

    const sortedKeys = Object.keys(monthlyMarks).sort();
    const chartData: number[] = [];
    const months: string[] = [];
    const monthNames = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

    for (const key of sortedKeys) {
      const marks = monthlyMarks[key];
      if (marks.length > 0) {
        const avg = marks.reduce((sum, val) => sum + val, 0) / marks.length;
        chartData.push(Number(avg.toFixed(2)));
        
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

    // 4. Calculate display grade over all selected visits
    const allSelectedMarks: number[] = [];

    for (const v of filtered) {
      for (const field of activeFields) {
        const val = (v as any)[field];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (!isNaN(num)) {
            allSelectedMarks.push(num);
          }
        }
      }
    }

    let displayGrade = 0;
    if (allSelectedMarks.length > 0) {
      displayGrade = allSelectedMarks.reduce((sum, val) => sum + val, 0) / allSelectedMarks.length;
    }

    let dynamicPeriodText = "за семестр";
    if (selectedPeriod === '3months') {
      dynamicPeriodText = "за последние 3 месяца";
    } else if (selectedPeriod === '6months') {
      dynamicPeriodText = "за последние 6 месяцев";
    } else if (selectedPeriod === 'alltime') {
      dynamicPeriodText = "за всё время";
    }

    // Dynamic trend & status
    let trendText = "Текущий тренд стабильный";
    if (finalChartData.length >= 2) {
      const lastVal = finalChartData[finalChartData.length - 1];
      const prevVal = finalChartData[finalChartData.length - 2];
      if (lastVal > prevVal && prevVal > 0) {
        trendText = "Текущий тренд: восходящий";
      } else if (lastVal < prevVal && lastVal > 0) {
        trendText = "Текущий тренд: нисходящий";
      }
    }

    let gradeStatusText = "Удовлетворительная успеваемость";
    if (displayGrade >= 4.5) gradeStatusText = "Отличная учеба";
    else if (displayGrade >= 3.8) gradeStatusText = "Хорошая учеба";
    else if (displayGrade > 0) gradeStatusText = "Требуется внимание";

    return {
      chartData: finalChartData,
      months: finalMonths,
      displayGrade,
      dynamicPeriodText,
      trendText,
      gradeStatusText
    };
  };

  const {
    chartData: dataPoints,
    months,
    displayGrade,
    dynamicPeriodText,
    trendText,
    gradeStatusText
  } = getFilteredData();

  const getOverallCurrentMonthAverage = () => {
    if (visits.length === 0) return null;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const marks: number[] = [];
    const allFields = ['control_work_mark', 'home_work_mark', 'lab_work_mark', 'class_work_mark', 'practical_work_mark', 'final_work_mark'];
    
    const currentMonthVisits = visits.filter(v => {
      if (!v.date_visit) return false;
      const dv = new Date(v.date_visit);
      const key = `${dv.getFullYear()}-${String(dv.getMonth() + 1).padStart(2, '0')}`;
      return key === currentMonthKey;
    });

    for (const v of currentMonthVisits) {
      for (const field of allFields) {
        const val = (v as any)[field];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (!isNaN(num)) {
            marks.push(num);
          }
        }
      }
    }

    if (marks.length > 0) {
      const avg = marks.reduce((sum, val) => sum + val, 0) / marks.length;
      const monthNamesFull = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
      return {
        avg: Number(avg.toFixed(2)),
        monthName: monthNamesFull[now.getMonth()]
      };
    }
    
    const monthlyMarks: { [key: string]: number[] } = {};
    for (const v of visits) {
      if (!v.date_visit) continue;
      const dv = new Date(v.date_visit);
      if (isNaN(dv.getTime())) continue;
      const key = `${dv.getFullYear()}-${String(dv.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMarks[key]) monthlyMarks[key] = [];
      for (const field of allFields) {
        const val = (v as any)[field];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (!isNaN(num)) monthlyMarks[key].push(num);
        }
      }
    }
    const sortedKeys = Object.keys(monthlyMarks).sort().reverse();
    const latestKey = sortedKeys.find(k => monthlyMarks[k].length > 0);
    if (latestKey) {
      const latestMarks = monthlyMarks[latestKey];
      const [, m] = latestKey.split('-');
      const monthNamesFull = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
      return {
        avg: Number((latestMarks.reduce((sum, val) => sum + val, 0) / latestMarks.length).toFixed(2)),
        monthName: monthNamesFull[parseInt(m, 10) - 1]
      };
    }

    return null;
  };

  const currentMonthInfo = getOverallCurrentMonthAverage();

  const getRankValueAndSubtext = () => {
    const text = gradeData?.rankText ?? "";
    const match = text.match(/Топ-(\d+)/);
    if (match) {
      return {
        value: `Топ-${match[1]}`,
        subtext: "в группе успеваемости"
      };
    }
    return {
      value: "Группа",
      subtext: text || "успеваемости"
    };
  };
  const rankInfo = getRankValueAndSubtext();

  const containerRef = useRef<HTMLDivElement>(null);
  const isIntersecting = useInView(containerRef, { once: false, amount: 0.1 });
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    setIsInView(isIntersecting);
  }, [isIntersecting]);

  useEffect(() => {
    if (!loading && isInView) {
      count.set(0);
      const controls = animate(count, displayGrade, {
        duration: 1.2,
        ease: [0.16, 1, 0.3, 1]
      });
      return controls.stop;
    }
  }, [displayGrade, loading, isInView]);

  // Semicircular arc gauge dimensions
  const arcLength = 167.5;
  const totalCircumference = 251.2;
  const offset = arcLength - (displayGrade / maxGrade) * arcLength;

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const svgWidth = 600;
  const svgHeight = 130;
  const paddingLeft = 45;
  const paddingRight = 4;
  const paddingTop = 15;
  const paddingBottom = 25;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const minDataVal = dataPoints.length > 0 ? Math.min(...dataPoints) : 3.5;
  let minVal = 3.5;
  let gridVals = [3.5, 4.0, 4.5, 5.0];

  if (minDataVal < 3.5) {
    if (minDataVal >= 2.5) {
      minVal = 2.5;
      gridVals = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    } else if (minDataVal >= 1.5) {
      minVal = 1.5;
      gridVals = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
    } else {
      minVal = 1.0;
      gridVals = [1.0, 2.0, 3.0, 4.0, 5.0];
    }
  }

  const maxVal = 5.0;

  const points = dataPoints.map((val, i) => ({
    x: paddingLeft + (i / Math.max(1, dataPoints.length - 1)) * chartWidth,
    y: paddingTop + chartHeight - ((val - minVal) / Math.max(0.1, maxVal - minVal)) * chartHeight,
  }));

  // Spline Line Path
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
        glowColor="rgba(255, 0, 0, 0.08)"
        contentClassName="chart-layout"
        style={{
          background: 'var(--os-s1)',
          borderColor: 'rgba(255, 0, 0, 0.1)',
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
        <p style={{ color: '#ff5555', fontSize: '0.9rem', marginBottom: '0.5rem' }}>Ошибка загрузки успеваемости</p>
        <p style={{ fontSize: '0.75rem', color: 'rgb(var(--os-fg-rgb)/0.4)' }}>{error}</p>
      </InteractiveGlowCard>
    );
  }

  return (
    <InteractiveGlowCard
      className="dash-card bento-col-6"
      containerRef={containerRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      glowColor="rgb(var(--os-fg-rgb) / 0.08)"
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
          <h4 className="dash-card-title" style={{ color: 'var(--os-fg)' }}>Средний балл</h4>
          <button
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="filter-toggle-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              background: isFiltersOpen ? 'rgb(var(--os-fg-rgb)/0.08)' : 'transparent',
              border: '1px solid rgb(var(--os-fg-rgb)/0.08)',
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

              {/* Row 3: Mark Types Toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <label style={{ fontSize: '0.65rem', color: 'rgb(var(--os-fg-rgb)/0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Типы оценок</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {[
                    { id: 'class', label: 'Классная' },
                    { id: 'home', label: 'Домашняя' },
                    { id: 'lab', label: 'Лабораторная' },
                    { id: 'control', label: 'Контрольная' },
                    { id: 'practical', label: 'Практическая' },
                    { id: 'final', label: 'Экзамен' }
                  ].map(item => {
                    const isActive = selectedMarkTypes.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (isActive) {
                            if (selectedMarkTypes.length > 1) {
                              setSelectedMarkTypes(selectedMarkTypes.filter(x => x !== item.id));
                            }
                          } else {
                            setSelectedMarkTypes([...selectedMarkTypes, item.id]);
                          }
                        }}
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

        {/* Circular Gauge and Stats summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1rem', paddingLeft: '0.25rem', width: '100%' }}>
          {/* Circular Gauge */}
          <div className="gauge-svg-container" style={{ width: '76px', height: '76px', flexShrink: 0 }}>
            <svg width="76" height="76" viewBox="0 0 100 100">
              {/* Background track: 240 degrees, gap at bottom */}
              <circle
                cx="50"
                cy="50"
                r="40"
                className="gauge-bg"
                strokeDasharray={`${arcLength} ${totalCircumference}`}
                transform="rotate(150 50 50)"
                style={{
                  fill: 'none',
                  stroke: 'rgb(var(--os-fg-rgb) / 0.08)',
                  strokeWidth: '8',
                  strokeLinecap: 'round',
                }}
              />
              {/* Active progress: White stroke */}
              {!loading && (
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="gauge-value"
                  strokeDasharray={`${arcLength} ${totalCircumference}`}
                  initial={{ strokeDashoffset: arcLength }}
                  animate={{ strokeDashoffset: isInView ? offset : arcLength }}
                  transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                  transform="rotate(150 50 50)"
                  style={{
                    fill: 'none',
                    stroke: '#ffffff',
                    strokeWidth: '8',
                    strokeLinecap: 'round',
                    filter: 'drop-shadow(0 0 4px rgb(var(--os-fg-rgb) / 0.3))',
                  }}
                />
              )}
            </svg>
            {/* Semicircle inner details */}
            <div className="gauge-center-text" style={{ transform: 'translate(-50%, -46%)' }}>
              <motion.div className="gauge-value-num" style={{ color: 'var(--os-fg)', fontSize: '1.2rem' }}>
                {loading ? '...' : roundedCount}
              </motion.div>
              <div className="gauge-label" style={{ color: 'rgb(var(--os-fg-rgb) / 0.3)', fontSize: '0.42rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {selectedPeriod === 'semester' ? 'семестр' : selectedPeriod === '3months' ? '3 мес' : selectedPeriod === '6months' ? '6 мес' : 'все время'}
              </div>
            </div>
          </div>
          
          {/* Dynamic Row of Columns */}
          {!loading ? (
            <div style={{
              display: 'flex',
              flex: 1,
              justifyContent: 'space-between',
              gap: '1.5rem',
              alignItems: 'flex-start',
              borderLeft: '1px solid rgb(var(--os-fg-rgb) / 0.05)',
              paddingLeft: '1.5rem',
              flexWrap: 'wrap'
            }}>
              {/* Column 1: Status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '120px' }}>
                <span style={{ fontSize: '0.62rem', color: 'rgb(var(--os-fg-rgb) / 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Успеваемость</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <TrendingUp size={12} style={{ color: displayGrade >= 3.8 ? '#7dffc4' : '#ff1744' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--os-fg)', whiteSpace: 'nowrap' }}>{gradeStatusText}</span>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'rgb(var(--os-fg-rgb) / 0.4)', lineHeight: 1.2 }}>
                  {trendText}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'rgb(var(--os-fg-rgb) / 0.3)', lineHeight: 1.1 }}>
                  Среднее {dynamicPeriodText}
                </span>
              </div>

              {/* Column 2: Leaderboard Rank */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '100px' }}>
                <span style={{ fontSize: '0.62rem', color: 'rgb(var(--os-fg-rgb) / 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Рейтинг в группе</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--os-fg)' }}>
                  {rankInfo.value}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'rgb(var(--os-fg-rgb) / 0.4)', lineHeight: 1.2 }}>
                  {rankInfo.subtext}
                </span>
              </div>

              {/* Column 3: Current Month */}
              {currentMonthInfo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '120px' }}>
                  <span style={{ fontSize: '0.62rem', color: 'rgb(var(--os-fg-rgb) / 0.3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Оценка за месяц</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--os-fg)' }}>
                    {currentMonthInfo.avg.toFixed(2)}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'rgb(var(--os-fg-rgb) / 0.4)', lineHeight: 1.2 }}>
                    {currentMonthInfo.monthName[0].toUpperCase() + currentMonthInfo.monthName.slice(1)} (все предметы)
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, gap: '2rem', borderLeft: '1px solid rgb(var(--os-fg-rgb) / 0.05)', paddingLeft: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                <div className="skeleton-line animate-pulse" style={{ width: '60px', height: '10px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
                <div className="skeleton-line animate-pulse" style={{ width: '100px', height: '12px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                <div className="skeleton-line animate-pulse" style={{ width: '60px', height: '10px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
                <div className="skeleton-line animate-pulse" style={{ width: '80px', height: '12px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                <div className="skeleton-line animate-pulse" style={{ width: '60px', height: '10px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
                <div className="skeleton-line animate-pulse" style={{ width: '80px', height: '12px', background: 'rgb(var(--os-fg-rgb) / 0.04)', borderRadius: '4px' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Chart */}
      <div className="chart-container-wrapper">
        {!loading && points.length > 0 && (
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <defs>
              <linearGradient id="reversedSparkGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            
            {/* Spline Line Chart rendering */}
            {chartType === 'line' && (
              <>
                {/* Area fill */}
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isInView ? 1 : 0 }}
                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                >
                  <path
                    d={areaPath}
                    fill="url(#reversedSparkGradient)"
                  />
                </motion.g>

                {/* Line Path */}
                <motion.path
                  d={linePath}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isInView ? 1 : 0 }}
                  transition={{ duration: 1.0, ease: "easeOut" }}
                  style={{ filter: 'drop-shadow(0 0 4px rgb(var(--os-fg-rgb) / 0.3))' }}
                />
              </>
            )}

            {/* Glowing Bar Chart rendering */}
            {chartType === 'bar' && points.map((p, i) => {
              const barWidth = Math.min(36, (chartWidth / Math.max(1, points.length)) * 0.5);
              const barPath = getBarPath(p.x - barWidth / 2, p.y, barWidth, paddingTop + chartHeight, 4);
              return (
                <motion.path
                  key={`${i}-${points.length}`}
                  d={barPath}
                  fill="url(#reversedSparkGradient)"
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeOpacity="0.15"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: isInView ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: i * 0.04 }}
                  style={{
                    filter: hoveredIndex === i ? 'drop-shadow(0 0 6px rgb(var(--os-fg-rgb) / 0.4))' : 'none',
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
          const yVal = paddingTop + chartHeight - ((val - minVal) / Math.max(0.1, maxVal - minVal)) * chartHeight;
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
                {val.toFixed(1)}
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

        {/* Glowing interactive dots (only for Line Chart) */}
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
                border: '2px solid #ffffff',
                boxShadow: isActive
                  ? '0 0 10px rgb(var(--os-fg-rgb) / 0.8), 0 0 20px rgb(var(--os-fg-rgb) / 0.4)'
                  : '0 0 4px rgb(var(--os-fg-rgb) / 0.2)',
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
        {!loading && hoveredIndex !== null && dataPoints[hoveredIndex] !== undefined && (
          <div
            className="chart-tooltip"
            style={{
              left: `${(points[hoveredIndex].x / svgWidth) * 100}%`,
              top: `${(points[hoveredIndex].y / svgHeight) * 100}%`,
            }}
          >
            {months[hoveredIndex]}: {dataPoints[hoveredIndex].toFixed(2)}
          </div>
        )}
      </div>
      </InteractiveGlowCard>
  );
}

