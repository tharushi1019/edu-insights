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
  const [marksRecords, setMarksRecords] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('All Subjects');
  const [selectedExam, setSelectedExam] = useState<'OL' | 'AL' | 'Scholarship'>('OL');
  const latestYear = records.length > 0 ? Math.max(...records.map(r => r.year)) : null;

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
      alTrend: { labels: [], datasets: [] },
      olTrend: { labels: [], datasets: [] },
      scholarshipTrend: { labels: [], datasets: [] },
      activeTrend: { labels: [], datasets: [] },
      scholarshipMetrics: { labels: [], datasets: [] },
      marksTrend: { labels: [], datasets: [] },
      olLatest: { labels: [], datasets: [] },
      alLatest: { labels: [], datasets: [] },
      scholarshipLatest: { labels: [], datasets: [] },
      gradeDist: { labels: [], datasets: [] },
      subjectRank: { labels: [], datasets: [] },
      overallPie: { labels: [], datasets: [] }
  });

  // Filtering Logic
  const filteredRecords = records.filter(r => {
    const yearMatch = !selectedYear || r.year === selectedYear;
    const subjectMatch = selectedSubject === 'All Subjects' || r.subjects?.name === selectedSubject;
    const isNotScholarship = r.subjects?.name !== 'Grade 5 Scholarship' && r.subjects?.name !== '5 ශ්‍රේණිය ශිෂ්‍යත්වය';
    return yearMatch && subjectMatch && isNotScholarship;
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
              id, year, total_students, pass_count, fail_count, subject_id, term, a_count, b_count, c_count, s_count, w_count, exam_type,
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

        // Fetch student marks for summary
        const { data: marksData, error: marksError } = await supabase
          .from('student_marks')
          .select('mark, term');
        
        if (marksError) throw marksError;
        if (marksData) {
            setMarksRecords(marksData);
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

    // --- 1. Calculate Stats (Overall) ---
    const totalSat = records.reduce((acc, r) => acc + (r.total_students || 0), 0);
    const totalPass = records.reduce((acc, r) => acc + (r.pass_count || 0), 0);
    const totalFail = records.reduce((acc, r) => acc + (r.fail_count || 0), 0);

    setStats({
      totalStudents: totalSat,
      passCount: totalPass,
      failCount: totalFail,
      subjectCount: new Set(records.map(r => r.subjects?.name)).size
    });

    // --- 2. Chart: Yearly Trends (5 Year) ---
    const examRecs = records.filter(r => {
      if (selectedExam === 'AL') return r.exam_type === 'AL';
      if (selectedExam === 'OL') return r.exam_type === 'OL';
      if (selectedExam === 'Scholarship') return r.exam_type === 'SCHOLARSHIP';
      return true;
    });
    const years = [...new Set(examRecs.map(r => r.year))].sort();
    
    let trendData: number[] = [];
    let trendLabel = '';
    let trendColor = '#3b82f6';
    let trendBgColor = 'rgba(59, 130, 246, 0.1)';

    let participationData: number[] = [];
    let successData: number[] = [];

    if (selectedExam === 'AL') {
      trendLabel = 'A/L Pass Rate %';
      trendColor = '#059669';
      trendBgColor = 'rgba(5, 150, 105, 0.1)';
      trendData = years.map(y => {
        const yearRecs = records.filter(r => r.year === y && r.exam_type === 'AL');
        const filteredRecs = selectedSubject === 'All Subjects' 
          ? yearRecs 
          : yearRecs.filter(r => r.subjects?.name === selectedSubject);
        const total = filteredRecs.reduce((acc, r) => acc + r.total_students, 0);
        const pass = filteredRecs.reduce((acc, r) => acc + r.pass_count, 0);
        return total > 0 ? Math.round((pass / total) * 100) : 0;
      });
    } else if (selectedExam === 'OL') {
      trendLabel = 'O/L Pass Rate %';
      trendColor = '#3b82f6';
      trendBgColor = 'rgba(59, 130, 246, 0.1)';
      trendData = years.map(y => {
        const yearRecs = records.filter(r => r.year === y && r.exam_type === 'OL');
        const filteredRecs = selectedSubject === 'All Subjects' 
          ? yearRecs 
          : yearRecs.filter(r => r.subjects?.name === selectedSubject);
        const total = filteredRecs.reduce((acc, r) => acc + r.total_students, 0);
        const pass = filteredRecs.reduce((acc, r) => acc + r.pass_count, 0);
        return total > 0 ? Math.round((pass / total) * 100) : 0;
      });
    } else if (selectedExam === 'Scholarship') {
      trendLabel = 'Scholarship Pass Rate %';
      trendColor = '#f59e0b';
      trendBgColor = 'rgba(245, 158, 11, 0.1)';
      
      participationData = years.map(y => {
        const yearRecs = records.filter(r => r.year === y && r.exam_type === 'SCHOLARSHIP');
        return yearRecs.reduce((acc, r) => acc + r.total_students, 0);
      });
      successData = years.map(y => {
        const yearRecs = records.filter(r => r.year === y && r.exam_type === 'SCHOLARSHIP');
        return yearRecs.reduce((acc, r) => acc + r.pass_count, 0);
      });
      
      trendData = years.map(y => {
        const yearRecs = records.filter(r => r.year === y && r.exam_type === 'SCHOLARSHIP');
        const total = yearRecs.reduce((acc, r) => acc + r.total_students, 0);
        const pass = yearRecs.reduce((acc, r) => acc + r.pass_count, 0);
        return total > 0 ? Math.round((pass / total) * 100) : 0;
      });
    }

    // --- 3. Marks Analysis (Term Test Summary) ---
    const terms = [...new Set(marksRecords.map(m => m.term))].sort();
    const termAverages = terms.map(t => {
      const termRecs = marksRecords.filter(m => m.term === t);
      const sum = termRecs.reduce((acc, r) => acc + r.mark, 0);
      return termRecs.length > 0 ? Math.round(sum / termRecs.length) : 0;
    });

    // --- 4. Latest Year Analysis ---
    const latestYear = records.length > 0 ? Math.max(...records.map(r => r.year)) : 0;
    const latestYearRecs = records.filter(r => r.year === latestYear);

    const olLatestRecs = latestYearRecs.filter(r => r.exam_type === 'OL');
    const olLabels = olLatestRecs.map(r => r.subjects?.name);
    const olPassRates = olLatestRecs.map(r => r.total_students > 0 ? Math.round((r.pass_count / r.total_students) * 100) : 0);

    const alLatestRecs = latestYearRecs.filter(r => r.exam_type === 'AL');
    const alLabels = alLatestRecs.map(r => r.subjects?.name);
    const alPassRates = alLatestRecs.map(r => r.total_students > 0 ? Math.round((r.pass_count / r.total_students) * 100) : 0);

    const schLatestRecs = latestYearRecs.filter(r => r.exam_type === 'SCHOLARSHIP');
    const schLabels = schLatestRecs.map(r => r.subjects?.name);
    const schSatCounts = schLatestRecs.map(r => r.total_students);
    const schPassCounts = schLatestRecs.map(r => r.pass_count);

    // --- 5. Grade Distribution (O/L Latest) ---
    const gradeLabels = olLatestRecs.map(r => r.subjects?.name);
    const aCounts = olLatestRecs.map(r => r.a_count || 0);
    const bCounts = olLatestRecs.map(r => r.b_count || 0);
    const cCounts = olLatestRecs.map(r => r.c_count || 0);
    const sCounts = olLatestRecs.map(r => r.s_count || 0);
    const wCounts = olLatestRecs.map(r => r.w_count || 0);

    // --- 6. Subject Ranking (Top 5) ---
    const sortedSubjects = [...latestYearRecs].sort((a, b) => {
      const rateA = a.total_students > 0 ? a.pass_count / a.total_students : 0;
      const rateB = b.total_students > 0 ? b.pass_count / b.total_students : 0;
      return rateB - rateA;
    }).slice(0, 5);
    const topLabels = sortedSubjects.map(r => r.subjects?.name);
    const topRates = sortedSubjects.map(r => r.total_students > 0 ? Math.round((r.pass_count / r.total_students) * 100) : 0);

    // --- 7. Overall Pass/Fail Doughnut ---
    const totalPassLatest = latestYearRecs.reduce((acc, r) => acc + (r.pass_count || 0), 0);
    const totalFailLatest = latestYearRecs.reduce((acc, r) => acc + (r.fail_count || 0), 0);

    setChartData({
      activeTrend: {
        labels: years,
        datasets: [{ label: trendLabel, data: trendData, borderColor: trendColor, backgroundColor: trendBgColor, fill: true, tension: 0.4 }]
      },
      scholarshipMetrics: {
        labels: years,
        datasets: [
          { label: 'Participation (Sat)', data: participationData, borderColor: '#64748b', backgroundColor: 'rgba(100, 116, 139, 0.1)', fill: true, tension: 0.4 },
          { label: 'Success (Passed)', data: successData, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', fill: true, tension: 0.4 }
        ]
      },
      marksTrend: {
        labels: terms.map(t => `Term ${t}`),
        datasets: [{ label: 'Avg Mark', data: termAverages, backgroundColor: '#8b5cf6', borderRadius: 6 }]
      },
      olLatest: {
        labels: olLabels,
        datasets: [{ label: 'Pass Rate %', data: olPassRates, backgroundColor: '#3b82f6', borderRadius: 4 }]
      },
      alLatest: {
        labels: alLabels,
        datasets: [{ label: 'Pass Rate %', data: alPassRates, backgroundColor: '#059669', borderRadius: 4 }]
      },
      scholarshipLatest: {
        labels: schLabels,
        datasets: [
          { label: 'Sitted Students', data: schSatCounts, backgroundColor: '#94a3b8', borderRadius: 4 },
          { label: 'Passed Students', data: schPassCounts, backgroundColor: '#f59e0b', borderRadius: 4 }
        ]
      },
      gradeDist: {
        labels: gradeLabels,
        datasets: [
          { label: 'A', data: aCounts, backgroundColor: '#10b981' },
          { label: 'B', data: bCounts, backgroundColor: '#3b82f6' },
          { label: 'C', data: cCounts, backgroundColor: '#f59e0b' },
          { label: 'S', data: sCounts, backgroundColor: '#64748b' },
          { label: 'W', data: wCounts, backgroundColor: '#f43f5e' }
        ]
      },
      subjectRank: {
        labels: topLabels,
        datasets: [{ label: 'Pass Rate %', data: topRates, backgroundColor: '#8b5cf6', borderRadius: 4 }]
      },
      overallPie: {
        labels: ['Pass', 'Fail'],
        datasets: [{ data: [totalPassLatest, totalFailLatest], backgroundColor: ['#10b981', '#f43f5e'] }]
      }
    });

    // Auto-scroll to charts when filtering to ensure user sees updated data
    if (selectedYear || selectedSubject) {
        const topOfCharts = document.getElementById('charts-start');
        if (topOfCharts) {
            topOfCharts.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
  }, [selectedYear, selectedSubject, selectedExam, records]);

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
    <div className="fade-in" style={{ padding: '2rem' }}>
      {/* HEADER */}
      <header style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                <TrendingUp size={20} />
                <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Overall School Progress</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>
              Academic Dashboard
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
              High-level overview of school performance and trends.
            </p>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-grid" style={{ marginTop: '2rem' }}>
          <div className="card">
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Total Students Sat (All Time)</div>
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

      {/* LATEST YEAR RESULTS SECTION */}
      <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Latest Year ({latestYear}) Results Analysis</h2>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              {/* O/L Latest */}
              <div className="card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>G.C.E. O/L Results</h3>
                  <div style={{ height: '250px' }}>
                      <Bar 
                        data={chartData.olLatest} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true, max: 100 } }
                        }}
                      />
                  </div>
              </div>

              {/* A/L Latest */}
              <div className="card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>G.C.E. A/L Results</h3>
                  <div style={{ height: '250px' }}>
                      <Bar 
                        data={chartData.alLatest} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          plugins: { legend: { display: false } },
                          scales: { y: { beginAtZero: true, max: 100 } }
                        }}
                      />
                  </div>
              </div>

              {/* Scholarship Latest */}
              <div className="card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>Scholarship Results</h3>
                  <div style={{ height: '250px' }}>
                      <Bar 
                        data={chartData.scholarshipLatest} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          plugins: { legend: { display: true } },
                          scales: { y: { beginAtZero: true } }
                        }}
                      />
                  </div>
              </div>
          </div>
      </section>

      {/* DEEP DIVE ANALYTICS SECTION */}
      <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Advanced Insights ({latestYear})</h2>
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              {/* Grade Distribution */}
              <div className="card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>O/L Grade Distribution</h3>
                  <div style={{ height: '250px' }}>
                      <Bar 
                        data={chartData.gradeDist} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          plugins: { legend: { display: true } },
                          scales: { x: { stacked: true }, y: { beginAtZero: true, stacked: true } }
                        }}
                      />
                  </div>
              </div>

              {/* Subject Ranking */}
              <div className="card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>Top 5 Subjects by Pass Rate</h3>
                  <div style={{ height: '250px' }}>
                      <Bar 
                        data={chartData.subjectRank} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          indexAxis: 'y', // Horizontal Bar
                          plugins: { legend: { display: false } },
                          scales: { x: { beginAtZero: true, max: 100 } }
                        }}
                      />
                  </div>
              </div>

              {/* Pass/Fail Doughnut */}
              <div className="card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>Overall Success Rate</h3>
                  <div style={{ height: '250px' }}>
                      <Doughnut 
                        data={chartData.overallPie} 
                        options={{ 
                          responsive: true, 
                          maintainAspectRatio: false, 
                          plugins: { legend: { display: true, position: 'bottom' } }
                        }}
                      />
                  </div>
              </div>
          </div>
      </section>

      {/* 5-YEAR TRENDS SECTION */}
      <section style={{ marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Performance Trends</h2>
          
          {/* Filters */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Select Exam</label>
                  <select 
                    value={selectedExam} 
                    onChange={(e) => setSelectedExam(e.target.value as any)}
                    className="select-premium"
                    style={{ minWidth: '150px' }}
                  >
                      <option value="OL">G.C.E. O/L</option>
                      <option value="AL">G.C.E. A/L</option>
                      <option value="Scholarship">Scholarship</option>
                  </select>
              </div>

              {(selectedExam === 'OL' || selectedExam === 'AL') && (
                  <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>Select Subject</label>
                      <select 
                        value={selectedSubject} 
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="select-premium"
                        style={{ minWidth: '200px' }}
                      >
                          <option value="All Subjects">All Subjects</option>
                          {uniqueSubjectNames
                            .filter(name => {
                              if (selectedExam === 'AL') return name.includes('(A/L)');
                              if (selectedExam === 'OL') return !name.includes('(A/L)') && !name.includes('Scholarship') && !name.includes('ශිෂ්‍යත්වය');
                              return true;
                            })
                            .map(name => (
                              <option key={name} value={name}>{name}</option>
                          ))}
                      </select>
                  </div>
              )}
          </div>

          <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr', gap: '2rem' }}>
              {selectedExam !== 'Scholarship' ? (
                  <div className="card">
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>
                          {selectedExam} Performance Trend - {selectedSubject}
                      </h3>
                      <div style={{ height: '350px' }}>
                          <Line 
                            data={chartData.activeTrend} 
                            options={{ 
                              responsive: true, 
                              maintainAspectRatio: false, 
                              plugins: { legend: { display: false } },
                              scales: { y: { beginAtZero: true, max: 100 } }
                            }}
                          />
                      </div>
                  </div>
              ) : (
                  <div className="card">
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>
                          Scholarship Participation & Success Metrics
                      </h3>
                      <div style={{ height: '350px' }}>
                          <Line 
                            data={chartData.scholarshipMetrics} 
                            options={{ 
                              responsive: true, 
                              maintainAspectRatio: false, 
                              plugins: { legend: { display: true } },
                              scales: { y: { beginAtZero: true } }
                            }}
                          />
                      </div>
                  </div>
              )}
          </div>
      </section>

      {/* MARKS ANALYSIS SECTION */}
      <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Term Test Marks Analysis</h2>
          <div className="card" style={{ maxWidth: '600px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '1rem' }}>Average Marks per Term</h3>
              <div style={{ height: '300px' }}>
                  <Bar 
                    data={chartData.marksTrend} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: { y: { beginAtZero: true, max: 100 } }
                    }}
                  />
              </div>
          </div>
      </section>
    </div>
  );
}
