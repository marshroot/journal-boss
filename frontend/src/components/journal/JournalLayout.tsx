import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import JournalSidebar from './JournalSidebar';
import JournalTopBar from './JournalTopBar';
import '../../journal.css';
import { getAccessToken, getCurrentUser, logout, AuthUser } from '../../lib/auth';
import { API_BASE } from '../../lib/apiBase';

export default function JournalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const navTimeoutRef = useRef<any>(null);

  // Determine active tab from location state or pathname
  const [activeTab, setActiveTab] = useState(() => {
    if (location.state?.activeTab) {
      return location.state.activeTab;
    }
    const path = location.pathname.substring(1); // remove leading slash
    return path || 'dashboard';
  });

  // Sync activeTab with pathname and location state changes
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    } else {
      const path = location.pathname.substring(1);
      setActiveTab(path || 'dashboard');
    }
  }, [location.pathname, location.state]);



  // MyStat profile details state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<{
    fullName: string;
    photo: string;
    level: number;
    groupName: string;
    gems: { available: number; total: number };
    coins: { available: number; total: number };
  } | null>(null);

  useEffect(() => {
    // Sync theme preference on mount to prevent defaulting to light theme
    const saved = localStorage.getItem('journal-mod-theme');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      navigate('/login', { replace: true });
      return;
    }

    const loadUser = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          navigate('/login', { replace: true });
          return;
        }

        setCurrentUser(user);
        setProfile(prev => ({
          fullName: user.fullName,
          photo: prev?.photo ?? '',
          level: prev?.level ?? 0,
          groupName: prev?.groupName ?? user.role,
          gems: prev?.gems ?? { available: 0, total: 0 },
          coins: prev?.coins ?? { available: 0, total: 0 },
        }));

        // Load the external journal profile through the authenticated JWT account.
        // Bearer credentials must not be placed in query strings.
        const profileToken = getAccessToken();
        if (profileToken) {
          const res = await fetch(`${API_BASE}/api/Auth/profile`, {
            headers: { Authorization: `Bearer ${profileToken}` },
          });
          if (res.ok) setProfile(await res.json());
        }
      } catch (err) {
        console.error('[Auth] Failed to validate session:', err);
        logout();
        navigate('/login', { replace: true });
      }
    };
    loadUser();
  }, [navigate]);



  // Clean up navigation timeout on unmount
  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) {
        clearTimeout(navTimeoutRef.current);
      }
    };
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab); // Instantly trigger Framer Motion's sliding spring animation!
    
    if (navTimeoutRef.current) {
      clearTimeout(navTimeoutRef.current);
    }

    const IMPLEMENTED_PAGES = ['dashboard', 'schedule', 'grades', 'local-grades', 'local-homework', 'homework', 'materials', 'announcements', 'awards', 'reviews', 'profile', 'faq', 'contacts', 'appeals', 'complaints', 'admin', 'admin/users', 'admin/academic', 'admin/operations', 'teacher/lessons', 'teacher/current-lesson', 'online-lesson', 'parent', 'parent/attendance', 'parent/progress', 'lesson-chat', 'code-lab', 'lesson-board', 'messages', 'payments', 'image-editor'];
    const targetPath = IMPLEMENTED_PAGES.includes(tab) ? `/${tab}` : '/dashboard';
    
    // Delay routing navigation slightly (180ms) so the sidebar spring animation 
    // runs to completion on an idle main thread, avoiding unmounting lag.
    navTimeoutRef.current = setTimeout(() => {
      navigate(targetPath, { state: { activeTab: tab } });
    }, 180);
  };

  return (
    <div className="journal-layout">
      <a className="skip-link" href="#main-content">Перейти к содержимому</a>

      {/* Global Background Grid (only rendered on grades/homework pages) */}
      {(location.pathname === '/grades' || location.pathname === '/homework') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: -2,
            overflow: 'hidden'
          }}
        >
          {/* Global coordinate grid lines */}
          <div 
            className="coordinate-grid" 
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.85
            }} 
          />
        </div>
      )}


      {/* Sidebar */}
      <JournalSidebar activeTab={activeTab} onTabChange={handleTabChange} currentUser={currentUser} />

      {/* Main Content */}
      <div className="journal-main">
        {/* Top HUD */}
        <JournalTopBar
          level={profile?.level}
          gems={profile?.gems}
          coins={profile?.coins}
          userName={profile?.fullName}
          userGroup={profile?.groupName}
          userPhoto={profile?.photo}
        />

        {/* Content Area */}
        <main id="main-content" className="journal-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
