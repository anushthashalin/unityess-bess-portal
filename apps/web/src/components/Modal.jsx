import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Reusable slide-in modal with brand styling.
 * Props:
 *   open      {boolean}
 *   onClose   {function}
 *   title     {string}
 *   children  {ReactNode}
 *   width     {number}  — max-width in px, default 520
 */
export default function Modal({ open, onClose, title, children, width = 520 }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxWidth: width,
          background: 'white', borderRadius: 16,
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.18s ease',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid #F3F4F6',
          background: '#FAFAFA',
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#2D2D2D' }}>{title}</span>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9CA3AF', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 6,
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color='#2D2D2D'; }}
            onMouseOut={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#9CA3AF'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px', maxHeight: 'calc(90vh - 80px)', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Form field helpers ─────────────────────────────────────────────────── */

export function Field({ label, required, children, hint }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}{required && <span style={{ color: '#F26B4E', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: '#9CA3AF' }}>{hint}</span>}
    </div>
  );
}

export function Input({ ...props }) {
  return (
    <input
      {...props}
      style={{
        border: '1px solid #E5E7EB', borderRadius: 8,
        padding: '9px 12px', fontSize: 13, fontFamily: 'Chivo, sans-serif',
        color: '#2D2D2D', outline: 'none', width: '100%',
        background: 'white', boxSizing: 'border-box',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...props.style,
      }}
      onFocus={e => { e.target.style.borderColor='#F26B4E'; e.target.style.boxShadow='0 0 0 3px rgba(242,107,78,0.12)'; }}
      onBlur={e => { e.target.style.borderColor='#E5E7EB'; e.target.style.boxShadow='none'; }}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <select
      {...props}
      style={{
        border: '1px solid #E5E7EB', borderRadius: 8,
        padding: '9px 12px', fontSize: 13, fontFamily: 'Chivo, sans-serif',
        color: '#2D2D2D', outline: 'none', width: '100%',
        background: 'white', boxSizing: 'border-box', cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...props.style,
      }}
      onFocus={e => { e.target.style.borderColor='#F26B4E'; e.target.style.boxShadow='0 0 0 3px rgba(242,107,78,0.12)'; }}
      onBlur={e => { e.target.style.borderColor='#E5E7EB'; e.target.style.boxShadow='none'; }}
    >
      {children}
    </select>
  );
}

export function FormGrid({ cols = 2, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px 14px' }}>
      {children}
    </div>
  );
}

export function SubmitRow({ onClose, loading, label = 'Save' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6', marginTop: 8 }}>
      <button
        type="button" onClick={onClose}
        className="btn-secondary" style={{ minWidth: 88 }}
      >
        Cancel
      </button>
      <button
        type="submit"
        className="btn-primary" style={{ minWidth: 100, opacity: loading ? 0.7 : 1 }}
        disabled={loading}
      >
        {loading ? 'Saving…' : label}
      </button>
    </div>
  );
}
