import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight, MapPin } from 'lucide-react';

interface NavbarProps {
  isDark: boolean;
  toggleTheme: () => void;
  onLoginClick: () => void;
  activeSection: string;
  onNavClick: (key: string) => void;
  isLoggedIn?: boolean;
}

export default function Navbar({ isDark, toggleTheme, onLoginClick, activeSection, onNavClick, isLoggedIn }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { name: 'Главная', href: '#home', key: 'home' },
    { name: 'Модули', href: '#voyages', key: 'voyages' },
    { name: 'Предметы', href: '#worlds', key: 'worlds' },
  ];

  const handleScroll = (href: string) => {
    setMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const cta = 'os-cta h-[46px] px-7 text-[15px]';

  return (
    <>
      <nav id="app-navbar" className="os-nav fixed top-0 left-0 right-0 z-50 h-[88px] px-5 md:px-7 grid grid-cols-[1fr_auto_1fr] items-center">
        {/* Left: logo circle + name */}
        <a
          href="#home"
          onClick={(e) => { e.preventDefault(); handleScroll('#home'); }}
          className="flex items-center gap-4 justify-self-start group"
        >
          <span className="os-logo-circle">mj</span>
          <span className="os-label text-[color:var(--os-fg)]">myJournal</span>
        </a>

        {/* Center: small uppercase links */}
        <div className="hidden md:flex items-center gap-9">
          {navLinks.map((link) => (
            <a
              key={link.key}
              href={link.href}
              onClick={(e) => { e.preventDefault(); onNavClick(link.key); }}
              className={`os-navlink ${activeSection === link.key ? 'is-active' : ''}`}
            >
              {link.name}
            </a>
          ))}
        </div>

        {/* Right: theme + CTA */}
        <div className="flex items-center gap-6 justify-self-end">
          <button onClick={toggleTheme} aria-label="Toggle visual theme" className="os-navlink hidden sm:flex items-center gap-2 cursor-pointer">
            <MapPin className="w-3 h-3 text-[#30ff44]" />
            {isDark ? 'Dark' : 'Light'}
          </button>
          {isLoggedIn ? (
            <Link to="/dashboard" className={`${cta} hidden md:inline-flex`}>
              Кабинет
              <ArrowRight className="w-4 h-4 os-arrow" />
            </Link>
          ) : (
            <button onClick={onLoginClick} className={`${cta} hidden md:inline-flex`}>
              Войти
              <ArrowRight className="w-4 h-4 os-arrow" />
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center border border-[color:var(--os-line)] text-[color:var(--os-fg)]"
          >
            {mobileMenuOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="fixed top-[88px] left-0 right-0 z-40 p-6 md:hidden border-y border-[color:var(--os-line)] bg-[color:var(--os-bg)] text-[color:var(--os-fg)]"
          >
            <div className="flex flex-col">
              {navLinks.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); onNavClick(link.key); }}
                  className={`os-navlink py-4 border-b border-[color:var(--os-line)] ${activeSection === link.key ? 'is-active' : ''}`}
                >
                  {link.name}
                </a>
              ))}
              <div className="pt-5">
                {isLoggedIn ? (
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)} className={`${cta} w-full justify-between`}>
                    Кабинет
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <button onClick={() => { setMobileMenuOpen(false); onLoginClick(); }} className={`${cta} w-full justify-between`}>
                    Войти
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
