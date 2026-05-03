'use client';

import { useState, useEffect } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Globe } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
    }
    checkUser();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = '/dashboard';
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) setError(error.message);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--background)', padding: '1rem' }}>
      <div className="card fade-in" style={{ maxWidth: '400px', width: '100%', padding: 'clamp(1.5rem, 5vw, 2.5rem)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img 
            src="/logo.png" 
            alt="EduInsights Logo" 
            style={{ width: '64px', height: '64px', borderRadius: '16px', marginBottom: '1.5rem', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
          />
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Sign in to your EduInsights portal</p>
        </div>

        <button 
          onClick={handleGoogleLogin}
          type="button" 
          className="btn-secondary" 
          style={{ justifyContent: 'center', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'white', border: '1px solid #e2e8f0' }}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
          <span style={{ fontWeight: '500', color: '#475569' }}>Sign in with Google</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--surface-border)' }}></div>
          OR
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--surface-border)' }}></div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'grid', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#475569' }}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="email" 
                placeholder="teacher@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#475569' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--error)', fontSize: '0.85rem' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ padding: '12px', marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}
          >
            <LogIn size={20} /> {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Don't have an account? <Link href="/signup" style={{ color: 'var(--primary)', fontWeight: '600' }}>Create Account</Link>
        </div>
      </div>
    </div>
  );
}
