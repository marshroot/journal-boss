import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ModuleExplorer from '../components/ModuleExplorer';
import SubjectDestinations from '../components/SubjectDestinations';
import Footer from '../components/Footer';
import { SUBJECTS } from '../data';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeSection, setActiveSection] = useState<string>('home');
  const [, setSelectedSubjectId] = useState<string>(SUBJECTS[0].id);

  // Session & user details state
  const [isLoggedIn] = useState<boolean>(() => Boolean(localStorage.getItem('accessToken')));

  const handleNavClick = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Load theme preference or default to dark (Obsidian theme)
  useEffect(() => {
    document.body.classList.add('show-scrollbar');

    const saved = localStorage.getItem('journal-mod-theme');
    if (saved === 'light') {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);


    return () => {
      document.body.classList.remove('show-scrollbar');
    };
  }, [navigate]);

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('journal-mod-theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  // Set active nav elements based on scroll positions
  useEffect(() => {
    const sections = ['home', 'voyages', 'worlds'];
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 250;
      
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  const handleSelectSubjectAndScroll = (subjectName: string) => {
    const found = SUBJECTS.find(s => s.name === subjectName);
    if (found) {
      setSelectedSubjectId(found.id);
    }
    const el = document.getElementById('worlds');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };



  return (
    <div className={`os-landing min-h-screen text-sans transition-colors duration-500 overflow-x-hidden ${
      isDark ? 'bg-bg-dark text-text-primary' : 'bg-bg-dark text-text-primary'
    }`}>
      {/* Old site's retro styling overlays */}
      <div className="grid-overlay" />
      <div className="scanlines" />

      {/* Header Navigation */}
      <Navbar 
        isDark={isDark} 
        toggleTheme={toggleTheme} 
        activeSection={activeSection}
        onLoginClick={() => isLoggedIn ? navigate('/dashboard') : navigate('/login')}
        onNavClick={handleNavClick}
        isLoggedIn={isLoggedIn}
      />

      {/* Hero Intro Showcase */}
      <Hero 
        isDark={isDark}
        onExploreClick={() => {
          const el = document.getElementById('voyages');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        onBookClick={() => {
          if (isLoggedIn) {
            navigate('/dashboard');
          } else {
            navigate('/login');
          }
        }}
      />

      {/* Module Explorer */}
      <ModuleExplorer 
        isDark={isDark}
      />

      {/* Subject destinations */}
      <SubjectDestinations 
        isDark={isDark}
        onSelectSubject={handleSelectSubjectAndScroll}
        onContactSupport={() => {
          if (isLoggedIn) {
            navigate('/dashboard');
          } else {
            navigate('/login');
          }
        }}
      />

      {/* Footer */}
      <Footer 
        isDark={isDark} 
      />


    </div>
  );
}
