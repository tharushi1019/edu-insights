'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { Printer, Download, Award, TrendingUp, GraduationCap, Loader2, AlertCircle, Calendar, BookOpen, Users, FileText, ChevronRight, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/context/LanguageContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SubjectGradeCount {
  subjectId: string;
  subjectName: string;
  a: number;
  b: number;
  c: number;
  s: number;
  w: number;
  ab: number;
  totalSat: number;
  passed: number;
  failed: number;
  passRate: number;
}

interface StudentProgression {
  id: string;
  name: string;
  class_name: string;
  terms: Record<string, { average: number | null; details: string }>;
}

interface YearlySubjectTrend {
  year: number;
  a: number;
  b: number;
  c: number;
  s: number;
  w: number;
  totalSat: number;
  passRate: number;
}

export default function ReportsPage() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'zonal' | 'progression' | 'trends'>('zonal');
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('EduInsights Academy');

  // Common Filters
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedTerm, setSelectedTerm] = useState<number>(1);
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [useHistoricalExams, setUseHistoricalExams] = useState(false);

  // Tab 1: Zonal Report State
  const [zonalData, setZonalData] = useState<SubjectGradeCount[]>([]);

  // Tab 2: Progression Grid State
  const [progressionData, setProgressionData] = useState<StudentProgression[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ studentId: string; cellKey: string } | null>(null);

  // Tab 3: Subject Trends State
  const [subjectsList, setSubjectsList] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>('');
  const [trendsData, setTrendsData] = useState<YearlySubjectTrend[]>([]);

  // Years option
  const yearsRange = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  // Load School Name
  useEffect(() => {
    async function loadSchoolProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('school_name')
        .eq('id', user.id)
        .single();
      if (data?.school_name) {
        setSchoolName(data.school_name);
      }
    }
    loadSchoolProfile();
  }, []);

  // Fetch subjects for Tab 3
  useEffect(() => {
    async function fetchSubjects() {
      const { data } = await supabase
        .from('subjects')
        .select('id, name')
        .order('name');
      if (data) {
        setSubjectsList(data);
        if (data.length > 0) {
          setSelectedSubjectId(data[0].id);
          setSelectedSubjectName(data[0].name);
        }
      }
    }
    fetchSubjects();
  }, []);

  // Fetch Data based on active tab & filters
  useEffect(() => {
    if (activeTab === 'zonal') {
      fetchZonalReport();
    } else if (activeTab === 'progression') {
      fetchProgressionReport();
    } else if (activeTab === 'trends') {
      fetchTrendsReport();
    }
  }, [activeTab, selectedYear, selectedTerm, selectedGrade, useHistoricalExams, selectedSubjectId]);

  // Helper to map score to letter grade
  const getLetterGrade = (score: number): 'A' | 'B' | 'C' | 'S' | 'W' => {
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 35) return 'S';
    return 'W';
  };

  // Report 1: O/L & A/L Zonal Performance Analysis
  const fetchZonalReport = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (useHistoricalExams) {
        // Fetch from historical exam_records (entered in ol/page.tsx or al/page.tsx)
        const { data, error } = await supabase
          .from('exam_records')
          .select(`
            total_students, pass_count, fail_count,
            a_count, b_count, c_count, s_count, w_count,
            subjects (id, name)
          `)
          .eq('user_id', user.id)
          .eq('year', selectedYear);

        if (error) throw error;

        const formatted: SubjectGradeCount[] = (data || []).map((r: any) => {
          const subName = r.subjects?.[0]?.name || r.subjects?.name || 'N/A';
          const rate = r.total_students > 0 ? Math.round((r.pass_count / r.total_students) * 100) : 0;
          return {
            subjectId: r.subjects?.id || '',
            subjectName: subName,
            a: r.a_count || 0,
            b: r.b_count || 0,
            c: r.c_count || 0,
            s: r.s_count || 0,
            w: r.w_count || 0,
            ab: 0, // Not explicitly tracked in historical summaries
            totalSat: r.total_students,
            passed: r.pass_count,
            failed: r.fail_count,
            passRate: rate
          };
        });
        setZonalData(formatted);
      } else {
        // Compile dynamically from student_marks based on student roster
        const { data: studentRoster } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .eq('grade', selectedGrade);

        if (!studentRoster || studentRoster.length === 0) {
          setZonalData([]);
          return;
        }

        const studentIds = studentRoster.map(s => s.id);

        const { data: marks, error } = await supabase
          .from('student_marks')
          .select(`
            student_id, mark, is_absent,
            subjects (id, name)
          `)
          .in('student_id', studentIds)
          .eq('year', selectedYear)
          .eq('term', selectedTerm);

        if (error) throw error;

        // Group by subject
        const groups: Record<string, { name: string; scores: { score: number; isAbsent: boolean }[] }> = {};
        marks?.forEach((m: any) => {
          const subId = m.subjects?.id;
          const subName = m.subjects?.name;
          if (!subId) return;

          if (!groups[subId]) {
            groups[subId] = { name: subName, scores: [] };
          }
          groups[subId].scores.push({
            score: m.mark || 0,
            isAbsent: m.is_absent || false
          });
        });

        const formatted: SubjectGradeCount[] = Object.keys(groups).map(subId => {
          const g = groups[subId];
          let a = 0, b = 0, c = 0, s = 0, w = 0, ab = 0;

          g.scores.forEach(sc => {
            if (sc.isAbsent) {
              ab++;
            } else {
              const letter = getLetterGrade(sc.score);
              if (letter === 'A') a++;
              else if (letter === 'B') b++;
              else if (letter === 'C') c++;
              else if (letter === 'S') s++;
              else w++;
            }
          });

          const totalSat = a + b + c + s + w;
          const passed = a + b + c + s;
          const failed = w;
          const passRate = totalSat > 0 ? Math.round((passed / totalSat) * 100) : 0;

          return {
            subjectId: subId,
            subjectName: g.name,
            a, b, c, s, w, ab,
            totalSat, passed, failed, passRate
          };
        });

        setZonalData(formatted);
      }
    } catch (err) {
      console.error('Error compiling zonal report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Report 2: Student Continuous Progression Grid
  const fetchProgressionReport = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch active student roster
      const { data: roster, error: rosterError } = await supabase
        .from('students')
        .select('id, name, class_name')
        .eq('user_id', user.id)
        .order('class_name', { ascending: true })
        .order('name', { ascending: true });

      if (rosterError) throw rosterError;
      if (!roster || roster.length === 0) {
        setProgressionData([]);
        return;
      }

      const studentIds = roster.map(s => s.id);

      // 2. Fetch all student marks across all years and terms
      const { data: marks, error: marksError } = await supabase
        .from('student_marks')
        .select(`
          student_id, mark, is_absent, year, term,
          students (grade),
          subjects (name)
        `)
        .in('student_id', studentIds);

      if (marksError) throw marksError;

      // Group marks per student and cell key (Grade-Term)
      // Cell key format: 'Grade-Term' (e.g., '6-1', '7-3', etc.)
      const studentMap: Record<string, StudentProgression> = {};
      roster.forEach(s => {
        studentMap[s.id] = {
          id: s.id,
          name: s.name,
          class_name: s.class_name || 'N/A',
          terms: {}
        };
      });

      // Temporary group to calculate average
      const studentCellMarks: Record<string, Record<string, { total: number; count: number; list: string[] }>> = {};

      marks?.forEach((m: any) => {
        const studId = m.student_id;
        const grade = m.students?.grade;
        const term = m.term;
        const subName = m.subjects?.name || 'Subject';
        if (!grade || !term) return;

        const cellKey = `${grade}-${term}`;

        if (!studentCellMarks[studId]) {
          studentCellMarks[studId] = {};
        }
        if (!studentCellMarks[studId][cellKey]) {
          studentCellMarks[studId][cellKey] = { total: 0, count: 0, list: [] };
        }

        if (m.is_absent) {
          studentCellMarks[studId][cellKey].list.push(`${subName}: Absent`);
        } else {
          studentCellMarks[studId][cellKey].total += m.mark || 0;
          studentCellMarks[studId][cellKey].count++;
          studentCellMarks[studId][cellKey].list.push(`${subName}: ${m.mark} (${getLetterGrade(m.mark || 0)})`);
        }
      });

      // Populate averages and formatted text details
      roster.forEach(s => {
        const cells = studentCellMarks[s.id] || {};
        const termProgression: Record<string, { average: number | null; details: string }> = {};

        // Loop over Grade 6-11 and Term 1-3
        for (let g = 6; g <= 11; g++) {
          for (let t = 1; t <= 3; t++) {
            const key = `${g}-${t}`;
            if (cells[key] && cells[key].count > 0) {
              const avg = Math.round(cells[key].total / cells[key].count);
              termProgression[key] = {
                average: avg,
                details: cells[key].list.join('\n')
              };
            } else if (cells[key] && cells[key].list.length > 0) {
              // Only absent records exist
              termProgression[key] = {
                average: null,
                details: cells[key].list.join('\n')
              };
            } else {
              termProgression[key] = { average: null, details: 'No records available' };
            }
          }
        }

        studentMap[s.id].terms = termProgression;
      });

      setProgressionData(Object.values(studentMap));
    } catch (err) {
      console.error('Error fetching continuous progression grid:', err);
    } finally {
      setLoading(false);
    }
  };

  // Report 3: Multi-Year Subject Trend Report
  const fetchTrendsReport = async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the name of the subject
      const chosenSub = subjectsList.find(s => s.id === selectedSubjectId);
      if (chosenSub) {
        setSelectedSubjectName(chosenSub.name);
      }

      const subjectName = chosenSub?.name || '';

      // 1. Fetch raw marks in student_marks for this subject ID across all years
      const { data: marks } = await supabase
        .from('student_marks')
        .select('mark, is_absent, year')
        .eq('subject_id', selectedSubjectId);

      // 2. Fetch historical records from exam_records for subjects matching this name
      const { data: history } = await supabase
        .from('exam_records')
        .select(`
          year, total_students, pass_count, fail_count,
          a_count, b_count, c_count, s_count, w_count,
          subjects (name)
        `)
        .eq('user_id', user.id);

      // Filter historical records in memory for this subject name to be fully accurate
      const filteredHistory = history?.filter((h: any) => {
        const subName = h.subjects?.[0]?.name || h.subjects?.name || '';
        return subName.toLowerCase() === subjectName.toLowerCase();
      }) || [];

      // Combine both sources by year
      const yearsSet = new Set<number>([
        ...(marks?.map(m => m.year) || []),
        ...(filteredHistory.map(h => h.year) || [])
      ]);

      const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

      const computedTrends: YearlySubjectTrend[] = sortedYears.map(yr => {
        const yrMarks = marks?.filter(m => m.year === yr) || [];
        const yrHist = filteredHistory.find(h => h.year === yr);

        let a = 0, b = 0, c = 0, s = 0, w = 0, sat = 0;

        if (yrHist) {
          a = yrHist.a_count || 0;
          b = yrHist.b_count || 0;
          c = yrHist.c_count || 0;
          s = yrHist.s_count || 0;
          w = yrHist.w_count || 0;
          sat = yrHist.total_students || (a + b + c + s + w);
        } else {
          yrMarks.forEach(sc => {
            if (!sc.is_absent) {
              const letter = getLetterGrade(sc.mark || 0);
              if (letter === 'A') a++;
              else if (letter === 'B') b++;
              else if (letter === 'C') c++;
              else if (letter === 'S') s++;
              else w++;
            }
          });
          sat = a + b + c + s + w;
        }

        const passed = a + b + c + s;
        const passRate = sat > 0 ? Math.round((passed / sat) * 100) : 0;

        return {
          year: yr,
          a, b, c, s, w,
          totalSat: sat,
          passRate
        };
      });

      setTrendsData(computedTrends);
    } catch (err) {
      console.error('Error fetching trends report:', err);
    } finally {
      setLoading(false);
    }
  };

  // PDF Download Handlers
  const downloadZonalPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolName, 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 116, 139);
    const subTitle = language === 'si' 
      ? `විභාග ප්‍රතිඵල විශ්ලේෂණය - අධ්‍යයන වර්ෂය: ${selectedYear}`
      : `Zonal Results Performance Sheet - Academic Year: ${selectedYear}`;
    doc.text(subTitle, 14, 28);

    doc.setFontSize(10);
    doc.text(`Generated via EduInsights on ${new Date().toLocaleDateString()}`, 14, 34);

    const tableHeaders = language === 'si'
      ? [['විෂයය', 'A', 'B', 'C', 'S', 'W', 'නොපැමිණි', 'පෙනී සිටි මුළු ගණන', 'සමත්', 'ප්‍රතිශතය %']]
      : [['Subject', 'A', 'B', 'C', 'S', 'W', 'Absent', 'Total Sat', 'Passed', 'Pass Rate %']];

    const tableBody = zonalData.map(r => [
      r.subjectName,
      r.a.toString(),
      r.b.toString(),
      r.c.toString(),
      r.s.toString(),
      r.w.toString(),
      r.ab.toString(),
      r.totalSat.toString(),
      r.passed.toString(),
      `${r.passRate}%`
    ]);

    autoTable(doc, {
      startY: 40,
      head: tableHeaders,
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], halign: 'center' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center' },
        8: { halign: 'center' },
        9: { halign: 'center', fontStyle: 'bold' }
      }
    });

    doc.save(`Zonal-Results-Analysis-${selectedYear}.pdf`);
  };

  const downloadProgressionPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4 is perfect for massive 18-column grid

    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolName, 14, 18);

    doc.setFontSize(13);
    doc.setTextColor(100, 116, 139);
    const subTitle = language === 'si'
      ? 'ශිෂ්‍ය සාධන මට්ටම් පත්‍රිකාව (6 ශ්‍රේණිය - 11 ශ්‍රේණිය ප්‍රගති වාර්තාව)'
      : 'Student Continuous Progression Grid (Grades 6 - 11 Academic History)';
    doc.text(subTitle, 14, 25);

    doc.setFontSize(9);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 30);

    const headers = [
      ['Student Name', 'Class', 'G6 T1', 'G6 T2', 'G6 T3', 'G7 T1', 'G7 T2', 'G7 T3', 'G8 T1', 'G8 T2', 'G8 T3', 'G9 T1', 'G9 T2', 'G9 T3', 'G10 T1', 'G10 T2', 'G10 T3', 'G11 T1', 'G11 T2', 'G11 T3']
    ];

    const body = progressionData.map(s => {
      const row = [s.name, s.class_name];
      for (let g = 6; g <= 11; g++) {
        for (let t = 1; t <= 3; t++) {
          const key = `${g}-${t}`;
          row.push(s.terms[key]?.average !== null ? `${s.terms[key].average}%` : '-');
        }
      }
      return row;
    });

    autoTable(doc, {
      startY: 35,
      head: headers,
      body: body,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [79, 70, 229], halign: 'center' },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 15, halign: 'center' }
      }
    });

    doc.save(`Student-Continuous-Progression-Grid.pdf`);
  };

  const downloadTrendsPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolName, 14, 20);

    doc.setFontSize(14);
    doc.setTextColor(100, 116, 139);
    const subTitle = language === 'si'
      ? `${selectedSubjectName} - බහු-වසර ප්‍රගති විශ්ලේෂණය`
      : `Multi-Year Performance Tracker: ${selectedSubjectName}`;
    doc.text(subTitle, 14, 28);

    doc.setFontSize(10);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 34);

    const headers = language === 'si'
      ? [['අධ්‍යයන වර්ෂය', 'A', 'B', 'C', 'S', 'W', 'පෙනී සිටි මුළු ගණන', 'සමත් ප්‍රතිශතය %']]
      : [['Academic Year', 'A', 'B', 'C', 'S', 'W', 'Total Sat', 'Pass Rate %']];

    const body = trendsData.map(r => [
      r.year.toString(),
      r.a.toString(),
      r.b.toString(),
      r.c.toString(),
      r.s.toString(),
      r.w.toString(),
      r.totalSat.toString(),
      `${r.passRate}%`
    ]);

    autoTable(doc, {
      startY: 40,
      head: headers,
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold' },
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'center' },
        7: { halign: 'center', fontStyle: 'bold' }
      }
    });

    doc.save(`${selectedSubjectName.replace(/\s+/g, '-')}-Multi-Year-Trends.pdf`);
  };

  return (
    <div className="fade-in">
      {/* HEADER SECTION */}
      <header className="no-print" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
          <FileText size={20} />
          <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Zonal Analytics & Reports
          </span>
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
          {t('reportsTitle')}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          {t('reportsSubtitle')}
        </p>
      </header>

      {/* PRINT-ONLY SCHOOL EMBLEM & HEADINGS */}
      <div className="print-only-header" style={{ display: 'none', textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>
          {schoolName}
        </h1>
        <p style={{ fontSize: '1rem', fontWeight: '600', color: '#475569' }}>
          {activeTab === 'zonal' && (language === 'si' ? `අ.පො.ස. ප්‍රතිඵල විශ්ලේෂණ ලේඛනය - ${selectedYear}` : `G.C.E. Official Results Analysis Sheet - ${selectedYear}`)}
          {activeTab === 'progression' && (language === 'si' ? 'ශිෂ්‍ය සාධන මට්ටම් ප්‍රගති පත්‍රිකාව (Grades 6–11)' : 'Student Continuous Progression History (Grades 6–11)')}
          {activeTab === 'trends' && `${selectedSubjectName} - ${language === 'si' ? 'ඓතිහාසික ප්‍රගති විශ්ලේෂණය' : 'Multi-Year Historical Trend Analysis'}`}
        </p>
        <hr style={{ border: 'none', borderBottom: '2px solid #000', marginTop: '1rem', marginBottom: '1.5rem' }} />
      </div>

      {/* NAVIGATION TABS */}
      <div className="no-print" style={{ display: 'flex', borderBottom: '2px solid var(--surface-border)', gap: '1.5rem', marginBottom: '2.5rem', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('zonal')}
          style={{
            padding: '12px 6px',
            fontSize: '1rem',
            fontWeight: '700',
            border: 'none',
            background: 'none',
            color: activeTab === 'zonal' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'zonal' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          {t('zonalReport')}
        </button>
        <button
          onClick={() => setActiveTab('progression')}
          style={{
            padding: '12px 6px',
            fontSize: '1rem',
            fontWeight: '700',
            border: 'none',
            background: 'none',
            color: activeTab === 'progression' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'progression' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          {t('continuousRoster')}
        </button>
        <button
          onClick={() => setActiveTab('trends')}
          style={{
            padding: '12px 6px',
            fontSize: '1rem',
            fontWeight: '700',
            border: 'none',
            background: 'none',
            color: activeTab === 'trends' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === 'trends' ? '3px solid var(--primary)' : '3px solid transparent',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s'
          }}
        >
          {t('subjectTrend')}
        </button>
      </div>

      {/* COMMAND FILTER BOX */}
      <div className="card no-print" style={{ padding: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Dynamic Filters depending on current selected tab */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
            {activeTab === 'zonal' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                    Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none', backgroundColor: 'white', fontWeight: '600' }}
                  >
                    {yearsRange.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                </div>

                {!useHistoricalExams && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Grade
                      </label>
                      <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(parseInt(e.target.value))}
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none', backgroundColor: 'white', fontWeight: '600' }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(g => <option key={g} value={g}>Grade {g}</option>)}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Term
                      </label>
                      <select
                        value={selectedTerm}
                        onChange={(e) => setSelectedTerm(parseInt(e.target.value))}
                        style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none', backgroundColor: 'white', fontWeight: '600' }}
                      >
                        <option value={1}>Term 1</option>
                        <option value={2}>Term 2</option>
                        <option value={3}>Term 3</option>
                      </select>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1.25rem' }}>
                  <input
                    type="checkbox"
                    id="chkHist"
                    checked={useHistoricalExams}
                    onChange={(e) => setUseHistoricalExams(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="chkHist" style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer' }}>
                    Show Historical G.C.E. Logs
                  </label>
                </div>
              </>
            )}

            {activeTab === 'trends' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  Choose Subject
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none', backgroundColor: 'white', fontWeight: '600', minWidth: '220px' }}
                >
                  {subjectsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {activeTab === 'progression' && (
              <div style={{ padding: '4px', backgroundColor: 'var(--primary-light)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem' }}>
                <Users size={18} />
                <span>Showing Continuous History for All Enrolled Students</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => window.print()}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
            >
              <Printer size={18} />
              Print A4
            </button>
            <button
              onClick={
                activeTab === 'zonal' ? downloadZonalPDF :
                activeTab === 'progression' ? downloadProgressionPDF :
                downloadTrendsPDF
              }
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', width: 'auto' }}
            >
              <Download size={18} />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* DATA VIEW AREA */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '30vh' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        </div>
      ) : (
        <div className="card" style={{ padding: 'clamp(1rem, 3vw, 2rem)', overflowX: 'auto' }}>
          
          {/* TAB 1: ZONAL PERFORMANCE ANALYSIS (Sinhala/English Toggle-Ready) */}
          {activeTab === 'zonal' && (
            <div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--surface-border)' }}>
                    <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {language === 'si' ? 'විෂයය' : 'SUBJECT'}
                    </th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>A</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>B</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>C</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>S</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>W</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>
                      {language === 'si' ? 'නොපැමිණි' : 'AB'}
                    </th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {language === 'si' ? 'පෙනී සිටි මුළු ගණන' : 'TOTAL SAT'}
                    </th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {language === 'si' ? 'සමත්' : 'PASSED'}
                    </th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {t('passRatePercent')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {zonalData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)', hover: { backgroundColor: '#f8fafc' } }}>
                      <td style={{ padding: '14px 12px', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        {row.subjectName}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '600', color: '#059669' }}>{row.a}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#10b981' }}>{row.b}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#3b82f6' }}>{row.c}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#f59e0b' }}>{row.s}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#f43f5e', fontWeight: '600' }}>{row.w}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: 'var(--text-muted)' }}>{row.ab}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '700' }}>{row.totalSat}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#059669', fontWeight: '600' }}>{row.passed}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '1rem', fontWeight: '800', color: row.passRate >= 75 ? 'var(--success)' : row.passRate < 40 ? 'var(--error)' : 'var(--text-main)' }}>
                        {row.passRate}%
                      </td>
                    </tr>
                  ))}
                  {zonalData.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records found. Select another year or verify your Term Test / Historical Exam tables have entries.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: STUDENT CONTINUOUS PROGRESSION GRID (Image 4) */}
          {activeTab === 'progression' && (
            <div style={{ position: 'relative' }}>
              <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--surface-border)', minWidth: '1500px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--surface-border)' }}>
                      <th rowSpan={2} style={{ padding: '16px 12px', textAlign: 'left', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', borderRight: '1px solid var(--surface-border)', width: '220px', position: 'sticky', left: 0, backgroundColor: '#f8fafc', zIndex: 10 }}>
                        STUDENT NAME
                      </th>
                      <th rowSpan={2} style={{ padding: '16px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', borderRight: '2px solid var(--surface-border)', width: '90px' }}>
                        CLASS
                      </th>
                      <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', borderRight: '1px solid var(--surface-border)', backgroundColor: '#eff6ff' }}>GRADE 6</th>
                      <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', borderRight: '1px solid var(--surface-border)', backgroundColor: '#eff6ff' }}>GRADE 7</th>
                      <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', borderRight: '1px solid var(--surface-border)', backgroundColor: '#eff6ff' }}>GRADE 8</th>
                      <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', borderRight: '1px solid var(--surface-border)', backgroundColor: '#eff6ff' }}>GRADE 9</th>
                      <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', borderRight: '1px solid var(--surface-border)', backgroundColor: '#eff6ff' }}>GRADE 10</th>
                      <th colSpan={3} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', backgroundColor: '#eff6ff' }}>GRADE 11</th>
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--surface-border)' }}>
                      {[6, 7, 8, 9, 10, 11].map(g => (
                        <Fragment key={g}>
                          <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', borderRight: '1px solid #e2e8f0' }}>T1</th>
                          <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', borderRight: '1px solid #e2e8f0' }}>T2</th>
                          <th style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted)', borderRight: g !== 11 ? '2px solid var(--surface-border)' : 'none' }}>T3</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {progressionData.map((stud) => (
                      <tr key={stud.id} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                        {/* sticky name column */}
                        <td style={{ padding: '14px 12px', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-main)', borderRight: '1px solid var(--surface-border)', position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}>
                          {stud.name}
                        </td>
                        <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', borderRight: '2px solid var(--surface-border)' }}>
                          {stud.class_name}
                        </td>
                        
                        {/* 18 Term Cells */}
                        {[6, 7, 8, 9, 10, 11].map(g => (
                          <Fragment key={g}>
                            {[1, 2, 3].map(t => {
                              const cellKey = `${g}-${t}`;
                              const cell = stud.terms[cellKey];
                              const avg = cell?.average;
                              const borderRightStyle = t === 3 && g !== 11 ? '2px solid var(--surface-border)' : '1px solid #e2e8f0';

                              return (
                                <td
                                  key={t}
                                  onMouseEnter={() => setHoveredCell({ studentId: stud.id, cellKey })}
                                  onMouseLeave={() => setHoveredCell(null)}
                                  style={{
                                    padding: '12px 8px',
                                    textAlign: 'center',
                                    fontSize: '0.9rem',
                                    fontWeight: '700',
                                    backgroundColor: avg !== null ? 'var(--primary-light)' : 'transparent',
                                    color: avg !== null ? 'var(--primary)' : 'var(--text-muted)',
                                    borderRight: borderRightStyle,
                                    position: 'relative',
                                    cursor: avg !== null ? 'help' : 'default'
                                  }}
                                >
                                  {avg !== null ? `${avg}%` : '-'}

                                  {/* Beautiful Interactive Tooltip Popover */}
                                  {hoveredCell?.studentId === stud.id && hoveredCell?.cellKey === cellKey && cell?.details && (
                                    <div style={{
                                      position: 'absolute',
                                      bottom: '120%',
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      backgroundColor: '#0f172a',
                                      color: 'white',
                                      padding: '10px 14px',
                                      borderRadius: '8px',
                                      fontSize: '0.75rem',
                                      fontWeight: '600',
                                      lineHeight: '1.4',
                                      whiteSpace: 'pre',
                                      zIndex: 100,
                                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                                      textAlign: 'left',
                                      border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '6px', color: '#38bdf8', fontWeight: '800' }}>
                                        Grade {g} - Term {t}
                                      </div>
                                      {cell.details}
                                      <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 0,
                                        height: 0,
                                        borderLeft: '6px solid transparent',
                                        borderRight: '6px solid transparent',
                                        borderTop: '6px solid #0f172a'
                                      }} />
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tr>
                    ))}
                    {progressionData.length === 0 && (
                      <tr>
                        <td colSpan={20} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No students registered in the system. Go to the Students Management page to build your roster.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: MULTI-YEAR SUBJECT TREND SHEET (Images 3 & 5) */}
          {activeTab === 'trends' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderLeft: '4px solid var(--success)', paddingLeft: '12px' }}>
                <TrendingUp size={24} color="var(--success)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {selectedSubjectName} {language === 'si' ? 'ප්‍රගති වාර්තාව' : 'Year-on-Year Progress History'}
                </h3>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--surface-border)' }}>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>
                      {language === 'si' ? 'අධ්‍යයන වර්ෂය' : 'ACADEMIC YEAR'}
                    </th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>A</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>B</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>C</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>S</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)' }}>W</th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {language === 'si' ? 'පෙනී සිටි මුළු ගණන' : 'TOTAL SAT'}
                    </th>
                    <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {language === 'si' ? 'සමත් ප්‍රතිශතය %' : 'PASS RATE %'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trendsData.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '1rem', fontWeight: '800', color: 'var(--primary)' }}>
                        {row.year}
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '700', color: '#059669' }}>{row.a}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#10b981' }}>{row.b}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#3b82f6' }}>{row.c}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#f59e0b' }}>{row.s}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', color: '#f43f5e', fontWeight: '700' }}>{row.w}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '0.95rem', fontWeight: '700' }}>{row.totalSat}</td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontSize: '1rem', fontWeight: '800', color: row.passRate >= 75 ? 'var(--success)' : row.passRate < 40 ? 'var(--error)' : 'var(--text-main)' }}>
                        {row.passRate}%
                      </td>
                    </tr>
                  ))}
                  {trendsData.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No historical or term test records found for this subject.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* PRINT-ONLY FOOTER SIGNATURE BLOCK */}
      <div className="print-only-footer" style={{ display: 'none', marginTop: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ borderTop: '1px dashed #000', width: '200px', paddingTop: '8px', fontSize: '0.9rem', fontWeight: '600' }}>
              Subject Teacher / විෂය භාර ගුරුතුමා
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ borderTop: '1px dashed #000', width: '200px', paddingTop: '8px', fontSize: '0.9rem', fontWeight: '600' }}>
              Principal / විදුහල්පති
            </p>
          </div>
        </div>
      </div>

      {/* CUSTOM PRINT STYLES */}
      <style jsx global>{`
        @media print {
          /* Hide sidebar, filter panel, and footer actions */
          .no-print,
          aside,
          .sidebar,
          header.no-print,
          .mobile-header,
          .card.no-print,
          button,
          .btn-primary,
          .btn-secondary {
            display: none !important;
          }
          
          /* Set body size to A4 dimensions */
          body {
            background-color: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          .main-content {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          
          /* Display custom A4 header & signature blocks */
          .print-only-header,
          .print-only-footer {
            display: block !important;
          }
          
          /* Remove modern container border shadows */
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          
          /* High contrast tables */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            border: 2px solid #000 !important;
          }
          
          th {
            background-color: #f1f5f9 !important;
            color: black !important;
            border: 1px solid #000 !important;
            font-weight: bold !important;
          }
          
          td {
            border: 1px solid #000 !important;
            color: black !important;
            background-color: transparent !important;
          }
          
          /* Force page break settings */
          tr {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  );
}
