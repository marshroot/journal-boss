import { ModuleItem, SubjectItem, PopularOrigin } from './types';

export const MODULES: ModuleItem[] = [
  {
    id: 'analytics-stats',
    name: 'Средний балл & Посещаемость',
    category: 'Stats & Goals',
    loadRate: 'Все предметы',
    accuracy: 100,
    speed: 'мгновенно',
    cabinHeight: 'React / TS',
    cabinWidth: 'SQLite / EF Core',
    storageLimit: 'Оценки на семестр',
    description: 'Аналитическая панель успеваемости и посещаемости. Рассчитывает средний балл, прогнозирует оценки на четверть или семестр и ведёт детальный учёт пропусков. Данные кэшируются в локальную базу SQLite для быстрого доступа.',
    imageUrl: '/dashboard-stats.jpg',
    costEstimate: 0,
    metrics: [
      { label: 'Анализ', value: 'Все предметы', icon: 'users' },
      { label: 'Точность', value: '100% расчёты', icon: 'compass' },
      { label: 'Графики', value: 'Интерактивные', icon: 'wind' },
      { label: 'Прогноз', value: 'Оценки на семестр', icon: 'layers' }
    ],
    specs: [
      { label: 'Стек', value: 'React / TS' },
      { label: 'База данных', value: 'SQLite / EF Core' }
    ]
  },
  {
    id: 'leaderboard',
    name: 'Таблица лидеров & Рейтинги',
    category: 'API Hidden',
    loadRate: 'Группа и поток',
    accuracy: 100,
    speed: 'реальное время',
    cabinHeight: 'API Портала',
    cabinWidth: 'Рейтинг группы',
    storageLimit: 'Показ скрытых',
    description: 'Интерактивная таблица лидеров и рейтинги потоков. Позволяет в реальном времени отслеживать успеваемость всей группы и потока, просматривать баллы и занимаемые позиции на основе прямых запросов к API дневника.',
    imageUrl: '/leaderboard.jpg',
    costEstimate: 0,
    metrics: [
      { label: 'Обхват', value: 'Группа и поток', icon: 'users' },
      { label: 'Рейтинг', value: 'Реальное время', icon: 'compass' },
      { label: 'Запрос', value: 'API дневника', icon: 'wind' },
      { label: 'Аватарки', value: 'Показ скрытых', icon: 'layers' }
    ],
    specs: [
      { label: 'Источник', value: 'API Портала' },
      { label: 'Анализ', value: 'Рейтинг группы' }
    ]
  },
  {
    id: 'schedule',
    name: 'Расписание занятий',
    category: 'Stats & Goals',
    loadRate: 'Автоматическое обновление',
    accuracy: 100,
    speed: '0.1c',
    cabinHeight: 'Синхронизация пар',
    cabinWidth: 'Интерактивный календарь',
    storageLimit: 'Учёт замен',
    description: 'Интерактивный календарь и расписание занятий. Модуль подтягивает актуальные данные пар, кабинетов и преподавателей из базы данных, поддерживает кэширование и мгновенное обновление при изменениях на сервере Академии.',
    imageUrl: '/schedule.jpg',
    costEstimate: 0,
    metrics: [
      { label: 'Календарь', value: 'Интерактивный', icon: 'users' },
      { label: 'Совпадение', value: '100% точное', icon: 'compass' },
      { label: 'Загрузка', value: '0.1 сек', icon: 'wind' },
      { label: 'Изменения', value: 'Учёт замен', icon: 'layers' }
    ],
    specs: [
      { label: 'Синхронизация', value: 'Автоматическая' },
      { label: 'Вид', value: 'Неделя / Месяц' },
      { label: 'Провайдер', value: 'База Дневника' }
    ]
  }
];

export const SUBJECTS: SubjectItem[] = [
  {
    id: 'cpp-dev',
    name: 'Программирование C++',
    code: 'CPP',
    area: 'Разработка ПО',
    imageUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=80&w=800',
    description: 'Сложные алгоритмы, структуры данных, указатели, управление памятью и принципы ООП. Консольные и графические приложения на C++.',
    complexity: 920,
    shortQuote: 'Алгоритмы, указатели и ООП решения'
  },
  {
    id: 'python-data',
    name: 'Python & Data Science',
    code: 'PY',
    area: 'Анализ Данных',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=800',
    description: 'Анализ данных, скрипты автоматизации, машинное обучение и работа с библиотеками NumPy, Pandas и TensorFlow.',
    complexity: 840,
    shortQuote: 'Скрипты и анализ данных'
  },
  {
    id: 'web-front',
    name: 'Web-разработка (HTML/JS)',
    code: 'HTML',
    area: 'Фронтенд',
    imageUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&q=80&w=800',
    description: 'Создание адаптивной вёрстки, работа с DOM-деревом, интерактивные скрипты на JavaScript и современные фреймворки.',
    complexity: 650,
    shortQuote: 'Адаптивный фронтенд и JS логика'
  },
  {
    id: 'sql-db',
    name: 'Базы данных SQL',
    code: 'SQL',
    area: 'Бэкенд',
    imageUrl: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&q=80&w=800',
    description: 'Проектирование реляционных баз данных, написание сложных JOIN-запросов, процедур, триггеров и транзакций на PostgreSQL, MySQL и MS SQL.',
    complexity: 780,
    shortQuote: 'Схемы БД и SQL-процедуры'
  },
  {
    id: 'java-enter',
    name: 'Java Enterprise',
    code: 'JAVA',
    area: 'Бэкенд',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&q=80&w=800',
    description: 'Серверная логика на Java Spring Boot, микросервисная архитектура, REST API и интеграция с очередями сообщений.',
    complexity: 990,
    shortQuote: 'Микросервисы Spring Boot API'
  },
  {
    id: 'sys-admin',
    name: 'Администрирование ОС',
    code: 'OS',
    area: 'Системы',
    imageUrl: 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?auto=format&fit=crop&q=80&w=800',
    description: 'Настройка Linux систем, скрипты Bash, управление пользователями, сетевыми службами, Docker-контейнерами и пайплайнами CI/CD.',
    complexity: 810,
    shortQuote: 'Bash скрипты и контейнеризация Docker'
  }
];

export const POPULAR_SEMESTERS: PopularOrigin[] = [
  { code: 'SEM-1', name: '1-й Семестр (Основы CS)' },
  { code: 'SEM-2', name: '2-й Семестр (ООП и БД)' },
  { code: 'SEM-3', name: '3-й Семестр (Фронтенд)' },
  { code: 'SEM-4', name: '4-й Семестр (Бэкенд Spring)' },
  { code: 'SEM-5', name: '5-й Семестр (Системное ПО)' },
  { code: 'SEM-6', name: '6-й Семестр (Дипломная работа)' }
];
