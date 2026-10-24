import { apiFetch } from '../../lib/api';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, Calendar, List, CalendarDays, Filter,
  Clock, MapPin, User, Check, X, Star, Sparkles, RefreshCw, Send, HelpCircle, AlertCircle
} from 'lucide-react';
import InteractiveGlowCard from './InteractiveGlowCard';

interface Lesson {
  id: number;
  key?: string; // used for feedback/ratings
  date_visit: string; // YYYY-MM-DD
  subject_name: string;
  room_name: string;
  teacher_name: string;
  teacher_photo: string | null;
  lesson_theme: string;
  started_at: string; // HH:MM
  finished_at: string; // HH:MM
  type_name: string; // Лекция, Практика, Экзамен
  homework_status?: 'pending' | 'submitted' | 'graded' | 'none';
  attendance_status?: number | null; // 1 = Present, 0 = Absent, 2 = Late
}

interface RateableLesson {
  key: string;
  date_visit: string;
  fio_teach: string;
  spec_name: string;
  teach_photo: string | null;
}

interface Visit {
  date_visit: string;
  spec_name: string;
  teacher_name?: string;
  lesson_theme?: string;
  status_was?: number | null;
  lesson_number?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05
    }
  }
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 22
    }
  }
} as const;

export default function ScheduleWidget() {
  const [activeTab, setActiveTab] = useState<'week' | 'month' | 'list'>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date States
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Drag scrolling refs & state
  const isMouseDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const dragMoved = useRef(false);
  const [isCursorGrabbing, setIsCursorGrabbing] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const isInitialMount = useRef(true);

  const handleScrollContainerRef = (node: HTMLDivElement | null) => {
    (scrollContainerRef as any).current = node;
    setScrollContainer(node);
  };

  // Reset initial mount flag on tab change or loading
  useEffect(() => {
    if (activeTab !== 'week' || loading) {
      isInitialMount.current = true;
    }
  }, [activeTab, loading]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isMouseDown.current = true;
    dragMoved.current = false;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeft.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(walk) > 5) {
      dragMoved.current = true;
      setIsCursorGrabbing(true);
    }
    scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isMouseDown.current = false;
    setIsCursorGrabbing(false);
  };
  
  // Data States
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [rateableLessons, setRateableLessons] = useState<RateableLesson[]>([]);
  const [ratedKeys, setRatedKeys] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('journal-rated-lessons') || '[]');
    } catch {
      return [];
    }
  });

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterTeacher, setFilterTeacher] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Rating States
  const [activeRatingLessonKey, setActiveRatingLessonKey] = useState<string | null>(null);
  const [evaluationStep, setEvaluationStep] = useState<1 | 2>(1);
  const [teacherRate, setTeacherRate] = useState(5);
  const [lessonRate, setLessonRate] = useState(5);
  const [teacherHoverRate, setTeacherHoverRate] = useState<number | null>(null);
  const [lessonHoverRate, setLessonHoverRate] = useState<number | null>(null);
  const [teacherComment, setTeacherComment] = useState('');
  const [lessonComment, setLessonComment] = useState('');
  const [selectedTeacherTags, setSelectedTeacherTags] = useState<number[]>([]);
  const [selectedLessonTags, setSelectedLessonTags] = useState<number[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingSuccessMessage, setRatingSuccessMessage] = useState<string | null>(null);
  const [ratingErrorMessage, setRatingErrorMessage] = useState<string | null>(null);

  // Hardcoded teacher tags mapping to MyStat IDs
  const TEACHER_TAGS = [
    { id: 8, text: 'Все супер!' },
    { id: 9, text: 'Не отвечал на вопросы' },
    { id: 10, text: 'Понятно объясняет' },
    { id: 11, text: 'Классный преподаватель!' },
    { id: 12, text: 'Было шумно!' },
    { id: 13, text: 'Тема не была объяснена!' },
    { id: 14, text: 'Преподаватель кричит' }
  ];

  // Hardcoded lesson tags mapping to MyStat IDs
  const LESSON_TAGS = [
    { id: 15, text: 'Все супер!' },
    { id: 16, text: 'Сложно!' },
    { id: 17, text: 'Скучно!(' },
    { id: 18, text: 'Не успели пройти тему' },
    { id: 19, text: 'Мало практики' },
    { id: 20, text: 'Мало теории' },
    { id: 21, text: 'Зачем мы это учим?' }
  ];

  // 1. Fetch Schedule Data based on date range
  const dateRange = useMemo(() => {
    // For Month/List view: get start and end of current month
    // For Week view: get start and end of current month to ensure caching and navigation work smoothly
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Add buffer of 7 days before and after
    const dateStart = new Date(firstDay);
    dateStart.setDate(dateStart.getDate() - 7);
    
    const dateEnd = new Date(lastDay);
    dateEnd.setDate(dateEnd.getDate() + 7);
    
    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    return {
      start: formatDate(dateStart),
      end: formatDate(dateEnd)
    };
  }, [currentDate]);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setError('Не выполнен вход в систему.');
      setLoading(false);
      return;
    }

    setLoading(true);
    let isMounted = true;

    // Fetch lessons range
    const fetchSchedule = async () => {
      try {
        // Fetch all three endpoints in parallel to optimize load times and ensure visits are ready
        const [scheduleRes, rateableRes, visitsRes] = await Promise.all([
          apiFetch(`/api/Schedule/operations/get-by-date-range?date_start=${encodeURIComponent(dateRange.start)}&date_end=${encodeURIComponent(dateRange.end)}`),
          apiFetch(`/api/Schedule/feedback/evaluate-lesson-list`),
          apiFetch(`/api/Leaderboard/visits`)
        ]);
        
        let scheduleData: Lesson[] = [];
        if (scheduleRes.ok) {
          const rawData = await scheduleRes.json();
          // Ensure it's parsed correctly
          if (Array.isArray(rawData)) {
            scheduleData = rawData.map((item: any, index: number) => ({
              id: item.id || index,
              key: item.key || `lesson-${index}`,
              date_visit: item.date_visit || item.date || '',
              subject_name: item.subject_name || item.spec_name || 'Предмет',
              room_name: item.room_name || item.cabinet || 'Кабинет',
              teacher_name: item.teacher_name || item.fio_teach || 'Преподаватель',
              teacher_photo: item.teacher_photo || item.teach_photo || null,
              started_at: item.started_at || '09:00',
              finished_at: item.finished_at || '10:30',
              type_name: item.type_name || (item.is_exam ? 'Экзамен' : 'Практика'),
              lesson_theme: item.lesson_theme || item.theme_name || item.theme || 'Тема не указана',
              homework_status: item.homework_status || 'none'
            }));
          }
        } else {
          console.warn('Backend returned error for schedule range, falling back to mock generation');
          scheduleData = generateMockLessons(dateRange.start, dateRange.end);
        }

        let rateableData: RateableLesson[] = [];
        if (rateableRes.ok) {
          try {
            rateableData = await rateableRes.json();
          } catch (e) {
            console.warn('Failed to parse rateable lessons', e);
          }
        }

        let visitsData: Visit[] = [];
        if (visitsRes.ok) {
          try {
            visitsData = await visitsRes.json();
          } catch (e) {
            console.warn('Failed to parse visits data', e);
          }
        }

        if (isMounted) {
          // Sort schedule lessons chronologically to ensure correct chronological mapping to visits
          scheduleData.sort((a, b) => {
            const dateCompare = a.date_visit.localeCompare(b.date_visit);
            if (dateCompare !== 0) return dateCompare;
            return a.started_at.localeCompare(b.started_at);
          });

          // Sort visits data chronologically by date and lesson number
          visitsData.sort((a, b) => {
            const dateCompare = a.date_visit.localeCompare(b.date_visit);
            if (dateCompare !== 0) return dateCompare;
            const numA = a.lesson_number ?? 0;
            const numB = b.lesson_number ?? 0;
            return numA - numB;
          });

          // Keep track of matched visits count per date + subject to support multiple classes on the same day
          const visitMatchCount: { [key: string]: number } = {};

          // Helper to safely extract local date part
          const getLocalDate = (dStr: string) => {
            if (!dStr) return '';
            return dStr.split('T')[0].split(' ')[0];
          };

          // Map rateable keys and attendance status onto the schedule lessons
          const mappedLessons = scheduleData.map(lesson => {
            const lessonDate = getLocalDate(lesson.date_visit);
            const lessonSub = lesson.subject_name.toLowerCase().replace(/[^a-zA-Zа-яА-Я0-9]/g, '').trim();

            const matchingRateable = rateableData.find(rl => {
              const rlDate = getLocalDate(rl.date_visit);
              if (rlDate !== lessonDate) return false;

              // Compare normalized subject names
              const rlSub = rl.spec_name.toLowerCase().replace(/[^a-zA-Zа-яА-Я0-9]/g, '').trim();
              if (rlSub !== lessonSub) return false;

              // Compare normalized teacher names
              const rlTeach = rl.fio_teach.toLowerCase().replace(/[^a-zA-Zа-яА-Я0-9]/g, '').trim();
              const lessonTeach = lesson.teacher_name.toLowerCase().replace(/[^a-zA-Zа-яА-Я0-9]/g, '').trim();
              return rlTeach === lessonTeach || rlTeach.includes(lessonTeach) || lessonTeach.includes(rlTeach);
            });

            const matchKey = `${lessonDate}_${lessonSub}`;

            // Find all visits matching this date and subject
            const matchingVisits = visitsData.filter(v => {
              const vDate = getLocalDate(v.date_visit);
              const vSub = v.spec_name.toLowerCase().replace(/[^a-zA-Zа-яА-Я0-9]/g, '').trim();
              return vDate === lessonDate && vSub === lessonSub;
            });

            // Get the matching visit in chronological order
            const matchIndex = visitMatchCount[matchKey] || 0;
            const matchingVisit = matchingVisits[matchIndex];
            
            if (matchingVisit) {
              visitMatchCount[matchKey] = matchIndex + 1;
            }

            return {
              ...lesson,
              key: matchingRateable ? matchingRateable.key : lesson.key,
              lesson_theme: (matchingVisit && matchingVisit.lesson_theme && matchingVisit.lesson_theme !== 'Тема не указана') 
                ? matchingVisit.lesson_theme 
                : lesson.lesson_theme,
              attendance_status: matchingVisit ? (matchingVisit.status_was !== undefined && matchingVisit.status_was !== null ? Number(matchingVisit.status_was) : null) : null
            };
          });

          setLessons(mappedLessons);
          setRateableLessons(rateableData);

          // Self-cleaning rated keys cache: only keep keys in localStorage if they are still present in rateableData list
          // This avoids localStorage bloating over time.
          const activeRateableKeys = rateableData.map(rl => rl.key);
          const localRatedKeysString = localStorage.getItem('journal-rated-lessons') || '[]';
          try {
            const currentLocalKeys: string[] = JSON.parse(localRatedKeysString);
            const cleanedKeys = currentLocalKeys.filter(key => activeRateableKeys.includes(key));
            if (cleanedKeys.length !== currentLocalKeys.length) {
              setRatedKeys(cleanedKeys);
              localStorage.setItem('journal-rated-lessons', JSON.stringify(cleanedKeys));
            }
          } catch (e) {
            console.error('Failed to parse or clean rated keys from localStorage', e);
          }

          setError(null);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to load schedule from API, generating realistic mockup:', err);
        // Fallback to high-quality interactive mock data
        if (isMounted) {
          const mockData = generateMockLessons(dateRange.start, dateRange.end);
          const mockRateables: RateableLesson[] = [];
          const now = new Date();
          
          const mockMapped = mockData.map(lesson => {
            const lessonDate = new Date(lesson.date_visit);
            if (lessonDate < now && lesson.id % 4 === 0) {
              const key = `mock-rate-key-${lesson.id}`;
              mockRateables.push({
                key: key,
                date_visit: lesson.date_visit,
                fio_teach: lesson.teacher_name,
                spec_name: lesson.subject_name,
                teach_photo: null
              });
              return {
                ...lesson,
                key: key
              };
            }
            return lesson;
          });

          setLessons(mockMapped);
          setRateableLessons(mockRateables);
          setError(null);
          setLoading(false);
        }
      }
    };

    fetchSchedule();

    return () => {
      isMounted = false;
    };
  }, [dateRange]);

  // Subject options
  const subjects = useMemo(() => {
    return Array.from(new Set(lessons.map(l => l.subject_name))).sort();
  }, [lessons]);

  // Teacher options
  const teachers = useMemo(() => {
    return Array.from(new Set(lessons.map(l => l.teacher_name))).sort();
  }, [lessons]);

  // Lesson types
  const lessonTypes = useMemo(() => {
    return Array.from(new Set(lessons.map(l => l.type_name))).sort();
  }, [lessons]);

  // Apply filters
  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      const matchSubject = filterSubject === 'all' || l.subject_name === filterSubject;
      const matchTeacher = filterTeacher === 'all' || l.teacher_name === filterTeacher;
      const matchType = filterType === 'all' || l.type_name === filterType;
      return matchSubject && matchTeacher && matchType;
    });
  }, [lessons, filterSubject, filterTeacher, filterType]);

  // Group filtered lessons by date for the List View
  const groupedLessonsByDate = useMemo(() => {
    if (activeTab !== 'list') return [];
    
    const groups: { dateStr: string; dateObj: Date; lessons: Lesson[] }[] = [];
    
    filteredLessons.forEach(lesson => {
      const existingGroup = groups.find(g => g.dateStr === lesson.date_visit);
      if (existingGroup) {
        existingGroup.lessons.push(lesson);
      } else {
        groups.push({
          dateStr: lesson.date_visit,
          dateObj: new Date(lesson.date_visit),
          lessons: [lesson]
        });
      }
    });
    
    // Sort groups chronologically
    return groups.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredLessons, activeTab]);

  // Navigation functions
  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (activeTab === 'week') {
      nextDate.setMonth(nextDate.getMonth() - 1);
      const newSelected = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
      setSelectedDate(newSelected);
    } else {
      nextDate.setMonth(nextDate.getMonth() - 1);
    }
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (activeTab === 'week') {
      nextDate.setMonth(nextDate.getMonth() + 1);
      const newSelected = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
      setSelectedDate(newSelected);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    setCurrentDate(nextDate);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  // Helper: check if two dates are same day
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  // Helper: format date (ru)
  const formatDateString = (date: Date) => {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Helper: format month name (ru)
  const formatMonthName = (date: Date) => {
    const name = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Week helper calculations (based on selectedDate for week stats and headers)
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    const day = startOfWeek.getDay();
    // Adjust so week starts on Monday (1)
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // Days of the month helper calculation
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [currentDate]);

  // Centering effect when selectedDate changes
  useEffect(() => {
    if (scrollContainer && activeTab === 'week') {
      const timer = setTimeout(() => {
        const activeEl = scrollContainer.querySelector('[data-active="true"]');
        if (activeEl) {
          activeEl.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
          isInitialMount.current = false;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedDate, activeTab, currentDate, scrollContainer]);

  // Month helper calculations (Calendar grid)
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of current month
    const firstDay = new Date(year, month, 1);
    // Day of the week for first day (0 = Sunday, 1 = Monday...)
    let startDayOfWeek = firstDay.getDay();
    // Convert to Russian format: Mon = 0, Sun = 6
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    // Total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true
      });
    }

    // Next month padding to fill grid (usually 42 cells or 35 cells)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false
      });
    }

    return cells;
  }, [currentDate]);

  // Selected day lessons (filtered)
  const selectedDayLessons = useMemo(() => {
    return filteredLessons.filter(l => {
      const lessonDate = new Date(l.date_visit);
      return isSameDay(lessonDate, selectedDate);
    });
  }, [filteredLessons, selectedDate]);

  // Today's active and next lessons for the sidebar card
  const { activeLesson, nextLesson } = useMemo(() => {
    const now = new Date();
    
    // Format today's date as YYYY-MM-DD
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    // Filter lessons for today
    const todayLessons = lessons.filter(l => l.date_visit.split('T')[0] === todayStr);

    let active: Lesson | null = null;
    let next: Lesson | null = null;

    todayLessons.forEach(l => {
      const [startH, startM] = l.started_at.split(':').map(Number);
      const [endH, endM] = l.finished_at.split(':').map(Number);

      const lessonStart = new Date(now);
      lessonStart.setHours(startH, startM, 0, 0);

      const lessonEnd = new Date(now);
      lessonEnd.setHours(endH, endM, 0, 0);

      if (now >= lessonStart && now <= lessonEnd) {
        active = l;
      } else if (now < lessonStart) {
        if (!next || l.started_at < next.started_at) {
          next = l;
        }
      }
    });

    return { activeLesson: active, nextLesson: next };
  }, [lessons]);

  // Filter lessons for statistics display (Week vs Month)
  const statsLessons = useMemo(() => {
    if (activeTab === 'week') {
      const startOfWeek = new Date(weekDays[0]);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(weekDays[6]);
      endOfWeek.setHours(23, 59, 59, 999);

      return lessons.filter(l => {
        const d = new Date(l.date_visit);
        return d >= startOfWeek && d <= endOfWeek;
      });
    } else {
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      return lessons.filter(l => {
        const d = new Date(l.date_visit);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    }
  }, [lessons, activeTab, weekDays, currentDate]);

  const statsRatedCount = useMemo(() => {
    return statsLessons.filter(l => l.key && ratedKeys.includes(l.key)).length;
  }, [statsLessons, ratedKeys]);

  // Lesson status helper
  const getLessonStatus = (lesson: Lesson) => {
    const now = new Date();
    const lessonDate = new Date(lesson.date_visit);
    
    // Parse time
    const [startH, startM] = lesson.started_at.split(':').map(Number);
    const [endH, endM] = lesson.finished_at.split(':').map(Number);
    
    const lessonStart = new Date(lessonDate);
    lessonStart.setHours(startH, startM, 0, 0);
    
    const lessonEnd = new Date(lessonDate);
    lessonEnd.setHours(endH, endM, 0, 0);

    if (now > lessonEnd) {
      return { status: 'completed', text: 'Завершено', color: 'text-accent-purple-muted bg-accent-purple-muted/10 border-accent-purple-muted/20' };
    } else if (now >= lessonStart && now <= lessonEnd) {
      return { status: 'ongoing', text: 'Идет сейчас', color: 'text-accent-purple-soft bg-accent-purple-soft/10 border-accent-purple-soft/20 blink-status' };
    } else {
      // Calculate countdown if it is today
      if (isSameDay(now, lessonDate)) {
        const diffMs = lessonStart.getTime() - now.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        
        let timeStr = '';
        if (hours > 0) {
          timeStr = `через ${hours} ч ${mins} мин`;
        } else {
          timeStr = `через ${mins} мин`;
        }
        return { status: 'upcoming', text: timeStr, color: 'text-accent-purple bg-accent-purple/10 border-accent-purple/20' };
      } else {
        return { status: 'upcoming', text: 'Предстоит', color: 'text-text-secondary bg-white/5 border-white/5' };
      }
    }
  };

  // Star Rating Submit Handler
  const handleRatingSubmit = async (
    key: string,
    mTeach: number,
    mLesson: number,
    cTeach: string,
    cLesson: string,
    tTeach: number[],
    tLesson: number[]
  ) => {
    setSubmittingRating(true);
    setRatingErrorMessage(null);
    try {
      const response = await apiFetch(`/api/Schedule/feedback/evaluate-lesson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          mark_teach: mTeach,
          mark_lesson: mLesson,
          comment_teach: cTeach,
          comment_lesson: cLesson,
          tags_teach: tTeach,
          tags_lesson: tLesson
        })
      });

      if (!response.ok) {
        let errData;
        try {
          errData = await response.json();
        } catch {
          errData = null;
        }
        const errMsg = errData?.message || 'Ошибка сервера при отправке оценки.';
        throw new Error(errMsg);
      }

      // Success
      handleRatingSuccess(key);
    } catch (err: any) {
      console.warn('Failed to submit rating to server:', err.message);
      setRatingErrorMessage(err.message || 'Ошибка при отправке оценки.');
      setSubmittingRating(false);
    }
  };

  const handleRatingSuccess = (key: string) => {
    // Save to local storage to persist rating status
    const updatedRatings = [...ratedKeys, key];
    setRatedKeys(updatedRatings);
    localStorage.setItem('journal-rated-lessons', JSON.stringify(updatedRatings));

    // Sparkle particles
    const triggerCelebration = (window as any).triggerCelebration;
    if (triggerCelebration) {
      const rect = document.getElementById(`rating-container-${key}`)?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      triggerCelebration(x, y, 'rainbow');
      setTimeout(() => triggerCelebration(x, y, 'coins'), 200);
    }

    setRatingSuccessMessage('Спасибо за отзыв!');
    setSubmittingRating(false);
    setTeacherComment('');
    setLessonComment('');
    setSelectedTeacherTags([]);
    setSelectedLessonTags([]);

    setTimeout(() => {
      setRatingSuccessMessage(null);
      setActiveRatingLessonKey(null);
    }, 2000);
  };

  const renderLessonCard = (lesson: Lesson) => {
    const statusInfo = getLessonStatus(lesson);
    const isRateable = rateableLessons.some(rl => rl.key === lesson.key) && !ratedKeys.includes(lesson.key || '');
    
    return (
      <InteractiveGlowCard
        key={lesson.id}
        variants={cardVariants}
        glowColor={statusInfo.status === 'ongoing' ? 'rgba(0, 255, 194, 0.15)' : undefined}
        className={`border ${statusInfo.status === 'ongoing' ? 'border-accent-purple-soft/30 bg-accent-purple-soft/5' : 'border-white/5 bg-bg-card'}`}
      >
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          
          {/* Time Box */}
          <div 
            className="md:col-span-2 flex flex-col items-center rounded-2xl p-3.5 w-full max-w-[92px] font-mono mx-auto md:mx-0"
            style={{
              backgroundColor: 'var(--os-fg)',
              border: '1px solid rgba(139, 131, 115, 0.18)',
              boxShadow: 'inset 0 1px 0 rgb(var(--os-fg-rgb) / 0.6), 0 3px 8px rgba(25, 22, 17, 0.08)'
            }}
          >
            <span style={{ fontSize: '1.08rem', fontWeight: 900, color: 'var(--os-bg)', letterSpacing: '-0.02em', lineHeight: '1.1' }}>{lesson.started_at}</span>
            <div className="h-[1px] w-10 my-2" style={{ backgroundColor: 'rgba(25, 22, 17, 0.14)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(25, 22, 17, 0.75)', letterSpacing: '-0.01em', lineHeight: '1.1' }}>{lesson.finished_at}</span>
          </div>
          
          {/* Subject & Status Badges */}
          <div className="md:col-span-4 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-full ${statusInfo.color}`}>
                {statusInfo.text}
              </span>
              <span className="text-[10px] font-mono text-text-dim px-2 py-0.5 bg-white/5 rounded border border-white/5">
                {lesson.type_name}
              </span>
              {lesson.attendance_status === 1 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-accent-purple-muted/10 border border-accent-purple-muted/20 text-accent-purple-muted rounded-full flex items-center gap-1">
                  <Check size={10} />
                  Был
                </span>
              )}
              {lesson.attendance_status === 2 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-accent-purple/10 border border-accent-purple/20 text-accent-purple rounded-full flex items-center gap-1">
                  <Clock size={10} />
                  Опоздал
                </span>
              )}
              {lesson.attendance_status === 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#30ff44]/10 border border-[#30ff44]/20 text-[#30ff44] rounded-full flex items-center gap-1">
                  <X size={10} />
                  Не был
                </span>
              )}
              {statusInfo.status === 'completed' && (lesson.attendance_status === null || lesson.attendance_status === undefined) && (
                <span className="text-[10px] font-semibold px-2 py-0.5 bg-white/5 border border-white/10 text-text-dim rounded-full">
                  Нет отметки
                </span>
              )}
            </div>
            
            <h4 className="text-base font-bold text-text-primary leading-tight">{lesson.subject_name}</h4>
            <p className="text-xs text-text-secondary flex items-center gap-1.5">
              <MapPin size={12} className="text-text-dim" />
              {lesson.room_name}
            </p>
          </div>

          {/* Center: Theme details */}
          <div className="md:col-span-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-dim">Тема урока:</span>
            <p className="text-xs text-text-secondary leading-relaxed mt-0.5 italic break-words">
              «{lesson.lesson_theme}»
            </p>
          </div>

          {/* Right: Teacher and evaluation */}
          <div className="md:col-span-3 flex flex-col md:items-end items-center gap-3 w-full border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
            
            {/* Teacher Bio Badge */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {lesson.teacher_photo ? (
                  <img 
                    src={`https://fs.top-academy.ru/api/v1/files/${lesson.teacher_photo}/public`} 
                    alt={lesson.teacher_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <User size={14} className="text-accent-purple" />
                )}
              </div>
              <div className="text-left md:text-right">
                <p className="text-xs font-semibold text-text-primary leading-tight">{lesson.teacher_name}</p>
                <p className="text-[10px] text-text-dim">Преподаватель</p>
              </div>
            </div>

            {/* Evaluation Trigger Button */}
            {isRateable && (
              <button
                onClick={() => {
                  if (activeRatingLessonKey !== lesson.key) {
                    setEvaluationStep(1);
                    setTeacherRate(5);
                    setLessonRate(5);
                    setTeacherComment('');
                    setLessonComment('');
                    setSelectedTeacherTags([]);
                    setSelectedLessonTags([]);
                    setRatingErrorMessage(null);
                    setRatingSuccessMessage(null);
                  }
                  setActiveRatingLessonKey(activeRatingLessonKey === lesson.key ? null : (lesson.key || null));
                }}
                className="px-3 py-1.5 bg-accent-purple/10 border border-accent-purple/30 hover:border-accent-purple hover:bg-gradient-to-r from-[#30ff44] to-[#00ffc2] text-accent-purple hover:text-black text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={11} />
                Оценить занятие
              </button>
            )}

            {ratedKeys.includes(lesson.key || '') && (
              <div className="text-[10px] font-mono text-accent-purple-muted bg-accent-purple-muted/5 border border-accent-purple-muted/20 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <Check size={11} />
                Занятие оценено
              </div>
            )}

          </div>
        </div>

        {/* Expandable Evaluation Interface */}
        <AnimatePresence>
          {activeRatingLessonKey === lesson.key && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/5 bg-black/20 p-5"
              id={`rating-container-${lesson.key}`}
            >
              {/* Wizard Steps Progress Indicator */}
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-text-secondary">
                  Оценка занятия
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono font-bold transition-all ${evaluationStep === 1 ? 'text-accent-purple' : 'text-text-dim'}`}>
                      Шаг 1: Преподаватель
                    </span>
                    <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-purple transition-all duration-300"
                        style={{ width: evaluationStep === 1 ? '50%' : '100%' }}
                      />
                    </div>
                    <span className={`text-[10px] font-mono font-bold transition-all ${evaluationStep === 2 ? 'text-accent-purple' : 'text-text-dim'}`}>
                      Шаг 2: Урок
                    </span>
                  </div>
                </div>
              </div>

              {evaluationStep === 1 ? (
                // Step 1: Teacher Evaluation
                <div className="space-y-4">
                  <h5 className="text-[11px] font-bold font-mono text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <User size={12} className="text-accent-purple" />
                    Оцените работу преподавателя ({lesson.teacher_name}):
                  </h5>

                  {/* Stars Selection */}
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => {
                          setTeacherRate(star);
                          if (ratingErrorMessage) setRatingErrorMessage(null);
                        }}
                        onMouseEnter={() => setTeacherHoverRate(star)}
                        onMouseLeave={() => setTeacherHoverRate(null)}
                        className="p-1 text-text-dim hover:text-accent-purple transition-colors cursor-pointer"
                      >
                        <Star
                          size={20}
                          fill={(teacherHoverRate !== null ? star <= teacherHoverRate : star <= teacherRate) ? 'var(--accent-purple)' : 'none'}
                          stroke={(teacherHoverRate !== null ? star <= teacherHoverRate : star <= teacherRate) ? 'var(--accent-purple)' : 'currentColor'}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-mono text-text-secondary ml-2">
                      {teacherRate === 5 && 'Отлично'}
                      {teacherRate === 4 && 'Хорошо'}
                      {teacherRate === 3 && 'Нормально'}
                      {teacherRate === 2 && 'Плохо'}
                      {teacherRate === 1 && 'Ужасно'}
                    </span>
                  </div>

                  {/* Teacher Tags List */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-text-dim block uppercase tracking-wider">
                      Выберите теги (опционально):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {TEACHER_TAGS.map((tag) => {
                        const isSelected = selectedTeacherTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTeacherTags(selectedTeacherTags.filter(id => id !== tag.id));
                              } else {
                                setSelectedTeacherTags([...selectedTeacherTags, tag.id]);
                              }
                              if (ratingErrorMessage) setRatingErrorMessage(null);
                            }}
                            className={`px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer select-none ${
                              isSelected
                                ? 'bg-accent-purple/15 border-accent-purple text-accent-purple font-medium shadow-sm shadow-accent-purple/10'
                                : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/15 hover:text-text-primary'
                            }`}
                          >
                            {tag.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Teacher Comment */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-text-dim block uppercase tracking-wider">
                      Комментарий преподавателю (опционально):
                    </span>
                    <div className="relative">
                      <textarea
                        value={teacherComment}
                        onChange={(e) => {
                          setTeacherComment(e.target.value);
                          if (ratingErrorMessage) setRatingErrorMessage(null);
                        }}
                        placeholder="Оставьте отзыв о работе преподавателя..."
                        maxLength={500}
                        className={`w-full bg-bg-dark border outline-none p-3 text-xs text-text-primary rounded-xl placeholder-text-dim/60 resize-none min-h-[70px] transition-all ${
                          ((teacherRate <= 3 && teacherComment.length < 20) || (teacherComment.length > 0 && teacherComment.length < 20))
                            ? 'border-accent-purple focus:border-accent-purple'
                            : 'border-white/5 hover:border-white/10 focus:border-accent-purple'
                        }`}
                      />
                      <div className="absolute right-3 bottom-2 text-[10px] font-mono text-text-dim/50">
                        {teacherComment.length} / 500
                      </div>
                    </div>
                    {((teacherRate <= 3 && teacherComment.length < 20) || (teacherComment.length > 0 && teacherComment.length < 20)) && (
                      <span className="text-[10px] text-accent-purple font-mono block">
                        {teacherRate <= 3 && teacherComment.length === 0
                          ? '* При оценке 3 и менее комментарий обязателен (мин. 20 символов).'
                          : '* Минимальный размер комментария — 20 символов.'}
                      </span>
                    )}
                  </div>

                  {/* Info Labels */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-text-dim border-t border-white/5 pt-3">
                    <div className="flex items-center gap-1">
                      <HelpCircle size={11} className="text-accent-purple" />
                      <span>Оценки анонимны и преподавателям не предоставляются</span>
                    </div>
                    <div className="flex items-center gap-1 text-accent-purple bg-accent-purple/5 px-2 py-0.5 rounded-md border border-accent-purple/10 self-start sm:self-auto">
                      <span>Бонус: 1 коин за оценку</span>
                    </div>
                  </div>

                  {/* Navigation Actions for Step 1 */}
                  <div className="flex items-center justify-end border-t border-white/5 pt-3 mt-4 gap-2">
                    <button
                      onClick={() => {
                        setActiveRatingLessonKey(null);
                        setRatingErrorMessage(null);
                      }}
                      className="px-3 py-1.5 bg-transparent border border-white/5 text-text-secondary hover:text-text-primary text-[10px] font-mono rounded-lg transition-all cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      disabled={teacherRate <= 3 ? (teacherComment.length < 20 || teacherComment.length > 500) : (teacherComment.length > 0 && teacherComment.length < 20)}
                      onClick={() => setEvaluationStep(2)}
                      className="px-3 py-1.5 bg-gradient-to-r from-[#30ff44] to-[#00ffc2] hover:bg-accent-purple/90 disabled:opacity-30 disabled:pointer-events-none text-black text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow shadow-accent-purple/20"
                    >
                      Далее
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              ) : (
                // Step 2: Lesson Quality Evaluation
                <div className="space-y-4">
                  <h5 className="text-[11px] font-bold font-mono text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <AwardIcon size={12} className="text-accent-purple" />
                    Оцените качество урока (тема: {lesson.lesson_theme || 'не указана'}):
                  </h5>

                  {/* Stars Selection */}
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => {
                          setLessonRate(star);
                          if (ratingErrorMessage) setRatingErrorMessage(null);
                        }}
                        onMouseEnter={() => setLessonHoverRate(star)}
                        onMouseLeave={() => setLessonHoverRate(null)}
                        className="p-1 text-text-dim hover:text-accent-purple transition-colors cursor-pointer"
                      >
                        <Star
                          size={20}
                          fill={(lessonHoverRate !== null ? star <= lessonHoverRate : star <= lessonRate) ? 'var(--accent-purple)' : 'none'}
                          stroke={(lessonHoverRate !== null ? star <= lessonHoverRate : star <= lessonRate) ? 'var(--accent-purple)' : 'currentColor'}
                        />
                      </button>
                    ))}
                    <span className="text-xs font-mono text-text-secondary ml-2">
                      {lessonRate === 5 && 'Отлично'}
                      {lessonRate === 4 && 'Хорошо'}
                      {lessonRate === 3 && 'Нормально'}
                      {lessonRate === 2 && 'Плохо'}
                      {lessonRate === 1 && 'Ужасно'}
                    </span>
                  </div>

                  {/* Lesson Tags List */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-text-dim block uppercase tracking-wider">
                      Выберите теги (опционально):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {LESSON_TAGS.map((tag) => {
                        const isSelected = selectedLessonTags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedLessonTags(selectedLessonTags.filter(id => id !== tag.id));
                              } else {
                                setSelectedLessonTags([...selectedLessonTags, tag.id]);
                              }
                              if (ratingErrorMessage) setRatingErrorMessage(null);
                            }}
                            className={`px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer select-none ${
                              isSelected
                                ? 'bg-accent-purple/15 border-accent-purple text-accent-purple font-medium shadow-sm shadow-accent-purple/10'
                                : 'bg-white/5 border-white/5 text-text-secondary hover:border-white/15 hover:text-text-primary'
                            }`}
                          >
                            {tag.text}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Lesson Comment */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono text-text-dim block uppercase tracking-wider">
                      Комментарий к уроку (опционально):
                    </span>
                    <div className="relative">
                      <textarea
                        value={lessonComment}
                        onChange={(e) => {
                          setLessonComment(e.target.value);
                          if (ratingErrorMessage) setRatingErrorMessage(null);
                        }}
                        placeholder="Оставьте отзыв о самом материале урока..."
                        maxLength={500}
                        className={`w-full bg-bg-dark border outline-none p-3 text-xs text-text-primary rounded-xl placeholder-text-dim/60 resize-none min-h-[70px] transition-all ${
                          ((lessonRate <= 3 && lessonComment.length < 20) || (lessonComment.length > 0 && lessonComment.length < 20))
                            ? 'border-accent-purple focus:border-accent-purple'
                            : 'border-white/5 hover:border-white/10 focus:border-accent-purple'
                        }`}
                      />
                      <div className="absolute right-3 bottom-2 text-[10px] font-mono text-text-dim/50">
                        {lessonComment.length} / 500
                      </div>
                    </div>
                    {((lessonRate <= 3 && lessonComment.length < 20) || (lessonComment.length > 0 && lessonComment.length < 20)) && (
                      <span className="text-[10px] text-accent-purple font-mono block">
                        {lessonRate <= 3 && lessonComment.length === 0
                          ? '* При оценке 3 и менее комментарий обязателен (мин. 20 символов).'
                          : '* Минимальный размер комментария — 20 символов.'}
                      </span>
                    )}
                  </div>

                  {/* Info Labels */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] font-mono text-text-dim border-t border-white/5 pt-3">
                    <div className="flex items-center gap-1">
                      <HelpCircle size={11} className="text-accent-purple" />
                      <span>Оценки анонимны и преподавателям не предоставляются</span>
                    </div>
                    <div className="flex items-center gap-1 text-accent-purple bg-accent-purple/5 px-2 py-0.5 rounded-md border border-accent-purple/10 self-start sm:self-auto">
                      <span>Бонус: 1 коин за оценку</span>
                    </div>
                  </div>

                  {/* Submission and error states */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-3">
                    {ratingSuccessMessage ? (
                      <span className="text-xs font-mono text-accent-purple-muted flex items-center gap-1">
                        <Sparkles size={12} className="animate-pulse" />
                        {ratingSuccessMessage}
                      </span>
                    ) : ratingErrorMessage ? (
                      <span className="text-xs font-mono text-[#30ff44] flex items-center gap-1">
                        <AlertCircle size={12} className="text-[#30ff44]" />
                        {ratingErrorMessage}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-text-dim">
                        * Оценка отправляется в журнал Академии.
                      </span>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <button
                        disabled={submittingRating}
                        onClick={() => setEvaluationStep(1)}
                        className="px-3 py-1.5 bg-transparent border border-white/5 text-text-secondary hover:text-text-primary text-[10px] font-mono rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      >
                        <ChevronLeft size={11} />
                        Назад
                      </button>
                      <button
                        disabled={submittingRating || (lessonRate <= 3 ? (lessonComment.length < 20 || lessonComment.length > 500) : (lessonComment.length > 0 && lessonComment.length < 20))}
                        onClick={() => handleRatingSubmit(
                          lesson.key!,
                          teacherRate,
                          lessonRate,
                          teacherComment,
                          lessonComment,
                          selectedTeacherTags,
                          selectedLessonTags
                        )}
                        className="px-3 py-1.5 bg-gradient-to-r from-[#30ff44] to-[#00ffc2] hover:bg-accent-purple/90 disabled:opacity-30 disabled:pointer-events-none text-black text-[10px] font-mono uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow shadow-accent-purple/20"
                      >
                        {submittingRating ? <RefreshCw className="animate-spin" size={11} /> : <Send size={11} />}
                        Отправить
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </InteractiveGlowCard>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header with Navigation and Views */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-card p-4 rounded-xl border border-white/5 relative z-10">
        
        {/* Title & Date range info */}
        <div>
          <h2 className="text-xl font-bold font-sans text-glow text-text-primary">Расписание занятий</h2>
          <p className="text-xs text-text-secondary mt-1 flex items-center gap-1.5">
            <Clock size={12} />
            <span>Месяц: {formatMonthName(currentDate)}</span>
          </p>
        </div>

        {/* View Switcher (Week, Month, List) */}
        <div className="flex items-center bg-bg-dark border border-white/5 p-1 rounded-xl relative">
          {(['week', 'month', 'list'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'week') {
                  setCurrentDate(selectedDate);
                }
              }}
              className={`relative px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer z-10 ${
                activeTab === tab ? 'text-accent-purple' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="schedule-tab-pill"
                  className="absolute inset-0 bg-white/5 border border-white/10 rounded-lg shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {tab === 'week' && 'Неделя'}
              {tab === 'month' && 'Месяц'}
              {tab === 'list' && 'Список'}
            </button>
          ))}
        </div>

        {/* Date navigators */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 border border-white/5 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 border border-white/5 rounded-lg text-xs hover:bg-white/5 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            Текущий месяц
          </button>
          <button
            onClick={handleNext}
            className="p-2 border border-white/5 rounded-lg hover:bg-white/5 text-text-secondary hover:text-text-primary transition-all cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 border rounded-lg hover:bg-white/5 transition-all cursor-pointer ${
              showFilters ? 'border-accent-purple text-accent-purple bg-accent-purple/5' : 'border-white/5 text-text-secondary hover:text-text-primary'
            }`}
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* Expandable filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-bg-card p-4 rounded-xl border border-white/5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Subject Filter */}
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-text-dim mb-1">Предмет</label>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="w-full bg-bg-dark border border-white/5 rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent-purple transition-all"
                >
                  <option value="all">Все предметы</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Teacher Filter */}
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-text-dim mb-1">Преподаватель</label>
                <select
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                  className="w-full bg-bg-dark border border-white/5 rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent-purple transition-all"
                >
                  <option value="all">Все преподаватели</option>
                  {teachers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-wider text-text-dim mb-1">Тип занятия</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-bg-dark border border-white/5 rounded-lg p-2 text-xs text-text-primary outline-none focus:border-accent-purple transition-all"
                >
                  <option value="all">Все типы</option>
                  {lessonTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Schedule Panels */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading-spinner"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center justify-center min-h-[40vh] bg-bg-card border border-white/5 rounded-xl p-12 w-full"
          >
            <RefreshCw className="animate-spin text-accent-purple mb-3" size={24} />
            <p className="text-xs text-text-secondary">Синхронизация расписания с сервером Академии...</p>
          </motion.div>
        ) : (
          <motion.div
            key="schedule-content"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full"
          >
          
          {/* LEFT COLUMN: Week Visualizer or Calendar Cell Grid */}
          <div className="lg:col-span-8 space-y-6">

            {/* A. WEEK VIEW */}
            {activeTab === 'week' && (
              <div className="space-y-4">
                <div 
                  ref={handleScrollContainerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUpOrLeave}
                  onMouseLeave={handleMouseUpOrLeave}
                  className="flex gap-2 overflow-x-auto no-scrollbar select-none py-1 px-0.5"
                  style={{ cursor: isCursorGrabbing ? 'grabbing' : 'grab' }}
                >
                  {monthDays.map((day, idx) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());
                    const dayLessons = filteredLessons.filter(l => isSameDay(new Date(l.date_visit), day));
                    const hasLessons = dayLessons.length > 0;
                    
                    // Day name
                    const dayName = day.toLocaleDateString('ru-RU', { weekday: 'short' });
                    const dayNum = day.getDate();

                    return (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        data-active={isSelected}
                        onClick={(e) => {
                          if (dragMoved.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            return;
                          }
                          setSelectedDate(day);
                        }}
                        className={`flex flex-col items-center justify-between p-3 rounded-xl border transition-all cursor-pointer min-h-[90px] flex-shrink-0 w-[calc((100%-48px)/7)] relative ${
                          isSelected 
                            ? 'bg-accent-purple/10 border-accent-purple shadow-lg shadow-accent-purple/5' 
                            : isToday 
                              ? 'bg-accent-purple-soft/5 border-accent-purple-soft/30' 
                              : 'bg-bg-card border-white/5 hover:border-white/10'
                        }`}
                      >
                        {/* Day Name */}
                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                          isSelected ? 'text-accent-purple' : isToday ? 'text-accent-purple-soft' : 'text-text-secondary'
                        }`}>
                          {dayName}
                        </span>
                        
                        {/* Day Number */}
                        <span className={`text-lg font-bold font-mono ${
                          isSelected ? 'text-accent-purple' : isToday ? 'text-accent-purple-soft text-glow' : 'text-text-primary'
                        }`}>
                          {dayNum}
                        </span>

                        {/* Lesson Indicators */}
                        <div className="flex gap-1 justify-center mt-1">
                          {hasLessons ? (
                            dayLessons.map((l, i) => (
                              <span 
                                key={i} 
                                className={`w-1.5 h-1.5 rounded-full ${getDotColorClass(l)}`} 
                              />
                            ))
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                {/* Week view attendance legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-center p-3 bg-bg-card rounded-xl border border-white/5 text-[10px] font-mono text-text-dim">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-purple-muted" /> Присутствовал</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-purple" /> Опоздал</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#30ff44]" /> Отсутствовал</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-purple-soft" /> Предстоит / Другое</span>
                </div>
              </div>
            )}

            {/* B. MONTH VIEW */}
            {activeTab === 'month' && (
              <div className="bg-bg-card p-4 rounded-xl border border-white/5 space-y-4">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                    <span key={d} className="text-[10px] uppercase font-mono tracking-widest text-text-dim py-1">{d}</span>
                  ))}
                </div>
                
                {/* Calendar Cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarCells.map((cell, idx) => {
                    const isSelected = isSameDay(cell.date, selectedDate);
                    const isToday = isSameDay(cell.date, new Date());
                    const dayLessons = filteredLessons.filter(l => isSameDay(new Date(l.date_visit), cell.date));
                    const hasLessons = dayLessons.length > 0;
                    
                    return (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setSelectedDate(cell.date)}
                        className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center cursor-pointer relative transition-all ${
                          isSelected 
                            ? 'bg-accent-purple/10 border-accent-purple shadow shadow-accent-purple/10' 
                            : isToday 
                              ? 'bg-accent-purple-soft/5 border-accent-purple-soft/30' 
                              : cell.isCurrentMonth
                                ? 'bg-bg-dark border-white/5 hover:border-white/10'
                                : 'bg-bg-dark/20 border-transparent text-text-dim/30'
                        }`}
                      >
                        {/* Day number */}
                        <span className={`text-xs font-mono font-bold ${
                          !cell.isCurrentMonth
                            ? 'text-text-dim/30'
                            : isSelected 
                              ? 'text-accent-purple' 
                              : isToday 
                                ? 'text-accent-purple-soft' 
                                : 'text-text-primary'
                        }`}>
                          {cell.date.getDate()}
                        </span>

                        {/* Little Dots for lessons */}
                        <div className="flex flex-wrap gap-1 mt-1.5 min-h-[6px] items-center justify-center w-full">
                          {hasLessons ? (
                            dayLessons.map((l, i) => (
                              <span 
                                key={i} 
                                className={`w-1.5 h-1.5 rounded-full ${getDotColorClass(l)}`} 
                              />
                            ))
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Month view attendance legend */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-center pt-3 text-[10px] font-mono text-text-dim border-t border-white/5">
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-purple-muted" /> Присутствовал</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-purple" /> Опоздал</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#30ff44]" /> Отсутствовал</span>
                  <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent-purple-soft" /> Предстоит / Другое</span>
                </div>
              </div>
            )}

            {/* C. LIST VIEW OR SELECTED DAY CONTAINER */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-text-secondary">
                  {activeTab === 'list' ? 'Хронология занятий за месяц' : `Занятия на ${formatDateString(selectedDate)}`}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-white/5 rounded border border-white/5 text-text-dim">
                  Найдено: {activeTab === 'list' ? filteredLessons.length : selectedDayLessons.length}
                </span>
              </div>

              <div className="space-y-6">
                {activeTab === 'list' ? (
                  groupedLessonsByDate.length > 0 ? (
                    groupedLessonsByDate.map((group) => (
                      <div key={group.dateStr} className="space-y-3">
                        {/* Day Date Header */}
                        <div className="flex items-center gap-3 pt-4 pb-1">
                          <span className="text-[10px] font-bold font-mono text-accent-purple bg-accent-purple/10 border border-accent-purple/20 px-3 py-1 rounded-lg text-glow uppercase tracking-wider">
                            {group.dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                          <div className="h-[1px] flex-1 bg-white/5" />
                        </div>

                        {/* Lessons in this Day */}
                        <motion.div
                          variants={containerVariants}
                          initial="hidden"
                          animate="show"
                          className="space-y-3 pl-3 border-l border-white/5"
                        >
                          {group.lessons.map((lesson) => renderLessonCard(lesson))}
                        </motion.div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 bg-bg-card/40 border border-white/5 border-dashed rounded-xl text-center">
                      <CalendarDays className="text-text-dim/40 mb-3" size={28} />
                      <p className="text-sm font-bold text-text-secondary">Свободный день</p>
                      <p className="text-xs text-text-dim mt-1 max-w-[280px]">
                        На выбранную дату нет запланированных лекций или зачетов.
                      </p>
                    </div>
                  )
                ) : (
                  selectedDayLessons.length > 0 ? (
                    <motion.div
                      key={selectedDate.toDateString()}
                      variants={containerVariants}
                      initial="hidden"
                      animate="show"
                      className="space-y-3"
                    >
                      {selectedDayLessons.map((lesson) => renderLessonCard(lesson))}
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 bg-bg-card/40 border border-white/5 border-dashed rounded-xl text-center">
                      <CalendarDays className="text-text-dim/40 mb-3" size={28} />
                      <p className="text-sm font-bold text-text-secondary">Свободный день</p>
                      <p className="text-xs text-text-dim mt-1 max-w-[280px]">
                        На выбранную дату нет запланированных лекций или зачетов.
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Sidebar Stats & Information panel */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Next / Active lesson card */}
            {(activeLesson || nextLesson) && (
              <InteractiveGlowCard 
                glowColor={activeLesson ? "rgba(0, 255, 194, 0.12)" : "rgba(0, 230, 150, 0.08)"}
                className={activeLesson ? "border-accent-purple-soft/20" : ""}
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-accent-purple">Ближайшие события</h4>
                    <Sparkles size={14} className="text-accent-purple animate-pulse" />
                  </div>
                  
                  <div className="space-y-4 divide-y divide-white/5">
                    {/* Active Lesson */}
                    {activeLesson && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold font-mono text-accent-purple-soft bg-accent-purple-soft/10 border border-accent-purple-soft/20 px-2 py-0.5 rounded uppercase blink-status">
                            Идет сейчас
                          </span>
                          <span className="text-[10px] font-mono text-text-dim">
                            Кабинет {activeLesson.room_name}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-text-primary leading-snug">{activeLesson.subject_name}</h5>
                        <p className="text-xs text-text-secondary leading-normal italic">
                          «{activeLesson.lesson_theme}»
                        </p>
                        <div className="flex items-center gap-2 text-text-dim text-[11px]">
                          <User size={12} className="text-text-dim" />
                          <span>{activeLesson.teacher_name} ({activeLesson.started_at} - {activeLesson.finished_at})</span>
                        </div>
                      </div>
                    )}

                    {/* Next Lesson */}
                    {nextLesson && (
                      <div className={`space-y-2.5 ${activeLesson ? "pt-4" : ""}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold font-mono text-accent-purple bg-accent-purple/10 border border-accent-purple/20 px-2 py-0.5 rounded uppercase">
                            Предстоит следующим
                          </span>
                          <span className="text-[10px] font-mono text-text-dim">
                            Кабинет {nextLesson.room_name}
                          </span>
                        </div>
                        <h5 className="text-sm font-bold text-text-primary leading-snug">{nextLesson.subject_name}</h5>
                        <p className="text-xs text-text-secondary leading-normal italic">
                          «{nextLesson.lesson_theme}»
                        </p>
                        <div className="flex items-center gap-2 text-text-dim text-[11px]">
                          <User size={12} className="text-text-dim" />
                          <span>{nextLesson.teacher_name} (нач. в {nextLesson.started_at})</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </InteractiveGlowCard>
            )}


            {/* 2. Schedule stats summary */}
            <div className="bg-bg-card p-5 rounded-xl border border-white/5 space-y-4">
              <div>
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-text-primary">
                  {activeTab === 'week' ? 'Статистика за неделю' : 'Статистика за месяц'}
                </h4>
                <p className="text-[10px] text-text-dim mt-0.5 font-mono">
                  {activeTab === 'week' ? (
                    `${weekDays[0].toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'})} — ${weekDays[6].toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'})}`
                  ) : (
                    formatMonthName(currentDate)
                  )}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-dark/50 border border-white/5 p-3 rounded-lg text-center">
                  <span className="text-[10px] font-mono text-text-dim block uppercase">Всего пар</span>
                  <span className="text-2xl font-bold font-mono text-text-primary text-glow mt-1 block">
                    {statsLessons.length}
                  </span>
                </div>
                <div className="bg-bg-dark/50 border border-white/5 p-3 rounded-lg text-center">
                  <span className="text-[10px] font-mono text-text-dim block uppercase">Оценено</span>
                  <span className="text-2xl font-bold font-mono text-accent-purple-muted text-glow mt-1 block">
                    {statsRatedCount}
                  </span>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Лекции:</span>
                  <span className="font-mono text-text-primary">{statsLessons.filter(l => l.type_name === 'Лекция').length}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Практические:</span>
                  <span className="font-mono text-text-primary">{statsLessons.filter(l => l.type_name === 'Практика').length}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-text-secondary">
                  <span>Экзамены:</span>
                  <span className="font-mono text-accent-purple font-bold">{statsLessons.filter(l => l.type_name === 'Экзамен').length}</span>
                </div>
              </div>
            </div>

          </div>

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const getDotColorClass = (l: Lesson) => {
  const now = new Date();
  const lessonDate = new Date(l.date_visit);
  const [startH, startM] = l.started_at.split(':').map(Number);
  const lessonStart = new Date(lessonDate);
  lessonStart.setHours(startH, startM, 0, 0);

  const isUpcoming = now < lessonStart;

  if (!isUpcoming) {
    if (l.attendance_status === 1) return 'bg-accent-purple-muted';
    if (l.attendance_status === 2) return 'bg-accent-purple';
    if (l.attendance_status === 0) return 'bg-[#30ff44]';
  }

  if (l.type_name === 'Экзамен') return 'bg-red-500 animate-pulse';
  return 'bg-accent-purple-soft';
};

// Custom Icons
const AwardIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="8" r="7" />
    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
  </svg>
);

// Dynamic Mock Schedule Data Generator for fallback and testing
function generateMockLessons(dateStartStr: string, dateEndStr: string): Lesson[] {
  const mockLessons: Lesson[] = [];
  
  const start = new Date(dateStartStr);
  const end = new Date(dateEndStr);
  
  const subjectPool = [
    { name: 'Программирование C++', code: 'CPP', themes: ['Управление памятью и указатели', 'Принципы ООП. Наследование', 'Полиморфизм и шаблоны классов', 'Многопоточность в С++'] },
    { name: 'Python & Data Science', code: 'PY', themes: ['Анализ данных с Pandas', 'Линейная регрессия в ML', 'Нейронные сети и Keras', 'Создание скриптов автоматизации'] },
    { name: 'Web-разработка (HTML/JS)', code: 'HTML', themes: ['Адаптивная верстка с Flexbox/Grid', 'Работа с DOM деревом', 'Асинхронные запросы Fetch API', 'Интеграция с WebSocket'] },
    { name: 'Базы данных SQL', code: 'SQL', themes: ['Связи таблиц и JOIN запросы', 'Проектирование схемы БД', 'Индексы и ускорение поиска', 'Написание процедур и триггеров'] },
    { name: 'Java Enterprise', code: 'JAVA', themes: ['Spring Boot: Архитектура MVC', 'Интеграция Spring Data JPA', 'Авторизация с Spring Security', 'Сборка проектов с Maven'] },
    { name: 'Администрирование ОС', code: 'OS', themes: ['Управление процессами в Linux', 'Написание Bash скриптов', 'Настройка Docker контейнеров', 'Службы systemd и логирование'] }
  ];

  const teachers = [
    { name: 'Тоницой Владислав Андреевич', photo: null },
    { name: 'Коваленко Игорь Петрович', photo: null },
    { name: 'Иванова Анна Сергеевна', photo: null },
    { name: 'Романов Никита Олегович', photo: null }
  ];

  const types = ['Лекция', 'Практика'];
  let idCounter = 1000;

  // Iterate over each date
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0) continue; // Skip Sunday

    // 60% chance to have a lesson day
    const daySeed = (current.getFullYear() * 31 + current.getMonth() * 7 + current.getDate()) % 100;
    if (daySeed > 60) continue;

    // Format date visit
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    const dateVisitStr = `${y}-${m}-${d}`;

    const isPastDate = dateVisitStr < todayStr;
    const isToday = dateVisitStr === todayStr;

    const getMockAttendance = (finishedAt: string) => {
      const [endH, endM] = finishedAt.split(':').map(Number);
      const lessonEnd = new Date(now);
      lessonEnd.setHours(endH, endM, 0, 0);
      const isPastLesson = isPastDate || (isToday && now > lessonEnd);
      
      if (!isPastLesson) return undefined;
      
      const attendanceSeed = (idCounter + daySeed) % 100;
      if (attendanceSeed < 78) {
        return 1; // Был
      } else if (attendanceSeed < 90) {
        return 0; // Не был
      } else {
        return 2; // Опоздал
      }
    };

    // Select random subjects/teachers deterministically based on date seed
    const subIdx1 = (daySeed + 1) % subjectPool.length;
    const subj1 = subjectPool[subIdx1];
    
    const teachIdx1 = (daySeed + 2) % teachers.length;
    const teach1 = teachers[teachIdx1];
    
    const typeIdx1 = (daySeed + 3) % types.length;
    const type1 = types[typeIdx1];

    const themeIdx1 = (daySeed + 4) % subj1.themes.length;
    const theme1 = subj1.themes[themeIdx1];

    // Lesson 1: 09:00 - 10:30
    mockLessons.push({
      id: idCounter++,
      key: `lesson-key-${idCounter}`,
      date_visit: dateVisitStr,
      subject_name: subj1.name,
      room_name: `Аудитория ${200 + (daySeed % 15) * 5}`,
      teacher_name: teach1.name,
      teacher_photo: teach1.photo,
      lesson_theme: theme1,
      started_at: '09:00',
      finished_at: '10:30',
      type_name: type1,
      homework_status: daySeed % 3 === 0 ? 'submitted' : daySeed % 3 === 1 ? 'pending' : 'none',
      attendance_status: getMockAttendance('10:30')
    });

    // 30% chance for a second lesson
    if (daySeed < 25) {
      const subIdx2 = (daySeed + 5) % subjectPool.length;
      const subj2 = subjectPool[subIdx2];
      
      const teachIdx2 = (daySeed + 6) % teachers.length;
      const teach2 = teachers[teachIdx2];
      
      const typeIdx2 = (daySeed + 7) % types.length;
      const type2 = types[typeIdx2];

      const themeIdx2 = (daySeed + 8) % subj2.themes.length;
      const theme2 = subj2.themes[themeIdx2];

      // Lesson 2: 10:45 - 12:15
      mockLessons.push({
        id: idCounter++,
        key: `lesson-key-${idCounter}`,
        date_visit: dateVisitStr,
        subject_name: subj2.name,
        room_name: `Аудитория ${200 + ((daySeed + 3) % 15) * 5}`,
        teacher_name: teach2.name,
        teacher_photo: teach2.photo,
        lesson_theme: theme2,
        started_at: '10:45',
        finished_at: '12:15',
        type_name: type2,
        homework_status: 'none',
        attendance_status: getMockAttendance('12:15')
      });
    }

    // Exam day simulation on the 15th of the month
    if (current.getDate() === 15) {
      mockLessons.push({
        id: idCounter++,
        key: `lesson-key-${idCounter}`,
        date_visit: dateVisitStr,
        subject_name: subj1.name,
        room_name: 'Конференц-зал 1',
        teacher_name: teach1.name,
        teacher_photo: teach1.photo,
        lesson_theme: `Семестровый экзамен по "${subj1.name}"`,
        started_at: '13:00',
        finished_at: '14:30',
        type_name: 'Экзамен',
        homework_status: 'none',
        attendance_status: getMockAttendance('14:30')
      });
    }
  }

  // Sort chronologically
  return mockLessons.sort((a, b) => {
    const dCompare = a.date_visit.localeCompare(b.date_visit);
    if (dCompare !== 0) return dCompare;
    return a.started_at.localeCompare(b.started_at);
  });
}
