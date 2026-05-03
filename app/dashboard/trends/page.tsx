'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Image as ImageIcon, Loader2, Calendar, ChevronLeft, Building2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Bar } from 'react-chartjs-2';
import { useLanguage } from '@/context/LanguageContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function TrendsPage() {
  const { t } = useLanguage();
  const trendChartRef = useRef<any>(null);
  const [schoolName, setSchoolName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [trendSubject, setTrendSubject] = useState<string>('All Subjects');
  const [chartData, setChartData] = useState<any>({ labels: [], datasets: [] });

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.error('Auth error or no user:', authError);
            if (authError?.message.includes('Refresh Token Not Found') || authError?.message.includes('invalid_grant')) {
                await supabase.auth.signOut();
            }
            window.location.href = '/login';
            return;
        }

        const { data, error } = await supabase
          .from('exam_records')
          .select(`
              id, year, total_students, pass_count, fail_count,
              subjects (name)
          `)
          .eq('user_id', user.id)
          .order('year', { ascending: true });
        
        if (error) throw error;

        if (data) setRecords(data);

        // Fetch School Name from Profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('school_name')
          .eq('id', user.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') throw profileError;
        if (profileData?.school_name) setSchoolName(profileData.school_name);

      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (records.length === 0) return;

    const trendYears = [...new Set(records.map(r => r.year))].sort((a, b) => a - b).slice(-5);
    let yearlyTotal: number[] = [];
    let yearlyAvgPass: number[] = [];

    if (trendSubject === 'All Subjects') {
        yearlyTotal = trendYears.map(y => {
            const yrRecs = records.filter(r => r.year === y);
            return yrRecs.reduce((acc, r) => acc + (r.total_students || 0), 0);
        });
        yearlyAvgPass = trendYears.map(y => {
            const yrRecs = records.filter(r => r.year === y);
            return yrRecs.reduce((acc, r) => acc + (r.pass_count || 0), 0);
        });
    } else {
        yearlyTotal = trendYears.map(y => {
            const rec = records.find(r => r.year === y && r.subjects?.name === trendSubject);
            return rec ? rec.total_students : 0;
        });
        yearlyAvgPass = trendYears.map(y => {
            const rec = records.find(r => r.year === y && r.subjects?.name === trendSubject);
            return rec ? rec.pass_count : 0;
        });
    }

    setChartData({
        labels: trendYears,
        datasets: [
            { 
              label: 'Students Sat', 
              data: yearlyTotal, 
              backgroundColor: '#cbd5e1', 
              borderRadius: 6, 
              barThickness: 40 
            },
            { 
              label: 'Passed Students', 
              data: yearlyAvgPass, 
              backgroundColor: '#2563eb', 
              borderRadius: 6, 
              barThickness: 40 
            }
        ]
    });
  }, [trendSubject, records]);

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    if (!schoolName.trim()) {
        alert("Please enter your School Name before generating the trend report.");
        return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;

    // Branded Header
    doc.setFillColor(15, 23, 42); // Deep Navy
    doc.rect(0, 0, pageWidth, 50, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text(schoolName.toUpperCase(), pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text("HISTORICAL PERFORMANCE & TREND ANALYSIS REPORT", pageWidth / 2, 28, { align: 'center' });
    
    doc.setFillColor(37, 99, 235); // Blue Accent
    doc.rect(pageWidth / 2 - 40, 32, 80, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`SUBJECT: ${trendSubject.toUpperCase()}`, pageWidth / 2, 37, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(`Generated On: ${new Date().toLocaleString()}`, pageWidth - 15, 45, { align: 'right' });

    // Section 1: Visual Trend
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("5-YEAR COMPARATIVE TREND", 15, 65);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 68, pageWidth - 15, 68);

    const chartImg = trendChartRef.current?.toBase64Image();
    if (chartImg) {
        doc.addImage(chartImg, 'PNG', 15, 75, 180, 90);
    }

    // Section 2: Data Table Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TABULAR TREND DATA", 15, 180);

    const tableBody = chartData.labels.map((year: any, index: number) => [
        year,
        chartData.datasets[0].data[index],
        chartData.datasets[1].data[index],
        chartData.datasets[0].data[index] - chartData.datasets[1].data[index],
        `${Math.round((chartData.datasets[1].data[index] / chartData.datasets[0].data[index]) * 100)}%`
    ]);

    autoTable(doc, {
        startY: 185,
        head: [['ACADEMIC YEAR', 'STUDENTS SAT', 'PASSED', 'FAILED', 'PASS RATE']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'center' }, 4: { fontStyle: 'bold', halign: 'center' } }
    });

    // Signature & Verification Area
    let lastPageY = (doc as any).lastAutoTable.finalY + 20;
    
    // If not enough space, add new page
    if (lastPageY > 230) {
        doc.addPage();
        lastPageY = 40;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(15, lastPageY, pageWidth - 15, lastPageY);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL TREND VERIFICATION", 15, lastPageY + 10);
    
    // Signature Lines
    doc.line(15, lastPageY + 35, 75, lastPageY + 35);
    doc.line(pageWidth - 75, lastPageY + 35, pageWidth - 15, lastPageY + 35);
    
    doc.setFontSize(8);
    doc.text("PRINCIPAL / SECTIONAL HEAD", 15, lastPageY + 40);
    doc.text("DATE & SCHOOL SEAL", pageWidth - 75, lastPageY + 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("This document is a historical trend analysis generated by EduInsights.", 15, lastPageY + 50);
    doc.text("All data is derived from official school records validated for the selected period.", 15, lastPageY + 54);

    // Global Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`${schoolName} | TREND ANALYSIS REPORT | PAGE ${i} OF ${pageCount}`, pageWidth / 2, 287, { align: 'center' });
    }

    doc.save(`${schoolName.replace(/\s+/g, '_')}_Trend_Analysis_${trendSubject.replace(/\s+/g, '_')}.pdf`);
  };

  const uniqueSubjectNames = [...new Set(records.map(r => r.subjects?.name || 'Unknown'))].sort();

  if (loading) {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        </div>
    );
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: '3rem' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '1.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
            <ChevronLeft size={18} /> Back to Dashboard
        </Link>
        <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                <TrendingUp size={24} />
                <span style={{ fontWeight: '700', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{t('trends')}</span>
            </div>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>{t('performanceTrends')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.25rem', maxWidth: '800px', lineHeight: '1.6' }}>
                {t('trendsSubtitle')}
            </p>
        </div>

        <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            border: '1px solid var(--surface-border)',
            boxShadow: 'var(--card-shadow)',
            gap: '2rem'
        }}>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flex: 1 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', paddingLeft: '4px' }}>
                        {t('institutionBranding')}
                    </label>
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 18px', 
                        borderRadius: '12px', 
                        border: '2px solid var(--primary-light)', 
                        backgroundColor: 'rgba(37, 99, 235, 0.05)', 
                        color: 'var(--primary)',
                        fontWeight: '800',
                        fontSize: '1.1rem',
                    }}>
                        <Building2 size={20} />
                        {schoolName || 'Setting up...'}
                    </div>
                </div>

                <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', paddingLeft: '4px' }}>
                        {t('subjectFilter')}
                    </label>
                    <select 
                        value={trendSubject} 
                        onChange={(e) => setTrendSubject(e.target.value)}
                        style={{ 
                            padding: '14px 24px', 
                            borderRadius: '12px', 
                            border: '2px solid var(--surface-border)', 
                            outline: 'none', 
                            backgroundColor: 'white', 
                            fontWeight: '700',
                            fontSize: '1rem',
                            appearance: 'none',
                            minWidth: '220px',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="All Subjects">Average (All Subjects)</option>
                        {uniqueSubjectNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button onClick={handleExportPDF} className="btn-secondary" style={{ padding: '14px 24px', fontSize: '1rem', whiteSpace: 'nowrap', height: '52px' }}>
                    <TrendingUp size={20} /> {t('downloadTrendPdf')}
                </button>
            </div>
        </div>
      </header>

      <div className="card" style={{ padding: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>{t('participationMetrics')}</h3>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Currently viewing: <b style={{ color: 'var(--primary)' }}>{trendSubject}</b></p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Calendar size={18} />
            <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{t('last5Years')}</span>
          </div>
        </div>

        <div style={{ height: '500px' }}>
            <Bar 
                ref={trendChartRef}
                data={chartData} 
                options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 30, font: { size: 14, weight: 600 } } },
                        tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 16, cornerRadius: 12, titleFont: { size: 14 }, bodyFont: { size: 14 } }
                    },
                    scales: { 
                        y: { 
                            grid: { color: '#e2e8f0' }, 
                            ticks: { font: { size: 12, weight: 500 }, padding: 10 },
                            title: { display: true, text: 'Number of Students', font: { size: 14, weight: 700 }, padding: 10 }
                        },
                        x: { 
                            grid: { display: false }, 
                            ticks: { font: { size: 13, weight: 700 }, padding: 10 },
                            title: { display: true, text: 'Academic Year', font: { size: 14, weight: 700 }, padding: 10 }
                        }
                    }
                }} 
            />
        </div>
      </div>

      <div style={{ marginTop: '3rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
         <div className="card" style={{ backgroundColor: 'var(--primary-light)', border: 'none' }}>
            <h4 style={{ color: 'var(--primary)', fontWeight: '800', marginBottom: '1rem' }}>Insight: Participation</h4>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Analyze how the total number of students sitting for exams has changed over time. Spikes may indicate successful enrollment campaigns or curriculum changes.
            </p>
         </div>
         <div className="card" style={{ backgroundColor: 'var(--success-light)', border: 'none' }}>
            <h4 style={{ color: 'var(--success)', fontWeight: '800', marginBottom: '1rem' }}>Insight: Success Rate</h4>
            <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                The gap between 'Students Sat' and 'Passed Students' visually represents the fail margin. A narrowing gap indicates improving academic standards.
            </p>
         </div>
      </div>
    </div>
  );
}
