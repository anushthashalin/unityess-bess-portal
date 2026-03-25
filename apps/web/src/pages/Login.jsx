import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ShaderAnimation } from '../components/ui/shader-animation.jsx';

export default function Login() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const from        = location.state?.from?.pathname || '/dashboard';

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
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Chivo', sans-serif",
      background: '#000',
    }}>
      {/* Shader background — fills parent */}
      <ShaderAnimation />

      {/* Glass card — floats above canvas */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: 400,
        borderRadius: 16,
        padding: '48px 40px',
        background: 'rgba(0, 0, 0, 0.52)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 40px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}>

        {/* Brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: '#F26B4E',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 20,
            boxShadow: '0 0 20px rgba(242,107,78,0.4)',
          }}>
            U
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.2px' }}>
              UnityESS Portal
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3px' }}>
              Ornate Solar — Internal
            </div>
          </div>
        </div>

        <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center' }}>
          Sign in
        </h2>
        <p style={{ margin: '0 0 28px', fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
          Use your Ornate Solar email to continue
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                border: '1.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff', fontSize: 14, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#F26B4E'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                border: '1.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff', fontSize: 14, fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#F26B4E'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(242,107,78,0.12)',
              border: '1px solid rgba(242,107,78,0.4)',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#ff9980',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? 'rgba(242,107,78,0.5)' : '#F26B4E',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px', fontSize: 15, fontWeight: 700,
              fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4, transition: 'background 0.2s',
              boxShadow: loading ? 'none' : '0 0 20px rgba(242,107,78,0.35)',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
          Trouble signing in? Contact Kedar at kedar@ornatesolar.com
        </div>
      </div>
    </div>
  );
}
