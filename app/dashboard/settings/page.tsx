'use client';

import { useState, useEffect } from 'react';
import { Settings, Shield, Trash2, RotateCcw, Building2, Save, Loader2, AlertTriangle, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (showResetConfirm || showDeleteConfirm) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showResetConfirm, showDeleteConfirm]);

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          if (authError?.message.includes('Refresh Token Not Found') || authError?.message.includes('invalid_grant')) {
            await supabase.auth.signOut();
          }
          router.push('/login');
          return;
        }
        setUserEmail(user.email || '');

        // Fetch school name from profiles table
        const { data, error } = await supabase
          .from('profiles')
          .select('school_name')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
        if (data) setSchoolName(data.school_name || '');

      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }
    getProfile();
  }, [router]);

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .upsert({ 
            id: user.id, 
            school_name: schoolName
        }, { onConflict: 'id' });

      if (error) {
          console.error('Supabase Error Details:', JSON.stringify(error, null, 2));
          alert(`Database Error: ${error.message || 'Check if the "profiles" table exists in Supabase.'}`);
          throw error;
      }
      alert('Profile updated successfully!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      if (!err.message) alert('Could not connect to Supabase. Please check your internet and Supabase configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Delete G.C.E. O/L and A/L performance records
      const { error: examError } = await supabase
        .from('exam_records')
        .delete()
        .eq('user_id', user.id);
      if (examError) throw examError;

      // 2. Fetch all student IDs belonging to this user
      const { data: userStudents, error: fetchStudError } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id);
      if (fetchStudError) throw fetchStudError;

      if (userStudents && userStudents.length > 0) {
        const studentIds = userStudents.map(s => s.id);
        
        // 3. Delete student term test marks
        const { error: marksError } = await supabase
          .from('student_marks')
          .delete()
          .in('student_id', studentIds);
        if (marksError) throw marksError;
      }

      // 4. Delete students themselves
      const { error: studentsError } = await supabase
        .from('students')
        .delete()
        .eq('user_id', user.id);
      if (studentsError) throw studentsError;

      alert('All exam records, student profiles, and term test marks have been successfully reset.');
      setShowResetConfirm(false);
    } catch (err: any) {
      console.error('Error resetting data:', err);
      alert(`Failed to reset data: ${err.message || err}`);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Delete historical G.C.E. O/L and A/L exam records
      await supabase.from('exam_records').delete().eq('user_id', user.id);
      
      // 2. Fetch student IDs for this user
      const { data: userStudents } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', user.id);

      if (userStudents && userStudents.length > 0) {
        const studentIds = userStudents.map(s => s.id);
        // 3. Delete student term test marks
        await supabase.from('student_marks').delete().in('student_id', studentIds);
      }

      // 4. Delete students themselves
      await supabase.from('students').delete().eq('user_id', user.id);

      // 5. Delete profile
      await supabase.from('profiles').delete().eq('id', user.id);

      // 6. Sign out (Deleting the actual Auth user usually requires admin API or RPC)
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Error deleting account:', err);
      alert('Failed to delete account.');
    }
  };

  if (loading) {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: '800px' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.75rem' }}>
            <Settings size={20} />
            <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>System Settings</span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>{t('settings')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.5' }}>
            {t('settingsSubtitle')}
        </p>
      </header>

      {/* INSTITUTION SETTINGS */}
      <section className="card" style={{ padding: 'clamp(1.5rem, 5vw, 2.5rem)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'var(--primary-light)' }}>
                <Building2 size={20} color="var(--primary)" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>{t('institutionBrandingTitle')}</h3>
        </div>

        <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
                {t('schoolNameLabel')}
            </label>
            <input 
                type="text" 
                placeholder="Enter your school name..." 
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                style={{ 
                    width: '100%',
                    padding: '14px 18px', 
                    borderRadius: '12px', 
                    border: '2px solid var(--surface-border)', 
                    outline: 'none', 
                    backgroundColor: 'white', 
                    fontWeight: '600',
                    fontSize: '1rem',
                    transition: 'all 0.2s'
                }}
            />
            <p style={{ marginTop: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                This name will appear on all generated PDF reports by default.
            </p>
        </div>

        <button 
            onClick={handleUpdateProfile} 
            disabled={saving}
            className="btn-primary" 
            style={{ fontSize: '1rem' }}
        >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {t('saveChanges')}
        </button>
      </section>

      {/* ACCOUNT & SECURITY */}
      <section className="card" style={{ padding: 'clamp(1.5rem, 5vw, 2.5rem)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <div style={{ padding: '10px', borderRadius: '12px', backgroundColor: 'var(--success-light)' }}>
                <Shield size={20} color="var(--success)" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>{t('accountSecurity')}</h3>
        </div>

        <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>
                Account Email
            </label>
            <div style={{ 
                padding: '14px 18px', 
                borderRadius: '12px', 
                backgroundColor: 'var(--surface)', 
                color: 'var(--text-muted)',
                fontWeight: '600',
                border: '1px solid var(--surface-border)'
            }}>
                {userEmail}
            </div>
        </div>

        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '2rem',
            marginTop: '2rem',
            paddingTop: '2rem',
            borderTop: '1px solid var(--surface-border)'
        }}>
            <div>
                <h4 style={{ fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>Reset Analytics</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Permanently delete all exam records. Your school branding will remain.
                </p>
                <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="btn-secondary" 
                    style={{ color: 'var(--warning)', borderColor: 'var(--warning-light)', backgroundColor: 'var(--warning-light)', width: '100%' }}
                >
                    <RotateCcw size={18} /> {t('resetAnalytics')}
                </button>
            </div>

            <div>
                <h4 style={{ fontWeight: '800', color: 'var(--error)', marginBottom: '0.5rem' }}>Delete Account</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Permanently remove your account and all data. This cannot be undone.
                </p>
                <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-secondary" 
                    style={{ color: 'var(--error)', borderColor: 'var(--error-light)', backgroundColor: 'var(--error-light)', width: '100%' }}
                >
                    <UserX size={18} /> {t('deleteAccount')}
                </button>
            </div>
        </div>
      </section>

      {/* CONFIRMATION MODALS */}
      {showResetConfirm && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }}>
            <div className="card scale-in" style={{ maxWidth: '450px', width: '100%', padding: 'clamp(1.5rem, 8vw, 2.5rem)', textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--warning-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <AlertTriangle size={32} color="var(--warning)" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>Reset Data?</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                    Are you sure you want to delete all exam records? This will clear your entire dashboard.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setShowResetConfirm(false)} className="btn-secondary" style={{ flex: '1 1 120px' }}>Cancel</button>
                    <button onClick={handleResetData} className="btn-primary" style={{ flex: '1 1 120px', backgroundColor: 'var(--warning)', border: 'none' }}>Yes, Reset</button>
                </div>
            </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }}>
            <div className="card scale-in" style={{ maxWidth: '450px', width: '100%', padding: 'clamp(1.5rem, 8vw, 2.5rem)', textAlign: 'center' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'var(--error-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <Trash2 size={32} color="var(--error)" />
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--error)' }}>Delete Account?</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                    This will permanently delete your account and all records. This cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary" style={{ flex: '1 1 120px' }}>Cancel</button>
                    <button onClick={handleDeleteAccount} className="btn-primary" style={{ flex: '1 1 120px', backgroundColor: 'var(--error)', border: 'none' }}>Delete Forever</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
