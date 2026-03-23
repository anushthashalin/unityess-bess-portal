import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { WavyBackground } from '../components/ui/wavy-background.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname || '/dashboard';

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <WavyBackground
      backgroundFill="#1a1a1a"
      waveOpacity={0.6}
      blur={8}
      speed="slow"
      containerClassName="relative"
      style={{ fontFamily: "'Chivo', sans-serif" }}
    >
      <div style={{
        background: 'hsl(var(--card))',
        borderRadius: 12,
        padding: '48px 40px',
        width: 400,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Logos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: '#F26B4E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 18,
          }}>U</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: 'hsl(var(--foreground))', lineHeight: 1.2 }}>UnityESS Portal</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Ornate Solar — Internal</div>
          </div>
        </div>

        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: 'hsl(var(--foreground))', textAlign: 'center' }}>
          Sign in
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
          Use your Ornate Solar email to continue
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@ornatesolar.com"
              required
              autoFocus
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid hsl(var(--border))', fontSize: 14, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#F26B4E'}
              onBlur={e => e.target.style.borderColor = '#ddd'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: '1.5px solid hsl(var(--border))', fontSize: 14, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#F26B4E'}
              onBlur={e => e.target.style.borderColor = '#ddd'}
            />
          </div>

          {error && (
            <div style={{
              background: '#fff5f3', border: '1px solid #F26B4E',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#c0392b',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? '#f0a899' : '#F26B4E',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px', fontSize: 15, fontWeight: 700,
              fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4, transition: 'background 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 12, color: '#bbb', textAlign: 'center' }}>
          Trouble signing in? Contact Kedar at kedar@ornatesolar.com
        </div>
      </div>
    </WavyBackground>
  );
}
