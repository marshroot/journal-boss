import { useState } from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard, Calendar, FileText, BookOpen,
  Megaphone, Trophy, MessageSquare, CreditCard, User,
  HelpCircle, Phone, MessageCircle, Settings,
  ShoppingBag, ChevronLeft, ClipboardCheck, ChevronRight, LogOut, ShieldCheck, Code2, ImageIcon
} from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: 'red' | 'green' | 'cyan';
}

const GradesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    <line x1="6" y1="20" x2="6" y2="14" />
    <line x1="12" y1="20" x2="12" y2="6" />
    <line x1="18" y1="20" x2="18" y2="10" />
  </svg>
);

const NAV_ITEMS: SidebarItem[] = [
  { id: 'dashboard', label: 'Главная', icon: <LayoutDashboard className="nav-icon" /> },
  { id: 'schedule', label: 'Расписание', icon: <Calendar className="nav-icon" /> },
  { id: 'grades', label: 'Оценки (журнал)', icon: <GradesIcon /> },
  { id: 'local-grades', label: 'Оценки (локальные)', icon: <GradesIcon /> },
  { id: 'homework', label: 'ДЗ (журнал)', icon: <FileText className="nav-icon" /> },
  { id: 'local-homework', label: 'ДЗ (локальные)', icon: <FileText className="nav-icon" /> },
  { id: 'materials', label: 'Учебные материалы', icon: <BookOpen className="nav-icon" /> },
  { id: 'messages', label: 'Сообщения', icon: <MessageCircle className="nav-icon" />, badge: 'NEW', badgeColor: 'cyan' },
  { id: 'payments', label: 'Платежи (демо)', icon: <CreditCard className="nav-icon" />, badge: 'NEW', badgeColor: 'cyan' },
  { id: 'code-lab', label: 'Лаборатория кода', icon: <Code2 className="nav-icon" />, badge: 'NEW', badgeColor: 'cyan' },
  { id: 'image-editor', label: 'Редактор изображений', icon: <ImageIcon className="nav-icon" />, badge: 'NEW', badgeColor: 'cyan' },
  { id: 'announcements', label: 'Объявления', icon: <Megaphone className="nav-icon" /> },
  { id: 'awards', label: 'Награды', icon: <Trophy className="nav-icon" /> },
  { id: 'reviews', label: 'Отзывы о студенте', icon: <MessageSquare className="nav-icon" /> },
  { id: 'profile', label: 'Личный кабинет', icon: <User className="nav-icon" /> },
  { id: 'faq', label: 'F.A.Q.', icon: <HelpCircle className="nav-icon" /> },
  { id: 'contacts', label: 'Контакты', icon: <Phone className="nav-icon" /> },
  { id: 'appeals', label: 'Обращения', icon: <MessageCircle className="nav-icon" /> },
  { id: 'complaints', label: 'Жалобы', icon: <Settings className="nav-icon" /> },
];

interface JournalSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: { role: string };
}

export default function JournalSidebar({ activeTab, onTabChange, currentUser }: JournalSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const items: SidebarItem[] = currentUser?.role === 'Admin'
    ? [...NAV_ITEMS, { id: 'teacher/current-lesson', label: 'Текущая пара', icon: <ClipboardCheck className="nav-icon" /> }, { id: 'admin', label: 'Панель администратора', icon: <LayoutDashboard className="nav-icon" /> }, { id: 'admin/users', label: 'Пользователи', icon: <ShieldCheck className="nav-icon" /> }, { id: 'admin/academic', label: 'Учебная структура', icon: <Calendar className="nav-icon" /> }, { id: 'admin/operations', label: 'Аудит и backup', icon: <ShieldCheck className="nav-icon" /> }]
    : currentUser?.role === 'Teacher'
      ? [...NAV_ITEMS, { id: 'teacher/lessons', label: 'Мои занятия', icon: <ClipboardCheck className="nav-icon" /> }, { id: 'teacher/current-lesson', label: 'Текущая пара', icon: <ClipboardCheck className="nav-icon" /> }]
      : currentUser?.role === 'Parent'
        ? [...NAV_ITEMS, { id: 'parent', label: 'Кабинет родителя', icon: <LayoutDashboard className="nav-icon" /> }, { id: 'parent/progress', label: 'Прогресс ребёнка', icon: <ClipboardCheck className="nav-icon" /> }, { id: 'parent/attendance', label: 'Посещаемость ребёнка', icon: <ClipboardCheck className="nav-icon" /> }]
        : [...NAV_ITEMS, { id: 'online-lesson', label: 'Текущая онлайн-пара', icon: <ClipboardCheck className="nav-icon" /> }];

  return (
    <aside className={`journal-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#30ff44" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10" />
          <path d="M6 10h10" />
        </svg>
        <h2>myJournal</h2>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: '#00ffc2',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Свернуть меню"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {items.map((item) => (
          <motion.a
            key={item.id}
            className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange(item.id)}
            whileTap={{ scale: 0.97 }}
          >
            {activeTab === item.id && (
              <motion.div
                layoutId="sidebar-active-pill"
                className="sidebar-active-pill-bg"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            {item.icon}
            <span className="nav-label">{item.label}</span>
            {item.badge && (
              <span className={`sidebar-badge ${item.badgeColor || 'red'}`}>
                {item.badge}
              </span>
            )}
          </motion.a>
        ))}
      </nav>
    </aside>
  );
}
