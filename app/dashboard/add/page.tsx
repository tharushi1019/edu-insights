'use client';

import { useState } from 'react';
import { Save, AlertCircle, CheckCircle2, ChevronLeft, Loader2, Plus, Info } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

export default function AddRecord() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    subject: '',
    customSubject: '',
    totalSat: '',
    passCount: '',
  });
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const passRate = (formData.totalSat && formData.passCount) 
    ? Math.round((parseInt(formData.passCount) / parseInt(formData.totalSat)) * 100) 
    : 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'subject' && value === 'custom') {
        setIsCustomSubject(true);
        setFormData(prev => ({ ...prev, subject: 'custom' }));
        return;
    }
    if (name === 'subject' && value !== 'custom') {
        setIsCustomSubject(false);
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const finalSubjectName = isCustomSubject ? formData.customSubject : formData.subject;
      if (!finalSubjectName) throw new Error('Please select or enter a subject');

      // 1. Get current subject ID (or insert if not exists)
      const { data: subData } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', finalSubjectName)
        .single();
      
      let subjectId = subData?.id;

      if (!subjectId) {
        const { data: newSub, error: newSubError } = await supabase
          .from('subjects')
          .insert({ name: finalSubjectName })
          .select('id')
          .single();
        if (newSubError) throw newSubError;
        subjectId = newSub.id;
      }

      // 2. Get user session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        if (authError?.message.includes('Refresh Token Not Found') || authError?.message.includes('invalid_grant')) {
            await supabase.auth.signOut();
            window.location.href = '/login';
            return;
        }
        throw new Error('Please sign in first (කරුණාකර ප්‍රථමයෙන් ඇතුළු වන්න)');
      }

      // 3. Check for existing record
      const { data: existingRecords } = await supabase
        .from('exam_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('year', parseInt(formData.year.toString()))
        .eq('subject_id', subjectId);
      
      if (existingRecords && existingRecords.length > 0) {
        throw new Error(`A record for ${finalSubjectName} in ${formData.year} already exists.`);
      }

      // 4. Insert exam record
      const { error } = await supabase
        .from('exam_records')
        .insert({
          user_id: user.id,
          year: parseInt(formData.year.toString()),
          subject_id: subjectId,
          total_students: parseInt(formData.totalSat),
          pass_count: parseInt(formData.passCount),
          fail_count: parseInt(formData.totalSat) - parseInt(formData.passCount)
        });

      if (error) throw error;

      setStatus('success');
      setFormData(prev => ({ ...prev, passCount: '', subject: '', customSubject: '' }));
      setIsCustomSubject(false);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Error saving record');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }} className="fade-in">
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: '500' }}>
        <ChevronLeft size={16} /> Back to Dashboard
      </Link>

      <header style={{ marginBottom: '2.5rem' }}>
        <span style={{ fontWeight: '700', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{t('addRecord')}</span>
        <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>{t('addNewRecord')}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', maxWidth: '800px', lineHeight: '1.6' }}>{t('addSubtitle')}</p>
      </header>

      <div className="card" style={{ padding: '2.5rem' }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#475569' }}>Exam Year (වර්ෂය)</label>
                <input 
                    type="number" 
                    name="year"
                    value={formData.year}
                    onChange={handleChange}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
                />
            </div>
            <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem', color: '#475569' }}>Total Students who sat (පෙනී සිටි සිසුන්)</label>
                <input 
                    type="number" 
                    name="totalSat"
                    value={formData.totalSat}
                    onChange={handleChange}
                    placeholder="Enter total students"
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
                />
            </div>
          </div>

          <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ marginBottom: '1.2rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} color="var(--primary)" /> Subject Data
              </h4>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>{t('selectSubject')}</label>
                    <select 
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none', backgroundColor: 'white' }}
                    >
                        <option value="">Select Subject</option>
                        
                        <optgroup label="Compulsory Subjects">
                            <option value="Mathematics">Mathematics</option>
                            <option value="Science">Science</option>
                            <option value="History">History</option>
                            <option value="English">English</option>
                            <option value="First Language - Sinhala">First Language - Sinhala</option>
                            <option value="First Language - Tamil">First Language - Tamil</option>
                            <option value="Religion - Buddhism">Religion - Buddhism</option>
                            <option value="Religion - Islam">Religion - Islam</option>
                            <option value="Religion - Roman Catholic">Religion - Roman Catholic</option>
                            <option value="Religion - Non-Roman Catholic">Religion - Non-Roman Catholic</option>
                            <option value="Religion - Hinduism">Religion - Hinduism</option>
                        </optgroup>

                        <optgroup label="Basket I: Commerce & Social Studies">
                            <option value="Business & Accounting Studies">Business & Accounting Studies</option>
                            <option value="Geography">Geography</option>
                            <option value="Civic Education">Civic Education</option>
                            <option value="Entrepreneurship Studies">Entrepreneurship Studies</option>
                            <option value="Second Language - Sinhala">Second Language - Sinhala</option>
                            <option value="Second Language - Tamil">Second Language - Tamil</option>
                            <option value="French">French</option>
                            <option value="German">German</option>
                            <option value="Japanese">Japanese</option>
                            <option value="Chinese">Chinese</option>
                            <option value="Russian">Russian</option>
                            <option value="Arabic">Arabic</option>
                            <option value="Pali">Pali</option>
                            <option value="Sanskrit">Sanskrit</option>
                        </optgroup>

                        <optgroup label="Basket II: Aesthetic Subjects">
                            <option value="Music - Oriental">Music - Oriental</option>
                            <option value="Music - Western">Music - Western</option>
                            <option value="Music - Carnatic">Music - Carnatic</option>
                            <option value="Dancing - Sinhala">Dancing - Sinhala</option>
                            <option value="Dancing - Bharata">Dancing - Bharata</option>
                            <option value="Art">Art</option>
                            <option value="Drama and Theatre - Sinhala">Drama and Theatre - Sinhala</option>
                            <option value="Drama and Theatre - Tamil">Drama and Theatre - Tamil</option>
                            <option value="Drama and Theatre - English">Drama and Theatre - English</option>
                            <option value="Appreciation of Literary Texts - English">Appreciation of Literary Texts - English</option>
                            <option value="Appreciation of Literary Texts - Sinhala">Appreciation of Literary Texts - Sinhala</option>
                            <option value="Appreciation of Literary Texts - Tamil">Appreciation of Literary Texts - Tamil</option>
                        </optgroup>

                        <optgroup label="Basket III: Technical & Practical Subjects">
                            <option value="Information & Communication Technology (ICT)">Information & Communication Technology (ICT)</option>
                            <option value="Agriculture & Food Technology">Agriculture & Food Technology</option>
                            <option value="Health & Physical Education">Health & Physical Education</option>
                            <option value="Communication & Media Studies">Communication & Media Studies</option>
                            <option value="Design, Electrical & Electronic Technology">Design, Electrical & Electronic Technology</option>
                            <option value="Home Economics">Home Economics</option>
                            <option value="Arts & Crafts">Arts & Crafts</option>
                        </optgroup>

                        <option value="custom" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>+ Other Subject</option>
                    </select>
                </div>

                {isCustomSubject && (
                    <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase' }}>{t('totalSat')}</label>
                        <input 
                            type="text" 
                            name="customSubject"
                            value={formData.customSubject}
                            onChange={handleChange}
                            placeholder="e.g. ICT, Music, Art"
                            required
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--primary)', outline: 'none' }}
                        />
                    </div>
                )}

                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#64748b' }}>Passed Count (සමත්වූ සංඛ්‍යාව)</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input 
                            type="number" 
                            name="passCount"
                            value={formData.passCount}
                            onChange={handleChange}
                            placeholder="0"
                            required
                            style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
                        />
                        <div style={{ padding: '12px 16px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '8px', fontWeight: 'bold' }}>
                            {passRate}% Pass Rate
                        </div>
                    </div>
                </div>
              </div>
          </div>

          {status === 'success' && (
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <CheckCircle2 size={18} /> Record saved successfully!
            </div>
          )}

          {status === 'error' && (
            <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <AlertCircle size={18} /> {errorMessage}
            </div>
          )}

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={status === 'loading'}
            style={{ marginTop: '0.5rem', justifyContent: 'center', opacity: status === 'loading' ? 0.7 : 1 }}
          >
            {status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {t('saveRecord')}
          </button>
        </form>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', backgroundColor: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
        <Info size={18} style={{ marginTop: '2px' }} />
        <div>
            <p style={{ fontWeight: '600', marginBottom: '4px' }}>How it works:</p>
            <p>1. Enter the total number of students who sat for O/L in that year.</p>
            <p>2. Choose a subject and enter how many passed.</p>
            <p>3. The pass percentage will be calculated and saved automatically.</p>
        </div>
      </div>
    </div>
  );
}
