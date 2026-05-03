'use client';

import { useState, useEffect, useRef } from 'react';
import { Users, GraduationCap, MinusCircle, BookOpen, PlusCircle, Loader2, Download, Printer, Image as ImageIcon, ChevronRight, TrendingUp, Award, AlertCircle, Building2 } from 'lucide-react';
import Link from 'next/link';
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
import * as XLSX from 'xlsx';
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

export default function Dashboard() {
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
      subjectBar: { labels: [], datasets: [] },
      trendLine: { labels: [], datasets: [] },
      overallDonut: { labels: [], datasets: [] },
      subjectBreakdown: {} // Restored for PDF reports
  });

  // Filtering Logic
  const filteredRecords = records.filter(r => {
    const yearMatch = !selectedYear || r.year === selectedYear;
    const subjectMatch = selectedSubject === 'All Subjects' || r.subjects?.name === selectedSubject;
    return yearMatch && subjectMatch;
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
              id, year, total_students, pass_count, fail_count, subject_id,
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
    // If a subject is selected, show its trend. If "All", show average trend.
    const years = [...new Set(records.map(r => r.year))].sort();
    const passTrend = years.map(y => {
      const yearRecs = records.filter(r => r.year === y && (selectedSubject === 'All Subjects' || r.subjects?.name === selectedSubject));
      const total = yearRecs.reduce((acc, r) => acc + r.total_students, 0);
      const pass = yearRecs.reduce((acc, r) => acc + r.pass_count, 0);
      return total > 0 ? Math.round((pass / total) * 100) : 0;
    });

    const failTrend = passTrend.map(p => p > 0 ? 100 - p : 0);

    // --- 3. Chart: Subject Comparison (Grouped Bar) ---
    const yearRecords = records.filter(r => 
        r.year === (selectedYear || records[0]?.year) &&
        (selectedSubject === 'All Subjects' || r.subjects?.name === selectedSubject)
    );
    const subNames = [...new Set(yearRecords.map(r => r.subjects?.name))];
    const subPassData = subNames.map(name => yearRecords.find(r => r.subjects?.name === name)?.pass_count || 0);
    const subFailData = subNames.map(name => yearRecords.find(r => r.subjects?.name === name)?.fail_count || 0);

    // --- 4. Subject Breakdown for PDF Visual Insights ---
    const subjectStats: any = {};
    const yrRecs = records.filter(r => 
        r.year === (selectedYear || records[0]?.year) &&
        (selectedSubject === 'All Subjects' || r.subjects?.name === selectedSubject)
    );
    yrRecs.forEach(r => {
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
      subjectBar: {
        labels: subNames,
        datasets: [
          {
            label: 'Passed',
            data: subPassData,
            backgroundColor: '#10b981',
            borderRadius: 6
          },
          {
            label: 'Failed',
            data: subFailData,
            backgroundColor: '#f43f5e',
            borderRadius: 6
          }
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

    // Auto-scroll to charts when filtering to ensure user sees updated data
    if (selectedYear || selectedSubject) {
        const topOfCharts = document.getElementById('charts-start');
        if (topOfCharts) {
            topOfCharts.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
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

  const handleExportPDF = async () => {
    if (!schoolName.trim()) {
        alert("Please enter your School Name before generating the report.");
        return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    // --- 1. COVER PAGE ---
    // Background Design
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Abstract shapes for "Pro" feel
    doc.setFillColor(30, 41, 59);
    doc.triangle(pageWidth, 0, pageWidth, 100, pageWidth - 100, 0, 'F');
    doc.setFillColor(37, 99, 235, 0.1);
    doc.circle(0, pageHeight, 120, 'F');

    // Branding
    try {
        const logoPath = 'file:///C:/Users/priya/.gemini/antigravity/brain/80defd8e-5c73-4a38-a1b4-f4abfe354f66/edu_insights_logo_1777772420168.png';
        doc.addImage(logoPath, 'PNG', pageWidth/2 - 25, 60, 50, 50);
    } catch(e) { console.warn("Logo failed to load for PDF"); }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text("EDUINSIGHTS PRO", pageWidth / 2, 130, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Academic Intelligence & Strategic Analysis", pageWidth / 2, 142, { align: 'center' });

    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(1);
    doc.line(pageWidth/2 - 30, 155, pageWidth/2 + 30, 155);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(schoolName.toUpperCase(), pageWidth / 2, 175, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`REPORTING PERIOD: ${selectedYear}`, pageWidth / 2, 188, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, pageWidth / 2, 270, { align: 'center' });

    // --- 2. EXECUTIVE SUMMARY & TRENDS ---
    doc.addPage();
    
    // Header Strip
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("EXECUTIVE DASHBOARD SNAPSHOT", 15, 25);
    doc.setFontSize(10);
    doc.text(schoolName, pageWidth - 15, 25, { align: 'right' });

    // Summary KPIs
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("STRATEGIC KPI SUMMARY", 15, 55);

    const kpiY = 65;
    const kpiW = (pageWidth - 45) / 4;
    const kpiH = 25;

    const kpis = [
        { label: "TOTAL SAT", val: stats.totalStudents, color: [37, 99, 235] },
        { label: "PASSED", val: stats.passCount, color: [16, 185, 129] },
        { label: "FAILED", val: stats.failCount, color: [244, 63, 94] },
        { label: "PASS RATE", val: `${passRate}%`, color: [245, 158, 11] }
    ];

    kpis.forEach((k, i) => {
        const x = 15 + (i * (kpiW + 5));
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, kpiY, kpiW, kpiH, 2, 2, 'FD');
        doc.setDrawColor(k.color[0], k.color[1], k.color[2]);
        doc.line(x, kpiY, x, kpiY + kpiH); // Left border color
        
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(k.label, x + kpiW/2, kpiY + 8, { align: 'center' });
        doc.setFontSize(14);
        doc.setTextColor(k.color[0], k.color[1], k.color[2]);
        doc.text(k.val.toString(), x + kpiW/2, kpiY + 18, { align: 'center' });
    });

    // Yearly Trend Chart
    const trendCanvas = lineChartRef.current?.canvas;
    let tableStartY = 220;
    if (trendCanvas) {
        const trendImg = lineChartRef.current.toBase64Image('image/png', 1.0);
        const props = doc.getImageProperties(trendImg);
        const w = pageWidth - 30;
        const h = (props.height * w) / props.width;

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text("HISTORICAL PERFORMANCE TREND", 15, 110);
        doc.addImage(trendImg, 'PNG', 15, 115, w, h, undefined, 'FAST');
        tableStartY = 115 + h + 15;
    }

    // Tabular Drill-down
    doc.text("DETAILED SUBJECT ANALYSIS", 15, tableStartY);
    autoTable(doc, {
      startY: tableStartY + 5,
      head: [['SUBJECT', 'SAT', 'PASSED', 'FAILED', 'SUCCESS RATE']],
      body: filteredRecords.map(r => [
          r.subjects?.name.toUpperCase(), r.total_students, r.pass_count, r.fail_count, `${Math.round((r.pass_count/r.total_students)*100)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], halign: 'center' },
      styles: { fontSize: 8 },
      columnStyles: { 4: { halign: 'center', fontStyle: 'bold' } }
    });

    // --- 3. COMPARATIVE ANALYSIS ---
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("VISUAL COMPARATIVE ANALYTICS", 15, 16);

    const barCanvas = barChartRef.current?.canvas;
    let compY = 45;
    if (barCanvas) {
        const barImg = barChartRef.current.toBase64Image('image/png', 1.0);
        const props = doc.getImageProperties(barImg);
        const w = pageWidth - 30;
        const h = (props.height * w) / props.width;

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text("SUBJECT PERFORMANCE COMPARISON", 15, 40);
        doc.addImage(barImg, 'PNG', 15, compY, w, h, undefined, 'FAST');
        compY = compY + h + 20; // 20mm gap
    }

    const donutCanvas = donutChartRef.current?.canvas;
    if (donutCanvas) {
        const donutImg = donutChartRef.current.toBase64Image('image/png', 1.0);
        const props = doc.getImageProperties(donutImg);
        const w = 65; // Slightly smaller to ensure fit
        const h = (props.height * w) / props.width;
        
        // Ensure donut doesn't start too low
        if (compY > 180) {
            doc.addPage();
            compY = 30;
        }

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);
        doc.text("OVERALL PASS/FAIL DISTRIBUTION", 15, compY);
        doc.addImage(donutImg, 'PNG', pageWidth/2 - w/2, compY + 5, w, h, undefined, 'FAST');
        
        // Add text in middle of donut
        doc.setFontSize(20);
        doc.text(`${passRate}%`, pageWidth/2, compY + 5 + (h/2) + 2, { align: 'center' });
        doc.setFontSize(7);
        doc.text("SUCCESS", pageWidth/2, compY + 5 + (h/2) + 8, { align: 'center' });
    }

    // --- 4. VERIFICATION PAGE ---
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("OFFICIAL RECORD VERIFICATION", 15, 16);

    const sigY = 60;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, sigY, pageWidth - 30, 80, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, sigY, pageWidth - 30, 80, 2, 2, 'D');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("INSTITUTIONAL DATA CERTIFICATION", pageWidth/2, sigY + 12, { align: 'center' });
    
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    
    // Left: Principal
    doc.line(30, sigY + 55, 85, sigY + 55);
    doc.setFontSize(9);
    doc.text("PRINCIPAL / SECTIONAL HEAD", 57.5, sigY + 62, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Signature & Official Designation", 57.5, sigY + 68, { align: 'center' });
    
    // Right: Seal
    doc.line(pageWidth - 85, sigY + 55, pageWidth - 30, sigY + 55);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("OFFICIAL SCHOOL SEAL", pageWidth - 57.5, sigY + 62, { align: 'center' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Date & Stamp Area", pageWidth - 57.5, sigY + 68, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`This academic report was generated on ${new Date().toLocaleString()}`, 15, sigY + 100);
    doc.text(`Data Source: ${schoolName} Exam Records Management System`, 15, sigY + 108);
    doc.text("Validated for academic period based on user-selected criteria.", 15, sigY + 116);

    // Global Footer
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`EDUINSIGHTS PRO | ${schoolName} | PAGE ${i} OF ${totalPages}`, pageWidth/2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`${schoolName.replace(/\s+/g, '_')}_Snapshot_Report_${selectedYear}.pdf`);
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
    XLSX.utils.book_append_sheet(wb, ws, "Exam Results");
    XLSX.writeFile(wb, `EduInsights-Export-${selectedYear}.xlsx`);
  };

  const uniqueSubjectNames = [...new Set(records.map(r => r.subjects?.name || 'Unknown'))].sort();

  if (loading) {
      return (
          <div className="fade-in">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                  {[1, 2, 3, 4].map(i => (
                      <div key={i} className="card loading-shimmer" style={{ height: '120px' }}></div>
                  ))}
              </div>
              <div className="card loading-shimmer" style={{ height: '400px', marginBottom: '2.5rem' }}></div>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '2rem' }}>
                  <div className="card loading-shimmer" style={{ height: '350px' }}></div>
                  <div className="card loading-shimmer" style={{ height: '350px' }}></div>
              </div>
          </div>
      );
  }

  if (records.length === 0) {
      return (
        <div>
          <header style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>{t('overviewTitle')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>{t('overviewSubtitle')} {selectedYear}</p>
          </header>
          <div className="card fade-in" style={{ padding: '5rem 2rem', textAlign: 'center', backgroundColor: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ 
                width: '100px', 
                height: '100px', 
                borderRadius: '50%', 
                backgroundColor: 'var(--primary-light)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '2rem'
              }}>
                  <PlusCircle size={48} color="var(--primary)" />
              </div>
              <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.75rem', fontWeight: '800' }}>No Records Found</h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '500px', marginBottom: '2.5rem', lineHeight: '1.7', fontSize: '1.1rem' }}>
                  Your analytics dashboard is empty. Start by adding your first exam result manually or upload an Excel file.
              </p>
              <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <Link href="/dashboard/add" className="btn-primary" style={{ padding: '16px 32px' }}>
                      Add Manually
                  </Link>
                  <Link href="/dashboard/upload" className="btn-secondary" style={{ padding: '16px 32px' }}>
                      Upload Excel
                  </Link>
              </div>
          </div>
        </div>
      );
  }

  return (
    <div className="fade-in">
      {/* HEADER & BRANDING */}
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                <TrendingUp size={20} />
                <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>EduInsights Pro Analytics</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
              Academic Performance
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px' }}>
              Strategic insights for <b style={{ color: 'var(--primary)' }}>{schoolName}</b>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
              <button onClick={handleExportPDF} className="btn-secondary" style={{ flex: 1 }}>
                  <Printer size={18} /> Report
              </button>
              <Link href="/dashboard/add" className="btn-primary" style={{ flex: 1 }}>
                  <PlusCircle size={20} /> New Record
              </Link>
          </div>
        </div>

        {/* 1. COMMAND FILTERS (STICKY) */}
        <div className="sticky-command-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Academic Year</label>
                <select 
                    value={selectedYear || ''} 
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="select-premium"
                >
                    {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Filter Subject</label>
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

        {/* 2. TOP SUMMARY CARDS */}
        <div className="stats-grid" style={{ marginTop: '2rem' }}>
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

          <div className="card" style={{ borderLeft: '4px solid var(--error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Total Failed</span>
              <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--error-light)' }}>
                <MinusCircle size={18} color="var(--error)" />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{stats.failCount.toLocaleString()}</div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>Overall Pass Rate</span>
              <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--warning-light)' }}>
                <TrendingUp size={18} color="var(--accent)" />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)' }}>{passRate}%</div>
          </div>
        </div>
      </header>

      {/* 3. YEARLY PERFORMANCE TREND (Full Width Line Chart) */}
      <section id="charts-start" className="card" style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Yearly Performance Trend</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Historical success vs failure analysis</p>
              </div>
              <button onClick={() => downloadChart(lineChartRef, 'Historical-Trend')} className="btn-secondary" style={{ padding: '8px', width: 'auto' }}>
                  <ImageIcon size={18} />
              </button>
          </div>
          <div style={{ height: '300px' }}>
              <Line 
                ref={lineChartRef}
                data={chartData.trendLine} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, font: { weight: 600, size: 10 } } },
                    tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12 }
                  },
                  scales: {
                    y: { min: 0, max: 100, ticks: { font: { size: 10 } } },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                  }
                }}
              />
          </div>
      </section>

      {/* 4. SUBJECT-WISE & DISTRIBUTION GRID */}
      <div className="dashboard-grid" style={{ marginBottom: '2.5rem' }}>
          {/* Subject-wise Bar Chart */}
          <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>Subject Performance</h3>
                  <button onClick={() => downloadChart(barChartRef, 'Subject-Comparison')} className="btn-secondary" style={{ padding: '8px', width: 'auto' }}>
                      <ImageIcon size={18} />
                  </button>
              </div>
              <div style={{ height: '300px' }}>
                  <Bar 
                    ref={barChartRef}
                    data={chartData.subjectBar}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: { beginAtZero: true, ticks: { font: { size: 10 } } }
                      }
                    }}
                  />
              </div>
          </div>

          {/* Pass vs Fail Distribution */}
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
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Success</div>
                  </div>
              </div>
          </div>
      </div>

      {/* 5. DATA TABLE */}
      <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>Tabular Data Summary</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Detailed drill-down for {selectedYear}</p>
              </div>
              <button onClick={handleExportExcel} className="btn-secondary" style={{ width: 'auto' }}>
                  <Download size={18} /> Export Excel
              </button>
          </div>
          
          <div className="table-container">
            <table>
                <thead>
                    <tr>
                        <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Subject</th>
                        <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Sat</th>
                        <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Passed</th>
                        <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Failed</th>
                        <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Success %</th>
                        <th style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredRecords.map(record => (
                        <tr key={record.id}>
                            <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{record.subjects?.name}</td>
                            <td>
                                {editingId === record.id ? (
                                    <input 
                                        type="number" 
                                        value={editValues.totalSat}
                                        onChange={(e) => setEditValues({...editValues, totalSat: e.target.value})}
                                        style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }}
                                    />
                                ) : record.total_students}
                            </td>
                            <td>
                                {editingId === record.id ? (
                                    <input 
                                        type="number" 
                                        value={editValues.passCount}
                                        onChange={(e) => setEditValues({...editValues, passCount: e.target.value})}
                                        style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }}
                                    />
                                ) : record.pass_count}
                            </td>
                            <td style={{ color: 'var(--error)', fontWeight: '600' }}>{record.fail_count}</td>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--primary-light)', borderRadius: '3px', width: '60px' }}>
                                        <div style={{ 
                                            width: `${Math.round((record.pass_count/record.total_students)*100)}%`, 
                                            height: '100%', 
                                            backgroundColor: (record.pass_count/record.total_students) > 0.5 ? 'var(--success)' : 'var(--error)',
                                            borderRadius: '3px'
                                        }}></div>
                                    </div>
                                    <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>{Math.round((record.pass_count/record.total_students)*100)}%</span>
                                </div>
                            </td>
                            <td>
                                {editingId === record.id ? (
                                    <button onClick={() => handleSaveEdit(record.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}>Save</button>
                                ) : (
                                    <button onClick={() => handleStartEdit(record)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}>Edit</button>
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
