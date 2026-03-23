import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sun, Moon, Flame } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { cn } from '../lib/utils.js';

const THEMES = [
  {
    id: 'light',
    label: 'Light',
    desc: 'Clean white',
    icon: Sun,
    swatch: 'bg-[#F8F7F4]',
    swatchBorder: 'border-gray-200',
    swatchAccent: 'bg-[#F26B4E]',
  },
  {
    id: 'dark',
    label: 'Dark',
    desc: 'Premium dark',
    icon: Moon,
    swatch: 'bg-[#0a0a0a]',
    swatchBorder: 'border-white/10',
    swatchAccent: 'bg-[#F26B4E]',
  },
  {
    id: 'solar',
    label: 'Solar',
    desc: 'Warm cream',
    icon: Flame,
    swatch: 'bg-[#FFFDF7]',
    swatchBorder: 'border-amber-200',
    swatchAccent: 'bg-amber-400',
  },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recalculate position on scroll / resize so the portal stays aligned
  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
        zIndex: 9999,
      });
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  function handleToggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuStyle({
        position: 'fixed',
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
        zIndex: 9999,
      });
    }
    setOpen(o => !o);
  }

  const current = THEMES.find(t => t.id === theme) ?? THEMES[0];
  const Icon = current.icon;

  const dropdown = open ? (
    <div
      ref={menuRef}
      style={menuStyle}
      className={cn(
        'w-44 rounded-xl shadow-2xl border overflow-hidden',
        theme === 'dark'
          ? 'bg-[#111] border-white/10'
          : 'bg-white border-border/60'
      )}
    >
      <div className={cn(
        'px-3 py-2 text-[10px] font-black uppercase tracking-widest border-b',
        theme === 'dark' ? 'text-white/30 border-white/10' : 'text-muted-foreground border-border/40'
      )}>
        Appearance
      </div>
      {THEMES.map(t => {
        const TIcon = t.icon;
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => { setTheme(t.id); setOpen(false); }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
              isActive
                ? 'bg-[#F26B4E]/10 text-[#F26B4E]'
                : theme === 'dark'
                  ? 'text-white/60 hover:bg-white/5 hover:text-white'
                  : 'text-foreground hover:bg-muted/60'
            )}
          >
            {/* Swatch */}
            <div className={cn('w-7 h-7 rounded-md border flex items-end justify-end p-0.5', t.swatch, t.swatchBorder)}>
              <div className={cn('w-2.5 h-2.5 rounded-sm', t.swatchAccent)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold leading-tight">{t.label}</div>
              <div className={cn('text-[10px] leading-tight', theme === 'dark' ? 'text-white/30' : 'text-muted-foreground')}>
                {t.desc}
              </div>
            </div>
            {isActive && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#F26B4E] shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div className="relative">
      {/* Trigger */}
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Change theme"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150',
          'hover:border-[#F26B4E]/40 hover:text-[#F26B4E]',
          theme === 'dark'
            ? 'border-white/10 text-white/50 bg-white/5 hover:bg-white/10'
            : 'border-border/60 text-muted-foreground bg-white/60 hover:bg-white'
        )}
      >
        <Icon size={13} />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {/* Portal — renders at document.body level, escapes overflow-hidden parents */}
      {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
    </div>
  );
}
