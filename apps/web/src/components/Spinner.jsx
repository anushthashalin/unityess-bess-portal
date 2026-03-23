export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        border: '3px solid #F3F4F6',
        borderTopColor: '#F26B4E',
        animation: 'spin 0.7s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div style={{
      background: '#FEF2F2', border: '1px solid #FECACA',
      borderRadius: 8, padding: '12px 16px',
      color: '#DC2626', fontSize: 13, fontWeight: 600
    }}>
      ⚠ {message ?? 'Something went wrong. Is the API running?'}
    </div>
  );
}

export function Empty({ label = 'No records yet.' }) {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>
      {label}
    </div>
  );
}
