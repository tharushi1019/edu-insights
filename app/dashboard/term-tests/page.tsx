'use client';

import { useState, useEffect } from 'react';
import { Users, Loader2, Save, CheckCircle2, AlertCircle, BarChart3, Calculator, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';

interface Student {
  id: string;
  name: string;
  class_name: string;
  grade: number;
  status: string;
}

interface Subject {
  id: string;
  name: string;
}

interface Mark {
  student_id: string;
  subject_id: string;
  mark: number;
  is_absent: boolean;
}

// Sri Lankan Standard Curriculum Subjects grouped by Grade Categories
const PRIMARY_SUBJECTS = [
  'First Language (Sinhala/Tamil)',
  'Mathematics',
  'Religion',
  'Environment Related Activities (ERA)',
  'English',
  'Second National Language',
  'Art',
  'Dancing',
  'Music'
];

const JUNIOR_SECONDARY_SUBJECTS = [
  'First Language (Sinhala/Tamil Language & Literature)',
  'Mathematics',
  'Science',
  'History',
  'English',
  'Religion',
  'Geography',
  'Civic Education',
  'Health & Physical Education',
  'Second National Language',
  'Art',
  'Dancing',
  'Music',
  'Practical & Technical Skills (PTS) / ICT'
];

const OL_SUBJECTS = [
  'Mathematics',
  'Science',
  'History',
  'English',
  'First Language - Sinhala',
  'First Language - Tamil',
  'Religion - Buddhism',
  'Religion - Islam',
  'Religion - Roman Catholic',
  'Religion - Non-Roman Catholic',
  'Religion - Hinduism',
  'Business & Accounting Studies',
  'Geography',
  'Civic Education',
  'Entrepreneurship Studies',
  'Second Language - Sinhala',
  'Second Language - Tamil',
  'French',
  'German',
  'Japanese',
  'Chinese',
  'Russian',
  'Arabic',
  'Pali',
  'Sanskrit',
  'Music - Oriental',
  'Music - Western',
  'Music - Carnatic',
  'Dancing - Sinhala',
  'Dancing - Bharata',
  'Art',
  'Drama and Theatre - Sinhala',
  'Drama and Theatre - Tamil',
  'Drama and Theatre - English',
  'Appreciation of Literary Texts - English',
  'Appreciation of Literary Texts - Sinhala',
  'Appreciation of Literary Texts - Tamil',
  'Information & Communication Technology (ICT)',
  'Agriculture & Food Technology',
  'Health & Physical Education',
  'Communication & Media Studies',
  'Design, Electrical & Electronic Technology',
  'Home Economics',
  'Arts & Crafts'
];

const AL_SUBJECTS = [
  'General English (A/L)',
  'Common General Test (A/L)',
  'Biology (A/L)',
  'Chemistry (A/L)',
  'Physics (A/L)',
  'Agricultural Science (A/L)',
  'Combined Mathematics (A/L)',
  'Information & Communication Technology (ICT) (A/L)',
  'Accounting (A/L)',
  'Economics (A/L)',
  'Business Studies (A/L)',
  'Business Statistics (A/L)',
  'Engineering Technology (A/L)',
  'Bio-Systems Technology (A/L)',
  'Science for Technology (A/L)',
  'Geography (A/L)',
  'Political Science (A/L)',
  'History (A/L)',
  'Logic & Scientific Method (A/L)',
  'Media & Communication Studies (A/L)',
  'Sinhala (A/L)',
  'Tamil (A/L)',
  'English (A/L)',
  'French (A/L)',
  'Japanese (A/L)',
  'Chinese (A/L)',
  'Arabic (A/L)',
  'Pali (A/L)',
  'Sanskrit (A/L)',
  'Art (A/L)',
  'Dancing (A/L)',
  'Music (A/L)',
  'Drama & Theatre (A/L)',
  'Home Economics (A/L)'
];

const getStandardSubjectsForGrade = (grade: number): string[] => {
  if (grade >= 12) return AL_SUBJECTS;
  if (grade >= 10) return OL_SUBJECTS;
  if (grade >= 6) return JUNIOR_SECONDARY_SUBJECTS;
  return PRIMARY_SUBJECTS;
};

export default function TermTestsPage() {
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, { mark: string; is_absent: boolean }>>>({});
  
  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedTerm, setSelectedTerm] = useState(1);
  const [selectedGrade, setSelectedGrade] = useState(10);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch subjects, students, and marks
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch existing subjects from Supabase
        const { data: initialSubData } = await supabase
          .from('subjects')
          .select('id, name')
          .order('name');
        
        let subData = initialSubData || [];
        
        // 2. Identify missing standard subjects for the currently selected grade category
        const standardSubjects = getStandardSubjectsForGrade(selectedGrade);
        const missingSubjects = standardSubjects.filter(name => !subData.some(s => s.name.toLowerCase() === name.toLowerCase()));
        
        // 3. Auto-seed missing subjects to the database to guarantee standardized curriculum presence
        if (missingSubjects.length > 0) {
            const { error: seedError } = await supabase
              .from('subjects')
              .insert(missingSubjects.map(name => ({ name })));
            
            if (!seedError) {
                // Re-fetch all subjects to get correct IDs
                const { data: reFetchedSubData } = await supabase
                  .from('subjects')
                  .select('id, name')
                  .order('name');
                if (reFetchedSubData) {
                    subData = reFetchedSubData;
                }
            } else {
                console.error('Error seeding subjects:', seedError);
            }
        }

        // 4. Filter subjects array to only include relevant subjects for this grade
        const gradeRelevantSubjects = subData.filter(sub => 
            standardSubjects.some(sName => sName.toLowerCase() === sub.name.toLowerCase())
        );
        setSubjects(gradeRelevantSubjects);

        // Auto-select first subject if currently selected is invalid or 'all' or empty
        if (gradeRelevantSubjects.length > 0) {
            setSelectedSubject(prev => {
                const currentIsValid = gradeRelevantSubjects.some(s => s.id === prev);
                return currentIsValid && prev !== 'all' ? prev : gradeRelevantSubjects[0].id;
            });
        }

        // Fetch students for the selected grade
        const { data: studData } = await supabase
          .from('students')
          .select('id, name, class_name, grade, status')
          .eq('user_id', user.id)
          .eq('grade', selectedGrade)
          .eq('status', 'active');
        setStudents(studData || []);

        // Fetch existing marks
        if (studData && studData.length > 0) {
            const studentIds = studData.map(s => s.id);
            const { data: marksData } = await supabase
              .from('student_marks')
              .select('student_id, subject_id, mark, is_absent')
              .in('student_id', studentIds)
              .eq('year', selectedYear)
              .eq('term', selectedTerm);

            // Convert to lookup object
            const marksLookup: Record<string, Record<string, { mark: string; is_absent: boolean }>> = {};
            studData.forEach(s => {
                marksLookup[s.id] = {};
                gradeRelevantSubjects.forEach(sub => {
                    marksLookup[s.id][sub.id] = { mark: '', is_absent: false };
                });
            });

            marksData?.forEach(m => {
                if (marksLookup[m.student_id] && marksLookup[m.student_id][m.subject_id]) {
                    marksLookup[m.student_id][m.subject_id] = {
                        mark: m.is_absent ? '' : m.mark.toString(),
                        is_absent: m.is_absent || false
                    };
                }
            });

            setMarks(marksLookup);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedYear, selectedTerm, selectedGrade]);

  // Reset selectedClass & selectedSubject when selectedGrade changes to avoid filter bugs
  useEffect(() => {
    setSelectedClass('all');
    setSelectedSubject('');
  }, [selectedGrade]);

  // Extract unique classes dynamically from student roster
  const uniqueClasses = Array.from(
      new Set(
          students
              .map(s => s.class_name)
              .filter(Boolean)
              .map(c => c.trim().toUpperCase())
      )
  ).sort() as string[];

  // Filter students based on selected class
  const filteredStudents = students.filter(student => {
      if (selectedClass === 'all') return true;
      if (selectedClass === 'none') return !student.class_name;
      return student.class_name?.trim().toUpperCase() === selectedClass.toUpperCase();
  });

  const handleMarkChange = (studentId: string, subjectId: string, value: string) => {
      setMarks(prev => ({
          ...prev,
          [studentId]: {
              ...prev[studentId],
              [subjectId]: {
                  ...prev[studentId][subjectId],
                  mark: value
              }
          }
      }));
  };

  const handleAbsentChange = (studentId: string, subjectId: string, value: boolean) => {
      setMarks(prev => ({
          ...prev,
          [studentId]: {
              ...prev[studentId],
              [subjectId]: {
                  ...prev[studentId][subjectId],
                  is_absent: value,
                  mark: value ? '' : prev[studentId][subjectId].mark
              }
          }
      }));
  };

  // Keyboard navigation handler for rapid entries
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextInput = document.getElementById(`mark-input-${index + 1}`) as HTMLInputElement;
          if (nextInput) {
              nextInput.focus();
              nextInput.select();
          }
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevInput = document.getElementById(`mark-input-${index - 1}`) as HTMLInputElement;
          if (prevInput) {
              prevInput.focus();
              prevInput.select();
          }
      }
  };

  // Compute overall calculations (totals, average, class/grade-level rank)
  const calculateCalculations = () => {
      const results: Record<string, { total: number; average: number; rank: number; passCount: number; failCount: number }> = {};
      
      filteredStudents.forEach(student => {
          let total = 0;
          let count = 0;
          let passCount = 0;
          let failCount = 0;

          subjects.forEach(subject => {
              const m = marks[student.id]?.[subject.id];
              if (m && !m.is_absent && m.mark !== '') {
                  const markVal = parseInt(m.mark);
                  total += markVal;
                  count++;
                  if (markVal >= 35) passCount++;
                  else failCount++;
              }
          });

          results[student.id] = {
              total,
              average: count > 0 ? Math.round(total / count) : 0,
              rank: 0,
              passCount,
              failCount
          };
      });

      // Calculate Rank within the class/filtered list
      const sorted = Object.entries(results).sort((a, b) => b[1].total - a[1].total);
      sorted.forEach(([id, data], index) => {
          results[id].rank = index + 1;
      });

      return results;
  };

  const calculations = calculateCalculations();

  // Compute live statistics for subject-wise view
  const getSubjectStats = () => {
      if (selectedSubject === 'all') return null;
      
      const presentMarks: number[] = [];
      let absentCount = 0;
      let passCount = 0;

      filteredStudents.forEach(student => {
          const m = marks[student.id]?.[selectedSubject];
          if (m) {
              if (m.is_absent) {
                  absentCount++;
              } else if (m.mark !== '') {
                  const val = parseInt(m.mark);
                  presentMarks.push(val);
                  if (val >= 35) {
                      passCount++;
                  }
              }
          }
      });

      const totalStudents = filteredStudents.length;
      const enteredCount = presentMarks.length + absentCount;
      const average = presentMarks.length > 0 ? Math.round(presentMarks.reduce((a, b) => a + b, 0) / presentMarks.length) : 0;
      const passRate = presentMarks.length > 0 ? Math.round((passCount / presentMarks.length) * 100) : 0;
      const highest = presentMarks.length > 0 ? Math.max(...presentMarks) : 0;
      const lowest = presentMarks.length > 0 ? Math.min(...presentMarks) : 0;

      return {
          totalStudents,
          enteredCount,
          absentCount,
          average,
          passRate,
          highest,
          lowest
      };
  };

  const subjectStats = getSubjectStats();

  // Scoped Save: transaction limits deletes and insertions strictly to selection to prevent crashes and protect other subjects' marks
  const handleSave = async () => {
      setStatus('loading');
      setErrorMessage('');

      try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('User not found');

          const insertData: any[] = [];

          filteredStudents.forEach(student => {
              subjects.forEach(subject => {
                  // If in single-subject mode, skip non-selected subjects
                  if (selectedSubject !== 'all' && subject.id !== selectedSubject) {
                      return;
                  }

                  const m = marks[student.id]?.[subject.id];
                  if (m && (m.mark !== '' || m.is_absent)) {
                      insertData.push({
                          student_id: student.id,
                          subject_id: subject.id,
                          year: selectedYear,
                          term: selectedTerm,
                          mark: m.is_absent ? null : parseInt(m.mark),
                          is_absent: m.is_absent
                      });
                  }
              });
          });

          // Delete existing marks for these students/year/term (and subject if scoped) first to avoid duplicates
          const studentIds = filteredStudents.map(s => s.id);
          
          if (studentIds.length > 0) {
              let deleteQuery = supabase
                  .from('student_marks')
                  .delete()
                  .in('student_id', studentIds)
                  .eq('year', selectedYear)
                  .eq('term', selectedTerm);

              if (selectedSubject !== 'all') {
                  deleteQuery = deleteQuery.eq('subject_id', selectedSubject);
              }

              const { error: delError } = await deleteQuery;
              if (delError) throw delError;

              if (insertData.length > 0) {
                  const { error } = await supabase
                      .from('student_marks')
                      .insert(insertData);
                  if (error) throw error;
              }
          }

          setStatus('success');
          setTimeout(() => setStatus('idle'), 3000);
      } catch (err: any) {
          console.error(err);
          setStatus('error');
          setErrorMessage(err.message || 'Error saving marks');
      }
  };

  if (loading) {
      return <div className="card loading-shimmer" style={{ height: '400px' }}></div>;
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
              <BarChart3 size={20} />
              <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Term Test Analysis</span>
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
            Marks Entry & Analysis
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            {`Enter student marks for ${subjects.find(s => s.id === selectedSubject)?.name || 'Subject'} class-wise.`}
          </p>
        </div>
        <div>
            <button onClick={handleSave} className="btn-primary" disabled={status === 'loading'} style={{ width: 'auto', minWidth: '150px' }}>
                {status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Save Subject Marks
            </button>
        </div>
      </header>

      {/* FILTERS */}
      <div className="sticky-command-bar" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Year</label>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="select-premium" style={{ minWidth: '100px' }}>
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Term</label>
                    <select value={selectedTerm} onChange={(e) => setSelectedTerm(Number(e.target.value))} className="select-premium" style={{ minWidth: '110px' }}>
                        {[1, 2, 3].map(t => <option key={t} value={t}>Term {t}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Grade</label>
                    <select value={selectedGrade} onChange={(e) => setSelectedGrade(Number(e.target.value))} className="select-premium" style={{ minWidth: '110px' }}>
                        {[1,2,3,4,5,6,7,8,9,10,11,12,13].map(g => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Class</label>
                    <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="select-premium" style={{ minWidth: '130px' }}>
                        <option value="all">All Classes</option>
                        {uniqueClasses.map(c => <option key={c} value={c}>Class {c}</option>)}
                        {students.some(s => !s.class_name) && <option value="none">Unassigned</option>}
                    </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject</label>
                    <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="select-premium" style={{ width: '100%' }}>
                        {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                    </select>
                </div>
            </div>
      </div>

      {status === 'success' && (
        <div style={{ marginBottom: '1.5rem', padding: '12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> Marks saved successfully!
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginBottom: '1.5rem', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {errorMessage}
        </div>
      )}

      {/* QUICK STATS PANEL (Subject-wise Mode) */}
      {selectedSubject !== 'all' && subjectStats && (
          <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Entered Count</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--primary)' }}>
                      {subjectStats.enteredCount} / {subjectStats.totalStudents}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({subjectStats.absentCount} marked absent)
                  </span>
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Class Average</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>
                      {subjectStats.average}%
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      active exam attempts
                  </span>
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pass Rate</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--success)' }}>
                      {subjectStats.passRate}%
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      students scoring &gt;= 35
                  </span>
              </div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score Range</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--accent)' }}>
                      {subjectStats.lowest} - {subjectStats.highest}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      lowest to highest
                  </span>
              </div>
          </div>
      )}

      {/* FOCUSSED SUBJECT-WISE ENTRY MODE */}
      <div className="card">
          <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>STUDENT</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', width: '100px' }}>CLASS</th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', width: '220px' }}>
                              {subjects.find(s => s.id === selectedSubject)?.name.toUpperCase()} MARK
                          </th>
                          <th style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', width: '120px' }}>STATUS</th>
                      </tr>
                  </thead>
                  <tbody>
                      {filteredStudents.map((student, index) => {
                          const m = marks[student.id]?.[selectedSubject] || { mark: '', is_absent: false };
                          
                          // Calculate dynamic status indicators for immediate feedback
                          let statusLabel = 'Unsaved';
                          let statusBg = '#f1f5f9';
                          let statusColor = '#475569';
                          
                          if (m.is_absent) {
                              statusLabel = 'Absent';
                              statusBg = 'var(--error-light)';
                              statusColor = 'var(--error)';
                          } else if (m.mark !== '') {
                              const score = parseInt(m.mark);
                              if (score >= 35) {
                                  statusLabel = 'Passed';
                                  statusBg = 'var(--success-light)';
                                  statusColor = 'var(--success)';
                              } else {
                                  statusLabel = 'Failed';
                                  statusBg = 'var(--error-light)';
                                  statusColor = 'var(--error)';
                              }
                          }

                          return (
                              <tr key={student.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: '600' }}>{student.name}</td>
                                  <td style={{ padding: '12px', fontSize: '0.9rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                      {student.class_name || 'N/A'}
                                  </td>
                                  <td style={{ padding: '12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                          <input 
                                              id={`mark-input-${index}`}
                                              type="number" 
                                              value={m.mark} 
                                              onChange={(e) => handleMarkChange(student.id, selectedSubject, e.target.value)}
                                              onKeyDown={(e) => handleKeyDown(e, index)}
                                              disabled={m.is_absent}
                                              placeholder="--"
                                              style={{ 
                                                  width: '80px', 
                                                  padding: '10px', 
                                                  borderRadius: '8px', 
                                                  border: '1px solid var(--surface-border)', 
                                                  textAlign: 'center',
                                                  fontWeight: '700',
                                                  fontSize: '1rem',
                                                  outline: 'none',
                                                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                              }}
                                              min="0"
                                              max="100"
                                          />
                                          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
                                              <input 
                                                  type="checkbox" 
                                                  checked={m.is_absent} 
                                                  onChange={(e) => handleAbsentChange(student.id, selectedSubject, e.target.checked)}
                                                  style={{ accentColor: 'var(--error)', width: '15px', height: '15px', cursor: 'pointer' }}
                                              />
                                              Abs
                                          </label>
                                      </div>
                                  </td>
                                  <td style={{ padding: '12px', textAlign: 'center' }}>
                                      <span style={{ 
                                          padding: '6px 12px', 
                                          borderRadius: '20px', 
                                          fontSize: '0.75rem', 
                                          fontWeight: '700',
                                          backgroundColor: statusBg,
                                          color: statusColor,
                                          display: 'inline-block',
                                          minWidth: '75px',
                                          textAlign: 'center'
                                      }}>
                                          {statusLabel}
                                      </span>
                                  </td>
                              </tr>
                          );
                      })}
                      {filteredStudents.length === 0 && (
                          <tr>
                              <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  No students found for Class {selectedClass === 'none' ? 'Unassigned' : selectedClass} in Grade {selectedGrade}.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
}
