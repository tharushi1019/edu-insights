'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, GraduationCap, Loader2, Award, TrendingUp, Save, CheckCircle2, AlertCircle, Printer, Image as ImageIcon, Plus, FileUp, Download, PlusCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Line, Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
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
import { useLanguage } from '@/context/LanguageContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function ALDashboard() {
  const { language, t } = useLanguage();
  const lineChartRef = useRef<any>(null);
  const barChartRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Form State
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
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ totalSat: '', passCount: '' });

  // Excel Upload State
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'importing'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);

  const passCount = (parseInt(formData.aCount) || 0) + (parseInt(formData.bCount) || 0) + (parseInt(formData.cCount) || 0) + (parseInt(formData.sCount) || 0);
  const passRate = formData.totalSat ? Math.round((passCount / parseInt(formData.totalSat)) * 100) : 0;

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            window.location.href = '/login';
            return;
        }

        // Fetch records for A/L subjects
        // We assume A/L subjects have "(A/L)" in their name or we just load all and let user filter.
        // For now, let's load all records and filter in memory or show all.
        const { data, error } = await supabase
          .from('exam_records')
          .select(`
              id, year, total_students, pass_count, fail_count, subject_id,
              a_count, b_count, c_count, s_count, w_count, term,
              subjects (name)
          `)
          .eq('user_id', user.id)
          .order('year', { ascending: true });
        
        if (error) throw error;

        // Filter for A/L subjects (heuristic: contains "A/L" or is one of the common A/L subjects)
        const alRecords = data?.filter(r => 
            r.subjects?.[0]?.name.includes('A/L') || 
            ['Combined Maths', 'Biology', 'Physics', 'Chemistry', 'Accounting', 'Economics', 'Business Studies'].includes(r.subjects?.[0]?.name)
        ) || [];

        setRecords(alRecords);
        
        const years = [...new Set(alRecords.map(r => r.year))].sort((a, b) => b - a);
        setAvailableYears(years);
        if (years.length > 0 && !selectedYear) {
            setSelectedYear(years[0]);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredRecords = records.filter(r => !selectedYear || r.year === selectedYear);

  const stats = {
    totalStudents: filteredRecords.reduce((acc, r) => acc + (r.total_students || 0), 0),
    passCount: filteredRecords.reduce((acc, r) => acc + (r.pass_count || 0), 0),
    failCount: filteredRecords.reduce((acc, r) => acc + (r.fail_count || 0), 0),
  };

  const overallPassRate = stats.totalStudents > 0 ? Math.round((stats.passCount / stats.totalStudents) * 100) : 0;

  // Chart Data
  const years = [...new Set(records.map(r => r.year))].sort();
  const trendData = years.map(y => {
      const yearRecs = records.filter(r => r.year === y);
      const total = yearRecs.reduce((acc, r) => acc + r.total_students, 0);
      const pass = yearRecs.reduce((acc, r) => acc + r.pass_count, 0);
      return total > 0 ? Math.round((pass / total) * 100) : 0;
  });

  const subNames = [...new Set(filteredRecords.map(r => r.subjects?.[0]?.name))];
  const subAData = subNames.map(name => filteredRecords.find(r => r.subjects?.[0]?.name === name)?.a_count || 0);
  const subBData = subNames.map(name => filteredRecords.find(r => r.subjects?.name === name)?.b_count || 0);
  const subCData = subNames.map(name => filteredRecords.find(r => r.subjects?.name === name)?.c_count || 0);
  const subSData = subNames.map(name => filteredRecords.find(r => r.subjects?.name === name)?.s_count || 0);
  const subWData = subNames.map(name => filteredRecords.find(r => r.subjects?.name === name)?.w_count || 0);

  const chartData = {
    trendLine: {
      labels: years,
      datasets: [
        {
          label: 'Pass Rate %',
          data: trendData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    },
    subjectBar: {
      labels: subNames,
      datasets: [
        { label: 'A', data: subAData, backgroundColor: '#059669', borderRadius: 6 },
        { label: 'B', data: subBData, backgroundColor: '#10b981', borderRadius: 6 },
        { label: 'C', data: subCData, backgroundColor: '#3b82f6', borderRadius: 6 },
        { label: 'S', data: subSData, backgroundColor: '#f59e0b', borderRadius: 6 },
        { label: 'W', data: subWData, backgroundColor: '#ef4444', borderRadius: 6 },
      ]
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

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

      setStatus('success');
      setFormData({ year: new Date().getFullYear(), subject: '', customSubject: '', totalSat: '', aCount: '', bCount: '', cCount: '', sCount: '', wCount: '' });
      setIsCustomSubject(false);
      
      // Refresh data
      window.location.reload();
      
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Error saving record');
    }
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

          setEditingId(null);
          window.location.reload();
      } catch (err: any) {
          console.error(err);
          alert('Error updating record');
      }
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      
      const schoolTitle = 'EduInsights Advanced Level Report';
      
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text(schoolTitle, 14, 22);
      
      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139);
      doc.text(`G.C.E. A/L Performance Summary - Year: ${selectedYear || 'All Years'}`, 14, 30);
      
      doc.setFontSize(10);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 36);
      
      const tableData = filteredRecords.map(r => {
        const rate = Math.round((r.pass_count / r.total_students) * 100);
        return [
          r.year.toString(),
          r.subjects?.[0]?.name || r.subjects?.name || 'N/A',
          r.total_students.toString(),
          r.pass_count.toString(),
          r.a_count?.toString() || '0',
          r.b_count?.toString() || '0',
          r.c_count?.toString() || '0',
          r.s_count?.toString() || '0',
          r.w_count?.toString() || '0',
          `${rate}%`
        ];
      });
      
      autoTable(doc, {
        startY: 42,
        head: [['Year', 'Subject', 'Total Sat', 'Passed', 'A', 'B', 'C', 'S', 'W', 'Pass Rate']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });
      
      doc.save(`GCE-AL-Performance-Report-${selectedYear || 'All'}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { Year: 2026, Subject: 'Combined Maths (A/L)', Total: 50, A: 5, B: 10, C: 15, S: 15, W: 5 },
      { Year: 2026, Subject: 'Physics (A/L)', Total: 48, A: 3, B: 8, C: 12, S: 20, W: 5 },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AL Template");
    XLSX.writeFile(wb, "AL_Template.xlsx");
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

  if (loading) {
      return <div className="card loading-shimmer" style={{ height: '400px' }}></div>;
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                <GraduationCap size={20} />
                <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Exam Module</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
              G.C.E. A/L Performance
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              Analytics and records for Advanced Level examinations.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
              <button onClick={handleExportPDF} className="btn-secondary" style={{ flex: 1 }}>
                  <Printer size={18} /> Report
              </button>
              <a href="#add-record-form" className="btn-primary" style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <PlusCircle size={20} /> New Record
              </a>
          </div>
        </div>
      </header>

      {/* FILTERS */}
      <div className="sticky-command-bar" style={{ marginBottom: '2rem' }}>
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
      </div>

      {/* STATS */}
      <div className="stats-grid" style={{ marginBottom: '2.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Total Students Sat</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--primary-light)' }}>
              <Users size={18} color="var(--primary)" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{stats.totalStudents.toLocaleString()}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Total Passed</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--success-light)' }}>
              <Award size={18} color="var(--success)" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{stats.passCount.toLocaleString()}</div>
        </div>

        <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Overall Pass Rate</span>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--warning-light)' }}>
              <TrendingUp size={18} color="var(--accent)" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{overallPassRate}%</div>
        </div>
      </div>

      {/* CHARTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Yearly Trend</h3>
          <div style={{ height: '250px' }}>
            <Line 
              ref={lineChartRef}
              data={chartData.trendLine} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: { min: 0, max: 100, ticks: { font: { size: 10 } } },
                  x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                }
              }}
            />
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Subject Performance (Grade Breakdown)</h3>
          <div style={{ height: '250px' }}>
            <Bar 
              ref={barChartRef}
              data={chartData.subjectBar}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, font: { size: 10 } } } },
                scales: {
                  x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
                  y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 } } }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* DATA ENTRY FORM */}
      <div id="add-record-form" className="card" style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Add A/L Record</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Year</label>
              <input type="number" name="year" value={formData.year} onChange={handleFormChange} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Subject</label>
              <select name="subject" value={formData.subject} onChange={handleFormChange} required style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', backgroundColor: 'white' }}>
                <option value="">Select Subject</option>
                <optgroup label="Common Compulsory Papers">
                    <option value="General English (A/L)">General English</option>
                    <option value="Common General Test (A/L)">Common General Test</option>
                </optgroup>
                <optgroup label="Physical Science (Maths)">
                    <option value="Combined Mathematics (A/L)">Combined Mathematics</option>
                    <option value="Physics (A/L)">Physics</option>
                    <option value="Chemistry (A/L)">Chemistry</option>
                    <option value="Information & Communication Technology (ICT) (A/L)">Information & Communication Technology (ICT)</option>
                </optgroup>
                <optgroup label="Biological Science">
                    <option value="Biology (A/L)">Biology</option>
                    <option value="Chemistry (A/L)">Chemistry</option>
                    <option value="Physics (A/L)">Physics</option>
                    <option value="Agricultural Science (A/L)">Agricultural Science</option>
                </optgroup>
                <optgroup label="Commerce">
                    <option value="Accounting (A/L)">Accounting</option>
                    <option value="Business Studies (A/L)">Business Studies</option>
                    <option value="Economics (A/L)">Economics</option>
                    <option value="Business Statistics (A/L)">Business Statistics</option>
                    <option value="Information & Communication Technology (ICT) (A/L)">Information & Communication Technology (ICT)</option>
                </optgroup>
                <optgroup label="Technology">
                    <option value="Engineering Technology (A/L)">Engineering Technology</option>
                    <option value="Bio Systems Technology (A/L)">Bio Systems Technology</option>
                    <option value="Science for Technology (A/L)">Science for Technology</option>
                    <option value="Information & Communication Technology (ICT) (A/L)">Information & Communication Technology (ICT)</option>
                </optgroup>
                <optgroup label="Arts: Social Sciences">
                    <option value="Geography (A/L)">Geography</option>
                    <option value="Political Science (A/L)">Political Science</option>
                    <option value="Economics (A/L)">Economics</option>
                    <option value="History (A/L)">History</option>
                    <option value="Logic & Scientific Method (A/L)">Logic & Scientific Method</option>
                    <option value="Media & Communication Studies (A/L)">Media & Communication Studies</option>
                </optgroup>
                <optgroup label="Arts: Languages & Literature">
                    <option value="Sinhala (A/L)">Sinhala</option>
                    <option value="Tamil (A/L)">Tamil</option>
                    <option value="English (A/L)">English</option>
                    <option value="French (A/L)">French</option>
                    <option value="Japanese (A/L)">Japanese</option>
                    <option value="Chinese (A/L)">Chinese</option>
                    <option value="Arabic (A/L)">Arabic</option>
                    <option value="Pali (A/L)">Pali</option>
                    <option value="Sanskrit (A/L)">Sanskrit</option>
                </optgroup>
                <optgroup label="Arts: Aesthetics & Others">
                    <option value="Art (A/L)">Art</option>
                    <option value="Dancing (A/L)">Dancing</option>
                    <option value="Music (A/L)">Music</option>
                    <option value="Drama & Theatre (A/L)">Drama & Theatre</option>
                    <option value="Home Economics (A/L)">Home Economics</option>
                    <option value="Agricultural Science (A/L)">Agricultural Science</option>
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
                  Calculated Pass Count: <b>{passCount}</b> ({passRate}%)
              </div>
              <button 
                type="submit" 
                className="btn-primary" 
                disabled={status === 'loading'}
                style={{ padding: '12px 24px' }}
              >
                {status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                Save Record
              </button>
          </div>
        </form>

        {status === 'success' && (
          <div style={{ marginTop: '1rem', padding: '12px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <CheckCircle2 size={18} /> Record saved successfully!
          </div>
        )}

        {status === 'error' && (
          <div style={{ marginTop: '1rem', padding: '12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <AlertCircle size={18} /> {errorMessage}
          </div>
        )}
      </div>

      {/* EXCEL UPLOAD */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Bulk Upload A/L Records</h3>
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

      {/* DATA TABLE */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Historical Records</h3>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>YEAR</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>SUBJECT</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>TOTAL SAT</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>PASSED</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>A</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>B</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>C</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>S</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>W</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>PASS RATE</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredRecords.map(r => {
                        const rate = Math.round((r.pass_count / r.total_students) * 100);
                        return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: '600' }}>{r.year}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem' }}>{r.subjects?.[0]?.name}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                    {editingId === r.id ? (
                                        <input type="number" value={editValues.totalSat} onChange={(e) => setEditValues({...editValues, totalSat: e.target.value})} style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                                    ) : r.total_students}
                                </td>
                                <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                    {editingId === r.id ? (
                                        <input type="number" value={editValues.passCount} onChange={(e) => setEditValues({...editValues, passCount: e.target.value})} style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                                    ) : r.pass_count}
                                </td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', color: '#059669', fontWeight: '600' }}>{r.a_count}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', color: '#10b981' }}>{r.b_count}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', color: '#3b82f6' }}>{r.c_count}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', color: '#f59e0b' }}>{r.s_count}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', color: '#ef4444' }}>{r.w_count}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: '700' }}>
                                    {editingId === r.id ? (
                                        `${Math.round((parseInt(editValues.passCount) / parseInt(editValues.totalSat)) * 100) || 0}%`
                                    ) : `${rate}%`}
                                </td>
                                <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                    {editingId === r.id ? (
                                        <button onClick={() => handleSaveEdit(r.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Save</button>
                                    ) : (
                                        <button onClick={() => handleStartEdit(r)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Edit</button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {filteredRecords.length === 0 && (
                        <tr>
                            <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found. Add your first record above.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
