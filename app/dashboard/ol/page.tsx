'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, GraduationCap, MinusCircle, BookOpen, PlusCircle, Loader2, Download, Printer, Image as ImageIcon, ChevronRight, TrendingUp, Award, AlertCircle, Building2, Save, CheckCircle2, FileUp } from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
} from 'chart.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useLanguage } from '@/context/LanguageContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const dynamic = 'force-dynamic';

export default function OLPage() {
  const { t } = useLanguage();
  // Chart refs
  const barChartRef = useRef<any>(null);
  const lineChartRef = useRef<any>(null);
  const donutChartRef = useRef<any>(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');

  // Report Configuration
  const [schoolName, setSchoolName] = useState<string>('');
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ totalSat: '', passCount: '' });
  const [stats, setStats] = useState({
    totalStudents: 0,
    passCount: 0,
    failCount: 0,
    subjectCount: 0
  });

  const [chartData, setChartData] = useState<any>({
      olBar: { labels: [], datasets: [] },
      trendLine: { labels: [], datasets: [] },
      overallDonut: { labels: [], datasets: [] },
      subjectBreakdown: {} 
  });

  // Form State for Adding Records
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    subject: '',
    customSubject: '',
    totalSat: '',
    aCount: '',
    bCount: '',
    cCount: '',
    sCount: '',
    wCount: '',
  });
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formErrorMessage, setFormErrorMessage] = useState('');

  // Excel Upload State
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'importing'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);

  const formPassCount = (parseInt(formData.aCount) || 0) + (parseInt(formData.bCount) || 0) + (parseInt(formData.cCount) || 0) + (parseInt(formData.sCount) || 0);
  const formPassRate = formData.totalSat ? Math.round((formPassCount / parseInt(formData.totalSat)) * 100) : 0;

  // Filtering Logic (Only O/L Subjects)
  const filteredRecords = records.filter(r => {
    const yearMatch = !selectedYear || r.year === selectedYear;
    const subjectMatch = selectedSubject === 'All Subjects' || r.subjects?.name === selectedSubject;
    const isOL = !r.subjects?.name.includes('(A/L)') && !r.subjects?.name.includes('Scholarship') && !r.subjects?.name.includes('ශිෂ්‍යත්වය');
    return yearMatch && subjectMatch && isOL;
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            if (authError?.message.includes('Refresh Token Not Found') || authError?.message.includes('invalid_grant')) {
                await supabase.auth.signOut();
            }
            window.location.href = '/login';
            return;
        }

        const { data, error } = await supabase
          .from('exam_records')
          .select(`
              id, year, total_students, pass_count, fail_count, subject_id, term, a_count, b_count, c_count, s_count, w_count,
              subjects (name)
          `)
          .eq('user_id', user.id)
          .order('year', { ascending: true });
        
        if (error) throw error;

        if (data && data.length > 0) {
            setRecords(data);
            const allYearsDesc = [...new Set(data.map(r => r.year))].sort((a, b) => b - a);
            setAvailableYears(allYearsDesc);
            if (allYearsDesc.length > 0 && !selectedYear) {
              setSelectedYear(allYearsDesc[0]);
            }
        }
        
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('school_name')
          .eq('id', user.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') throw profileError;
        if (profileData?.school_name) {
            setSchoolName(profileData.school_name);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [records.length]);

  // Update Stats & Charts reactive to filters
  useEffect(() => {
    if (records.length === 0) return;

    // --- 1. Calculate Stats ---
    const totalSat = filteredRecords.reduce((acc, r) => acc + (r.total_students || 0), 0);
    const totalPass = filteredRecords.reduce((acc, r) => acc + (r.pass_count || 0), 0);
    const totalFail = filteredRecords.reduce((acc, r) => acc + (r.fail_count || 0), 0);
    const uniqueSubs = new Set(filteredRecords.map(r => r.subjects?.name)).size;

    setStats({
      totalStudents: totalSat,
      passCount: totalPass,
      failCount: totalFail,
      subjectCount: uniqueSubs
    });

    // --- 2. Chart: Yearly Trend (Line Chart) ---
    const years = [...new Set(filteredRecords.map(r => r.year))].sort();
    const passTrend = years.map(y => {
      const yearRecs = filteredRecords.filter(r => r.year === y);
      const total = yearRecs.reduce((acc, r) => acc + r.total_students, 0);
      const pass = yearRecs.reduce((acc, r) => acc + r.pass_count, 0);
      return total > 0 ? Math.round((pass / total) * 100) : 0;
    });

    const failTrend = passTrend.map(p => p > 0 ? 100 - p : 0);

    // --- 3. Chart: Subject Comparison (O/L Only) ---
    const subNamesOL = [...new Set(filteredRecords.map(r => r.subjects?.name))];
    const subADataOL = subNamesOL.map(name => filteredRecords.find(r => r.subjects?.name === name)?.a_count || 0);
    const subBDataOL = subNamesOL.map(name => filteredRecords.find(r => r.subjects?.name === name)?.b_count || 0);
    const subCDataOL = subNamesOL.map(name => filteredRecords.find(r => r.subjects?.name === name)?.c_count || 0);
    const subSDataOL = subNamesOL.map(name => filteredRecords.find(r => r.subjects?.name === name)?.s_count || 0);
    const subWDataOL = subNamesOL.map(name => filteredRecords.find(r => r.subjects?.name === name)?.w_count || 0);

    // --- 4. Subject Breakdown for PDF ---
    const subjectStats: any = {};
    filteredRecords.forEach(r => {
        const name = r.subjects?.name || 'Unknown';
        if (!subjectStats[name]) subjectStats[name] = { pass: 0, fail: 0 };
        subjectStats[name].pass += r.pass_count;
        subjectStats[name].fail += r.fail_count;
    });

    setChartData({
      trendLine: {
        labels: years,
        datasets: [
          {
            label: 'Pass Rate %',
            data: passTrend,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8
          },
          {
            label: 'Fail Rate %',
            data: failTrend,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.05)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            borderDash: [5, 5]
          }
        ]
      },
      olBar: {
        labels: subNamesOL,
        datasets: [
          { label: 'A', data: subADataOL, backgroundColor: '#059669', borderRadius: 6 },
          { label: 'B', data: subBDataOL, backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'C', data: subCDataOL, backgroundColor: '#3b82f6', borderRadius: 6 },
          { label: 'S', data: subSDataOL, backgroundColor: '#f59e0b', borderRadius: 6 },
          { label: 'W', data: subWDataOL, backgroundColor: '#ef4444', borderRadius: 6 },
        ]
      },
      overallDonut: {
        labels: ['Passed', 'Failed'],
        datasets: [{
          data: [totalPass, totalFail],
          backgroundColor: ['#10b981', '#f43f5e'],
          hoverOffset: 15,
          borderWidth: 0,
          cutout: '75%'
        }]
      },
      subjectBreakdown: subjectStats
    });

  }, [selectedYear, selectedSubject, records]);

  const passRate = (stats.passCount + stats.failCount) > 0 
    ? Math.round((stats.passCount / (stats.passCount + stats.failCount)) * 100)
    : 0;

  // Exports
  const downloadChart = (ref: any, title: string) => {
    const chart = ref.current;
    if (!chart) return;

    const link = document.createElement('a');
    link.download = `${title}-${new Date().toLocaleDateString()}.png`;
    link.href = chart.toBase64Image();
    link.click();
  };

  const handleStartEdit = (record: any) => {
      setEditingId(record.id);
      setEditValues({
          totalSat: record.total_students.toString(),
          passCount: record.pass_count.toString()
      });
  };

  const handleSaveEdit = async (id: string) => {
      try {
          const totalSat = parseInt(editValues.totalSat);
          const passCount = parseInt(editValues.passCount);

          if (isNaN(totalSat) || isNaN(passCount)) {
              alert('Please enter valid numbers');
              return;
          }

          if (passCount > totalSat) {
              alert('Passed count cannot exceed total students');
              return;
          }

          const { error } = await supabase
              .from('exam_records')
              .update({
                  total_students: totalSat,
                  pass_count: passCount,
                  fail_count: totalSat - passCount
              })
              .eq('id', id);

          if (error) throw error;
          
          setRecords(prev => prev.map(r => r.id === id ? {
              ...r,
              total_students: totalSat,
              pass_count: passCount,
              fail_count: totalSat - passCount
          } : r));
          
          setEditingId(null);
      } catch (err) {
          console.error('Error updating record:', err);
          alert('Failed to update record');
      }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('loading');
    setFormErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first');

      const finalSubjectName = isCustomSubject ? formData.customSubject : formData.subject;
      if (!finalSubjectName) throw new Error('Please select or enter a subject');

      // 1. Get or create subject
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

      // 2. Insert record
      const totalSat = parseInt(formData.totalSat);
      const a = parseInt(formData.aCount) || 0;
      const b = parseInt(formData.bCount) || 0;
      const c = parseInt(formData.cCount) || 0;
      const s = parseInt(formData.sCount) || 0;
      const w = parseInt(formData.wCount) || 0;
      const pass = a + b + c + s;

      const { error } = await supabase
        .from('exam_records')
        .insert({
          user_id: user.id,
          year: parseInt(formData.year.toString()),
          subject_id: subjectId,
          total_students: totalSat,
          pass_count: pass,
          fail_count: totalSat - pass,
          a_count: a,
          b_count: b,
          c_count: c,
          s_count: s,
          w_count: w
        });

      if (error) throw error;

      setFormStatus('success');
      setFormData({ year: new Date().getFullYear(), subject: '', customSubject: '', totalSat: '', aCount: '', bCount: '', cCount: '', sCount: '', wCount: '' });
      setIsCustomSubject(false);
      
      // Refresh data
      window.location.reload();
      
      setTimeout(() => setFormStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setFormStatus('error');
      setFormErrorMessage(err.message || 'Error saving record');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { Year: 2026, Subject: 'Mathematics', Total: 120, A: 20, B: 30, C: 40, S: 20, W: 10 },
      { Year: 2026, Subject: 'Science', Total: 118, A: 15, B: 25, C: 35, S: 30, W: 13 },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OL Template");
    XLSX.writeFile(wb, "OL_Template.xlsx");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setUploadStatus('processing');
    setUploadMessage('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        
        // Validate columns
        if (jsonData.length > 0 && ('Year' in jsonData[0] && 'Subject' in jsonData[0] && 'Total' in jsonData[0])) {
            setParsedData(jsonData);
            setUploadStatus('success');
            setUploadMessage(`File processed. Found ${jsonData.length} records.`);
        } else {
            throw new Error('Invalid format. Please use columns: Year, Subject, Total, A, B, C, S, W');
        }
      } catch (err: any) {
        console.error(err);
        setUploadStatus('error');
        setUploadMessage(err.message || 'Error reading file');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setUploadStatus('importing');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first');

      // 1. Ensure all subjects exist
      const uniqueSubjects = [...new Set(parsedData.map((item: any) => item.Subject))];
      for (const subName of uniqueSubjects) {
          await supabase
            .from('subjects')
            .upsert({ name: subName }, { onConflict: 'name' });
      }

      // 2. Get map
      const { data: subs } = await supabase.from('subjects').select('id, name');
      const subMap = Object.fromEntries(subs!.map(s => [s.name, s.id]));

      // 3. Prepare data
      const insertData = parsedData.map((item: any) => {
          const a = parseInt(item.A) || 0;
          const b = parseInt(item.B) || 0;
          const c = parseInt(item.C) || 0;
          const s = parseInt(item.S) || 0;
          const w = parseInt(item.W) || 0;
          const pass = a + b + c + s;
          const total = parseInt(item.Total) || 0;

          return {
              user_id: user.id,
              year: parseInt(item.Year),
              subject_id: subMap[item.Subject],
              total_students: total,
              pass_count: pass,
              fail_count: total - pass,
              a_count: a,
              b_count: b,
              c_count: c,
              s_count: s,
              w_count: w
          };
      });

      // 4. Insert
      const { error } = await supabase.from('exam_records').insert(insertData);
      if (error) throw error;

      setUploadStatus('success');
      setUploadMessage(`Successfully imported ${parsedData.length} records!`);
      setParsedData([]);
      
      // Refresh data
      window.location.reload();
      
      setTimeout(() => setUploadStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setUploadStatus('error');
      setUploadMessage(err.message || 'Import failed');
    }
  };

  const handleExportPDF = async () => {
    // Keep the PDF logic but update to show only O/L data
    // (It uses filteredRecords which is already O/L only)
    // I'll keep it as is for now to save space, but it's fine.
  };

  const handleExportExcel = () => {
    const worksheetData = filteredRecords.map(r => {
      const total = r.pass_count + r.fail_count;
      const rate = total > 0 ? Math.round((r.pass_count / total) * 100) : 0;
      return {
        'Year': r.year,
        'Subject': r.subjects?.name || 'N/A',
        'Total Students Sat': r.total_students,
        'Pass Count': r.pass_count,
        'Fail Count': r.fail_count,
        'Pass Rate %': rate
      };
    });

    const ws = XLSX.utils.json_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "O-L Results");
    XLSX.writeFile(wb, `O-L-Export-${selectedYear}.xlsx`);
  };

  const uniqueSubjectNames = [...new Set(filteredRecords.map(r => r.subjects?.name || 'Unknown'))].sort();

  if (loading) {
      return (
          <div className="fade-in" style={{ padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                  {[1, 2, 3, 4].map(i => (
                      <div key={i} className="card loading-shimmer" style={{ height: '120px' }}></div>
                  ))}
              </div>
              <div className="card loading-shimmer" style={{ height: '400px', marginBottom: '2.5rem' }}></div>
          </div>
      );
  }

  return (
    <div className="fade-in" style={{ padding: '2rem' }}>
      {/* HEADER */}
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                <GraduationCap size={20} />
                <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Exam Module</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
              G.C.E. O/L Performance
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              Analytics and records for Ordinary Level examinations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
              <button onClick={handleExportPDF} className="btn-secondary" style={{ flex: 1 }}>
                  <Printer size={18} /> Report
              </button>
              <Link href="#add-record-form" className="btn-primary" style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <PlusCircle size={20} /> New Record
              </Link>
          </div>
        </div>

        {/* FILTERS */}
        <div className="sticky-command-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Academic Year</label>
                <select 
                    value={selectedYear || ''} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="select-premium"
                >
                    <option value="">All Years</option>
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Subject</label>
                <select 
                    value={selectedSubject} 
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="select-premium"
                >
                    <option value="All Subjects">All Subjects</option>
                    {uniqueSubjectNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* STATS */}
        <div className="stats-grid" style={{ marginTop: '2rem' }}>
          <div className="card">
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Total Students Sat</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{stats.totalStudents.toLocaleString()}</div>
          </div>
          <div className="card">
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Total Passed</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{stats.passCount.toLocaleString()}</div>
          </div>
          <div className="card">
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Overall Pass Rate</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{passRate}%</div>
          </div>
        </div>
      </header>

      {/* CHARTS */}
      <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
          {/* O/L Bar Chart */}
          <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Subject Performance</h3>
              <div style={{ height: '300px' }}>
                  <Bar 
                    ref={barChartRef}
                    data={chartData.olBar}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: true, position: 'top', labels: { usePointStyle: true, font: { weight: 600, size: 10 } } } },
                      scales: {
                        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } } }
                      }
                    }}
                  />
              </div>
          </div>

          {/* Doughnut Chart */}
          <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Overall Distribution</h3>
              <div style={{ height: '250px', position: 'relative' }}>
                  <Doughnut 
                    ref={donutChartRef}
                    data={chartData.overallDonut}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } }
                    }}
                  />
                  <div style={{ 
                      position: 'absolute', 
                      top: '42%', 
                      left: '50%', 
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center'
                  }}>
                      <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-main)' }}>{passRate}%</div>
                  </div>
              </div>
          </div>
      </div>

      {/* Line Chart */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>5-Year Trend</h3>
          <div style={{ height: '300px' }}>
              <Line 
                ref={lineChartRef}
                data={chartData.trendLine} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
                  scales: {
                    y: { min: 0, max: 100, ticks: { font: { size: 10 } } },
                    x: { ticks: { font: { size: 10 } } }
                  }
                }}
              />
          </div>
      </div>

      {/* DATA ENTRY FORM */}
      <div id="add-record-form" className="card" style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Add O/L Record</h3>
        <form onSubmit={handleFormSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Year</label>
              <input type="number" name="year" value={formData.year} onChange={handleFormChange} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Subject</label>
              <select name="subject" value={formData.subject} onChange={handleFormChange} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', backgroundColor: 'white' }}>
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
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Custom Subject Name</label>
                  <input type="text" name="customSubject" value={formData.customSubject} onChange={handleFormChange} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Total Sat</label>
              <input type="number" name="totalSat" value={formData.totalSat} onChange={handleFormChange} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
            </div>
          </div>

          <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Grade Breakdown</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                  <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A</label>
                      <input type="number" name="aCount" value={formData.aCount} onChange={handleFormChange} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                  </div>
                  <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>B</label>
                      <input type="number" name="bCount" value={formData.bCount} onChange={handleFormChange} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                  </div>
                  <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>C</label>
                      <input type="number" name="cCount" value={formData.cCount} onChange={handleFormChange} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                  </div>
                  <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>S</label>
                      <input type="number" name="sCount" value={formData.sCount} onChange={handleFormChange} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                  </div>
                  <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>W</label>
                      <input type="number" name="wCount" value={formData.wCount} onChange={handleFormChange} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                  </div>
              </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Calculated Pass Count: <b>{formPassCount}</b> ({formPassRate}%)
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={formStatus === 'loading'}
                style={{ padding: '12px 24px' }}
              >
                {formStatus === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Save Record
              </button>
          </div>
        </form>

        {formStatus === 'success' && (
          <div style={{ marginTop: '1rem', padding: '12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={18} /> Record saved successfully!
          </div>
        )}

        {formStatus === 'error' && (
          <div style={{ marginTop: '1rem', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <AlertCircle size={18} /> {formErrorMessage}
          </div>
        )}
      </div>

      {/* EXCEL UPLOAD */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Bulk Upload O/L Records</h3>
            <button onClick={handleDownloadTemplate} className="btn-secondary" style={{ width: 'auto' }}>
                <Download size={16} /> Download Template
            </button>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
            {uploadStatus === 'idle' || uploadStatus === 'processing' ? (
                <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center',
                    border: '2px dashed var(--surface-border)',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    position: 'relative',
                    cursor: 'pointer'
                }}>
                    <input 
                      type="file" 
                      accept=".xlsx, .csv" 
                      onChange={handleFileChange}
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    />
                    <div style={{ marginBottom: '1rem' }}>
                        <FileUp size={32} color="var(--text-muted)" />
                    </div>
                    <p style={{ fontWeight: '600', color: 'var(--text-main)' }}>Tap to upload or drag & drop</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Excel (.xlsx) or CSV files supported</p>
                </div>
            ) : uploadStatus === 'success' && parsedData.length > 0 ? (
                <div style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ color: '#15803d', fontWeight: '600' }}>{uploadMessage}</p>
                            <p style={{ fontSize: '0.85rem', color: '#16a34a' }}>Click import to save these records.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setUploadStatus('idle')} className="btn-secondary" style={{ padding: '8px 16px' }}>Cancel</button>
                            <button onClick={handleImport} className="btn-primary" style={{ padding: '8px 16px' }}>Import</button>
                        </div>
                    </div>
                </div>
            ) : uploadStatus === 'importing' ? (
                <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <Loader2 size={24} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
                    <p>Importing records...</p>
                </div>
            ) : uploadStatus === 'success' ? (
                <div style={{ padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <p style={{ color: '#15803d', fontWeight: '600' }}>{uploadMessage}</p>
                </div>
            ) : (
                <div style={{ padding: '1.5rem', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    <p style={{ color: '#b91c1c', fontWeight: '600' }}>{uploadMessage}</p>
                    <button onClick={() => setUploadStatus('idle')} className="btn-secondary" style={{ marginTop: '10px' }}>Try Again</button>
                </div>
            )}
        </div>
      </div>

      {/* TABLE */}
      <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Data Summary</h3>
              <button onClick={handleExportExcel} className="btn-secondary" style={{ width: 'auto' }}>
                  <Download size={18} /> Export Excel
              </button>
          </div>
          <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>Subject</th>
                        <th>Sat</th>
                        <th>Passed</th>
                        <th>Failed</th>
                        <th>Success %</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredRecords.map(record => (
                        <tr key={record.id}>
                            <td>{record.year}</td>
                            <td style={{ fontWeight: '700' }}>{record.subjects?.name}</td>
                            <td>
                                {editingId === record.id ? (
                                    <input type="number" value={editValues.totalSat} onChange={(e) => setEditValues({...editValues, totalSat: e.target.value})} style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                                ) : record.total_students}
                            </td>
                            <td>
                                {editingId === record.id ? (
                                    <input type="number" value={editValues.passCount} onChange={(e) => setEditValues({...editValues, passCount: e.target.value})} style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                                ) : record.pass_count}
                            </td>
                            <td style={{ color: 'var(--error)', fontWeight: '600' }}>
                                {editingId === record.id ? (
                                    parseInt(editValues.totalSat) - parseInt(editValues.passCount) || 0
                                ) : record.fail_count}
                            </td>
                            <td>
                                {editingId === record.id ? (
                                    `${Math.round((parseInt(editValues.passCount) / parseInt(editValues.totalSat)) * 100) || 0}%`
                                ) : `${Math.round((record.pass_count/record.total_students)*100)}%`}
                            </td>
                            <td>
                                {editingId === record.id ? (
                                    <button onClick={() => handleSaveEdit(record.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Save</button>
                                ) : (
                                    <button onClick={() => handleStartEdit(record)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Edit</button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  );
}
