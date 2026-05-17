'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard, PlusCircle, FileUp, BarChart3, Settings, LogOut, GraduationCap, TrendingUp, Building2, Languages, Menu, X, Users, BookOpen, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const [schoolName, setSchoolName] = useState<string>('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    async function checkProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/login');
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('school_name')
          .eq('id', user.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') throw profileError;

        if (profileData && profileData.school_name && profileData.school_name.trim() !== '') {
          setSchoolName(profileData.school_name);
          setShowOnboarding(false);
        } else {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.error('Error checking profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    checkProfile();
  }, [router]);

  const handleSaveOnboarding = async () => {
    if (!schoolName.trim()) return;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('profiles')
          .upsert({ 
            id: user.id, 
            school_name: schoolName,
          });

        if (error) {
          console.error('Full Supabase Error:', error);
          alert(`Database Error: ${error.message}\n\nThis usually happens because the "profiles" table is missing an INSERT policy. Please run the SQL command provided in the chat.`);
          return;
        }

        setShowOnboarding(false);
        window.location.reload();
    } catch (err) {
        console.error('Unexpected error during onboarding:', err);
        alert('An unexpected error occurred. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="main-container">
      {/* Mobile Header */}
      <header className="mobile-header">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '32px', height: '32px', borderRadius: '8px' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>EduInsights</h2>
        </Link>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}
        >
          {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside className={`sidebar ${isMenuOpen ? 'mobile-open' : ''}`}>
        <div style={{ padding: '0 0 2rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', textDecoration: 'none' }}>
            <img 
              src="/logo.png" 
              alt="EduInsights Logo" 
              style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
              className="slide-in"
            />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.025em' }}>
              EduInsights
            </h2>
          </Link>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500', paddingLeft: '4px' }}>
            {t('portalTitle')}
          </p>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <LayoutDashboard size={20} /> 
            <span>{t('dashboard')}</span>
          </Link>
          <Link href="/dashboard/trends" className={`nav-link ${pathname === '/dashboard/trends' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <TrendingUp size={20} /> 
            <span>{t('trends')}</span>
          </Link>
          <Link href="/dashboard/scholarship" className={`nav-link ${pathname === '/dashboard/scholarship' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <GraduationCap size={20} /> 
            <span>{t('scholarship')}</span>
          </Link>
          <Link href="/dashboard/al" className={`nav-link ${pathname === '/dashboard/al' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <GraduationCap size={20} /> 
            <span>G.C.E. A/L</span>
          </Link>
          <Link href="/dashboard/ol" className={`nav-link ${pathname === '/dashboard/ol' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <GraduationCap size={20} /> <span>G.C.E. O/L</span>
          </Link>
          <Link href="/dashboard/term-tests" className={`nav-link ${pathname === '/dashboard/term-tests' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <BarChart3 size={20} /> <span>Term Tests</span>
          </Link>
          <Link href="/dashboard/admin/students" className={`nav-link ${pathname === '/dashboard/admin/students' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Users size={20} /> <span>Students</span>
          </Link>
          <Link href="/dashboard/reports" className={`nav-link ${pathname === '/dashboard/reports' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <FileText size={20} /> <span>Reports</span>
          </Link>

          <hr style={{ border: 'none', borderTop: '1px solid var(--surface-border)', margin: '0.5rem 0' }} />

          <Link href="/dashboard/settings" className={`nav-link ${pathname === '/dashboard/settings' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Settings size={20} /> 
            <span>{t('settings')}</span>
          </Link>
        </nav>

        {/* Language Toggle */}
        <div style={{ paddingBottom: '1rem', borderBottom: '1px solid var(--surface-border)', marginBottom: '1rem' }}>
            <div style={{ 
                display: 'flex', 
                backgroundColor: 'var(--surface)', 
                borderRadius: '10px', 
                padding: '4px',
                border: '1px solid var(--surface-border)'
            }}>
                <button 
                    onClick={() => setLanguage('en')}
                    style={{ 
                        flex: 1, 
                        padding: '8px', 
                        fontSize: '0.8rem', 
                        fontWeight: '700', 
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: language === 'en' ? 'white' : 'transparent',
                        color: language === 'en' ? 'var(--primary)' : 'var(--text-muted)',
                        boxShadow: language === 'en' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    English
                </button>
                <button 
                    onClick={() => setLanguage('si')}
                    style={{ 
                        flex: 1, 
                        padding: '8px', 
                        fontSize: '0.8rem', 
                        fontWeight: '700', 
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: language === 'si' ? 'white' : 'transparent',
                        color: language === 'si' ? 'var(--primary)' : 'var(--text-muted)',
                        boxShadow: language === 'si' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    සිංහල
                </button>
            </div>
        </div>

        <div style={{ paddingTop: '0.5rem' }}>
          <button 
            onClick={handleSignOut}
            className="nav-link"
            style={{ 
              color: 'var(--error)', 
              width: '100%', 
              justifyContent: 'flex-start',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <LogOut size={20} /> 
            <span>{t('signOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>

      {/* ONBOARDING MODAL */}
      {showOnboarding && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
            <div className="card scale-in" style={{ maxWidth: '500px', padding: '3rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
                    <Building2 size={40} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>{t('welcome')}</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', lineHeight: '1.7', fontSize: '1.1rem' }}>
                    {t('onboardingDesc')}
                </p>
                <div style={{ marginBottom: '2.5rem', textAlign: 'left' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>{t('schoolNameLabel')}</label>
                    <input 
                        type="text" 
                        placeholder="e.g. Royal College Colombo" 
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        style={{ 
                            width: '100%',
                            padding: '16px 20px', 
                            borderRadius: '12px', 
                            border: '2px solid var(--primary-light)', 
                            outline: 'none', 
                            fontSize: '1.1rem',
                            fontWeight: '600'
                        }}
                        autoFocus
                    />
                </div>
                <button 
                    onClick={handleSaveOnboarding}
                    disabled={!schoolName.trim()}
                    className="btn-primary" 
                    style={{ width: '100%', padding: '18px', fontSize: '1.1rem' }}
                >
                    {t('getStarted')}
                </button>
            </div>
        </div>
      )}
    </div>
  );
}
