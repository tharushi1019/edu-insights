'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2, Plus, Edit2, Trash2, CheckCircle2, AlertCircle, UserPlus, UserMinus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

interface Student {
  id: string;
  name: string;
  class_name: string;
  grade: number;
  status: string;
}

export default function AdminStudentsPage() {
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Form State
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(10);
  const [className, setClassName] = useState('');
  const [status, setStatus] = useState('active');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [actionStatus, setActionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .order('grade', { ascending: true })
        .order('class_name', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setActionStatus('loading');
      setErrorMessage('');

      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not found');

          const studentData = {
              name,
              grade,
              class_name: className ? className.trim().toUpperCase() : null,
              status,
              user_id: user.id
          };

          if (editingId) {
              const { error } = await supabase
                  .from('students')
                  .update(studentData)
                  .eq('id', editingId);
              if (error) throw error;
          } else {
              const { error } = await supabase
                  .from('students')
                  .insert([studentData]);
              if (error) throw error;
          }

          setActionStatus('success');
          setName('');
          setGrade(10);
          setClassName('');
          setStatus('active');
          setEditingId(null);
          fetchStudents();
          
          setTimeout(() => setActionStatus('idle'), 3000);
      } catch (err: any) {
          console.error(err);
          setActionStatus('error');
          setErrorMessage(err.message || 'Error saving student');
      }
  };
  const handleEdit = (student: Student) => {
      setEditingId(student.id);
      setName(student.name);
      setGrade(student.grade);
      setClassName(student.class_name || '');
      setStatus(student.status);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
      if (!confirm('Are you sure you want to delete this student?')) return;
      
      try {
          const { error } = await supabase
              .from('students')
              .delete()
              .eq('id', id);

          if (error) throw error;
          fetchStudents();
      } catch (err) {
          console.error('Error deleting student:', err);
          alert('Error deleting student');
      }
  };

  if (loading) {
      return <div className="card loading-shimmer" style={{ height: '400px' }}></div>;
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
            <Users size={20} />
            <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Admin</span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
          Students Management
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          Add, update, and manage student records.
        </p>
      </header>

      {/* FORM */}
      <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem' }}>
              {editingId ? 'Edit Student' : 'Add New Student'}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Name</label>
                  <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      required 
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  />
              </div>
              <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Grade</label>
                  <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="select-premium" style={{ width: '100%' }}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(g => <option key={g} value={g}>Grade {g}</option>)}
                  </select>
              </div>
              <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Class Name</label>
                  <input 
                      type="text" 
                      value={className} 
                      onChange={(e) => setClassName(e.target.value)} 
                      placeholder="e.g. A, B, C"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  />
              </div>

              <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="select-premium" style={{ width: '100%' }}>
                      <option value="active">Active</option>
                      <option value="leaved">Leaved School</option>
                  </select>
              </div>
              <div>
                  <button type="submit" className="btn-primary" disabled={actionStatus === 'loading'} style={{ width: '100%' }}>
                      {actionStatus === 'loading' ? <Loader2 size={20} className="animate-spin" /> : editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                      {editingId ? 'Update' : 'Add'} Student
                  </button>
              </div>
          </form>

          {actionStatus === 'success' && (
            <div style={{ marginTop: '1rem', padding: '12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={18} /> Student saved successfully!
            </div>
          )}

          {actionStatus === 'error' && (
            <div style={{ marginTop: '1rem', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} /> {errorMessage}
            </div>
          )}
      </div>

      {/* LIST */}
      <div className="card">
          <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>NAME</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>GRADE</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>STATUS</th>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>ACTIONS</th>
                      </tr>
                  </thead>
                  <tbody>
                      {students.map(student => (
                          <tr key={student.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: '600' }}>{student.name}</td>
                              <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                  Grade {student.grade} {student.class_name ? `- ${student.class_name}` : ''}
                              </td>
                              <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                  <span style={{ 
                                      padding: '4px 8px', 
                                      borderRadius: '12px', 
                                      fontSize: '0.75rem', 
                                      fontWeight: '700',
                                      backgroundColor: student.status === 'active' ? 'var(--success-light)' : 'var(--error-light)',
                                      color: student.status === 'active' ? 'var(--success)' : 'var(--error)'
                                  }}>
                                      {student.status === 'active' ? 'Active' : 'Leaved'}
                                  </span>
                              </td>
                              <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                      <button onClick={() => handleEdit(student)} className="btn-secondary" style={{ padding: '6px', width: 'auto' }} title="Edit">
                                          <Edit2 size={16} />
                                      </button>
                                      <button onClick={() => handleDelete(student.id)} className="btn-secondary" style={{ padding: '6px', color: 'var(--error)', width: 'auto' }} title="Delete">
                                          <Trash2 size={16} />
                                      </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                      {students.length === 0 && (
                          <tr>
                              <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No students found.</td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
