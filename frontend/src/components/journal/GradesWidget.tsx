import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  Search,
  User,
  Info,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Award,
  BookOpen,
  MapPin,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
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
  status_was?: number | null;
  comment?: string;
  teacher_comment?: string;
}

interface Exam {
  spec_name?: string;
  spec?: string;
  exam_date?: string;
  date?: string;
  teacher_name?: string;
  teacher?: string;
  examiner_name?: string;
  mark?: number | string | null;
  points?: number | null;
  is_passed?: boolean;
  status_name?: string;
  comment_teach?: string | null;
}

interface FutureExam {
  spec_name?: string;
  spec?: string;
  date: string;
  teacher_name?: string;
  teacher?: string;
  room?: string;
}

interface SubjectSummary {
  name: string;
  average: number;
  lessonsCount: number;
  rawVisits: Visit[];
}

interface GroupedDay {
  dateStr: string;
  rawDate: Date;
  visits: Visit[];
  status_was: number;
  weekdayName: string;
  averageMark: number | null;
  textColor: string;
  cellBg: string;
  cellBorder: string;
  cellBorderTop: string;
  cellBorderBottom: string;
  cellShadow: string;
  textGlow: string;
}

const getPairTime = (pNum: number) => {
  const times: { [key: number]: string } = {
    1: '08:30 - 10:00',
    2: '10:15 - 11:45',
    3: '12:15 - 13:45',
    4: '14:00 - 15:30',
    5: '15:45 - 17:15',
    6: '17:30 - 19:00',
    7: '19:15 - 20:45'
  };
  return times[pNum] || '—';
};

const isEmptyValue = (val: any) => {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  return str === '' || str === '—' || str === '-' || str === 'null' || str === 'undefined';
};

