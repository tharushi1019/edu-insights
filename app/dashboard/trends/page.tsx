'use client';

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Image as ImageIcon, Loader2, Calendar, ChevronLeft, Building2, Users, Award } from 'lucide-react';
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

export const dynamic = 'force-dynamic';

export default function TrendsPage() {
  const { t } = useLanguage();
  const trendChartRef = useRef<any>(null);
  const [schoolName, setSchoolName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [trendSubject, setTrendSubject] = useState<string>('All Subjects');
  const [selectedExam, setSelectedExam] = useState<'OL' | 'AL' | 'Scholarship'>('OL');
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

    // Filter records by exam type
    const examRecs = records.filter(r => {
        if (selectedExam === 'AL') return r.subjects?.name.includes('(A/L)');
        if (selectedExam === 'OL') return !r.subjects?.name.includes('(A/L)') && !r.subjects?.name.includes('Scholarship') && !r.subjects?.name.includes('ශිෂ්‍යත්වය');
        if (selectedExam === 'Scholarship') return r.subjects?.name.includes('Scholarship') || r.subjects?.name.includes('ශිෂ්‍යත්වය');
        return true;
    });

    if (selectedExam === 'Scholarship' || trendSubject === 'All Subjects') {
        yearlyTotal = trendYears.map(y => {
            const yrRecs = examRecs.filter(r => r.year === y);
            return yrRecs.reduce((acc, r) => acc + (r.total_students || 0), 0);
        });
        yearlyAvgPass = trendYears.map(y => {
            const yrRecs = examRecs.filter(r => r.year === y);
            return yrRecs.reduce((acc, r) => acc + (r.pass_count || 0), 0);
        });
    } else {
        yearlyTotal = trendYears.map(y => {
            const rec = examRecs.find(r => r.year === y && r.subjects?.name === trendSubject);
            return rec ? rec.total_students : 0;
        });
        yearlyAvgPass = trendYears.map(y => {
            const rec = examRecs.find(r => r.year === y && r.subjects?.name === trendSubject);
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
  }, [trendSubject, selectedExam, records]);

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

    const chartCanvas = trendChartRef.current?.canvas;
    let nextY = 80;
    if (chartCanvas) {
        const chartImg = trendChartRef.current.toBase64Image('image/png', 1.0);
        const imgProps = doc.getImageProperties(chartImg);
        const chartWidth = pageWidth - 30;
        const chartHeight = (imgProps.height * chartWidth) / imgProps.width;
        
        doc.addImage(chartImg, 'PNG', 15, 75, chartWidth, chartHeight, undefined, 'FAST');
        nextY = 75 + chartHeight + 15;
    }

    // Section 2: Data Table Summary
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("TABULAR TREND DATA", 15, nextY);

    const tableBody = chartData.labels.map((year: any, index: number) => [
        year,
        chartData.datasets[0].data[index],
        chartData.datasets[1].data[index],
        chartData.datasets[0].data[index] - chartData.datasets[1].data[index],
        `${Math.round((chartData.datasets[1].data[index] / chartData.datasets[0].data[index]) * 100)}%`
    ]);

    autoTable(doc, {
        startY: nextY + 5,
        head: [['ACADEMIC YEAR', 'STUDENTS SAT', 'PASSED', 'FAILED', 'PASS RATE']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: { 0: { fontStyle: 'bold', halign: 'center' }, 4: { fontStyle: 'bold', halign: 'center' } }
    });

    // Verification Section (New Page)
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text("OFFICIAL TREND VERIFICATION", 15, 16);

    const verY = 50;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, verY, pageWidth - 15, verY);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DATA AUTHENTICITY CERTIFICATE", 15, verY + 15);
    
    // Signature Lines
    doc.line(15, verY + 60, 75, verY + 60);
    doc.line(pageWidth - 75, verY + 60, pageWidth - 15, verY + 60);
    
    doc.setFontSize(9);
    doc.text("PRINCIPAL / SECTIONAL HEAD", 15, verY + 66);
    doc.text("DATE & SCHOOL SEAL", pageWidth - 75, verY + 66);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("This document is a historical trend analysis generated by EduInsights.", 15, verY + 85);
    doc.text("All data is derived from official school records validated for the selected period.", 15, verY + 92);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, verY + 99);

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
    <div className="fade-in" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: '600', fontSize: '0.85rem' }}>
            <ChevronLeft size={16} /> Back to Dashboard
        </Link>
        <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                <TrendingUp size={20} />
                <span style={{ fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('trends')}</span>
            </div>
            <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)', letterSpacing: '-0.03em' }}>{t('performanceTrends')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '800px', lineHeight: '1.5' }}>
                {t('trendsSubtitle')}
            </p>
        </div>

        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            padding: '1.25rem',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            border: '1px solid var(--surface-border)',
            boxShadow: 'var(--card-shadow)',
            gap: '1.5rem'
        }} className="tablet-row">
            <style jsx>{`
                @media (min-width: 768px) {
                    .tablet-row { flex-direction: row !important; align-items: flex-end !important; }
                    .tablet-inner-row { flex-direction: row !important; align-items: flex-end !important; }
                }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }} className="tablet-inner-row">
                <div style={{ position: 'relative', flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', paddingLeft: '4px' }}>
                        {t('institutionBranding')}
                    </label>
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px', 
                        borderRadius: '10px', 
                        border: '1px solid var(--primary-light)', 
                        backgroundColor: 'rgba(37, 99, 235, 0.05)', 
                        color: 'var(--primary)',
                        fontWeight: '700',
                        fontSize: '1rem',
                        width: '100%'
                    }}>
                        <Building2 size={18} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schoolName || 'Setting up...'}</span>
                    </div>
                </div>

                <div style={{ position: 'relative', flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', paddingLeft: '4px' }}>
                        Select Exam
                    </label>
                    <select 
                        value={selectedExam} 
                        onChange={(e) => {
                            setSelectedExam(e.target.value as any);
                            setTrendSubject('All Subjects'); // Reset subject when exam changes
                        }}
                        className="select-premium"
                        style={{ width: '100%' }}
                    >
                        <option value="OL">G.C.E. O/L</option>
                        <option value="AL">G.C.E. A/L</option>
                        <option value="Scholarship">Scholarship</option>
                    </select>
                </div>

                {(selectedExam === 'OL' || selectedExam === 'AL') && (
                    <div style={{ position: 'relative', flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', paddingLeft: '4px' }}>
                            {t('subjectFilter')}
                        </label>
                        <select 
                            value={trendSubject} 
                            onChange={(e) => setTrendSubject(e.target.value)}
                            className="select-premium"
                            style={{ width: '100%' }}
                        >
                            <option value="All Subjects">Average (All Subjects)</option>
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

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button onClick={handleExportPDF} className="btn-secondary" style={{ height: '48px' }}>
                    <TrendingUp size={18} /> {t('downloadTrendPdf')}
                </button>
            </div>
        </div>
      </header>

      <div className="card" style={{ padding: 'clamp(1rem, 5vw, 2.5rem)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '4px' }}>{t('participationMetrics')}</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Currently viewing: <b style={{ color: 'var(--primary)' }}>{trendSubject}</b></p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Calendar size={16} />
            <span style={{ fontWeight: '700', fontSize: '0.8rem' }}>{t('last5Years')}</span>
          </div>
        </div>

        <div style={{ height: 'clamp(300px, 50vh, 500px)' }}>
            <Bar 
                ref={trendChartRef}
                data={chartData} 
                options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { size: 11, weight: 600 } } },
                        tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, cornerRadius: 10 }
                    },
                    scales: { 
                        y: { 
                            grid: { color: '#e2e8f0' }, 
                            ticks: { font: { size: 10 }, padding: 5 },
                        },
                        x: { 
                            grid: { display: false }, 
                            ticks: { font: { size: 11, weight: 700 }, padding: 5 },
                        }
                    }
                }} 
            />
        </div>
      </div>

      <div className="stats-grid" style={{ marginTop: '2.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
         <div className="card" style={{ 
             display: 'flex', 
             gap: '1.25rem', 
             backgroundColor: 'white', 
             border: '1px solid var(--surface-border)',
             padding: '1.5rem',
             transition: 'transform 0.2s',
             cursor: 'default'
         }}>
            <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                backgroundColor: 'var(--primary-light)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <Users size={24} color="var(--primary)" />
            </div>
            <div>
                <h4 style={{ color: 'var(--text-main)', fontWeight: '800', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Insight: Participation</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    Monitor enrollment trends over time. Significant growth in 'Students Sat' often reflects the success of institutional expansion and student retention programs.
                </p>
            </div>
         </div>

         <div className="card" style={{ 
             display: 'flex', 
             gap: '1.25rem', 
             backgroundColor: 'white', 
             border: '1px solid var(--surface-border)',
             padding: '1.5rem',
             transition: 'transform 0.2s',
             cursor: 'default'
         }}>
            <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                backgroundColor: 'var(--success-light)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <Award size={24} color="var(--success)" />
            </div>
            <div>
                <h4 style={{ color: 'var(--text-main)', fontWeight: '800', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Insight: Success Rate</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    Observe the narrowing gap between participation and passing. A higher convergence rate indicates an elevation in teaching quality and academic performance.
                </p>
            </div>
         </div>
      </div>
    </div>
  );
}
