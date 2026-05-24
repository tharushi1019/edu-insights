'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, GraduationCap, Loader2, Award, TrendingUp, Save, CheckCircle2, AlertCircle, Printer, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
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

export default function ScholarshipDashboard() {
  const { language } = useLanguage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineChartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const donutChartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const barChartRef = useRef<any>(null);
  
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [records, setRecords] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);


  // Form State
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    totalSat: '',
    passCount: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ totalSat: '', passCount: '' });



  const subjectName = language === 'si' ? '5 ශ්‍රේණිය ශිෂ්‍යත්වය' : 'Grade 5 Scholarship';

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            window.location.href = '/login';
            return;
        }

        // Fetch subjects first to find the ID for 'Grade 5 Scholarship'
        const { data: subjects } = await supabase
          .from('subjects')
          .select('id, name')
          .or(`name.eq.Grade 5 Scholarship,name.eq.5 ශ්‍රේණිය ශිෂ්‍යත්වය`);

        const subjectIds = subjects?.map(s => s.id) || [];

        if (subjectIds.length > 0) {
            const { data, error } = await supabase
              .from('exam_records')
              .select(`
                  id, year, total_students, pass_count, fail_count, subject_id, exam_type
              `)
              .eq('user_id', user.id)
              .eq('exam_type', 'SCHOLARSHIP')
              .in('subject_id', subjectIds)
              .order('year', { ascending: true });
            
            if (error) throw error;
            setRecords(data || []);
            
            const years = [...new Set((data || []).map(r => r.year))].sort((a, b) => b - a);
            setAvailableYears(years);
            if (years.length > 0) {
                setSelectedYear(years[0]);
            }
        } else {
            setRecords([]);
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

  const stats = filteredRecords.length > 0 ? {
    totalStudents: filteredRecords.reduce((acc, r) => acc + (r.total_students || 0), 0),
    passCount: filteredRecords.reduce((acc, r) => acc + (r.pass_count || 0), 0),
    failCount: filteredRecords.reduce((acc, r) => acc + (r.fail_count || 0), 0),
  } : { totalStudents: 0, passCount: 0, failCount: 0 };

  const chartData = records.length > 0 ? {
    trendLine: {
      labels: records.map(r => r.year),
      datasets: [
        {
          label: 'Pass Rate %',
          data: records.map(r => Math.round((r.pass_count / r.total_students) * 100)),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    },
    overallDonut: {
      labels: ['Passed', 'Failed'],
      datasets: [{
        data: [stats.passCount, stats.failCount],
        backgroundColor: ['#10b981', '#f43f5e'],
        hoverOffset: 15,
        borderWidth: 0,
        cutout: '75%'
      }]
    },
    scholarshipBar: {
      labels: filteredRecords.map(r => r.year),
      datasets: [
        { label: 'Sitted Students', data: filteredRecords.map(r => r.total_students), backgroundColor: '#94a3b8', borderRadius: 4 },
        { label: 'Passed Students', data: filteredRecords.map(r => r.pass_count), backgroundColor: '#f59e0b', borderRadius: 4 }
      ]
    }
  } : {
    trendLine: { labels: [], datasets: [] },
    overallDonut: { labels: [], datasets: [] },
    scholarshipBar: { labels: [], datasets: [] }
  };

  const overallPassRate = (stats.passCount + stats.failCount) > 0 
    ? Math.round((stats.passCount / (stats.passCount + stats.failCount)) * 100)
    : 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloadChart = (ref: any, title: string) => {
    const chart = ref.current;
    if (!chart) return;

    const link = document.createElement('a');
    link.download = `${title}-${new Date().toLocaleDateString()}.png`;
    link.href = chart.toBase64Image();
    link.click();
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // --- 1. COVER PAGE ---
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    doc.setFillColor(30, 41, 59);
    doc.triangle(pageWidth, 0, pageWidth, 100, pageWidth - 100, 0, 'F');
    doc.setFillColor(37, 99, 235, 0.1);
    doc.circle(0, pageHeight, 120, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text("EDUINSIGHTS PRO", pageWidth / 2, 130, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Grade 5 Scholarship Analysis", pageWidth / 2, 142, { align: 'center' });

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(pageWidth/2 - 30, 155, pageWidth/2 + 30, 155);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, 175, { align: 'center' });

    // --- 2. DETAILS PAGE ---
    doc.addPage();
    
    // Header Strip
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("SCHOLARSHIP PERFORMANCE SUMMARY", 15, 20);

    // Summary KPIs
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("OVERALL STATISTICS", 15, 45);

    const kpiY = 50;
    const kpiW = (pageWidth - 40) / 3;
    const kpiH = 20;

    const kpis = [
        { label: "TOTAL SAT", val: stats.totalStudents, color: [37, 99, 235] },
        { label: "PASSED", val: stats.passCount, color: [16, 185, 129] },
        { label: "PASS RATE", val: `${overallPassRate}%`, color: [245, 158, 11] }
    ];

    kpis.forEach((k, i) => {
        const x = 15 + (i * (kpiW + 5));
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'FD');
        doc.setDrawColor(k.color[0], k.color[1], k.color[2]);
        doc.line(x, kpiY, x, kpiY + kpiH);
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + kpiW/2, kpiY + 6, { align: 'center' });
        doc.setFontSize(12);
        doc.setTextColor(k.color[0], k.color[1], k.color[2]);
        doc.text(k.val.toString(), x + kpiW/2, kpiY + 14, { align: 'center' });
    });

    let currentY = kpiY + kpiH + 15;

    // Yearly Trend Chart
    const trendCanvas = lineChartRef.current?.canvas;
    if (trendCanvas) {
        const trendImg = lineChartRef.current.toBase64Image('image/png', 1.0);
        const props = doc.getImageProperties(trendImg);
        const w = pageWidth - 30;
        const h = (props.height * w) / props.width;

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text("YEARLY PERFORMANCE TREND", 15, currentY);
        doc.addImage(trendImg, 'PNG', 15, currentY + 5, w, h, undefined, 'FAST');
        currentY += h + 20;
    }

    // Bar Chart
    const barCanvas = barChartRef.current?.canvas;
    if (barCanvas && currentY + 60 < pageHeight) {
        const barImg = barChartRef.current.toBase64Image('image/png', 1.0);
        const props = doc.getImageProperties(barImg);
        const w = pageWidth - 30;
        const h = (props.height * w) / props.width;

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text("YEARLY PARTICIPATION & SUCCESS", 15, currentY);
        doc.addImage(barImg, 'PNG', 15, currentY + 5, w, h, undefined, 'FAST');
        currentY += h + 20;
    }

    // Historical Table
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text("HISTORICAL RECORDS", 15, currentY);
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [['YEAR', 'TOTAL SAT', 'PASSED', 'FAILED', 'PASS RATE']],
      body: records.map(r => [
          r.year, r.total_students, r.pass_count, r.fail_count, `${Math.round((r.pass_count/r.total_students)*100)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], halign: 'center' },
      styles: { fontSize: 8 },
      columnStyles: { 4: { halign: 'center', fontStyle: 'bold' } }
    });

    // Donut Chart
    const donutCanvas = donutChartRef.current?.canvas;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable.finalY || currentY + 40;
    
    if (donutCanvas && finalY + 60 < pageHeight) {
        const donutImg = donutChartRef.current.toBase64Image('image/png', 1.0);
        const props = doc.getImageProperties(donutImg);
        const w = 80;
        const h = (props.height * w) / props.width;

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text("OVERALL DISTRIBUTION", 15, finalY + 10);
        doc.addImage(donutImg, 'PNG', pageWidth/2 - w/2, finalY + 15, w, h, undefined, 'FAST');
    }

    doc.save(`Scholarship-Analysis-${new Date().toLocaleDateString()}.pdf`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          
          // Refresh data
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
              const { data: subjects } = await supabase
                .from('subjects')
                .select('id, name')
                .or(`name.eq.Grade 5 Scholarship,name.eq.5 ශ්‍රේණිය ශිෂ්‍යත්වය`);

              const subjectIds = subjects?.map(s => s.id) || [];

              if (subjectIds.length > 0) {
                  const { data } = await supabase
                    .from('exam_records')
                    .select(`id, year, total_students, pass_count, fail_count, subject_id, exam_type`)
                    .eq('user_id', user.id)
                    .eq('exam_type', 'SCHOLARSHIP')
                    .in('subject_id', subjectIds)
                    .order('year', { ascending: true });
                  
                  setRecords(data || []);
              }
          }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
          console.error(err);
          alert('Error updating record');
      }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in first');

      // 1. Get or create subject
      const { data: subData } = await supabase
        .from('subjects')
        .select('id')
        .eq('name', subjectName)
        .single();
      
      let subjectId = subData?.id;

      if (!subjectId) {
        const { data: newSub, error: newSubError } = await supabase
          .from('subjects')
          .insert({ name: subjectName })
          .select('id')
          .single();
        if (newSubError) throw newSubError;
        subjectId = newSub.id;
      }

      // 2. Check for existing record
      const { data: existing } = await supabase
        .from('exam_records')
        .select('id')
        .eq('user_id', user.id)
        .eq('year', parseInt(formData.year.toString()))
        .eq('subject_id', subjectId);
      
      if (existing && existing.length > 0) {
        throw new Error(`A record for ${formData.year} already exists.`);
      }

      // 3. Insert
      const { error } = await supabase
        .from('exam_records')
        .insert({
          user_id: user.id,
          year: parseInt(formData.year.toString()),
          subject_id: subjectId,
          total_students: parseInt(formData.totalSat),
          pass_count: parseInt(formData.passCount),
          fail_count: parseInt(formData.totalSat) - parseInt(formData.passCount),
          exam_type: 'SCHOLARSHIP'
        });

      if (error) throw error;

      setStatus('success');
      setFormData({ year: new Date().getFullYear(), totalSat: '', passCount: '' });
      
      // Refresh data
      const { data: updatedData } = await supabase
        .from('exam_records')
        .select(`id, year, total_students, pass_count, fail_count, subject_id, exam_type`)
        .eq('user_id', user.id)
        .eq('exam_type', 'SCHOLARSHIP')
        .eq('subject_id', subjectId)
        .order('year', { ascending: true });
      
      setRecords(updatedData || []);
      
      setTimeout(() => setStatus('idle'), 3000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Error saving record');
    }
  };

  if (loading) {
      return <div className="card loading-shimmer" style={{ height: '400px' }}></div>;
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
              <GraduationCap size={20} />
              <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Special Feature</span>
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
            {language === 'si' ? '5 ශ්‍රේණිය ශිෂ්‍යත්වය' : 'Grade 5 Scholarship'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            Performance analysis for the Grade 5 Scholarship Examination.
          </p>
        </div>
        <div>
          <button onClick={handleExportPDF} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} /> Report
          </button>
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
            <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Passed Cutoff</span>
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

      {/* Top Row: Bar and Donut */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {/* Bar Chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Yearly Participation & Success</h3>
            <button onClick={() => downloadChart(barChartRef, 'Scholarship-Bar')} className="btn-secondary" style={{ padding: '6px', width: 'auto' }}>
                <ImageIcon size={16} />
            </button>
          </div>
          <div style={{ height: '250px' }}>
            {records.length > 0 ? (
                <Bar 
                  ref={barChartRef}
                  data={chartData.scholarshipBar} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true } },
                    scales: {
                      y: { beginAtZero: true },
                      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                    }
                  }}
                />
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data available</div>
            )}
          </div>
        </div>

        {/* Donut Chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Overall Distribution</h3>
            <button onClick={() => downloadChart(donutChartRef, 'Scholarship-Distribution')} className="btn-secondary" style={{ padding: '6px', width: 'auto' }}>
                <ImageIcon size={16} />
            </button>
          </div>
          <div style={{ height: '250px', position: 'relative' }}>
            {records.length > 0 ? (
              <>
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
                    <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--text-main)' }}>{overallPassRate}%</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Success</div>
                </div>
              </>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Full width Line Chart */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Yearly Trend</h3>
            <button onClick={() => downloadChart(lineChartRef, 'Scholarship-Trend')} className="btn-secondary" style={{ padding: '6px', width: 'auto' }}>
                <ImageIcon size={16} />
            </button>
          </div>
          <div style={{ height: '250px' }}>
            {records.length > 0 ? (
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
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* DATA ENTRY FORM */}
      <div className="card" style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Add Scholarship Record</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Year</label>
            <input 
              type="number" 
              name="year"
              value={formData.year}
              onChange={handleFormChange}
              required
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Total Students</label>
            <input 
              type="number" 
              name="totalSat"
              value={formData.totalSat}
              onChange={handleFormChange}
              required
              placeholder="Total sat"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Passed Cutoff</label>
            <input 
              type="number" 
              name="passCount"
              value={formData.passCount}
              onChange={handleFormChange}
              required
              placeholder="Passed count"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
            />
          </div>
          <div>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={status === 'loading'}
              style={{ width: '100%', padding: '12px' }}
            >
              {status === 'loading' ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              Save
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

      {/* DATA TABLE */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Historical Records</h3>
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>YEAR</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>TOTAL SAT</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>PASSED</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>FAILED</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>PASS RATE</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map(r => {
                        const rate = Math.round((r.pass_count / r.total_students) * 100);
                        return (
                            <tr key={r.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px', fontSize: '0.9rem', fontWeight: '600' }}>{r.year}</td>
                                <td style={{ padding: '12px', fontSize: '0.9rem' }}>
                                    {editingId === r.id ? (
                                        <input type="number" value={editValues.totalSat} onChange={(e) => setEditValues({...editValues, totalSat: e.target.value})} style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                                    ) : r.total_students}
                                </td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--success)', fontWeight: '600' }}>
                                    {editingId === r.id ? (
                                        <input type="number" value={editValues.passCount} onChange={(e) => setEditValues({...editValues, passCount: e.target.value})} style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }} />
                                    ) : r.pass_count}
                                </td>
                                <td style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--error)' }}>
                                    {editingId === r.id ? (
                                        parseInt(editValues.totalSat) - parseInt(editValues.passCount) || 0
                                    ) : r.fail_count}
                                </td>
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
                    {records.length === 0 && (
                        <tr>
                            <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found. Add your first record above.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}
