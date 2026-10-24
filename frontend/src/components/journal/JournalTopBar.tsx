import { useState, useEffect, useRef } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { logout } from '../../lib/auth';

interface JournalTopBarProps {
  level?: number;
  gems?: { available: number; total: number };
  coins?: { available: number; total: number };
  userName?: string;
  userGroup?: string;
  userPhoto?: string;
}

export default function JournalTopBar({
  level,
  gems,
  coins,
  userName,
  userGroup,
  userPhoto
}: JournalTopBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleGemsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((window as any).triggerCelebration) {
      (window as any).triggerCelebration(e.clientX, e.clientY, 'gems');
    }
  };

  const handleCoinsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((window as any).triggerCelebration) {
      (window as any).triggerCelebration(e.clientX, e.clientY, 'coins');
    }
  };

  const formatName = (fullName?: string) => {
    if (!fullName) return 'Загрузка...';
    const parts = fullName.split(/\s+/);
    if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
    return fullName;
  };

  const formattedName = userName ? formatName(userName) : 'Загрузка...';
  const displayGroup = userGroup || '';

  const getAvatarUrl = (photo?: string) => {
    if (!photo) return null;
    if (photo.startsWith('http://') || photo.startsWith('https://') || photo.includes('/')) {
      return photo;
    }
    return `https://fs.top-academy.ru/api/v1/files/${photo}/public`;
  };

  const getInitials = (name: string): string => {
    if (!name || name === 'Загрузка...') return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const avatarUrl = getAvatarUrl(userPhoto);

  return (
    <div className="journal-topbar">
      {/* Left: Wallet metrics */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {/* Gems (Green Diamond) */}
        <div
          className="hud-wallet"
          style={{
            background: 'rgba(125, 255, 196, 0.06)',
            borderColor: 'rgba(125, 255, 196, 0.15)',
            cursor: 'pointer',
            transition: 'transform 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            padding: '0.35rem 1.1rem',
            minWidth: '105px',
          }}
          onClick={handleGemsClick}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <img 
            src="/top-gem.png" 
            alt="Gems" 
            style={{ 
              width: '18px', 
              height: '18px', 
              display: 'block', 
              filter: 'drop-shadow(0 0 4px rgba(125, 255, 196, 0.4))',
              transform: 'translateY(-1px)'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
            <span className="hud-wallet-value" style={{ color: 'var(--os-fg)' }}>
              {gems !== undefined ? gems.total : '...'}
            </span>
            <span style={{ color: 'rgb(var(--os-fg-rgb) / 0.4)', fontSize: '0.65rem', fontFamily: "'Fira Code', monospace" }}>
              {gems !== undefined ? gems.available : '...'}
            </span>
          </div>
        </div>

        {/* Coins (Orange Coin) */}
        <div
          className="hud-wallet"
          style={{
            background: 'rgba(0, 230, 150, 0.06)',
            borderColor: 'rgba(0, 230, 150, 0.15)',
            cursor: 'pointer',
            transition: 'transform 0.1s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            padding: '0.35rem 1.1rem',
            minWidth: '105px',
          }}
          onClick={handleCoinsClick}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <img 
            src="/top-coin.png" 
            alt="Coins" 
            style={{ 
              width: '18px', 
              height: '18px', 
              display: 'block', 
              filter: 'drop-shadow(0 0 4px rgba(0, 230, 150, 0.4))',
              transform: 'translateY(-1px)'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.1' }}>
            <span className="hud-wallet-value" style={{ color: 'var(--os-fg)' }}>
              {coins !== undefined ? coins.total : '...'}
            </span>
            <span style={{ color: 'rgb(var(--os-fg-rgb) / 0.4)', fontSize: '0.65rem', fontFamily: "'Fira Code', monospace" }}>
              {coins !== undefined ? coins.available : '...'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Level Progress + User profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
        {/* Level Badge (moved to right side) */}
        <div
          className="hud-wallet"
          style={{
            background: 'rgba(0, 255, 194, 0.06)',
            borderColor: 'rgba(0, 255, 194, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            padding: '0.35rem 1.1rem',
            minWidth: '85px',
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--os-accent-text)', fontFamily: "'Fira Code', monospace" }}>
            Lvl {level !== undefined ? level : '...'}
          </span>
        </div>

        {/* User profile dropdown with status indicator */}
        <div className="relative" ref={dropdownRef}>
          <div 
            className="hud-user-block"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="hud-user-info">
              <div className="hud-user-name">{formattedName}</div>
              <div className="hud-user-group">{displayGroup}</div>
            </div>
            <ChevronDown 
              size={14} 
              style={{ 
                color: '#6b6b6b',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                cursor: 'pointer'
              }} 
            />
            <div className="relative flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="hud-avatar animate-fade-in"
                  style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                  onError={(e) => {
                    // Hide image on error and show fallback element
                    (e.target as HTMLElement).style.display = 'none';
                    const fallbackEl = e.currentTarget.parentElement?.querySelector('.hud-avatar-fallback') as HTMLElement;
                    if (fallbackEl) fallbackEl.style.display = 'flex';
                  }}
                />
              ) : null}
              {(!avatarUrl) && (
                <div
                  className="hud-avatar"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0, 230, 150, 0.12) 0%, rgba(0, 230, 150, 0.28) 100%)',
                    border: '1px solid rgba(0, 230, 150, 0.25)',
                    color: '#30ff44',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    fontFamily: "'Fira Code', monospace",
                    textShadow: '0 0 4px rgba(0, 230, 150, 0.3)'
                  }}
                >
                  {getInitials(formattedName)}
                </div>
              )}
              {avatarUrl && (
                <div
                  className="hud-avatar-fallback"
                  style={{
                    display: 'none',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0, 230, 150, 0.12) 0%, rgba(0, 230, 150, 0.28) 100%)',
                    border: '1px solid rgba(0, 230, 150, 0.25)',
                    color: '#30ff44',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    fontFamily: "'Fira Code', monospace",
                    textShadow: '0 0 4px rgba(0, 230, 150, 0.3)'
                  }}
                >
                  {getInitials(formattedName)}
                </div>
              )}
              {/* Green online online badge */}
              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-[#7dffc4] ring-2 ring-[color:var(--os-s1)]" />
            </div>
          </div>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '115%',
              right: 0,
              background: '#13141a',
              border: '1px solid rgb(var(--os-fg-rgb) / 0.08)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 0 1px rgb(var(--os-fg-rgb) / 0.02)',
              padding: '0.4rem',
              minWidth: '150px',
              zIndex: 100,
            }}>
              <button
                onClick={() => {
                  logout();
                  localStorage.removeItem('sessionToken');
                  window.location.href = '/login';
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#e53935',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(229, 57, 53, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={16} />
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
