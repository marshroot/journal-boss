import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  FileText,
  Download,
  UploadCloud,
  Trash2,
  Clock,
  User,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Award,
  MessageSquare,
  Star
} from 'lucide-react';
import { API_BASE } from '../../lib/apiBase';
import { getAccessToken } from '../../lib/auth';

// Attach the local JWT to direct API requests, including file uploads/download helpers.
const authenticatedFetch: typeof fetch = (input, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

interface StudentSubmission {
  id: number;
  filename: string | null;
  file_path: string | null;
  tmp_file: string | null;
  mark: number | null;
  creation_time: string;
  stud_answer: string | null;
  auto_mark: boolean;
}

interface TeacherComment {
  text_comment: string | null;
  attachment: string | null;
  attachment_path: string | null;
  date_updated: string;
}

interface Homework {
  id: number;
  id_spec: number;
  id_teach: number;
  id_group: number;
  fio_teach: string | null;
  theme: string;
  completion_time: string | null;
  creation_time: string | null;
  overdue_time: string | null;
  filename: string | null;
  file_path: string | null;
  comment: string | null;
  name_spec: string;
  status: number;
  common_status: number | null;
  homework_stud: StudentSubmission | null;
  homework_comment: TeacherComment | null;
  cover_image: string | null;
  type?: number | string;
}

const TAG_TRANSLATIONS: Record<string, string> = {
  "everything_is_cool_tag": "Всё круто 👍",
  "everything_is_clear_tag": "Всё понятно 💡",
  "boring_tag": "Скучно 🥱",
  "task_is_too_difficult_tag": "Слишком сложно 🤯",
  "i_like_tag": "Мне нравится ❤️",
  "its_not_clear_but_it_had_to_be_done_tag": "Непонятно, но сделано 🤷‍♂️",
  "task_is_too_simple_tag": "Слишком просто ⚡"
};

const getFriendlyErrorMessage = (errorText: string): string => {
  try {
    if (errorText.trim().startsWith('{') || errorText.trim().startsWith('[')) {
      const parsed = JSON.parse(errorText);
      const msg = parsed.message || parsed.error || errorText;
      if (typeof msg === 'string') {
        if (msg.includes('upload_dz_have_not_enough_of_funds') || msg.includes('not_funds_retake')) {
          return 'Недостаточно средств для пересдачи (требуется 2 топгема).';
        }
        if (msg.includes('upload_dz_seven_days_has_passed')) {
          return 'Прошло более 7 дней с момента оценки. Пересдача невозможна.';
        }
        if (msg.includes('unable_retake_hom')) {
          return 'Не удалось пересдать домашнее задание.';
        }
        return msg;
      }
    }
  } catch (e) {
    // Not JSON
  }

  if (errorText.includes('upload_dz_have_not_enough_of_funds') || errorText.includes('not_funds_retake')) {
    return 'Недостаточно средств для пересдачи (требуется 2 топгема).';
  }
  if (errorText.includes('upload_dz_seven_days_has_passed')) {
    return 'Прошло более 7 дней с момента оценки. Пересдача невозможна.';
  }
  if (errorText.includes('unable_retake_hom')) {
    return 'Не удалось пересдать домашнее задание.';
  }

  return errorText;
};

export default function HomeworkWidget() {
  const location = useLocation();
  const state = location.state as {
    activeTab?: string;
    selectedHwId?: number;
    selectedStatus?: number;
    selectedType?: number;
  } | null;

  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<number>(() => {
    if (state?.selectedStatus !== undefined) return state.selectedStatus;
    return 3; // Default to Current (3)
  });
  const [typeFilter, setTypeFilter] = useState<number>(() => {
    if (state?.selectedType !== undefined) return state.selectedType;
    return 0; // 0 = Homework, 1 = Labs
  });

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Detail view
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    if (state?.selectedHwId !== undefined) return state.selectedHwId;
    return null;
  });
  const selectedIdRef = useRef<number | null>(selectedId);
  selectedIdRef.current = selectedId;

  const [isMobileDetailView, setIsMobileDetailView] = useState(() => {
    return state?.selectedHwId !== undefined;
  });

  // Form states
  const [answerText, setAnswerText] = useState('');
  const [spentTimeHour, setSpentTimeHour] = useState('00');
  const [spentTimeMin, setSpentTimeMin] = useState('30');
  
  // File upload states
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFileToken, setUploadedFileToken] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showResubmitForm, setShowResubmitForm] = useState(false);

  // Local cache for homework lists by category (type_status)
  const [cache, setCache] = useState<Record<string, { items: Homework[]; hasMore: boolean; page: number }>>({});

  // Evaluation (rating) states
  interface EvaluationTag {
    id: number;
    translate_key: string;
    type: string;
  }

  const [tagsList, setTagsList] = useState<EvaluationTag[]>([]);
  const [evalRating, setEvalRating] = useState<number>(0);
  const [evalComment, setEvalComment] = useState<string>('');
  const [evalSelectedTags, setEvalSelectedTags] = useState<number[]>([]);
  const [evalHoverRating, setEvalHoverRating] = useState<number | null>(null);

  const sessionToken = getAccessToken();
  const shouldScrollRef = useRef(!!state?.selectedHwId);
  const activeRequestKeyRef = useRef<string>('');

  // Sync state when location state changes (e.g. navigation from dashboard)
  useEffect(() => {
    console.log('[HomeworkWidget] Location state changed:', location.state);
    if (state?.selectedStatus !== undefined) {
      setStatusFilter(state.selectedStatus);
    }
    if (state?.selectedType !== undefined) {
      setTypeFilter(state.selectedType);
    }
    if (state?.selectedHwId !== undefined) {
      setSelectedId(state.selectedHwId);
      setIsMobileDetailView(true);
      shouldScrollRef.current = true;
      console.log('[HomeworkWidget] set shouldScrollRef to true for selectedHwId:', state.selectedHwId);
    }
  }, [location.state]);

  const scrollTimeoutRef = useRef<any>(null);
  const restoreTimeoutRef = useRef<any>(null);

  // Clean up scroll timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll callback ref for exact DOM mount timing
  const scrollRefCallback = (element: HTMLDivElement | null) => {
    if (element && shouldScrollRef.current) {
      console.log('[HomeworkWidget] scrollRefCallback triggered for ID:', selectedId);
      const container = element.closest('.hw-list-scrollable') as HTMLDivElement;
      if (container) {
        const performScroll = (behavior: 'auto' | 'smooth') => {
          const rect = element.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          if (rect.height > 0 && containerRect.height > 0) {
            container.style.pointerEvents = 'none';
            const targetScrollTop = container.scrollTop + (rect.top - containerRect.top) - (containerRect.height / 2) + (rect.height / 2);
            container.scrollTo({
              top: targetScrollTop,
              behavior
            });
            return true;
          }
          return false;
        };

        // Trigger smooth scroll animation after a short delay (250ms) to allow exit animations to complete
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          performScroll('smooth');
        }, 250);

        // Restore pointer events after scroll completes (e.g. 900ms)
        if (restoreTimeoutRef.current) {
          clearTimeout(restoreTimeoutRef.current);
        }
        restoreTimeoutRef.current = setTimeout(() => {
          container.style.pointerEvents = 'auto';
        }, 900);

        // Disable further scrolls until next external redirect
        shouldScrollRef.current = false;
      }
    }
  };

  // Helper to resolve URLs
  const getDownloadUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http')) {
      if (path.endsWith('/public')) {
        return path.slice(0, -7);
      }
      return path;
    }
    return `https://fs.top-academy.ru/api/v1/files/${path}`;
  };

  // Helper to calculate visual status dynamically
  const getHomeworkStatus = (hw: Homework) => {
    if (hw.status === 5) {
      return 5; // Deleted by teacher
    }
    if (hw.homework_stud) {
      if (hw.homework_stud.auto_mark) {
        return 0; // Overdue (automatically graded as 1 due to expiration)
      }
      if (hw.homework_stud.mark !== null && hw.homework_stud.mark !== undefined) {
        return 1; // Graded / Checked
      }
      return 2; // Under Review / Pending
    }
    
    // No submission. Check deadline.
    if (hw.completion_time) {
      const deadlineDate = new Date(hw.completion_time.replace(' ', 'T'));
      deadlineDate.setHours(23, 59, 59, 999);
      const now = new Date();
      if (deadlineDate < now) {
        return 0; // Overdue
      }
    }
    
    return 3; // Current / Active
  };

  // Prefetch remaining categories in the background concurrently
  const prefetchRemainingCategories = async (bypassCache = false) => {
    if (!sessionToken) return;

    const activeKey = `${typeFilter}_${statusFilter}`;
    const combinations = [];
    for (let t = 0; t <= 1; t++) {
      for (let s = 0; s <= 5; s++) {
        const key = `${t}_${s}`;
        if (key !== activeKey) {
          combinations.push({ type: t, status: s, key });
        }
      }
    }

    const cacheBuster = bypassCache ? '&bypassCache=true' : '';

    // Fire all prefetch requests concurrently, letting the backend handle the pacing
    await Promise.all(
      combinations.map(async (combo) => {
        // Avoid overwriting if cache exists (unless force-bypassing)
        if (cache[combo.key] && !bypassCache) return;

        try {
          const response = await authenticatedFetch(
            `${API_BASE}/api/Homework/list?status=${combo.status}&type=${combo.type}&page=1${cacheBuster}`
          );
          if (response.ok) {
            const data = await response.json();
            const hwArray = Array.isArray(data) ? data : [];
            setCache((prev) => ({
              ...prev,
              [combo.key]: {
                items: hwArray,
                hasMore: hwArray.length >= 6,
                page: 1
              }
            }));
          }
        } catch (err) {
          console.warn(`[Homework] Background prefetch failed for ${combo.key}:`, err);
        }
      })
    );
  };

  // Load active category (unblocks UI quickly)
  const loadActiveCategory = async (bypassCache = false) => {
    if (!sessionToken) {
      setError('Не найден токен сессии.');
      setLoading(false);
      setListLoading(false);
      return;
    }

    const currentType = typeFilter;
    const currentStatus = statusFilter;
    const activeKey = `${currentType}_${currentStatus}`;
    
    // Track this request key to prevent async race conditions
    activeRequestKeyRef.current = activeKey;

    const cachedData = cache[activeKey];
    const hasCache = !!cachedData;
    
    // We only force fetching if there is no cache, or if we transitioned from dashboard with a selected item not in cache
    const isDashboardSelection = state?.selectedHwId !== undefined && Number(state.selectedHwId) === Number(selectedId) && shouldScrollRef.current;
    const isSelectedInCache = selectedId === null || (hasCache && cachedData.items.some((h) => Number(h.id) === Number(selectedId)));
    const needsFetch = !hasCache || bypassCache || (isDashboardSelection && !isSelectedInCache);

    if (needsFetch) {
      // If we don't have cache, show loading
      if (Object.keys(cache).length === 0) {
        setLoading(true);
      } else {
        setListLoading(true);
      }
    } else if (bypassCache) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const cacheBuster = bypassCache ? '&bypassCache=true' : '';
      const response = await authenticatedFetch(
        `${API_BASE}/api/Homework/list?status=${currentStatus}&type=${currentType}&page=1${cacheBuster}`
      );

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      let hwArray = Array.isArray(data) ? data : [];
      let currentHasMore = hwArray.length >= 6;
      let loadedPage = 1;

      // If a selectedHwId was passed from navigation, and it's NOT in the first page,
      // load subsequent pages until we find it or run out of items.
      if (selectedId !== null) {
        let found = hwArray.some((h) => Number(h.id) === Number(selectedId));
        while (!found && currentHasMore && loadedPage < 10) {
          loadedPage++;
          const nextResp = await authenticatedFetch(
            `${API_BASE}/api/Homework/list?status=${currentStatus}&type=${currentType}&page=${loadedPage}${cacheBuster}`
          );
          if (nextResp.ok) {
            const nextData = await nextResp.json();
            const nextArray = Array.isArray(nextData) ? nextData : [];
            hwArray = [...hwArray, ...nextArray];
            currentHasMore = nextArray.length >= 6;
            found = nextArray.some((h) => Number(h.id) === Number(selectedId));
          } else {
            break;
          }
        }
      }

      // Deduplicate pages to avoid duplicates
      const dedupMap = new Map<number, any>();
      hwArray.forEach(item => dedupMap.set(item.id, item));
      hwArray = Array.from(dedupMap.values());

      // Check if filters changed while we were fetching
      if (activeRequestKeyRef.current !== activeKey) {
        // Update cache so the tab gets populated for future visits, but don't mutate current UI state
        setCache((prev) => ({
          ...prev,
          [activeKey]: {
            items: hwArray,
            hasMore: currentHasMore,
            page: loadedPage
          }
        }));
        return;
      }

      setCache((prev) => ({
        ...prev,
        [activeKey]: {
          items: hwArray,
          hasMore: currentHasMore,
          page: loadedPage
        }
      }));

      setHomeworks(hwArray);
      setHasMore(currentHasMore);
      setPage(loadedPage);

      // Restore selection or select first
      const filteredHwList = hwArray.filter((h) => h.type === undefined || h.type === null || h.type == currentType);
      if (selectedId !== null) {
        const stillExists = filteredHwList.some((h) => Number(h.id) === Number(selectedId));
        if (!stillExists) {
          const isFromState = state?.selectedHwId !== undefined && Number(state.selectedHwId) === Number(selectedId) && shouldScrollRef.current;
          if (!isFromState) {
            setSelectedId(filteredHwList.length > 0 ? filteredHwList[0].id : null);
          }
        }
      } else if (filteredHwList.length > 0) {
        setSelectedId(filteredHwList[0].id);
      }
    } catch (err: any) {
      console.error('[Homework] Active load error:', err);
      if (activeRequestKeyRef.current === activeKey) {
        setError('Не удалось загрузить список домашних заданий. Пожалуйста, попробуйте позже.');
      }
    } finally {
      if (activeRequestKeyRef.current === activeKey) {
        setLoading(false);
        setListLoading(false);
        setIsRefreshing(false);
      }
    }

    // Fire prefetch for remaining categories in the background after a delay to prevent scroll animation interruption
    setTimeout(() => {
      prefetchRemainingCategories(bypassCache);
    }, 2000);
  };

  // Prefetch all (legacy entrypoint, now uses loadActiveCategory)
  const prefetchAllHomeworks = async (bypassCache = false) => {
    await loadActiveCategory(bypassCache);
  };

  // Load homeworks (delegates to active load or handles pagination load more)
  const fetchHomeworks = async (bypassCache = false, targetPage = 1) => {
    if (!sessionToken) {
      setError('Не найден токен сессии.');
      setLoading(false);
      return;
    }

    const currentType = typeFilter;
    const currentStatus = statusFilter;
    const activeKey = `${currentType}_${currentStatus}`;

    const isLoadMore = targetPage > 1;

    if (!isLoadMore) {
      // Set the active key immediately on start of load
      activeRequestKeyRef.current = activeKey;

      if (bypassCache) {
        await loadActiveCategory(true);
        return;
      }
      
      if (cache[activeKey]) {
        const cached = cache[activeKey];
        const hwArray = cached.items;
        
        // Verify if filters changed during the synchronous tick
        if (activeRequestKeyRef.current !== activeKey) return;

        setHomeworks(hwArray);
        setHasMore(cached.hasMore);
        setPage(cached.page || 1);
        
        // Restore selection or select first (safe cache restore without bypassing cache)
        const filteredCachedHwList = hwArray.filter((h) => h.type === undefined || h.type === null || h.type == currentType);
        const stillExists = selectedId !== null && filteredCachedHwList.some((h) => Number(h.id) === Number(selectedId));
        if (!stillExists) {
          const isFromState = state?.selectedHwId !== undefined && Number(state.selectedHwId) === Number(selectedId) && shouldScrollRef.current;
          if (!isFromState) {
            setSelectedId(filteredCachedHwList.length > 0 ? filteredCachedHwList[0].id : null);
          }
        } else if (selectedId === null && filteredCachedHwList.length > 0) {
          setSelectedId(filteredCachedHwList[0].id);
        }
        
        setLoading(false);
        setListLoading(false);
        return;
      }
      
      await loadActiveCategory(false);
      return;
    }

    // Load More pagination
    setLoadingMore(true);
    setError(null);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/Homework/list?status=${currentStatus}&type=${currentType}&page=${targetPage}`
      );

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      const hwArray = Array.isArray(data) ? data : [];

      // Protect against tab switching during load more request
      if (activeRequestKeyRef.current !== activeKey) {
        return;
      }

      setHomeworks((prev) => {
        const newItems = hwArray.filter((newItem) => !prev.some((existing) => existing.id === newItem.id));
        const combined = [...prev, ...newItems];
        
        // Update cache entry
        setCache((prevCache) => ({
          ...prevCache,
          [activeKey]: {
            items: combined,
            hasMore: hwArray.length >= 6,
            page: targetPage
          }
        }));

        if (hwArray.length < 6) {
          setHasMore(false);
        }
        return combined;
      });
    } catch (err: any) {
      console.error('[Homework] Fetch error:', err);
      if (activeRequestKeyRef.current === activeKey) {
        setError('Не удалось загрузить дополнительные задания.');
      }
    } finally {
      if (activeRequestKeyRef.current === activeKey) {
        setLoadingMore(false);
      }
    }
  };

  // Re-fetch on filter changes (resets page to 1)
  useEffect(() => {
    fetchHomeworks(false, 1);
  }, [statusFilter, typeFilter]);

  // Load next page
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchHomeworks(false, nextPage);
  };

  // Selected item
  const selectedHw = useMemo(() => {
    return homeworks.find((h) => Number(h.id) === Number(selectedId)) || null;
  }, [homeworks, selectedId]);

  const isMoreThanSixMonthsOld = useMemo(() => {
    if (!selectedHw) return false;
    const targetDateStr = selectedHw.creation_time || selectedHw.completion_time;
    if (!targetDateStr) return true;
    const targetDate = new Date(targetDateStr.replace(' ', 'T'));
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(now.getDate() - 180);
    return targetDate < sixMonthsAgo;
  }, [selectedHw]);

  const cannotSubmitDueToAge = useMemo(() => {
    if (!selectedHw) return false;
    const isLab = typeFilter === 1;
    const isOverdue = getHomeworkStatus(selectedHw) === 0;
    
    if (selectedHw.status === 5) {
      return isMoreThanSixMonthsOld;
    }
    if (isLab && isOverdue) {
      return isMoreThanSixMonthsOld;
    }
    return false;
  }, [selectedHw, typeFilter, isMoreThanSixMonthsOld]);

  const isDeadlinePassed = useMemo(() => {
    if (!selectedHw || !selectedHw.completion_time) return false;
    const deadlineDate = new Date(selectedHw.completion_time.replace(' ', 'T'));
    deadlineDate.setHours(23, 59, 59, 999);
    const now = new Date();
    return deadlineDate < now;
  }, [selectedHw]);


  // Reset form when changing selected homework
  // Load evaluation tags once on mount
  useEffect(() => {
    const fetchTags = async () => {
      if (!sessionToken) return;
      try {
        const res = await authenticatedFetch(`${API_BASE}/api/Homework/evaluation/tags`);
        if (res.ok) {
          const data = await res.json();
          setTagsList(data || []);
        }
      } catch (err) {
        console.error('[Homework] Failed to fetch evaluation tags:', err);
      }
    };
    fetchTags();
  }, []);



  // Reset form when changing selected homework
  useEffect(() => {
    if (selectedHw) {
      setAnswerText(selectedHw.homework_stud?.stud_answer || '');
      setSpentTimeHour('00');
      setSpentTimeMin('30');
      setUploadedFileToken(selectedHw.homework_stud?.file_path || null);
      setUploadedFileName(selectedHw.homework_stud?.filename || null);
      setUploadingFile(null);
      setUploadProgress(0);
      setUploadError(null);
      setEvalRating(0);
      setEvalHoverRating(null);
      setEvalSelectedTags([]);
      setEvalComment('');
      setShowResubmitForm(false);
    } else {
      setAnswerText('');
      setSpentTimeHour('00');
      setSpentTimeMin('30');
      setUploadedFileToken(null);
      setUploadedFileName(null);
      setUploadingFile(null);
      setUploadProgress(0);
      setUploadError(null);
      setEvalRating(0);
      setEvalHoverRating(null);
      setEvalSelectedTags([]);
      setEvalComment('');
      setShowResubmitForm(false);
    }
  }, [selectedId, selectedHw]);

  // Core File Upload Logic
  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt' || ext === 'csv') {
      setUploadError('Загрузка файлов .txt и .csv не поддерживается.');
      return;
    }

    if (file.size > 99 * 1024 * 1024) {
      setUploadError('Размер файла превышает лимит в 99 MB.');
      return;
    }

    setUploadingFile(file);
    setIsUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      // 1. Get Upload Token
      const tokenRes = await authenticatedFetch(
        `${API_BASE}/api/Homework/file-token`,
        { method: 'POST' }
      );

      if (!tokenRes.ok) {
        throw new Error('Не удалось получить токен загрузки.');
      }

      const tokenData = await tokenRes.json();
      const storageToken = tokenData.token;
      const directory = tokenData.dir?.homeworkDirId?.src;

      if (!storageToken || !directory) {
        throw new Error('Неверные данные токена загрузки.');
      }

      setUploadProgress(30);

      // 2. Upload file to storage
      const formData = new FormData();
      formData.append('files', file);
      formData.append('directory', directory);

      const uploadRes = await authenticatedFetch(
        `${API_BASE}/api/Homework/upload`,
        {
          method: 'POST',
          headers: {
            'X-File-Storage-Token': storageToken
          },
          body: formData
        }
      );

      if (!uploadRes.ok) {
        throw new Error('Ошибка загрузки файла на сервер.');
      }

      setUploadProgress(80);

      const uploadData = await uploadRes.json();
      const fileToken = uploadData[0]?.token;
      const fileName = uploadData[0]?.name;

      if (!fileToken) {
        throw new Error('Токен файла не получен.');
      }

      setUploadedFileToken(fileToken);
      setUploadedFileName(fileName || file.name);
      setUploadProgress(100);
    } catch (err: any) {
      console.error('[Upload] Error:', err);
      setUploadError(err.message || 'Ошибка загрузки файла.');
      setUploadingFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  // Drag and Drop Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await uploadFile(file);
    }
  };

  // Handle standard file input selection
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  // Submit Homework
  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHw || !sessionToken) return;

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('id', selectedHw.id.toString());
      formData.append('answerText', answerText);
      formData.append('spentTimeHour', spentTimeHour.padStart(2, '0'));
      formData.append('spentTimeMin', spentTimeMin);

      if (uploadedFileToken) {
        const fullUrl = uploadedFileToken.startsWith('http')
          ? uploadedFileToken
          : `https://fs.top-academy.ru/api/v1/files/${uploadedFileToken}`;
        formData.append('filename', fullUrl);
        formData.append('answer', fullUrl);
        formData.append('file_path', fullUrl);
      }

      const blankBlob = new Blob([], { type: 'application/octet-stream' });
      formData.append('file', blankBlob, '');

      const response = await authenticatedFetch(
        `${API_BASE}/api/Homework/create`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        const friendlyMessage = getFriendlyErrorMessage(errorText);
        throw new Error(friendlyMessage);
      }

      // Parse submission ID and save evaluation if filled
      try {
        const createData = await response.json();
        const submissionId = createData.id || createData.homework_stud?.id;
        
        if (evalRating > 0 && submissionId) {
          const evalPayload = {
            EvaluationHomeworkForm: {
              id: submissionId,
              id_dom_zad: selectedHw.id,
              mark: evalRating,
              comment: evalComment,
              tags: evalSelectedTags
            }
          };
          
          await authenticatedFetch(`${API_BASE}/api/Homework/evaluation/save`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(evalPayload)
          });
        }
      } catch (evalErr) {
        console.error('[Evaluation] Failed to save evaluation during submission:', evalErr);
      }

      if ((window as any).triggerCelebration) {
        (window as any).triggerCelebration(window.innerWidth / 2, window.innerHeight / 2, 'gems');
      }

      // Reset rating states after successful submission
      setEvalRating(0);
      setEvalHoverRating(null);
      setEvalSelectedTags([]);
      setEvalComment('');
      setShowResubmitForm(false);

      await fetchHomeworks(true, 1);
    } catch (err: any) {
      console.error('[Submit] Error:', err);
      alert(err.message || 'Ошибка отправки решения.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Homework
  const handleDeleteHomework = async () => {
    if (!selectedHw || !sessionToken) return;
    
    const submissionId = selectedHw.homework_stud?.id;
    if (!submissionId) {
      alert('Не найден ID сданного решения.');
      return;
    }

    if (!confirm('Вы уверены, что хотите удалить сданное решение?')) {
      return;
    }

    setDeleting(true);

    try {
      const response = await authenticatedFetch(
        `${API_BASE}/api/Homework/delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id: submissionId })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Не удалось удалить решение.');
      }

      setUploadedFileToken(null);
      setUploadedFileName(null);
      setUploadingFile(null);
      setAnswerText('');

      await fetchHomeworks(true, 1);
    } catch (err: any) {
      console.error('[Delete] Error:', err);
      alert(err.message || 'Ошибка удаления решения.');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered list based on search query and typeFilter
  const filteredHomeworks = useMemo(() => {
    const filtered = homeworks.filter((hw) => {
      // Filter out assignments that don't match the current type filter (using loose comparison for string vs number)
      if (hw.type !== undefined && hw.type !== null && hw.type != typeFilter) {
        return false;
      }
      const query = searchQuery.toLowerCase();
      const subject = hw.name_spec || '';
      const theme = hw.theme || '';
      const teacher = hw.fio_teach || '';
      return (
        subject.toLowerCase().includes(query) ||
        theme.toLowerCase().includes(query) ||
        teacher.toLowerCase().includes(query)
      );
    });

    // Do not sort on the client side, as the API already returns them sorted newest first, 
    // and manual sorting would scramble the pagination order (newly loaded items would jump to the top).
    return filtered;
  }, [homeworks, searchQuery, typeFilter]);

  // Helper for status badge details
  const getStatusBadge = (status: number, mark: number | null | undefined) => {
    switch (status) {
      case 5:
        return {
          text: 'Удалено преподавателем',
          color: 'var(--text-dim, #6b6b6b)',
          glow: 'rgba(109, 100, 87, 0.2)',
          bg: 'rgba(109, 100, 87, 0.05)'
        };
      case 0:
        return {
          text: 'Просрочено',
          color: 'var(--accent-red, #ff5555)',
          glow: 'rgba(255, 85, 85, 0.25)',
          bg: 'rgba(255, 85, 85, 0.05)'
        };
      case 1:
        return {
          text: 'Проверено',
          color: 'var(--accent-purple-muted)',
          glow: 'rgba(125, 255, 196, 0.25)',
          bg: 'rgba(125, 255, 196, 0.05)'
        };
      case 2:
        return {
          text: 'На проверке',
          color: 'var(--accent-purple, #30ff44)',
          glow: 'rgba(255, 145, 0, 0.25)',
          bg: 'rgba(255, 145, 0, 0.05)'
        };
      case 3:
      default:
        return {
          text: 'Текущее',
          color: 'var(--accent-purple-soft)',
          glow: 'rgba(0, 255, 194, 0.25)',
          bg: 'rgba(0, 255, 194, 0.05)'
        };
    }
  };

  const isSevenDaysPassed = useMemo(() => {
    if (!selectedHw || !selectedHw.homework_comment?.date_updated) return false;
    
    // Parse the date_updated. Format is typically: YYYY-MM-DD HH:mm:ss
    const dateStr = selectedHw.homework_comment.date_updated.replace(' ', 'T');
    const checkDate = new Date(dateStr);
    if (isNaN(checkDate.getTime())) return false;
    
    const now = new Date();
    return now.getTime() - checkDate.getTime() > 7 * 24 * 60 * 60 * 1000;
  }, [selectedHw]);

  let animIndex = 0;

  return (
    <motion.div
      className="homework-layout-container"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <style>{`
        .homework-layout-container {
          display: flex;
          height: calc(100vh - 100px);
          width: 100%;
          gap: 1.5rem;
          padding: 0 1.5rem 1.5rem 1.5rem;
          box-sizing: border-box;
          color: var(--text-primary);
        }
        
        .hw-master-pane {
          flex: 0 0 380px;
          display: flex;
          flex-direction: column;
          height: 100%;
          border-radius: 16px;
        }
        
        .hw-detail-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          border-radius: 16px;
          min-width: 0;
        }

        @media (max-width: 1024px) {
          .homework-layout-container {
            padding: 0 1rem 1rem 1rem;
            gap: 0;
            height: calc(100vh - 85px);
          }
          .hw-master-pane {
            flex: 1;
            display: ${isMobileDetailView ? 'none' : 'flex'};
            width: 100%;
          }
          .hw-detail-pane {
            flex: 1;
            display: ${isMobileDetailView ? 'flex' : 'none'};
            width: 100%;
          }
        }

        .hw-filters-box {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 1.5rem;
          border-bottom: 1px solid rgb(var(--os-fg-rgb) / 0.04);
        }

        .hw-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid rgb(var(--os-fg-rgb) / 0.04);
          background: rgb(var(--os-fg-rgb) / 0.01);
          flex-shrink: 0;
        }

        .hw-mobile-back-btn {
          display: none;
        }

        .hw-desktop-title {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: inline;
        }

        @media (max-width: 1024px) {
          .hw-mobile-back-btn {
            display: flex;
            align-items: center;
            background: transparent;
            border: none;
            color: var(--text-primary);
            cursor: pointer;
            font-size: 0.78rem;
          }
          .hw-desktop-title {
            display: none;
          }
        }

        .hw-filter-tabs {
          display: flex;
          background: rgb(var(--os-fg-rgb) / 0.02);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.04);
          border-radius: 10px;
          padding: 2px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          position: relative;
        }

        .hw-filter-tab {
          position: relative;
          z-index: 10;
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-family: 'Fira Code', monospace;
          padding: 8px 12px;
          cursor: pointer;
          border-radius: 8px;
          transition: color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: center;
        }

        .hw-filter-tab.active {
          color: var(--accent-purple);
        }

        .hw-filter-tab-pill-bg {
          position: absolute;
          inset: 0;
          background: rgba(0, 230, 150, 0.08);
          border: 1px solid rgba(0, 230, 150, 0.2);
          border-radius: 8px;
          z-index: 1;
          box-shadow: 0 0 10px rgba(0, 230, 150, 0.15);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }

        .hw-status-scroller {
          display: flex;
          gap: 0.45rem;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
          position: relative;
        }
        .hw-status-scroller::-webkit-scrollbar {
          display: none;
        }

        .hw-status-pill {
          position: relative;
          z-index: 10;
          white-space: nowrap;
          background: rgb(var(--os-fg-rgb) / 0.015);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.04);
          color: var(--text-dim);
          border-radius: 20px;
          padding: 5px 12px;
          font-size: 0.72rem;
          cursor: pointer;
          transition: color 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .hw-status-pill.active {
          color: var(--text-primary);
          border-color: transparent;
        }

        .hw-status-pill-active-bg {
          position: absolute;
          inset: -1px;
          border-radius: 20px;
          background: rgba(0, 230, 150, 0.08);
          border: 1px solid rgba(0, 230, 150, 0.35);
          box-shadow: 0 0 12px rgba(0, 230, 150, 0.2);
          z-index: 1;
        }

        .hw-list-scrollable {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .hw-list-card {
          padding: 1.25rem;
          border-radius: 14px;
          background: rgb(var(--os-fg-rgb) / 0.015);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.04);
          cursor: pointer;
          position: relative;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: background 0.25s, border-color 0.25s, box-shadow 0.25s;
          user-select: none;
          -webkit-user-select: none;
        }

        .hw-list-card:hover {
          background: rgb(var(--os-fg-rgb) / 0.035);
          border-color: rgb(var(--os-fg-rgb) / 0.08);
        }

        .hw-list-card.selected {
          background: rgba(0, 230, 150, 0.04);
          border-color: rgba(0, 230, 150, 0.25);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        .hw-list-card.archived-deleted,
        .hw-detail-header-card.archived-deleted {
          background: #090a0f !important;
          border-color: rgb(var(--os-fg-rgb) / 0.03) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8) !important;
        }

        .hw-list-card.archived-deleted:hover {
          background: #10121a !important;
          border-color: rgb(var(--os-fg-rgb) / 0.06) !important;
        }

        .hw-list-card.archived-deleted.selected {
          background: #14110f !important;
          border-color: rgba(0, 230, 150, 0.3) !important;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8), 0 5px 15px rgba(0, 0, 0, 0.3) !important;
        }

        .hw-list-card.archived-deleted .hw-card-subject,
        .hw-detail-header-card.archived-deleted .hw-card-subject {
          color: #ffffff !important;
          opacity: 0.95;
          font-weight: 700;
        }

        .hw-list-card.archived-deleted .hw-card-theme,
        .hw-detail-header-card.archived-deleted .hw-detail-theme {
          color: #ffffff !important;
          opacity: 0.9;
        }

        .hw-list-card.archived-deleted .hw-card-deadline,
        .hw-detail-header-card.archived-deleted .hw-detail-meta,
        .hw-detail-header-card.archived-deleted .hw-detail-meta-item {
          color: #ffffff !important;
          opacity: 0.75;
        }

        .hw-active-card-indicator {
          position: absolute;
          left: 0;
          top: 15%;
          height: 70%;
          width: 4px;
          background: var(--accent-purple);
          border-radius: 0 4px 4px 0;
          box-shadow: 0 0 12px var(--accent-purple);
          z-index: 5;
        }

        .hw-card-subject {
          font-size: 0.65rem;
          font-family: 'Fira Code', monospace;
          color: #9ca3af; /* A clean, neutral gray that stands out but doesn't clash with the theme */
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
          line-height: 1.4;
        }

        .hw-card-theme {
          font-size: 0.88rem;
          color: var(--text-primary);
          font-weight: 600;
          margin-top: 0.4rem;
          line-height: 1.4;
        }

        .hw-card-footer {
          display: flex;
          justify-content: flex-start;
          align-items: center;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .hw-card-deadline {
          font-size: 0.7rem;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .hw-badge {
          font-size: 0.68rem;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid currentColor;
          font-weight: 600;
        }

        .hw-detail-scrollable {
          flex: 1;
          overflow-y: auto;
          padding: 1.75rem;
          display: flex;
          flex-direction: column;
          gap: 1.75rem;
          padding-bottom: 4rem;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hw-detail-scrollable::-webkit-scrollbar {
          display: none;
        }

        .hw-setup-panel-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .hw-setup-panel-container::-webkit-scrollbar {
          display: none;
        }

        .hw-detail-header-card {
          padding: 1.75rem;
          border-radius: 16px;
          background: rgb(var(--os-fg-rgb) / 0.015);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.04);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .hw-detail-theme {
          font-size: 1.6rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
          margin: 0.25rem 0;
        }

        .hw-detail-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .hw-detail-meta-item {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .hw-desc-box {
          padding: 1.5rem;
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.03);
          font-size: 0.9rem;
          line-height: 1.65;
          color: var(--text-secondary);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .hw-desc-box a {
          color: var(--accent-purple-soft);
          text-decoration: underline;
        }

        .hw-desc-box ul, .hw-desc-box ol {
          padding-left: 1.5rem;
          margin-top: 0.75rem;
          margin-bottom: 0.75rem;
        }

        .hw-section-title {
          font-size: 0.85rem;
          font-family: 'Fira Code', monospace;
          color: var(--accent-purple);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }

        .hw-submission-card {
          padding: 1.75rem;
          border-radius: 16px;
          background: rgb(var(--os-fg-rgb) / 0.015);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.05);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .hw-dropzone {
          border: 2px dashed rgb(var(--os-fg-rgb) / 0.08);
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          background: rgb(var(--os-fg-rgb) / 0.01);
          transition: all 0.25s ease;
          position: relative;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .hw-dropzone.active {
          border-color: var(--accent-purple-soft);
          background: rgba(0, 255, 194, 0.04);
          box-shadow: 0 0 15px rgba(0, 255, 194, 0.1);
        }

        .hw-code-textarea {
          width: 100%;
          min-height: 160px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.06);
          border-radius: 12px;
          padding: 1rem;
          color: #FFFFFF;
          font-family: 'Fira Code', monospace;
          font-size: 0.88rem;
          resize: vertical;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s;
        }

        .hw-code-textarea:focus {
          border-color: var(--accent-purple);
          box-shadow: 0 0 12px rgba(0, 230, 150, 0.15);
        }

        .hw-download-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-radius: 12px;
          background: rgb(var(--os-fg-rgb) / 0.02);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.04);
          font-size: 0.85rem;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .hw-download-card:hover {
          background: rgb(var(--os-fg-rgb) / 0.04);
          border-color: rgb(var(--os-fg-rgb) / 0.08);
        }

        .hw-time-input-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          height: 36px;
        }

        .hw-time-input {
          width: 60px;
          height: 32px;
          line-height: 32px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgb(var(--os-fg-rgb) / 0.06);
          border-radius: 8px;
          padding: 0 6px;
          color: var(--text-primary);
          text-align: center;
          font-family: 'Fira Code', monospace;
          font-size: 0.85rem;
          outline: none;
          box-sizing: border-box;
        }

        .hw-time-input:focus {
          border-color: var(--accent-purple-soft);
        }

        .hw-main-content-wrapper {
          display: flex;
          width: 100%;
          height: 100%;
          gap: 1.5rem;
        }
        @media (max-width: 1024px) {
          .hw-main-content-wrapper {
            gap: 0;
          }
        }
        .hw-loading-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          width: 100%;
          border-radius: 16px;
          padding: 3rem;
          box-sizing: border-box;
        }
      `}</style>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="hw-loading"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="hw-loading-container liquid-glass-dense"
          >
            <RefreshCw className="animate-spin text-accent-purple mb-3" size={24} style={{ color: 'var(--accent-purple)' }} />
            <p className="text-xs text-text-secondary" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Синхронизация домашних заданий с сервером Академии...
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="hw-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hw-main-content-wrapper"
          >
            {/* LEFT COLUMN: Homework Master List */}
            <motion.div
              className="hw-master-pane liquid-glass-dense"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Filters Header */}
              <div className="hw-filters-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', fontFamily: "'Fira Code', monospace" }}>
                    Задания & Лабораторные
                  </h4>
            <motion.button
              onClick={() => fetchHomeworks(true, 1)}
              disabled={isRefreshing}
              whileTap={{ scale: 0.9 }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px'
              }}
              title="Обновить"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            </motion.button>
          </div>

          {/* Search */}
          <div className="journal-search" style={{ margin: 0 }}>
            <Search size={14} style={{ color: '#6b6b6b', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Поиск по предмету, теме..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type Filter */}
          <div className="hw-filter-tabs">
            <button
              className={`hw-filter-tab ${typeFilter === 0 ? 'active' : ''}`}
              onClick={() => setTypeFilter(0)}
              style={{ position: 'relative' }}
            >
              {typeFilter === 0 && (
                <motion.div
                  layoutId="hw-type-filter-pill"
                  className="hw-filter-tab-pill-bg"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2 }}>ДЗ</span>
            </button>
            <button
              className={`hw-filter-tab ${typeFilter === 1 ? 'active' : ''}`}
              onClick={() => setTypeFilter(1)}
              style={{ position: 'relative' }}
            >
              {typeFilter === 1 && (
                <motion.div
                  layoutId="hw-type-filter-pill"
                  className="hw-filter-tab-pill-bg"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2 }}>Лабораторные</span>
            </button>
          </div>

          {/* Status Filter Scroller */}
          <div className="hw-status-scroller">
            {[
              { id: 4, label: 'Все' },
              { id: 3, label: 'Текущие' },
              { id: 2, label: 'На проверке' },
              { id: 1, label: 'Проверено' },
              { id: 0, label: 'Просрочено' },
              { id: 5, label: 'Удалено преподавателем' }
            ].map((st) => (
              <button
                key={st.id}
                className={`hw-status-pill ${statusFilter === st.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(st.id)}
                style={{ position: 'relative' }}
              >
                {statusFilter === st.id && (
                  <motion.div
                    layoutId="hw-status-pill-bg"
                    className="hw-status-pill-active-bg"
                    transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 2 }}>{st.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable list */}
        <div className="hw-list-scrollable">
          { (loading || listLoading) ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="hw-list-card animate-pulse"
                style={{ height: '110px', pointerEvents: 'none' }}
              />
            ))
          ) : filteredHomeworks.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 1rem',
                color: 'var(--text-dim)',
                fontSize: '0.82rem',
                textAlign: 'center'
              }}
            >
              <FileText size={28} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
              <div>Нет заданий в данной категории</div>
            </div>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                {filteredHomeworks.map((hw, index) => {
                  const isSelected = Number(hw.id) === Number(selectedId);
                  const calculatedStatus = getHomeworkStatus(hw);
                  const isOldDeleted = (!hw.homework_stud || hw.homework_stud.auto_mark) && (() => {
                    const targetDateStr = hw.creation_time || hw.completion_time;
                    if (!targetDateStr) return true;
                    const targetDate = new Date(targetDateStr.replace(' ', 'T'));
                    const now = new Date();
                    const sixMonthsAgo = new Date();
                    sixMonthsAgo.setDate(now.getDate() - 180);
                    const isOlderThan6Months = targetDate < sixMonthsAgo;
                    if (hw.status === 5) return isOlderThan6Months;
                    if (typeFilter === 1 && calculatedStatus === 0) return isOlderThan6Months;
                    return false;
                  })();
                  const badge = getStatusBadge(calculatedStatus, hw.homework_stud?.mark);
                  return (
                    <motion.div
                      key={hw.id}
                      id={`hw-list-card-${hw.id}`}
                      ref={isSelected ? scrollRefCallback : undefined}
                      layoutId={`hw-card-${hw.id}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      whileHover={{ y: -3, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className={`hw-list-card ${isSelected ? 'selected' : ''} ${isOldDeleted ? 'archived-deleted' : ''}`}
                      onClick={() => {
                        setSelectedId(hw.id);
                        setIsMobileDetailView(true);
                      }}
                      style={{ 
                        paddingRight: hw.homework_stud?.mark && !hw.homework_stud.auto_mark
                          ? '5.5rem'
                          : '1.25rem'
                      }}
                      transition={{
                        default: { type: 'spring', stiffness: 400, damping: 30 },
                        opacity: { delay: index * 0.03, duration: 0.25 },
                        y: { delay: index * 0.03, type: 'spring', stiffness: 400, damping: 30 }
                      }}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="hw-active-card-indicator"
                          className="hw-active-card-indicator"
                          transition={{ type: "spring", stiffness: 350, damping: 28 }}
                        />
                      )}
                      <div className="hw-card-subject">{hw.name_spec}</div>
                      <div className="hw-card-theme">{hw.theme}</div>
                      <div className="hw-card-footer">
                        <div className="hw-card-deadline">
                          <Clock size={12} />
                          <span>Дедлайн: {hw.completion_time || '—'}</span>
                        </div>
                        <span
                          className="hw-badge"
                          style={{
                            color: badge.color,
                            boxShadow: `0 0 8px ${badge.glow}`,
                            background: badge.bg,
                            borderColor: badge.color
                          }}
                        >
                          {badge.text}
                        </span>
                      </div>

                      {/* Large circular mark badge */}
                      {hw.homework_stud && hw.homework_stud.mark !== null && hw.homework_stud.mark !== undefined && (
                        <div style={{
                          position: 'absolute',
                          right: '1.25rem',
                          bottom: '1.25rem',
                          width: '52px',
                          height: '52px',
                          borderRadius: '50%',
                          background: 'rgb(var(--os-fg-rgb) / 0.03)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.08)',
                          boxShadow: 'inset 0 1px 2px rgb(var(--os-fg-rgb) / 0.05), 0 2px 6px rgba(0, 0, 0, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 5
                        }}>
                          <span style={{
                            fontSize: '1.5rem',
                            fontWeight: 800,
                            color: '#7dffc4',
                            fontFamily: "'Fira Code', monospace",
                            textShadow: '0 0 8px rgba(255, 122, 80, 0.35)',
                            lineHeight: '1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {hw.homework_stud.mark}
                          </span>
                        </div>
                      )}

                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Show More Pagination Button */}
              {hasMore && (
                <button
                  className="btn-journal secondary"
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    height: '38px',
                    fontFamily: "'Fira Code', monospace",
                    fontSize: '0.78rem',
                    border: '1px solid rgba(0, 230, 150, 0.2)',
                    color: 'var(--accent-purple)'
                  }}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <>
                      <span>Показать еще</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* RIGHT COLUMN: Detailed View / Submission Pane */}
      <motion.div
        className="hw-detail-pane liquid-glass-dense"
      >
        {selectedHw ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header row containing Mobile Back Button AND Contextual Switcher */}
            <div className="hw-detail-header">
              {/* Back Button (Only visible on mobile) */}
              <motion.button
                onClick={() => setIsMobileDetailView(false)}
                whileHover={{ x: -3 }}
                whileTap={{ scale: 0.97 }}
                className="hw-mobile-back-btn"
              >
                <ArrowLeft size={16} style={{ marginRight: '4px' }} />
                Назад к списку
              </motion.button>

              {/* Desktop Title (Only visible on desktop) */}
              <span className="hw-desktop-title">
                Карточка задания
              </span>

            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              <AnimatePresence mode="wait">
            <motion.div
              key={`normal-dev-${selectedHw.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
            >
              {(() => { animIndex = 0; return null; })()}

            <div className="hw-detail-scrollable">
              {/* Header Info */}
              <motion.div
                className={`hw-detail-header-card ${(!selectedHw.homework_stud || selectedHw.homework_stud.auto_mark) && cannotSubmitDueToAge ? 'archived-deleted' : ''}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: animIndex++ * 0.08, type: 'spring', stiffness: 150 }}
              >
                <span className="hw-card-subject">{selectedHw.name_spec}</span>
                <h2 className="hw-detail-theme">{selectedHw.theme}</h2>

                <div className="hw-detail-meta">
                  {selectedHw.fio_teach && (
                    <div className="hw-detail-meta-item">
                      <User size={13} style={{ color: 'var(--accent-purple-soft)' }} />
                      <span>{selectedHw.fio_teach}</span>
                    </div>
                  )}
                  {selectedHw.creation_time && (
                    <div className="hw-detail-meta-item">
                      <Clock size={13} style={{ color: 'var(--accent-purple-muted)' }} />
                      <span>Выдано: {selectedHw.creation_time}</span>
                    </div>
                  )}
                  {selectedHw.completion_time && (
                    <div className="hw-detail-meta-item">
                      <AlertTriangle size={13} style={{ color: 'var(--accent-purple)' }} />
                      <span style={{ fontWeight: 600 }}>Дедлайн: {selectedHw.completion_time}</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Task Description */}
              {selectedHw.comment && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: animIndex++ * 0.08, type: 'spring', stiffness: 150 }}
                >
                  <div className="hw-section-title">
                    <FileText size={15} />
                    <span>Описание задания</span>
                  </div>
                  <div
                    className="hw-desc-box"
                    dangerouslySetInnerHTML={{ __html: selectedHw.comment }}
                  />
                </motion.div>
              )}

              {/* Teacher attached materials */}
              {selectedHw.file_path && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: animIndex++ * 0.08, type: 'spring', stiffness: 150 }}
                >
                  <div className="hw-section-title">
                    <Download size={15} />
                    <span>Материалы преподавателя</span>
                  </div>
                  <motion.div 
                    className="hw-download-card"
                    whileHover={{ scale: 1.01 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <FileText size={20} style={{ color: 'var(--accent-purple-soft)', flexShrink: 0 }} />
                      <span
                        style={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {selectedHw.filename || 'Материалы задания'}
                      </span>
                    </div>
                    <motion.a
                      href={getDownloadUrl(selectedHw.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-journal primary"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      style={{
                        padding: '6px 12px',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={12} />
                      Скачать
                    </motion.a>
                  </motion.div>
                </motion.div>
              )}

              {/* Submission Area */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: animIndex++ * 0.08, type: 'spring', stiffness: 150 }}
              >
                <div className="hw-section-title">
                  <Award size={15} />
                  <span>Ваше решение</span>
                </div>

                <div className="hw-submission-card">
                  {/* Case 1: Graded by Teacher */}
                  {selectedHw.homework_stud && selectedHw.homework_stud.mark !== null && !selectedHw.homework_stud.auto_mark && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          background: 'rgba(125, 255, 196, 0.04)',
                          border: '1px solid rgba(125, 255, 196, 0.2)',
                          padding: '1.25rem',
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)'
                        }}
                      >
                        <CheckCircle2 size={24} style={{ color: 'var(--accent-purple-muted)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Работа проверена</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                            Оценка: <strong style={{ color: 'var(--accent-purple-muted)', fontSize: '1.05rem' }}>{selectedHw.homework_stud.mark}</strong>
                          </div>
                        </div>
                      </div>

                      {selectedHw.homework_comment?.text_comment && (
                        <div
                          style={{
                            background: 'rgb(var(--os-fg-rgb) / 0.02)',
                            border: '1px solid rgb(var(--os-fg-rgb) / 0.04)',
                            padding: '1.25rem',
                            borderRadius: '12px',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              fontSize: '0.78rem',
                              fontFamily: "'Fira Code', monospace",
                              color: 'var(--accent-purple)',
                              marginBottom: '0.5rem'
                            }}
                          >
                            <MessageSquare size={13} />
                            Комментарий преподавателя:
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            {selectedHw.homework_comment.text_comment}
                          </div>
                        </div>
                      )}

                      {selectedHw.homework_stud.stud_answer && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.45rem' }}>
                            Ваш текстовый ответ:
                          </label>
                          <pre
                            style={{
                              margin: 0,
                              padding: '1rem',
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid rgb(var(--os-fg-rgb)/0.03)',
                              borderRadius: '10px',
                              fontFamily: "'Fira Code', monospace",
                              fontSize: '0.82rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              color: '#bdbdbd',
                              lineHeight: 1.45
                            }}
                          >
                            {selectedHw.homework_stud.stud_answer}
                          </pre>
                        </div>
                      )}

                      {(selectedHw.homework_stud.filename || selectedHw.homework_stud.file_path) && (
                        <motion.div 
                          className="hw-download-card"
                          whileHover={{ scale: 1.01 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <FileText size={16} style={{ color: 'var(--accent-purple-soft)', flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {selectedHw.homework_stud.filename || 'Файл решения'}
                            </span>
                          </div>
                          {selectedHw.homework_stud.file_path && (
                            <motion.a
                              href={getDownloadUrl(selectedHw.homework_stud.file_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.96 }}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'var(--accent-purple-soft)', fontSize: '0.78rem' }}
                            >
                              <ExternalLink size={12} /> Просмотреть файл
                            </motion.a>
                          )}
                        </motion.div>
                      )}

                      {/* Divider line */}
                      <hr style={{ border: 'none', borderTop: '1px solid rgb(var(--os-fg-rgb) / 0.08)', margin: '1rem 0' }} />

                      <AnimatePresence mode="wait">
                        {!showResubmitForm ? (
                          <motion.div
                            key="resubmit-prompt"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            style={{
                              background: 'rgb(var(--os-fg-rgb) / 0.01)',
                              border: '1px solid rgb(var(--os-fg-rgb) / 0.03)',
                              padding: '1.25rem',
                              borderRadius: '12px',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.75rem',
                              textAlign: 'center',
                              backdropFilter: 'blur(10px)',
                              WebkitBackdropFilter: 'blur(10px)'
                            }}
                          >
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              Запрос на пересдачу
                            </div>
                            
                            <motion.button
                              onClick={() => {
                                setShowResubmitForm(true);
                              }}
                              className="btn-journal primary"
                              whileHover={{
                                scale: 1.05,
                                boxShadow: '0 0 15px rgba(125, 255, 196, 0.3)',
                                borderColor: 'rgba(125, 255, 196, 0.5)'
                              }}
                              whileTap={{ scale: 0.95 }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                height: '38px',
                                padding: '0 1.5rem',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity: 1,
                                background: 'rgba(125, 255, 196, 0.1)',
                                border: '1px solid rgba(125, 255, 196, 0.3)',
                                color: 'var(--accent-purple-muted)'
                              }}
                            >
                              <span>-2</span>
                              <img 
                                src="/top-gem.png" 
                                alt="Gems" 
                                style={{ 
                                  width: '16px', 
                                  height: '16px', 
                                  display: 'block',
                                  filter: 'drop-shadow(0 0 4px rgba(125, 255, 196, 0.4))'
                                }}
                              />
                            </motion.button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="resubmit-form"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-purple)' }}>
                                Подготовка пересдачи
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setUploadedFileToken(null);
                                  setUploadedFileName(null);
                                  setUploadingFile(null);
                                  setShowResubmitForm(false);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-dim)',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem'
                                }}
                              >
                                Отмена
                              </button>
                            </div>
                            
                            <form onSubmit={handleSubmitHomework} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                              {/* Text Solution */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontFamily: "'Fira Code', monospace", fontWeight: 500 }}>
                                  Текстовый ответ / Комментарий:
                                </label>
                                <textarea
                                  className="hw-code-textarea"
                                  placeholder="Введите ваш ответ или код решения здесь..."
                                  value={answerText}
                                  onChange={(e) => setAnswerText(e.target.value)}
                                />
                              </div>

                              {/* File Uploader Dropzone */}
                              <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontFamily: "'Fira Code', monospace", fontWeight: 500 }}>
                                  Прикрепить файл (архив с кодом, PDF, документ):
                                </label>
                                
                                {!uploadedFileToken ? (
                                  <motion.div 
                                    className={`hw-dropzone ${isDragActive ? 'active' : ''}`}
                                    onDragEnter={handleDrag}
                                    onDragOver={handleDrag}
                                    onDragLeave={handleDrag}
                                    onDrop={handleDrop}
                                    animate={{
                                      scale: isDragActive ? 1.02 : 1,
                                      borderColor: isDragActive ? 'var(--accent-purple-soft)' : 'rgb(var(--os-fg-rgb) / 0.08)',
                                      backgroundColor: isDragActive ? 'rgba(0, 255, 194, 0.04)' : 'rgb(var(--os-fg-rgb) / 0.01)'
                                    }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <input
                                      type="file"
                                      id="hw-file-upload-input-resubmit"
                                      style={{ display: 'none' }}
                                      onChange={handleFileSelect}
                                      disabled={isUploading}
                                    />
                                    <label htmlFor="hw-file-upload-input-resubmit" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                                      <UploadCloud size={30} style={{ color: 'var(--text-dim)', marginBottom: '0.75rem', transition: 'color 0.2s' }} />
                                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                        {isUploading ? 'Загрузка файла на сервер...' : 'Выберите файл или перетащите его'}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                                        Поддерживаются любые файлы до 99MB (.txt и .csv запрещены)
                                      </div>
                                    </label>

                                    {isUploading && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          bottom: 0,
                                          left: 0,
                                          height: '3px',
                                          background: 'var(--accent-purple-soft)',
                                          width: `${uploadProgress}%`,
                                          transition: 'width 0.2s',
                                          borderRadius: '0 0 12px 12px'
                                        }}
                                      />
                                    )}
                                  </motion.div>
                                ) : (
                                  <motion.div 
                                    className="hw-download-card"
                                    whileHover={{ scale: 1.01 }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                      <FileText size={18} style={{ color: 'var(--accent-purple-soft)', flexShrink: 0 }} />
                                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                        {uploadedFileName}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUploadedFileToken(null);
                                        setUploadedFileName(null);
                                        setUploadingFile(null);
                                      }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ff5555',
                                        cursor: 'pointer',
                                        padding: '4px'
                                      }}
                                      title="Удалить файл"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </motion.div>
                                )}

                                {uploadError && (
                                  <div style={{ fontSize: '0.75rem', color: '#ff5555', marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertCircle size={12} />
                                    <span>{uploadError}</span>
                                  </div>
                                )}
                              </div>

                              <motion.button
                                type="submit"
                                disabled={submitting || isUploading}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.99 }}
                                className="btn-journal primary"
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.5rem',
                                  marginTop: '0.5rem',
                                  height: '42px',
                                  cursor: (submitting || isUploading) ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {submitting ? 'Отправка...' : 'Отправить на пересдачу (-2 топгема)'}
                              </motion.button>
                            </form>
                          </motion.div>
                        )}
                      </AnimatePresence>

                    </div>
                  )}

                  {/* Case 2: Under Review */}
                  {selectedHw.homework_stud && selectedHw.homework_stud.mark === null && !selectedHw.homework_stud.auto_mark && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          background: 'rgba(255, 145, 0, 0.04)',
                          border: '1px solid rgba(255, 145, 0, 0.2)',
                          padding: '1.25rem',
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)'
                        }}
                      >
                        <Clock size={24} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ожидает проверки</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                            Вы сдали работу. Преподаватель еще не проверил ее.
                          </div>
                        </div>
                      </div>

                      {selectedHw.homework_stud.stud_answer && (
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '0.45rem' }}>
                            Ваш ответ:
                          </label>
                          <pre
                            style={{
                              margin: 0,
                              padding: '1rem',
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid rgb(var(--os-fg-rgb)/0.03)',
                              borderRadius: '10px',
                              fontFamily: "'Fira Code', monospace",
                              fontSize: '0.82rem',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              color: '#bdbdbd',
                              lineHeight: 1.45
                            }}
                          >
                            {selectedHw.homework_stud.stud_answer}
                          </pre>
                        </div>
                      )}

                      {(selectedHw.homework_stud.filename || selectedHw.homework_stud.file_path) && (
                        <div className="hw-download-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <FileText size={16} style={{ color: 'var(--accent-purple-soft)', flexShrink: 0 }} />
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {selectedHw.homework_stud.filename || 'Файл решения'}
                            </span>
                          </div>
                          {selectedHw.homework_stud.file_path && (
                            <a
                              href={getDownloadUrl(selectedHw.homework_stud.file_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'var(--accent-purple-soft)', fontSize: '0.78rem' }}
                            >
                              <ExternalLink size={12} /> Просмотреть файл
                            </a>
                          )}
                        </div>
                      )}

                      {selectedHw.status !== 5 && (
                        <button
                          onClick={handleDeleteHomework}
                          disabled={deleting}
                          className="btn-journal secondary"
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            color: '#ff5555',
                            cursor: 'pointer',
                            marginTop: '0.5rem',
                            height: '38px'
                          }}
                        >
                          <Trash2 size={14} />
                          {deleting ? 'Удаление...' : 'Отозвать и удалить решение'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Case 4: Deleted by teacher or overdue lab, and more than 6 months old */}
                  {(!selectedHw.homework_stud || selectedHw.homework_stud.auto_mark) && cannotSubmitDueToAge && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'rgba(255, 85, 85, 0.04)',
                        border: '1px solid rgba(255, 85, 85, 0.15)',
                        padding: '1.25rem',
                        borderRadius: '12px',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        marginTop: '0.5rem'
                      }}
                    >
                      <AlertCircle size={24} style={{ color: 'var(--accent-red, #ff5555)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ff5555' }}>Сдача невозможна</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.45 }}>
                          {selectedHw.status === 5 ? (
                            'Это задание было удалено преподавателем более 6 месяцев назад. Сдача решения невозможна.'
                          ) : (
                            'Невозможно загрузить материалы в связи со сроком давности выдачи задания.'
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Case 3: Empty / Action Needed (not submitted yet) */}
                  {(!selectedHw.homework_stud || selectedHw.homework_stud.auto_mark) && !cannotSubmitDueToAge && (
                    <form onSubmit={handleSubmitHomework} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Overdue Warning */}
                      {getHomeworkStatus(selectedHw) === 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(255, 85, 85, 0.05)',
                            border: '1px solid rgba(255, 85, 85, 0.15)',
                            padding: '0.85rem',
                            borderRadius: '10px',
                            color: '#ff5555',
                            fontSize: '0.78rem',
                            lineHeight: 1.4
                          }}
                        >
                          <AlertCircle size={16} style={{ flexShrink: 0 }} />
                          <span>Дедлайн истек! Вы все еще можете сдать работу, но она будет помечена как просроченная.</span>
                        </div>
                      )}

                      {/* Deleted but submittable warning */}
                      {selectedHw.status === 5 && !isMoreThanSixMonthsOld && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(255, 145, 0, 0.05)',
                            border: '1px solid rgba(255, 145, 0, 0.15)',
                            padding: '0.85rem',
                            borderRadius: '10px',
                            color: 'var(--accent-purple, #30ff44)',
                            fontSize: '0.78rem',
                            lineHeight: 1.4
                          }}
                        >
                          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                          <span>Задание удалено преподавателем, но вы можете сдать его, так как с момента выдачи прошло менее 6 месяцев.</span>
                        </div>
                      )}

                      {/* Text Solution */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontFamily: "'Fira Code', monospace", fontWeight: 500 }}>
                          Текстовый ответ / Комментарий:
                        </label>
                        <textarea
                          className="hw-code-textarea"
                          placeholder="Введите ваш ответ или код решения здесь..."
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                        />
                      </div>

                      {/* File Uploader Dropzone */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', fontFamily: "'Fira Code', monospace", fontWeight: 500 }}>
                          Прикрепить файл (архив с кодом, PDF, документ):
                        </label>
                        
                        {!uploadedFileToken ? (
                          <motion.div 
                            className={`hw-dropzone ${isDragActive ? 'active' : ''}`}
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            animate={{
                              scale: isDragActive ? 1.02 : 1,
                              borderColor: isDragActive ? 'var(--accent-purple-soft)' : 'rgb(var(--os-fg-rgb) / 0.08)',
                              backgroundColor: isDragActive ? 'rgba(0, 255, 194, 0.04)' : 'rgb(var(--os-fg-rgb) / 0.01)'
                            }}
                            transition={{ duration: 0.2 }}
                          >
                            <input
                              type="file"
                              id="hw-file-upload-input"
                              style={{ display: 'none' }}
                              onChange={handleFileSelect}
                              disabled={isUploading}
                            />
                            <label htmlFor="hw-file-upload-input" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                              <UploadCloud size={30} style={{ color: 'var(--text-dim)', marginBottom: '0.75rem', transition: 'color 0.2s' }} />
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                {isUploading ? 'Загрузка файла на сервер...' : 'Выберите файл или перетащите его'}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                                Поддерживаются любые файлы до 99MB (.txt и .csv запрещены)
                              </div>
                            </label>

                            {isUploading && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  height: '3px',
                                  background: 'var(--accent-purple-soft)',
                                  width: `${uploadProgress}%`,
                                  transition: 'width 0.2s',
                                  borderRadius: '0 0 12px 12px'
                                }}
                              />
                            )}
                          </motion.div>
                        ) : (
                          <motion.div 
                            className="hw-download-card"
                            whileHover={{ scale: 1.01 }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <FileText size={18} style={{ color: 'var(--accent-purple-soft)', flexShrink: 0 }} />
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                {uploadedFileName}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadedFileToken(null);
                                setUploadedFileName(null);
                                setUploadingFile(null);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ff5555',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                              title="Удалить файл"
                            >
                              <Trash2 size={14} />
                            </button>
                          </motion.div>
                        )}

                        {uploadError && (
                          <div style={{ fontSize: '0.75rem', color: '#ff5555', marginTop: '0.45rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <AlertCircle size={12} />
                            <span>{uploadError}</span>
                          </div>
                        )}
                      </div>

                      {/* Optional Homework/Lesson Evaluation Section */}
                      <div
                        style={{
                          background: 'rgb(var(--os-fg-rgb) / 0.01)',
                          border: '1px solid rgb(var(--os-fg-rgb) / 0.03)',
                          padding: '1rem',
                          borderRadius: '10px',
                          marginTop: '1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Оцените, насколько знания с урока были достаточными:
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              background: 'rgb(var(--os-fg-rgb) / 0.05)',
                              color: 'var(--text-dim)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 500,
                              fontFamily: "'Fira Code', monospace"
                            }}
                          >
                            не обязательно
                          </span>
                        </div>

                        {/* Stars */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {Array.from({ length: 5 }).map((_, idx) => {
                            const starVal = idx + 1;
                            const isActive = evalHoverRating !== null ? starVal <= evalHoverRating : starVal <= evalRating;
                            return (
                              <motion.button
                                key={idx}
                                type="button"
                                onClick={() => setEvalRating(starVal)}
                                onMouseEnter={() => setEvalHoverRating(starVal)}
                                onMouseLeave={() => setEvalHoverRating(null)}
                                whileHover={{ scale: 1.25, rotate: 12 }}
                                whileTap={{ scale: 0.9 }}
                                style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer' }}
                              >
                                <Star
                                  size={18}
                                  style={{
                                    color: isActive ? '#7dffc4' : 'var(--text-dim)',
                                    fill: isActive ? '#7dffc4' : 'transparent',
                                    transition: 'all 0.1s'
                                  }}
                                />
                              </motion.button>
                            );
                          })}
                        </div>

                        {/* Expandable evaluation options */}
                        <AnimatePresence>
                          {evalRating > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                            >
                              {/* Tags picker (only show if tagsList exists) */}
                              {tagsList.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                    Что понравилось или не понравилось:
                                  </span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                    {tagsList.map((tag) => {
                                      const isSelected = evalSelectedTags.includes(tag.id);
                                      const label = TAG_TRANSLATIONS[tag.translate_key] || tag.translate_key;
                                      return (
                                        <motion.button
                                          key={tag.id}
                                          type="button"
                                          whileHover={{ scale: 1.03 }}
                                          whileTap={{ scale: 0.97 }}
                                          onClick={() => {
                                            if (isSelected) {
                                              setEvalSelectedTags(prev => prev.filter(id => id !== tag.id));
                                            } else {
                                              setEvalSelectedTags(prev => [...prev, tag.id]);
                                            }
                                          }}
                                          style={{
                                            fontSize: '0.68rem',
                                            background: isSelected ? 'rgba(0, 230, 150, 0.12)' : 'rgb(var(--os-fg-rgb) / 0.02)',
                                            border: isSelected ? '1px solid rgba(0, 230, 150, 0.3)' : '1px solid rgb(var(--os-fg-rgb) / 0.05)',
                                            color: isSelected ? 'var(--accent-purple)' : 'var(--text-secondary)',
                                            borderRadius: '6px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s, color 0.2s, border-color 0.2s'
                                          }}
                                        >
                                          {label}
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Comment textarea */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                  Комментарий к уроку/ДЗ (по желанию):
                                </span>
                                <textarea
                                  value={evalComment}
                                  onChange={(e) => setEvalComment(e.target.value)}
                                  placeholder="Напишите свое мнение о занятии..."
                                  style={{
                                    width: '100%',
                                    minHeight: '45px',
                                    maxHeight: '100px',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    border: '1px solid rgb(var(--os-fg-rgb) / 0.05)',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.78rem',
                                    resize: 'vertical',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Spent Time & Submit */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1.25rem',
                          borderTop: '1px solid rgb(var(--os-fg-rgb) / 0.04)',
                          paddingTop: '1.25rem',
                          marginTop: '0.5rem'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: "'Fira Code', monospace" }}>
                            Потрачено времени:
                          </span>
                          <div className="hw-time-input-group">
                            <input
                              type="number"
                              className="hw-time-input"
                              min="0"
                              max="99"
                              value={spentTimeHour}
                              onChange={(e) => setSpentTimeHour(e.target.value)}
                              placeholder="чч"
                            />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: "'Fira Code', monospace" }}>ч</span>
                            <input
                              type="number"
                              className="hw-time-input"
                              min="0"
                              max="59"
                              value={spentTimeMin}
                              onChange={(e) => setSpentTimeMin(e.target.value)}
                              placeholder="мм"
                            />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: "'Fira Code', monospace" }}>м</span>
                          </div>
                        </div>

                        <motion.button
                          type="submit"
                          disabled={submitting || isUploading || (!answerText.trim() && !uploadedFileToken)}
                          whileHover={!(submitting || isUploading || (!answerText.trim() && !uploadedFileToken)) ? { scale: 1.02 } : {}}
                          whileTap={!(submitting || isUploading || (!answerText.trim() && !uploadedFileToken)) ? { scale: 0.98 } : {}}
                          className="btn-journal primary"
                          style={{
                            padding: '10px 24px',
                            height: '38px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: (submitting || isUploading || (!answerText.trim() && !uploadedFileToken)) ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {submitting ? 'Отправка...' : 'Отправить решение'}
                        </motion.button>
                      </div>
                    </form>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'var(--text-dim)',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <FileText size={48} style={{ opacity: 0.15, marginBottom: '1rem' }} />
            <h3 style={{ margin: 0, fontWeight: 500, fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Выберите домашнее задание
            </h3>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', maxWidth: '300px', lineHeight: 1.4 }}>
              Выберите нужное задание из списка слева для просмотра подробного описания и сдачи работы.
            </p>
          </div>
        )}
      </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