export default function GradesWidget() {

  const [activeTab, setActiveTab] = useState<'grid' | 'exams'>('grid');
  const [viewMode, setViewMode] = useState<'dates' | 'subjects' | 'pairs'>('dates');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw API Data
  const [visits, setVisits] = useState<Visit[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [futureExams, setFutureExams] = useState<FutureExam[]>([]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) return;

    setIsRefreshing(true);

    Promise.all([
      apiFetch('/api/Leaderboard/visits?bypassCache=true').then(res => res.ok ? res.json() : []),
      apiFetch('/api/Leaderboard/exams?bypassCache=true').then(res => res.ok ? res.json() : []),
      apiFetch('/api/Leaderboard/future-exams?bypassCache=true').then(res => res.ok ? res.json() : [])
    ])
      .then(([vData, eData, feData]) => {
        setVisits(vData);
        setExams(eData);
        setFutureExams(feData);

        sessionStorage.setItem('visits_data_jwt', JSON.stringify(vData));
        sessionStorage.setItem('exams_data_jwt', JSON.stringify(eData));
        sessionStorage.setItem('future_exams_data_jwt', JSON.stringify(feData));
        setIsRefreshing(false);
      })
      .catch(err => {
        console.error('Error refreshing grades:', err);
        setIsRefreshing(false);
      });
  };

  // Selection states
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc'>('date-desc');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'absent' | 'late'>('all');
  const [selectedMarkFilter, setSelectedMarkFilter] = useState<string | null>(null);
  const [visibleDaysCount, setVisibleDaysCount] = useState(36);
  const [visiblePairsCount, setVisiblePairsCount] = useState(120);

  // Expanded day details drawer
  const [selectedDay, setSelectedDay] = useState<GroupedDay | null>(null);
  const [clickedVisit, setClickedVisit] = useState<Visit | null>(null);

  // Custom dropdown states
  const [isSubjDropdownOpen, setIsSubjDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  const subjDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search query to prevent stuttering while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when any filter or view mode changes
  useEffect(() => {
    setVisibleDaysCount(36);
    setVisiblePairsCount(120);
  }, [searchQuery, selectedSubject, attendanceFilter, selectedMarkFilter, sortBy, viewMode]);

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
      setError('Не найдена авторизация. Войдите в аккаунт заново.');
      setLoading(false);
      return;
    }

    const cachedVisits = sessionStorage.getItem('visits_data_jwt');
    const cachedExams = sessionStorage.getItem('exams_data_jwt');
    const cachedFutureExams = sessionStorage.getItem('future_exams_data_jwt');

    let hasCache = false;
    if (cachedVisits) {
      try {
        setVisits(JSON.parse(cachedVisits));
        if (cachedExams) setExams(JSON.parse(cachedExams));
        if (cachedFutureExams) setFutureExams(JSON.parse(cachedFutureExams));
        setLoading(false);
        hasCache = true;
      } catch (e) {
        console.error('Failed to parse cached grades data', e);
      }
    }

    let isMounted = true;
    Promise.all([
      apiFetch('/api/Leaderboard/visits').then(res => res.ok ? res.json() : []),
      apiFetch('/api/Leaderboard/exams').then(res => res.ok ? res.json() : []),
      apiFetch('/api/Leaderboard/future-exams').then(res => res.ok ? res.json() : [])
    ])
      .then(([vData, eData, feData]) => {
        if (isMounted) {
          setVisits(vData);
          setExams(eData);
          setFutureExams(feData);

          sessionStorage.setItem('visits_data_jwt', JSON.stringify(vData));
          sessionStorage.setItem('exams_data_jwt', JSON.stringify(eData));
          sessionStorage.setItem('future_exams_data_jwt', JSON.stringify(feData));
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('Error fetching grades API:', err);
        if (isMounted && !hasCache) {
          setError('Не удалось загрузить данные об успеваемости.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Close custom dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (subjDropdownRef.current && !subjDropdownRef.current.contains(event.target as Node)) {
        setIsSubjDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Aggregate unique subjects list
  const uniqueSubjects = Array.from(new Set(visits.map(v => v.spec_name).filter(Boolean))).sort();

  // Helper definition of mark types with exact colors matching the user's screenshot
  const markTypes = [
    { key: 'home', label: 'Домашние задания', color: '#30ff44', field: 'home_work_mark' },
    { key: 'lab', label: 'Лабораторные работы', color: '#30ff44', field: 'lab_work_mark' },
    { key: 'class', label: 'Классная работа', color: '#00ffc2', field: 'class_work_mark' },
    { key: 'control', label: 'Контрольные работы', color: '#7dffc4', field: 'control_work_mark' },
    { key: 'practical', label: 'Практические работы', color: '#00ffc2', field: 'practical_work_mark' },
    { key: 'final', label: 'Итоговая контрольная', color: '#cfd8dc', field: 'final_work_mark' }
  ];

  // Get marks list for a cell
  const getCellMarks = (v: Visit) => {
    const list: { val: number; color: string; key: string; label: string }[] = [];
    markTypes.forEach(m => {
      const val = (v as any)[m.field];
      if (val !== undefined && val !== null) {
        list.push({ val: Number(val), color: m.color, key: m.key, label: m.label });
      }
    });
    return list;
  };

  const getShortLabel = (label: string) => {
    if (label.includes("Домашн")) return "Дом.";
    if (label.includes("Лабораторн")) return "Лаб.";
    if (label.includes("Классн")) return "Класс.";
    if (label.includes("Контрольн")) return "Контр.";
    if (label.includes("Практическ")) return "Практ.";
    if (label.includes("Итогов")) return "Итог.";
    return label;
  };


  // Precalculate pair index (lesson number) for each visit chronologically on its date,
  // as well as the absolute lesson index for each visit within its subject.
  const visitsWithPairNumber = useMemo(() => {
    const dateGroups: { [key: string]: Visit[] } = {};
    const subjectGroups: { [key: string]: Visit[] } = {};
    
    // Sort all raw visits chronologically (oldest first)
    const sortedRawVisits = [...visits].sort((a, b) => new Date(a.date_visit).getTime() - new Date(b.date_visit).getTime());
    
    return sortedRawVisits.map((v, idx) => {
      const dateKey = v.date_visit.split('T')[0];
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(v);
      
      const subjectKey = v.spec_name;
      if (!subjectGroups[subjectKey]) {
        subjectGroups[subjectKey] = [];
      }
      subjectGroups[subjectKey].push(v);
      
      return {
        ...v,
        _pairNum: dateGroups[dateKey].length,
        _subjectPairNum: subjectGroups[subjectKey].length,
        _overallNum: idx + 1
      };
    });
  }, [visits]);

  // Process visits and filter/sort them
  const { days: processedVisits, subjects: groupedSubjects, pairs: groupedPairs, daysMap } = useMemo(() => {
    // 1. Apply filters to the raw visits list
    const filteredVisits = visitsWithPairNumber.filter(v => {
      // Subject filter
      if (selectedSubject !== 'all' && v.spec_name !== selectedSubject) return false;

      // Smart Search filter
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.trim().toLowerCase();
        
        // 1. Theme match
        const themeMatch = v.lesson_theme?.toLowerCase().includes(query);
        
        // 2. Subject match
        const subjectMatch = v.spec_name?.toLowerCase().includes(query);
        
        // 3. Teacher match
        const teacherMatch = v.teacher_name?.toLowerCase().includes(query);
        
        // 4. Date match (checks raw date_visit, formatted date like "17.06.2026", and weekday)
        const dateMatch = v.date_visit.includes(query);
        
        const parts = v.date_visit.split('T')[0].split('-');
        const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : v.date_visit;
        const formattedDateMatch = formattedDate.includes(query);
        
        const weekdaysFull = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
        const weekdayIndex = new Date(v.date_visit).getDay();
        const weekdayMatch = weekdaysFull[weekdayIndex]?.includes(query);

        // 5. Lesson Number (Pair index & Overall sequence number) match: "пара 2", "1480 пара", "1480"
        let pairMatch = false;
        if (/^\d+$/.test(query)) {
          const num = parseInt(query, 10);
          if (v._pairNum === num || (v as any)._overallNum === num) pairMatch = true;
        } else {
          const pairRegexMatch = query.match(/(?:пара|пары|пара\s*#|пара\s*№|#)\s*(\d+)/) || query.match(/(\d+)\s*пара/);
          if (pairRegexMatch) {
            const num = parseInt(pairRegexMatch[1], 10);
            if (v._pairNum === num || (v as any)._overallNum === num) pairMatch = true;
          }
        }

        // 6. Grades match (checks if any of the marks obtained matches the query)
        const visitGrades = [
          v.home_work_mark,
          v.lab_work_mark,
          v.class_work_mark,
          v.control_work_mark,
          v.practical_work_mark,
          v.final_work_mark
        ].filter(g => g !== null && g !== undefined).map(Number);
        
        let gradeMatch = false;
        if (/^\d+$/.test(query)) {
          const num = parseInt(query, 10);
          if (visitGrades.includes(num)) gradeMatch = true;
        } else {
          const explicitGradeMatch = query.match(/(?:оценка|балл)\s*(\d+)/);
          if (explicitGradeMatch) {
            const num = parseInt(explicitGradeMatch[1], 10);
            if (visitGrades.includes(num)) gradeMatch = true;
          }
        }

        // 7. Work type match (e.g. "дз", "лаб", "контрольная")
        let workTypeMatch = false;
        if ((query === 'дз' || query.includes('домашн')) && v.home_work_mark !== null && v.home_work_mark !== undefined) workTypeMatch = true;
        if ((query === 'лаб' || query.includes('лабор')) && v.lab_work_mark !== null && v.lab_work_mark !== undefined) workTypeMatch = true;
        if ((query === 'класс' || query.includes('классн')) && v.class_work_mark !== null && v.class_work_mark !== undefined) workTypeMatch = true;
        if ((query === 'практ' || query.includes('практич')) && v.practical_work_mark !== null && v.practical_work_mark !== undefined) workTypeMatch = true;
        if ((query === 'контр' || query.includes('контрол')) && v.control_work_mark !== null && v.control_work_mark !== undefined) workTypeMatch = true;
        if ((query === 'итог' || query.includes('итогов')) && v.final_work_mark !== null && v.final_work_mark !== undefined) workTypeMatch = true;

        // 8. Attendance match (e.g. "был", "пропуск", "опоздание")
        let attendanceMatch = false;
        if ((query === 'пропуск' || query === 'н' || query === 'отсутствовал' || query === 'энка' || query === 'нка') && v.status_was === 0) attendanceMatch = true;
        if ((query === 'был' || query === 'присутствовал' || query === 'присутствие') && (v.status_was === 1 || v.status_was === null)) attendanceMatch = true;
        if ((query === 'опоздание' || query === 'опоздал') && v.status_was === 2) attendanceMatch = true;

        // 9. Comments match
        const commentMatch = v.comment?.toLowerCase().includes(query) || v.teacher_comment?.toLowerCase().includes(query);

        if (
          !themeMatch &&
          !subjectMatch &&
          !teacherMatch &&
          !dateMatch &&
          !formattedDateMatch &&
          !weekdayMatch &&
          !pairMatch &&
          !gradeMatch &&
          !workTypeMatch &&
          !attendanceMatch &&
          !commentMatch
        ) {
          return false;
        }
      }

      // Attendance filter
      if (attendanceFilter === 'absent' && v.status_was !== 0) return false;
      if (attendanceFilter === 'late' && v.status_was !== 2) return false;

      // Mark filter
      if (selectedMarkFilter) {
        const fieldMap: { [key: string]: string } = {
          home: 'home_work_mark',
          lab: 'lab_work_mark',
          class: 'class_work_mark',
          control: 'control_work_mark',
          practical: 'practical_work_mark',
          final: 'final_work_mark'
        };
        const targetField = fieldMap[selectedMarkFilter];
        if (targetField && ((v as any)[targetField] === undefined || (v as any)[targetField] === null)) {
          return false;
        }
      }

      return true;
    });

    // 2. Group filtered visits by date
    const localDaysMap: { [key: string]: Omit<GroupedDay, 'status_was' | 'weekdayName' | 'averageMark' | 'textColor' | 'cellBg' | 'cellBorder' | 'cellBorderTop' | 'cellBorderBottom' | 'cellShadow' | 'textGlow'> } = {};

    filteredVisits.forEach(v => {
      const parts = v.date_visit.split('T')[0].split('-');
      const dateStr = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : v.date_visit;
      
      if (!localDaysMap[dateStr]) {
        localDaysMap[dateStr] = {
          dateStr,
          rawDate: new Date(v.date_visit),
          visits: []
        };
      }
      
      localDaysMap[dateStr].visits.push(v);
    });

    const weekdays = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

    // 3. Aggregate status_was, precalculate styles and average mark for each day
    const days = Object.values(localDaysMap).map(day => {
      let status = 1;
      const totalVisits = day.visits.length;
      const absentCount = day.visits.filter(v => v.status_was === 0).length;
      const lateCount = day.visits.filter(v => v.status_was === 2).length;

      if (totalVisits > 0 && (absentCount / totalVisits) >= 0.5) {
        status = 0; // Absent (50% or more lessons missed)
      } else if (lateCount > 0) {
        status = 2; // Late (otherwise, if there is at least one late arrival)
      }

      const weekdayName = weekdays[day.rawDate.getDay()];

      const cellMarks: ReturnType<typeof getCellMarks> = [];
      day.visits.forEach(v => {
        cellMarks.push(...getCellMarks(v));
      });

      // Calculate average mark for the day
      const numericMarks = cellMarks.map(m => m.val).filter(val => typeof val === 'number' && !isNaN(val));
      const averageMark = numericMarks.length > 0
        ? Number((numericMarks.reduce((sum, val) => sum + val, 0) / numericMarks.length).toFixed(1))
        : null;

      let textColor = '#7dffc4';
      if (status === 0) {
        textColor = '#30ff44'; // Absent (red-orange)
      } else if (status === 2) {
        textColor = '#00ffc2'; // Late (yellow)
      }

      // Determine colors, borders, and shadows for the 3D Glass Capsule look matching UI Kit
      let cellBg = 'linear-gradient(135deg, rgb(var(--os-fg-rgb) / 0.04) 0%, rgb(var(--os-fg-rgb) / 0.01) 100%)';
      let cellBorder = '1px solid rgb(var(--os-fg-rgb) / 0.1)';
      let cellBorderTop = '1px solid rgb(var(--os-fg-rgb) / 0.25)'; // White specular top border
      let cellBorderBottom = '1px solid rgb(var(--os-fg-rgb) / 0.08)';
      let cellShadow = `
        inset 0 1px 0px 0px rgb(var(--os-fg-rgb) / 0.15),
        inset 0 4px 6px -2px rgb(var(--os-fg-rgb) / 0.08),
        inset 0 -4px 6px -2px rgba(0, 0, 0, 0.2),
        0 4px 10px rgba(0, 0, 0, 0.3)
      `;
      let textGlow = 'none';

      if (textColor !== '#7dffc4') {
        const hex = textColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // Keep background neutral but add a tiny, very subtle tint (5-15% opacity) to avoid visual noise
        cellBg = `linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, 0.15) 0%, rgba(${r}, ${g}, ${b}, 0.04) 100%)`;
        cellBorder = `1px solid rgba(${r}, ${g}, ${b}, 0.28)`; // Elegant subtle color border
        cellBorderTop = `1px solid rgb(var(--os-fg-rgb) / 0.38)`; // Specular highlight remains crisp white
        cellBorderBottom = `1px solid rgba(${r}, ${g}, ${b}, 0.15)`;
        
        // Soft, elegant colored shadow instead of high-saturation neon glow
        cellShadow = `
          inset 0 1px 0px 0px rgb(var(--os-fg-rgb) / 0.2),
          inset 0 4px 6px -2px rgb(var(--os-fg-rgb) / 0.1),
          inset 0 -4px 6px -2px rgba(0, 0, 0, 0.22),
          0 6px 14px -3px rgba(${r}, ${g}, ${b}, 0.25), /* Softened ambient glow */
          0 2px 4px -2px rgba(${r}, ${g}, ${b}, 0.15)
        `;
        
        // Elegant text glow for digital neon indication
        textGlow = `0 0 6px rgba(${r}, ${g}, ${b}, 0.65)`;
      }

      return {
        ...day,
        status_was: status,
        weekdayName,
        averageMark,
        textColor,
        cellBg,
        cellBorder,
        cellBorderTop,
        cellBorderBottom,
        cellShadow,
        textGlow
      } as GroupedDay;
    });

    // 4. Sort grouped days by rawDate
    const sortedDays = days.sort((a, b) => {
      const timeA = a.rawDate.getTime();
      const timeB = b.rawDate.getTime();
      return sortBy === 'date-asc' ? timeA - timeB : timeB - timeA;
    });

    // Create a fully-styled days map for subject timeline clicks
    const fullyStyledDaysMap: { [key: string]: GroupedDay } = {};
    sortedDays.forEach(day => {
      fullyStyledDaysMap[day.dateStr] = day;
    });

    // 5. Group by subjects
    const subjectsMap: {
      [key: string]: {
        name: string;
        visits: (Visit & { _pairNum: number })[];
        lessonsCount: number;
        average: number | null;
      }
    } = {};

    filteredVisits.forEach(v => {
      if (!subjectsMap[v.spec_name]) {
        subjectsMap[v.spec_name] = {
          name: v.spec_name,
          visits: [],
          lessonsCount: 0,
          average: null
        };
      }
      subjectsMap[v.spec_name].visits.push(v);
    });

    const subjects = Object.values(subjectsMap).map(subj => {
      // Sort visits inside each subject based on sortBy
      subj.visits.sort((a, b) => {
        const timeA = new Date(a.date_visit).getTime();
        const timeB = new Date(b.date_visit).getTime();
        return sortBy === 'date-asc' ? timeA - timeB : timeB - timeA;
      });
      subj.lessonsCount = subj.visits.length;

      // Calculate average mark for the subject
      const grades: number[] = [];
      subj.visits.forEach(v => {
        const visitGrades = [
          v.home_work_mark,
          v.lab_work_mark,
          v.class_work_mark,
          v.control_work_mark,
          v.practical_work_mark,
          v.final_work_mark
        ].filter(g => g !== null && g !== undefined).map(Number);
        grades.push(...visitGrades);
      });

      subj.average = grades.length > 0
        ? Number((grades.reduce((sum, val) => sum + val, 0) / grades.length).toFixed(2))
        : null;

      return subj;
    }).sort((a, b) => a.name.localeCompare(b.name));

    // 3. Sort pairs by overall sequence number
    const pairs = [...filteredVisits].sort((a, b) => {
      return sortBy === 'date-asc'
        ? (a as any)._overallNum - (b as any)._overallNum
        : (b as any)._overallNum - (a as any)._overallNum;
    });

    return { days: sortedDays, subjects, pairs, daysMap: fullyStyledDaysMap };
  }, [visits, selectedSubject, debouncedSearchQuery, attendanceFilter, selectedMarkFilter, sortBy]);

  // Paginated/Limited visible days for better performance
  const visibleDays = useMemo(() => {
    return processedVisits.slice(0, visibleDaysCount);
  }, [processedVisits, visibleDaysCount]);

  // Paginated/Limited visible pairs for better performance
  const visiblePairs = useMemo(() => {
    return (groupedPairs as any[]).slice(0, visiblePairsCount);
  }, [groupedPairs, visiblePairsCount]);

  // Filter out upcoming exams from the completed exams list
  const completedExams = useMemo(() => {
    return exams.filter(exam => {
      // 1. If it has a non-zero mark or points, it is considered completed/taken
      const hasMark = (!isEmptyValue(exam.mark) && Number(exam.mark) !== 0) || 
                      (!isEmptyValue(exam.points) && Number(exam.points) !== 0);
      if (hasMark) return true;

      // 2. If it has no mark, check if it has a valid exam date in the past
      const exDate = exam.exam_date || exam.date;
      if (isEmptyValue(exDate)) return false;

      const parsedDate = new Date(exDate);
      if (isNaN(parsedDate.getTime())) return false;

      // Filter out placeholder years (e.g. 0001, 1970)
      if (parsedDate.getFullYear() < 2000) return false;

      // If the date is in the future, it is not completed (it's upcoming)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const examDay = new Date(parsedDate);
      examDay.setHours(0, 0, 0, 0);

      return examDay.getTime() <= today.getTime();
    });
  }, [exams]);

  // Helper color map for grades values
  const getGradeTheme = (g: number) => {
    if (g === 0) return { text: '#7dffc4', border: 'rgb(var(--os-fg-rgb) / 0.08)', bg: 'rgb(var(--os-fg-rgb)/0.01)', label: 'Без оценок' };
    if (g >= 4.5 || g >= 10) return { text: '#7dffc4', border: 'rgba(125, 255, 196, 0.2)', bg: 'rgba(125, 255, 196, 0.03)', label: 'Отлично' };
    if (g >= 3.8 || g >= 8) return { text: '#30ff44', border: 'rgba(41, 121, 255, 0.2)', bg: 'rgba(41, 121, 255, 0.03)', label: 'Хорошо' };
    if (g >= 3.0 || g >= 6) return { text: '#00ffc2', border: 'rgba(255, 179, 0, 0.2)', bg: 'rgba(255, 179, 0, 0.03)', label: 'Удовл.' };
    return { text: '#30ff44', border: 'rgba(0, 230, 150, 0.2)', bg: 'rgba(0, 230, 150, 0.03)', label: 'Внимание' };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#30ff44]"></div>
        <p style={{ color: '#7dffc4', fontSize: '0.85rem', fontFamily: "'Fira Code', monospace" }}>Загрузка журнала оценок...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ background: 'var(--os-s1)', border: '1px solid rgba(0, 230, 150, 0.15)', borderRadius: '12px', padding: '2.5rem', textAlign: 'center', maxWidth: '420px' }}>
          <h3 style={{ color: '#30ff44', marginBottom: '0.75rem', fontFamily: "'Fira Code', monospace" }}>Ошибка соединения</h3>
          <p style={{ color: '#7dffc4', fontSize: '0.85rem', lineHeight: 1.5 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'relative',
        zIndex: 10,
        width: '100%'
      }}
    >
      {/* Title & Tabs switcher row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.25rem', position: 'relative', zIndex: 2 }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#30ff44', fontFamily: "'Inter', sans-serif", letterSpacing: '0.05em' }}>
          ОЦЕНКИ
        </h2>

        {/* Tab Switcher */}
        <div style={{
          marginLeft: 'auto',
          display: 'flex',
          background: 'rgb(var(--os-fg-rgb) / 0.02)',
          border: '1px solid rgb(var(--os-fg-rgb) / 0.06)',
          borderRadius: '24px',
          padding: '3px',
          boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.2)'
        }}>
          {[
            { id: 'grid', label: 'Журнал оценок' },
            { id: 'exams', label: 'Экзамены и зачеты' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none',
                borderRadius: '20px',
                color: activeTab === t.id ? '#ffffff' : '#7dffc4',
                fontWeight: activeTab === t.id ? 600 : 500,
                fontSize: '0.75rem',
                padding: '5px 16px',
                cursor: 'pointer',
                transition: 'color 0.2s ease',
                zIndex: 1
              }}
              className="hover:text-white"
            >
              {activeTab === t.id && (
                <motion.div
                  layoutId="activeMainTab"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgb(var(--os-fg-rgb) / 0.08)',
                    border: '1px solid rgb(var(--os-fg-rgb) / 0.05)',
                    borderRadius: '20px',
                    zIndex: -1,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2 }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main glass card container - Liquid Glass frosted look */}
      <div 
        className="liquid-glass" 
        style={{
          position: 'relative',
          zIndex: 1,
          borderRadius: '14px',
          padding: '1.75rem',
          overflow: 'hidden'
        }}
      >
        <AnimatePresence mode="wait">
          {activeTab === 'grid' && (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-4"
            >
              {/* DROPDOWNS & CONTROLS ROW */}
              <div style={{ display: 'flex', gap: '0.75rem', zIndex: 100, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Sort Dropdown */}
                <div ref={sortDropdownRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                    style={{
                      background: 'rgb(var(--os-bg-rgb) / 0.2)',
                      border: '1px solid rgb(var(--os-fg-rgb) / 0.06)',
                      borderRadius: '24px',
                      color: 'var(--os-fg)',
                      padding: '8px 18px',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      minWidth: '130px',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      boxShadow: 'inset 0 1px 1px rgb(var(--os-fg-rgb)/0.05)'
                    }}
                    className="hover:border-white/20 active:scale-95"
                  >
                    <span style={{ opacity: 0.85 }}>{sortBy === 'date-asc' ? 'По дате (сначала старые)' : 'По дате (сначала новые)'}</span>
                    <ChevronDown size={14} style={{ color: '#30ff44' }} />
                  </button>
                  <AnimatePresence>
                    {isSortDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          background: 'rgb(var(--os-bg-rgb) / 0.95)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.1)',
                          borderRadius: '12px',
                          minWidth: '220px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          zIndex: 110
                        }}
                      >
                        <button
                          onClick={() => { setSortBy('date-asc'); setIsSortDropdownOpen(false); }}
                          style={{
                            border: 'none',
                            padding: '8px 12px',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s ease'
                          }}
                          className={`transition-colors duration-150 ${
                            sortBy === 'date-asc'
                              ? 'bg-white/5 text-[#30ff44]'
                              : 'bg-transparent text-[#7dffc4] hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          По дате (сначала старые)
                        </button>
                        <button
                          onClick={() => { setSortBy('date-desc'); setIsSortDropdownOpen(false); }}
                          style={{
                            border: 'none',
                            padding: '8px 12px',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.15s ease'
                          }}
                          className={`transition-colors duration-150 ${
                            sortBy === 'date-desc'
                              ? 'bg-white/5 text-[#30ff44]'
                              : 'bg-transparent text-[#7dffc4] hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          По дате (сначала новые)
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Subject Dropdown */}
                <div ref={subjDropdownRef} style={{ position: 'relative', flex: 1, maxWidth: '280px' }}>
                  <button
                    onClick={() => setIsSubjDropdownOpen(!isSubjDropdownOpen)}
                    style={{
                      background: 'rgb(var(--os-bg-rgb) / 0.2)',
                      border: '1px solid rgb(var(--os-fg-rgb) / 0.06)',
                      borderRadius: '24px',
                      color: 'var(--os-fg)',
                      padding: '8px 18px',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                      boxShadow: 'inset 0 1px 1px rgb(var(--os-fg-rgb)/0.05)'
                    }}
                    className="hover:border-white/20 active:scale-95"
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
                      {selectedSubject === 'all' ? 'Все предметы' : selectedSubject}
                    </span>
                    <ChevronDown size={14} style={{ color: '#30ff44' }} />
                  </button>
                  <AnimatePresence>
                    {isSubjDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 6px)',
                          left: 0,
                          right: 0,
                          background: 'rgb(var(--os-bg-rgb) / 0.95)',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.1)',
                          borderRadius: '12px',
                          maxHeight: '260px',
                          overflowY: 'auto',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                          padding: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          zIndex: 110
                        }}
                      >
                        <button
                          onClick={() => { setSelectedSubject('all'); setIsSubjDropdownOpen(false); }}
                          style={{
                            border: 'none',
                            padding: '8px 12px',
                            fontSize: '0.75rem',
                            textAlign: 'left',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            transition: 'all 0.15s ease'
                          }}
                          className={`transition-colors duration-150 ${
                            selectedSubject === 'all'
                              ? 'bg-white/5 text-[#30ff44]'
                              : 'bg-transparent text-[#7dffc4] hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          Все предметы
                        </button>
                        {uniqueSubjects.map(subName => (
                          <button
                            key={subName}
                            onClick={() => { setSelectedSubject(subName); setIsSubjDropdownOpen(false); }}
                            style={{
                              border: 'none',
                              padding: '8px 12px',
                              fontSize: '0.75rem',
                              textAlign: 'left',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            className={`transition-colors duration-150 ${
                              selectedSubject === subName
                                ? 'bg-white/5 text-[#30ff44]'
                                : 'bg-transparent text-[#7dffc4] hover:bg-white/5 hover:text-white'
                            }`}
                            title={subName}
                          >
                            {subName}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* View Mode Switcher */}
                <div style={{
                  display: 'flex',
                  background: 'rgb(var(--os-bg-rgb) / 0.2)',
                  border: '1px solid rgb(var(--os-fg-rgb) / 0.06)',
                  borderRadius: '24px',
                  padding: '2px',
                  height: '38px',
                  alignItems: 'center',
                  flexShrink: 0
                }}>
                  <button
                    onClick={() => setViewMode('dates')}
                    style={{
                      position: 'relative',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '20px',
                      color: viewMode === 'dates' ? '#ffffff' : '#7dffc4',
                      fontSize: '0.72rem',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: viewMode === 'dates' ? 600 : 500,
                      height: '32px',
                      transition: 'color 0.2s ease',
                      zIndex: 1
                    }}
                    className={viewMode === 'dates' ? '' : 'hover:text-white'}
                  >
                    {viewMode === 'dates' && (
                      <motion.div
                        layoutId="activeViewModeTab"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgb(var(--os-fg-rgb) / 0.08)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.05)',
                          borderRadius: '20px',
                          zIndex: -1,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          backdropFilter: 'blur(4px)'
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Calendar size={12} style={{ color: viewMode === 'dates' ? '#30ff44' : 'inherit', zIndex: 2 }} />
                    <span style={{ zIndex: 2 }}>По датам</span>
                  </button>
                  <button
                    onClick={() => setViewMode('subjects')}
                    style={{
                      position: 'relative',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '20px',
                      color: viewMode === 'subjects' ? '#ffffff' : '#7dffc4',
                      fontSize: '0.72rem',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: viewMode === 'subjects' ? 600 : 500,
                      height: '32px',
                      transition: 'color 0.2s ease',
                      zIndex: 1
                    }}
                    className={viewMode === 'subjects' ? '' : 'hover:text-white'}
                  >
                    {viewMode === 'subjects' && (
                      <motion.div
                        layoutId="activeViewModeTab"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgb(var(--os-fg-rgb) / 0.08)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.05)',
                          borderRadius: '20px',
                          zIndex: -1,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          backdropFilter: 'blur(4px)'
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <BookOpen size={12} style={{ color: viewMode === 'subjects' ? '#30ff44' : 'inherit', zIndex: 2 }} />
                    <span style={{ zIndex: 2 }}>По предметам</span>
                  </button>
                  <button
                    onClick={() => setViewMode('pairs')}
                    style={{
                      position: 'relative',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '20px',
                      color: viewMode === 'pairs' ? '#ffffff' : '#7dffc4',
                      fontSize: '0.72rem',
                      padding: '6px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: viewMode === 'pairs' ? 600 : 500,
                      height: '32px',
                      transition: 'color 0.2s ease',
                      zIndex: 1
                    }}
                    className={viewMode === 'pairs' ? '' : 'hover:text-white'}
                  >
                    {viewMode === 'pairs' && (
                      <motion.div
                        layoutId="activeViewModeTab"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgb(var(--os-fg-rgb) / 0.08)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.05)',
                          borderRadius: '20px',
                          zIndex: -1,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          backdropFilter: 'blur(4px)'
                        }}
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Clock size={12} style={{ color: viewMode === 'pairs' ? '#30ff44' : 'inherit', zIndex: 2 }} />
                    <span style={{ zIndex: 2 }}>По парам</span>
                  </button>
                </div>

                {/* Theme/Date Search Input */}
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#6b6b6b' }} />
                  <input
                    type="text"
                    placeholder="Поиск по теме, предмету, дате или № пары..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgb(var(--os-bg-rgb) / 0.2)',
                      border: '1px solid rgb(var(--os-fg-rgb) / 0.06)',
                      borderRadius: '24px',
                      color: 'var(--os-fg)',
                      padding: '8px 18px 8px 36px',
                      fontSize: '0.75rem',
                      outline: 'none',
                      height: '38px',
                      boxShadow: 'inset 0 1px 1px rgb(var(--os-fg-rgb)/0.05)'
                    }}
                    className="hover:border-white/20 focus:border-white/35 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#7dffc4', cursor: 'pointer' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* LEGEND SECTION */}
              <div style={{
                background: 'rgb(var(--os-fg-rgb) / 0.01)',
                border: '1.5px solid rgb(var(--os-fg-rgb) / 0.04)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', rowGap: '0.5rem', fontSize: '0.72rem' }}>
                  {/* Attendance block */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <button
                      onClick={() => setAttendanceFilter(prev => prev === 'absent' ? 'all' : 'absent')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'transparent',
                        border: 'none',
                        color: '#7dffc4',
                        cursor: 'pointer',
                        fontWeight: attendanceFilter === 'absent' ? 700 : 500
                      }}
                    >
                      <div style={{
                        width: '11px',
                        height: '11px',
                        background: 'rgba(0, 230, 150, 0.12)',
                        border: '1px solid #30ff44',
                        borderRadius: '2px',
                        boxShadow: attendanceFilter === 'absent' ? 'inset 0 0 2px #30ff44' : 'none'
                      }} />
                      <span style={{ color: attendanceFilter === 'absent' ? '#30ff44' : '#7dffc4' }}>Пропуск</span>
                    </button>

                    <button
                      onClick={() => setAttendanceFilter(prev => prev === 'late' ? 'all' : 'late')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: 'transparent',
                        border: 'none',
                        color: '#7dffc4',
                        cursor: 'pointer',
                        fontWeight: attendanceFilter === 'late' ? 700 : 500
                      }}
                    >
                      <div style={{
                        width: '11px',
                        height: '11px',
                        background: 'rgba(255, 179, 0, 0.12)',
                        border: '1px solid #00ffc2',
                        borderRadius: '2px',
                        boxShadow: attendanceFilter === 'late' ? 'inset 0 0 2px #00ffc2' : 'none'
                      }} />
                      <span style={{ color: attendanceFilter === 'late' ? '#00ffc2' : '#7dffc4' }}>Опоздание</span>
                    </button>
                  </div>

                  <div style={{ width: '1px', height: '12px', background: 'rgb(var(--os-fg-rgb)/0.08)' }} />

                  {/* Marks legend block */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.8rem', rowGap: '0.4rem' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Оценка:</span>
                    {markTypes.map(m => {
                      const isSelected = selectedMarkFilter === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => setSelectedMarkFilter(prev => prev === m.key ? null : m.key)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'transparent',
                            border: 'none',
                            color: isSelected ? '#ffffff' : '#7dffc4',
                            cursor: 'pointer',
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '0.72rem'
                          }}
                        >
                          <div style={{ width: '7px', height: '7px', background: m.color, borderRadius: '50%', boxShadow: isSelected ? `0 0 0 2px rgb(var(--os-fg-rgb)/0.1)` : 'none' }} />
                          <span style={{ color: isSelected ? m.color : '#7dffc4' }}>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Reset Filters Option */}
                  {(attendanceFilter !== 'all' ||
                    selectedMarkFilter !== null ||
                    searchQuery !== '' ||
                    selectedSubject !== 'all' ||
                    sortBy !== 'date-desc') && (
                    <button
                      onClick={() => {
                        setAttendanceFilter('all');
                        setSelectedMarkFilter(null);
                        setSearchQuery('');
                        setSelectedSubject('all');
                        setSortBy('date-desc');
                      }}
                      style={{
                        marginLeft: 'auto',
                        background: 'transparent',
                        border: 'none',
                        color: '#30ff44',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </div>
              </div>

              {/* LESSON GRID MATRIX OR SUBJECT CARDS */}
              <AnimatePresence mode="wait">
                {viewMode === 'dates' ? (
                  processedVisits.length > 0 ? (
                    <motion.div
                      key="dates-grid"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                        gap: '0.65rem'
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        {visibleDays.map((day) => {
                        const isSelected = selectedDay?.dateStr === day.dateStr;
                        const formattedDate = day.dateStr;
                        const weekdayName = day.weekdayName;
                        const averageMark = day.averageMark;

                        let cellBg = day.cellBg;
                        let cellBorder = day.cellBorder;
                        let cellBorderTop = day.cellBorderTop;
                        let cellBorderBottom = day.cellBorderBottom;
                        let cellShadow = day.cellShadow;

                        if (isSelected) {
                          cellBorder = '1px solid #30ff44';
                          cellBorderTop = '1.5px solid #30ff44';
                          cellShadow = '0 0 12px rgba(0, 230, 150, 0.45), inset 0 1px 0px rgb(var(--os-fg-rgb)/0.3)';
                        }

                        return (
                          <motion.div
                            layout="position"
                            key={day.dateStr}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                            transition={{
                              opacity: { duration: 0.22 },
                              scale: { duration: 0.22 },
                              y: { duration: 0.22 },
                              layout: { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.42 }
                            }}
                            whileHover={{ scale: 1.03 }}
                            onClick={() => {
                              setClickedVisit(null);
                              setSelectedDay(day);
                            }}
                            style={{
                              position: 'relative',
                              background: cellBg,
                              border: cellBorder,
                              borderTop: cellBorderTop,
                              borderBottom: cellBorderBottom,
                              borderRadius: '12px', /* Highly rounded corners like capsules in UI Kit */
                              boxShadow: cellShadow,
                              backdropFilter: 'blur(8px)',
                              WebkitBackdropFilter: 'blur(8px)',
                              minHeight: '80px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem 1.1rem',
                              gap: '0.75rem',
                              transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease'
                            }}
                          >
                            {/* Date info stack */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', position: 'relative', zIndex: 5 }}>
                              {/* Short Weekday Name */}
                              <span style={{
                                fontSize: '0.65rem',
                                color: 'var(--text-primary)',
                                opacity: 0.45,
                                fontFamily: "'Fira Code', monospace",
                                fontWeight: 700
                              }}>
                                {weekdayName}
                              </span>

                              {/* Date */}
                              <span style={{
                                fontSize: '0.92rem',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                opacity: 0.9,
                                fontFamily: "'Fira Code', monospace",
                                letterSpacing: '-0.01em'
                              }}>
                                {formattedDate}
                              </span>
                            </div>

                            {/* Large, premium average grade badge */}
                            {averageMark !== null && (
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'rgb(var(--os-fg-rgb) / 0.03)',
                                border: '1px solid rgb(var(--os-fg-rgb) / 0.08)',
                                boxShadow: 'inset 0 1px 2px rgb(var(--os-fg-rgb) / 0.05), 0 2px 6px rgba(0, 0, 0, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                zIndex: 5,
                                flexShrink: 0
                              }}>
                                <span style={{
                                  fontSize: '1.05rem',
                                  fontWeight: 800,
                                  color: '#7dffc4', // Pleasant coral orange
                                  fontFamily: "'Fira Code', monospace",
                                  textShadow: '0 0 8px rgba(255, 122, 80, 0.35)'
                                }}>
                                  {averageMark}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                      {/* "Show more" button for pagination */}
                      {processedVisits.length > visibleDaysCount && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', width: '100%', gridColumn: '1 / -1' }}>
                          <button
                            onClick={() => setVisibleDaysCount(prev => prev + 36)}
                            className="hover:bg-white/[0.08] hover:border-white/20 transition-all"
                            style={{
                              background: 'rgb(var(--os-fg-rgb)/0.03)',
                              border: '1px solid rgb(var(--os-fg-rgb)/0.08)',
                              borderRadius: '20px',
                              color: 'var(--os-fg)',
                              fontSize: '0.75rem',
                              padding: '8px 24px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            Показать еще
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="dates-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '30vh', color: '#7dffc4', fontSize: '0.82rem', border: '1px dashed rgb(var(--os-fg-rgb)/0.05)', borderRadius: '8px', padding: '2rem' }}
                    >
                      <Info size={18} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      По заданным критериям фильтрации занятий не найдено.
                    </motion.div>
                  )
                ) : viewMode === 'subjects' ? (
                  groupedSubjects.length > 0 ? (
                    <motion.div
                      key="subjects-grid"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '1rem'
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        {groupedSubjects.map((subj) => {
                        const hasAverage = subj.average !== null;
                        const avg = subj.average || 0;
                        const gradeTheme = getGradeTheme(avg);
                        
                        return (
                          <motion.div
                            layout="position"
                            key={subj.name}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                            transition={{
                              opacity: { duration: 0.22 },
                              scale: { duration: 0.22 },
                              y: { duration: 0.22 },
                              layout: { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.42 }
                            }}
                            className="liquid-glass"
                            style={{
                              padding: '1.25rem',
                              borderRadius: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.85rem',
                              background: 'linear-gradient(135deg, rgb(var(--os-fg-rgb) / 0.03) 0%, rgb(var(--os-fg-rgb) / 0.005) 100%)',
                              border: '1px solid rgb(var(--os-fg-rgb) / 0.06)',
                              boxShadow: 'inset 0 1px 0px rgb(var(--os-fg-rgb) / 0.08), 0 4px 15px rgba(0, 0, 0, 0.2)',
                              backdropFilter: 'blur(10px)',
                              WebkitBackdropFilter: 'blur(10px)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgb(var(--os-fg-rgb) / 0.06)', paddingBottom: '0.65rem' }}>
                                <div style={{ flex: 1, minWidth: 0, paddingRight: '0.5rem' }}>
                                  <h3 style={{
                                    fontSize: '0.88rem',
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    margin: 0
                                  }} title={subj.name}>
                                    {subj.name}
                                  </h3>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-primary)', opacity: 0.6 }}>
                                    Занятий: {subj.lessonsCount}
                                  </span>
                                </div>
                                
                                {hasAverage && (
                                  <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'rgb(var(--os-fg-rgb) / 0.03)',
                                    border: '1px solid rgb(var(--os-fg-rgb) / 0.08)',
                                    boxShadow: 'inset 0 1px 2px rgb(var(--os-fg-rgb) / 0.05), 0 2px 6px rgba(0, 0, 0, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                  }} title={`Средний балл: ${avg.toFixed(2)}`}>
                                    <span style={{
                                      fontSize: '1.05rem',
                                      fontWeight: 800,
                                      color: '#7dffc4',
                                      fontFamily: "'Fira Code', monospace",
                                      textShadow: '0 0 8px rgba(255, 122, 80, 0.35)',
                                      lineHeight: '1',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      {avg.toFixed(1)}
                                    </span>
                                  </div>
                                )}
                              </div>
 
                              {/* Lessons Timeline List */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                maxHeight: '240px',
                                overflowY: 'auto',
                                paddingRight: '4px'
                              }} className="no-scrollbar">
                                {subj.visits.map((v, vIdx) => {
                                  const parts = v.date_visit.split('T')[0].split('-');
                                  const dateStr = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : v.date_visit;
                                  const lessonMarks = getCellMarks(v);
                                  
                                  // Attendance status colors
                                  let statusColor = '#7dffc4'; // Был (green)
                                  if (v.status_was === 0) statusColor = '#30ff44'; // Пропуск (red)
                                  else if (v.status_was === 2) statusColor = '#00ffc2'; // Опоздание (yellow)
 
                                  return (
                                    <div
                                      key={vIdx}
                                      onClick={() => {
                                        const dayObj = daysMap[dateStr];
                                        if (dayObj) {
                                          setClickedVisit(v);
                                          setSelectedDay(dayObj);
                                        }
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.5rem 0.65rem',
                                        background: 'rgb(var(--os-fg-rgb) / 0.01)',
                                        border: '1px solid rgb(var(--os-fg-rgb) / 0.03)',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                      className="hover:bg-white/[0.04] hover:border-white/[0.08] hover:translate-x-1"
                                    >
                                      {/* Left: Status Dot & Date */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{
                                          width: '6px',
                                          height: '6px',
                                          borderRadius: '50%',
                                          background: statusColor,
                                          boxShadow: `0 0 6px ${statusColor}`
                                        }} />
                                        <span style={{
                                          fontSize: '0.75rem',
                                          color: 'var(--text-primary)',
                                          fontFamily: "'Fira Code', monospace"
                                        }}>
                                          {dateStr}
                                        </span>
                                        {(v as any)._subjectPairNum && (
                                          <span style={{
                                            fontSize: '0.65rem',
                                            color: 'var(--text-primary)',
                                            opacity: 0.5,
                                            fontFamily: "'Fira Code', monospace"
                                          }}>
                                            зан. #{(v as any)._subjectPairNum}
                                          </span>
                                        )}
                                      </div>

                                      {/* Right: Grades List */}
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        {lessonMarks.length > 0 ? (
                                          lessonMarks.map((m, mIdx) => (
                                            <div
                                              key={mIdx}
                                              style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                background: `${m.color}15`,
                                                border: `1px solid ${m.color}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                              }}
                                              title={m.label}
                                            >
                                              <span style={{
                                                fontSize: '0.68rem',
                                                fontWeight: 800,
                                                color: m.color,
                                                fontFamily: "'Fira Code', monospace"
                                              }}>
                                                {m.val}
                                              </span>
                                            </div>
                                          ))
                                        ) : (
                                          v.status_was === 0 ? (
                                            <span style={{ fontSize: '0.62rem', color: '#30ff44', fontWeight: 600, opacity: 0.7 }}>
                                              Пропуск
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: '0.62rem', color: '#7dffc4', opacity: 0.35 }}>
                                              —
                                            </span>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="subjects-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '30vh', color: '#7dffc4', fontSize: '0.82rem', border: '1px dashed rgb(var(--os-fg-rgb)/0.05)', borderRadius: '8px', padding: '2rem' }}
                    >
                      <Info size={18} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      По заданным критериям фильтрации предметов не найдено.
                    </motion.div>
                  )
                ) : (
                  groupedPairs.length > 0 ? (
                    <motion.div
                      key="pairs-grid"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                        gap: '0.5rem'
                      }}
                    >
                      <AnimatePresence mode="popLayout">
                        {visiblePairs.map((v, vIdx) => {
                        const lessonMarks = getCellMarks(v);
                        const parts = v.date_visit.split('T')[0].split('-');
                        const dateStr = parts.length === 3 ? `${parts[2]}.${parts[1]}` : v.date_visit;
                        const fullDateStr = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : v.date_visit;

                        const isSelected = clickedVisit && 
                          clickedVisit.date_visit === v.date_visit && 
                          clickedVisit.spec_name === v.spec_name && 
                          (clickedVisit as any)._pairNum === (v as any)._pairNum;

                        // Background & styling based on attendance status
                        let cellBg = 'linear-gradient(135deg, rgb(var(--os-fg-rgb) / 0.03) 0%, rgb(var(--os-fg-rgb) / 0.005) 100%)';
                        let cellBorder = '1px solid rgb(var(--os-fg-rgb) / 0.06)';
                        let cellShadow = 'inset 0 1px 0px rgb(var(--os-fg-rgb) / 0.05), 0 4px 10px rgba(0, 0, 0, 0.15)';
                        
                        if (v.status_was === 0) { // Absent
                          cellBg = 'linear-gradient(135deg, rgba(0, 230, 150, 0.12) 0%, rgba(0, 230, 150, 0.03) 100%)';
                          cellBorder = '1px solid rgba(0, 230, 150, 0.22)';
                          cellShadow = 'inset 0 1px 0px rgb(var(--os-fg-rgb) / 0.05), 0 4px 10px rgba(0, 230, 150, 0.05)';
                        } else if (v.status_was === 2) { // Late
                          cellBg = 'linear-gradient(135deg, rgba(255, 179, 0, 0.12) 0%, rgba(255, 179, 0, 0.03) 100%)';
                          cellBorder = '1px solid rgba(255, 179, 0, 0.22)';
                          cellShadow = 'inset 0 1px 0px rgb(var(--os-fg-rgb) / 0.05), 0 4px 10px rgba(255, 179, 0, 0.05)';
                        }

                        if (isSelected) {
                          cellBorder = '1px solid #30ff44';
                          cellShadow = '0 0 12px rgba(0, 230, 150, 0.45), inset 0 1px 0px rgb(var(--os-fg-rgb)/0.2)';
                        }

                        return (
                          <motion.div
                            layout="position"
                            key={(v as any)._overallNum || vIdx}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                            transition={{
                              opacity: { duration: 0.22 },
                              scale: { duration: 0.22 },
                              y: { duration: 0.22 },
                              layout: { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.42 }
                            }}
                            whileHover={{ scale: 1.05, y: -2, transition: { duration: 0.12 } }}
                            onClick={() => {
                              const dayObj = daysMap[fullDateStr];
                              if (dayObj) {
                                setClickedVisit(v);
                                setSelectedDay(dayObj);
                              }
                            }}
                            title={`${v.spec_name}\nДата: ${fullDateStr}\nПара #${v._pairNum}\nТема: ${v.lesson_theme || '—'}\nПреподаватель: ${v.teacher_name || '—'}`}
                            style={{
                              position: 'relative',
                              background: cellBg,
                              border: cellBorder,
                              borderRadius: '8px',
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: '82px',
                              cursor: 'pointer',
                              boxShadow: cellShadow,
                              transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease'
                            }}
                          >
                            {/* Date (Top) */}
                            <span style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-primary)',
                              opacity: 0.65,
                              fontFamily: "'Fira Code', monospace",
                              fontWeight: 500,
                              lineHeight: 1
                            }}>
                              {fullDateStr}
                            </span>

                            {/* Sequence Number (Center) */}
                            <span style={{
                              fontSize: '1.35rem',
                              fontWeight: 800,
                              color: 'var(--text-primary)',
                              fontFamily: "'Fira Code', monospace",
                              lineHeight: 1,
                              margin: '2px 0',
                              textShadow: '0 0 8px rgba(242, 235, 217, 0.15)'
                            }}>
                              {(v as any)._overallNum}
                            </span>

                            {/* Grades / Status (Bottom) */}
                            <div style={{ display: 'flex', gap: '4.5px', height: '20px', alignItems: 'center', justifyContent: 'center' }}>
                              {lessonMarks.length > 0 ? (
                                lessonMarks.map((m, mIdx) => (
                                  <div
                                    key={mIdx}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      background: `${m.color}15`,
                                      border: `1.5px solid ${m.color}`,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}
                                    title={m.label}
                                  >
                                    <span style={{
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      color: m.color,
                                      fontFamily: "'Fira Code', monospace"
                                    }}>
                                      {m.val}
                                    </span>
                                  </div>
                                ))
                              ) : (
                                v.status_was === 0 ? (
                                  <span style={{ fontSize: '0.72rem', color: '#30ff44', fontWeight: 800, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                    Н
                                  </span>
                                ) : (
                                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgb(var(--os-fg-rgb) / 0.15)' }} />
                                )
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>

                      {/* "Show more" button for pagination */}
                      {groupedPairs.length > visiblePairsCount && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', width: '100%', gridColumn: '1 / -1' }}>
                          <button
                            onClick={() => setVisiblePairsCount(prev => prev + 120)}
                            className="hover:bg-white/[0.08] hover:border-white/20 transition-all"
                            style={{
                              background: 'rgb(var(--os-fg-rgb)/0.03)',
                              border: '1px solid rgb(var(--os-fg-rgb)/0.08)',
                              borderRadius: '20px',
                              color: 'var(--os-fg)',
                              fontSize: '0.75rem',
                              padding: '8px 24px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            Показать еще
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="pairs-empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '30vh', color: '#7dffc4', fontSize: '0.82rem', border: '1px dashed rgb(var(--os-fg-rgb)/0.05)', borderRadius: '8px', padding: '2rem' }}
                    >
                      <Info size={18} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                      По заданным критериям фильтрации пар не найдено.
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              {/* DETAILS CENTERED MODAL OVERLAY */}
              {createPortal(
                <AnimatePresence>
                  {selectedDay && (
                    <div style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      zIndex: 9999, // High z-index on portal to cover navbar/hud/sidebar
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '1.5rem'
                    }}>
                      {/* Glassmorphic Backdrop */}
                      <motion.div
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        onClick={() => { setSelectedDay(null); setClickedVisit(null); }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0, 0, 0, 0.65)',
                          cursor: 'pointer'
                        }}
                      />

                      {/* Modal Content */}
                      <motion.div
                        initial={{ scale: 0.94, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.94, opacity: 0 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                        className="liquid-glass"
                        style={{
                          position: 'relative',
                          zIndex: 10,
                          width: '100%',
                          maxWidth: '720px',
                          maxHeight: '85vh',
                          background: 'linear-gradient(135deg, rgb(var(--os-fg-rgb) / 0.04) 0%, rgb(var(--os-fg-rgb) / 0.01) 100%), rgb(var(--os-bg-rgb) / 0.88)',
                          borderRadius: '16px',
                          padding: '1.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1.25rem',
                          boxShadow: 'inset 0 1px 0px rgb(var(--os-fg-rgb) / 0.22), 0 25px 60px rgba(0, 0, 0, 0.75)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.12)'
                        }}
                      >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                          <div>
                            <span style={{ fontSize: '0.62rem', color: '#30ff44', fontWeight: 700, textTransform: 'uppercase', fontFamily: "'Fira Code', monospace" }}>
                              Расписание и оценки за день
                            </span>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--os-fg)', marginTop: '0.2rem' }}>
                              {selectedDay.dateStr}
                            </h3>
                          </div>
                          <button
                            onClick={() => { setSelectedDay(null); setClickedVisit(null); }}
                            style={{
                              background: 'rgb(var(--os-fg-rgb)/0.02)',
                              border: '1px solid rgb(var(--os-fg-rgb)/0.05)',
                              borderRadius: '6px',
                              color: '#7dffc4',
                              padding: '5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}
                            className="hover:text-white"
                          >
                            <X size={15} />
                          </button>
                        </div>

                        {/* Day's Lessons List */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '4px', maxHeight: 'calc(85vh - 130px)' }} className="no-scrollbar">
                          {selectedDay.visits.map((v, vIdx) => {
                            const lessonMarks = getCellMarks(v);
                            const isHighlighted = clickedVisit && 
                              clickedVisit.date_visit === v.date_visit && 
                              clickedVisit.spec_name === v.spec_name && 
                              (clickedVisit as any)._pairNum === (v as any)._pairNum;

                            return (
                              <motion.div 
                                key={vIdx}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: vIdx * 0.08, type: 'spring', stiffness: 150 }}
                                style={{
                                  background: isHighlighted 
                                    ? 'linear-gradient(135deg, rgba(0, 230, 150, 0.08) 0%, rgba(0, 230, 150, 0.02) 100%)' 
                                    : 'rgb(var(--os-fg-rgb) / 0.02)',
                                  border: isHighlighted 
                                    ? '1px solid rgba(0, 230, 150, 0.35)' 
                                    : '1px solid rgb(var(--os-fg-rgb) / 0.05)',
                                  borderLeft: isHighlighted 
                                    ? '3px solid #30ff44' 
                                    : '3px solid transparent',
                                  boxShadow: isHighlighted 
                                    ? '0 0 15px rgba(0, 230, 150, 0.15), inset 0 1px 0px rgb(var(--os-fg-rgb) / 0.1)' 
                                    : 'none',
                                  borderRadius: '12px',
                                  padding: '0.85rem 1rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem',
                                  position: 'relative'
                                }}
                              >
                                {/* Upper Row: Left & Right info */}
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-stretch gap-4 w-full">
                                  
                                  {/* Left Column: Subject, Teacher, Theme */}
                                  <div className="flex-1 flex flex-col gap-1.5 w-full">
                                    <span style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 700,
                                      color: 'rgb(var(--os-fg-rgb) / 0.3)',
                                      fontFamily: "'Fira Code', monospace"
                                    }}>
                                      ПАРА #{vIdx + 1}
                                    </span>

                                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--os-fg)', display: 'block', lineHeight: 1.25 }}>
                                      {v.spec_name}
                                    </span>

                                    {v.teacher_name && (
                                      <span style={{ fontSize: '0.68rem', color: '#7dffc4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <User size={10} style={{ color: '#30ff44' }} /> {v.teacher_name}
                                      </span>
                                    )}

                                    {v.lesson_theme && (
                                      <div style={{
                                        fontSize: '0.72rem',
                                        color: '#7dffc4',
                                        fontStyle: 'italic',
                                        marginTop: '0.15rem'
                                      }}>
                                        <span style={{ fontSize: '0.6rem', color: '#30ff44', fontWeight: 700, textTransform: 'uppercase', fontFamily: "'Fira Code', monospace", marginRight: '6px', fontStyle: 'normal' }}>
                                          Тема:
                                        </span>
                                        «{v.lesson_theme}»
                                      </div>
                                    )}
                                  </div>

                                  {/* Right Column: Attendance Status & Grades */}
                                  <div className="flex flex-row sm:flex-col justify-between sm:justify-between items-center sm:items-end w-full sm:w-auto min-w-full sm:min-w-[160px] gap-2 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                                    {/* Attendance Badge */}
                                    {v.status_was === 0 ? (
                                      <span style={{ fontSize: '0.62rem', color: '#30ff44', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <AlertTriangle size={10} /> Пропуск
                                      </span>
                                    ) : v.status_was === 2 ? (
                                      <span style={{ fontSize: '0.62rem', color: '#00ffc2', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <Clock size={10} /> Опоздание
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.62rem', color: '#7dffc4', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <CheckCircle2 size={10} /> Был
                                      </span>
                                    )}

                                    {/* Grades */}
                                    {lessonMarks.length > 0 && (
                                      <div className="flex flex-row flex-wrap gap-3.5 justify-end items-end w-auto">
                                        {lessonMarks.map((m, mIdx) => {
                                          const shortLabel = getShortLabel(m.label);
                                          return (
                                            <div 
                                              key={mIdx}
                                              style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '3px'
                                              }}
                                              title={m.label}
                                            >
                                              <span style={{ fontSize: '0.62rem', color: '#7dffc4', fontWeight: 600 }}>{shortLabel}</span>
                                              
                                              {/* Large circular grade badge */}
                                              <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '50%',
                                                background: `${m.color}08`,
                                                border: `1.5px solid ${m.color}`,
                                                boxShadow: `0 0 8px ${m.color}25, inset 0 1px 1px rgb(var(--os-fg-rgb)/0.05)`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0
                                              }}>
                                                <span style={{
                                                  fontSize: '0.95rem',
                                                  fontWeight: 800,
                                                  color: m.color,
                                                  fontFamily: "'Fira Code', monospace",
                                                  textShadow: `0 0 6px ${m.color}40`
                                                }}>
                                                  {m.val}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Comment Row */}
                                {(v.comment || v.teacher_comment) && (
                                  <blockquote style={{
                                    fontSize: '0.68rem',
                                    color: '#7dffc4',
                                    background: 'rgba(0, 230, 150, 0.02)',
                                    borderLeft: '2px solid #30ff44',
                                    padding: '0.3rem 0.5rem',
                                    borderRadius: '0 4px 4px 0',
                                    lineHeight: 1.35,
                                    fontStyle: 'italic',
                                    marginTop: '0.2rem'
                                  }}>
                                    "{v.comment || v.teacher_comment}"
                                  </blockquote>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>,
                document.body
              )}
            </motion.div>
          )}

          {/* Tab 2: EXAMS */}
          {activeTab === 'exams' && (
            <motion.div
              key="exams"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Column 1: Completed exams */}
              <div>
                <h3 style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Award size={16} style={{ color: 'var(--accent-purple-muted)', filter: 'drop-shadow(0 0 5px rgba(125, 255, 196, 0.45))' }} />
                  <span>Сданные экзамены</span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    background: 'rgba(125, 255, 196, 0.1)',
                    border: '1px solid rgba(125, 255, 196, 0.2)',
                    color: 'var(--accent-purple-muted)',
                    borderRadius: '12px',
                    padding: '1px 7px',
                    marginLeft: '2px'
                  }}>
                    {completedExams.length}
                  </span>
                </h3>

                {completedExams.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {completedExams.map((exam, idx) => {
                      const markNum = Number(exam.mark || exam.points);
                      const markVal = exam.mark || exam.points;
                      let isPassed = false;
                      if (!isEmptyValue(markVal)) {
                        const markNumVal = Number(markVal);
                        if (!isNaN(markNumVal)) {
                          isPassed = markNumVal >= 3;
                        } else {
                          const markStr = String(markVal).toLowerCase();
                          isPassed = !['незачет', 'не сдано', 'неуд', 'fail'].some(bad => markStr.includes(bad));
                        }
                      } else if (!isEmptyValue(exam.status_name)) {
                        const statusStr = exam.status_name!.toLowerCase();
                        isPassed = !['незачет', 'не сдано', 'неуд', 'fail'].some(bad => statusStr.includes(bad));
                      }
                      
                      const examTheme = getGradeTheme(isNaN(markNum) ? (isPassed ? 5 : 2) : markNum);
                      const exDate = exam.exam_date || exam.date;
                      let formattedDate = '—';
                      if (exDate) {
                        try {
                          const parsedDate = new Date(exDate);
                          if (!isNaN(parsedDate.getTime())) {
                            formattedDate = parsedDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                          }
                        } catch (e) {
                          console.error("Failed to parse date", e);
                        }
                      }

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.02 }}
                          whileHover={{ y: -2, transition: { duration: 0.15 } }}
                          className="liquid-glass"
                          style={{
                            borderRadius: '10px',
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            border: `1px solid ${isPassed ? examTheme.border : 'rgba(0, 230, 150, 0.15)'}`,
                            boxShadow: `0 4px 15px -3px rgba(0,0,0,0.3), 0 0 0 1px ${isPassed ? examTheme.border : 'rgba(0, 230, 150, 0.15)'}`,
                            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                            <div style={{ flex: 1, minWidth: '150px' }}>
                              <h4 style={{
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                letterSpacing: '0.01em',
                                lineHeight: 1.3
                              }}>
                                {exam.spec || exam.spec_name || 'Неизвестный предмет'}
                              </h4>
                              <div className="flex items-center gap-3.5 mt-2" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Calendar size={11} style={{ opacity: 0.7 }} /> {formattedDate}
                                </span>
                                {(exam.teacher || exam.teacher_name || exam.examiner_name) && (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={11} style={{ opacity: 0.7 }} /> {exam.teacher || exam.teacher_name || exam.examiner_name}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                              <span style={{
                                fontSize: '0.62rem',
                                color: isPassed ? 'var(--accent-purple-muted)' : 'var(--accent-purple)',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                background: isPassed ? 'rgba(125, 255, 196, 0.06)' : 'rgba(0, 230, 150, 0.06)',
                                border: `1px solid ${isPassed ? 'rgba(125, 255, 196, 0.2)' : 'rgba(0, 230, 150, 0.2)'}`,
                                borderRadius: '4px',
                                padding: '2px 6px',
                                textShadow: isPassed ? '0 0 8px rgba(125, 255, 196, 0.25)' : '0 0 8px rgba(0, 230, 150, 0.25)'
                              }}>
                                {exam.status_name || (isPassed ? 'Сдано' : 'Не сдано')}
                              </span>

                              {/* Grade Badge */}
                              <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                <div style={{
                                  width: '38px',
                                  height: '38px',
                                  borderRadius: '50%',
                                  background: `${isPassed ? examTheme.text : '#30ff44'}08`,
                                  border: `1.5px solid ${isPassed ? examTheme.text : '#30ff44'}`,
                                  boxShadow: `0 0 8px ${isPassed ? examTheme.text : '#30ff44'}25, inset 0 1px 1px rgb(var(--os-fg-rgb)/0.05)`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <span style={{
                                    fontSize: '1rem',
                                    fontWeight: 800,
                                    color: isPassed ? examTheme.text : '#30ff44',
                                    fontFamily: "'Fira Code', monospace",
                                    textShadow: `0 0 6px ${isPassed ? examTheme.text : '#30ff44'}40`
                                  }}>
                                    {exam.mark || exam.points || '—'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Teacher comment */}
                          {exam.comment_teach && (
                            <blockquote style={{
                              fontSize: '0.68rem',
                              color: 'var(--text-secondary)',
                              background: 'rgb(var(--os-fg-rgb) / 0.01)',
                              borderLeft: `2px solid ${isPassed ? examTheme.text : '#30ff44'}`,
                              padding: '0.3rem 0.5rem',
                              borderRadius: '0 4px 4px 0',
                              lineHeight: 1.35,
                              fontStyle: 'italic',
                              marginTop: '0.4rem',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '5px'
                            }}>
                              <MessageSquare size={10} style={{ marginTop: '2px', flexShrink: 0, opacity: 0.6 }} />
                              <span>"{exam.comment_teach}"</span>
                            </blockquote>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="liquid-glass" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    padding: '2.5rem 1.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    border: '1px dashed rgb(var(--os-fg-rgb)/0.06)',
                    background: 'rgb(var(--os-fg-rgb)/0.01)',
                  }}>
                    <Info size={20} style={{ color: 'var(--accent-purple)', marginBottom: '0.6rem', filter: 'drop-shadow(0 0 4px rgba(0, 230, 150, 0.35))' }} />
                    <span style={{ fontWeight: 500 }}>У вас пока нет сданных экзаменов.</span>
                  </div>
                )}
              </div>

              {/* Column 2: Upcoming exams */}
              <div>
                <h3 style={{
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Clock size={16} style={{ color: 'var(--accent-purple-soft)', filter: 'drop-shadow(0 0 5px rgba(0, 255, 194, 0.45))' }} />
                  <span>Предстоящие экзамены</span>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    background: 'rgba(0, 255, 194, 0.1)',
                    border: '1px solid rgba(0, 255, 194, 0.2)',
                    color: 'var(--accent-purple-soft)',
                    borderRadius: '12px',
                    padding: '1px 7px',
                    marginLeft: '2px'
                  }}>
                    {futureExams.length}
                  </span>
                </h3>

                {futureExams.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {futureExams.map((exam, idx) => {
                      let formattedDate = '—';
                      let formattedTime = '';
                      if (exam.date) {
                        try {
                          const exDate = new Date(exam.date);
                          if (!isNaN(exDate.getTime())) {
                            formattedDate = exDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
                            
                            // Only format and show time if the date string doesn't represent midnight (00:00:00)
                            const hasRealTime = !exam.date.endsWith('00:00:00') &&
                                                !exam.date.endsWith('00:00:00.000Z') &&
                                                !exam.date.endsWith('00:00:00Z') &&
                                                /T\d{2}:\d{2}/.test(exam.date) &&
                                                !/T00:00/.test(exam.date);
                            
                            if (hasRealTime) {
                              formattedTime = exDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                            }
                          }
                        } catch (e) {
                          console.error("Failed to parse future exam date", e);
                        }
                      }

                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.02 }}
                          whileHover={{ y: -2, transition: { duration: 0.15 } }}
                          className="liquid-glass"
                          style={{
                            borderRadius: '10px',
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.75rem',
                            border: '1px solid rgba(0, 255, 194, 0.15)',
                            boxShadow: '0 4px 15px -3px rgba(0,0,0,0.3), 0 0 0 1px rgba(0, 255, 194, 0.12)',
                            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: '150px' }}>
                            <h4 style={{
                              color: 'var(--text-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              letterSpacing: '0.01em',
                              lineHeight: 1.3
                            }}>
                              {exam.spec || exam.spec_name || 'Неизвестный предмет'}
                            </h4>
                            <div className="flex items-center gap-3.5 mt-2" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {(exam.teacher || exam.teacher_name) && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <User size={11} style={{ opacity: 0.7 }} /> {exam.teacher || exam.teacher_name}
                                </span>
                              )}
                              {exam.room && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <MapPin size={11} style={{ opacity: 0.7 }} /> Кабинет: {exam.room}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Date & Time Block */}
                          <div style={{
                            background: 'rgba(0, 255, 194, 0.03)',
                            border: '1px solid rgba(0, 255, 194, 0.18)',
                            boxShadow: '0 0 10px rgba(0, 255, 194, 0.05)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            textAlign: 'right',
                            minWidth: '95px'
                          }}>
                            <span style={{
                              display: 'block',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)'
                            }}>
                              {formattedDate}
                            </span>
                            {formattedTime && (
                              <span style={{
                                display: 'block',
                                fontSize: '0.62rem',
                                fontWeight: 600,
                                color: 'var(--accent-purple-soft)',
                                fontFamily: "'Fira Code', monospace",
                                textShadow: '0 0 5px rgba(0, 255, 194, 0.3)',
                                marginTop: '1px'
                              }}>
                                {formattedTime}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="liquid-glass" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    padding: '2.5rem 1.5rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    border: '1px dashed rgb(var(--os-fg-rgb)/0.06)',
                    background: 'rgb(var(--os-fg-rgb)/0.01)',
                  }}>
                    <Clock size={20} style={{ color: 'var(--accent-purple-soft)', marginBottom: '0.6rem', filter: 'drop-shadow(0 0 4px rgba(0, 255, 194, 0.35))' }} />
                    <span style={{ fontWeight: 500 }}>Предстоящих экзаменов не запланировано.</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
