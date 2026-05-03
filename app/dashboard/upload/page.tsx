'use client';

import { useState, useEffect } from 'react';
import { FileUp, Info, AlertTriangle, CheckCircle2, FileSpreadsheet, X, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ExamRecord {
  Year: number;
  Subject: string;
  Total: number;
  Pass: number;
  Fail: number;
}

export default function ExcelUpload() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<ExamRecord[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'importing'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        if (error?.message.includes('Refresh Token Not Found') || error?.message.includes('invalid_grant')) {
          await supabase.auth.signOut();
        }
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFile(file);
    setStatus('processing');
    setMessage('');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as ExamRecord[];
        
        // Basic column validation
        if (jsonData.length > 0 && ('Year' in jsonData[0] && 'Subject' in jsonData[0])) {
            setData(jsonData);
            setStatus('success');
        } else {
            throw new Error('Invalid format. Please use columns: Year, Subject, Total, Pass, Fail');
        }
      } catch (err: any) {
        console.error(err);
        setStatus('error');
        setMessage(err.message || 'Error reading file');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImport = async () => {
    setStatus('importing');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        if (authError?.message.includes('Refresh Token Not Found') || authError?.message.includes('invalid_grant')) {
          await supabase.auth.signOut();
          router.push('/login');
          return;
        }
        throw new Error('Please sign in first');
      }

      // 1. Ensure all subjects exist
      const uniqueSubjects = [...new Set(data.map(item => item.Subject))];
      for (const subName of uniqueSubjects) {
          // Using upsert with onConflict to handle existing subjects gracefully
          await supabase
            .from('subjects')
            .upsert({ name: subName }, { onConflict: 'name' });
      }

      // 2. Get map
      const { data: subs } = await supabase.from('subjects').select('id, name');
      const subMap = Object.fromEntries(subs!.map(s => [s.name, s.id]));

      // 3. Prepare data
      const insertData = data.map(item => ({
          user_id: user.id,
          year: item.Year,
          subject_id: subMap[item.Subject],
          total_students: item.Total || 0,
          pass_count: item.Pass || 0,
          fail_count: item.Fail || 0
      }));

      // 4. Insert
      const { error } = await supabase.from('exam_records').insert(insertData);
      if (error) throw error;

      setStatus('success');
      setMessage(`Successfully saved ${data.length} records!`);
      setData([]);
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || 'Import failed');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      { Year: 2026, Subject: 'Mathematics', Total: 120, Pass: 95, Fail: 25 },
      { Year: 2026, Subject: 'Science', Total: 118, Pass: 88, Fail: 30 },
      { Year: 2026, Subject: 'English', Total: 120, Pass: 110, Fail: 10 },
      { Year: 2025, Subject: 'Mathematics', Total: 115, Pass: 85, Fail: 30 },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "EduInsights_Standard_Template.xlsx");
  };

  const reset = () => {
    setFile(null);
    setData([]);
    setStatus('idle');
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Bulk Upload Exam Data</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Upload an Excel (.xlsx) file to populate your dashboard automatically.</p>
      </header>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {status === 'idle' || status === 'processing' ? (
          <div 
            className="card" 
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{ 
              padding: 'clamp(2rem, 10vw, 4rem) 1.5rem', 
              textAlign: 'center',
              border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--surface-border)'}`,
              transition: 'all 0.2s',
              backgroundColor: dragActive ? 'rgba(37, 99, 235, 0.05)' : 'white',
              position: 'relative',
              cursor: 'pointer'
            }}
          >
            <input 
              type="file" 
              accept=".xlsx, .csv" 
              onChange={handleFileChange}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            />
            <div style={{ marginBottom: '1.5rem' }}>
              <FileUp size={40} color={dragActive ? 'var(--primary)' : 'var(--text-muted)'} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
               Tap to upload or drag & drop
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Excel (.xlsx) or CSV files supported
            </p>
          </div>
        ) : status === 'success' ? (
          <div className="card" style={{ border: '1px solid var(--success)', backgroundColor: '#f0fdf4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <CheckCircle2 color="var(--success)" size={32} />
                    <div>
                        <h3 style={{ color: '#166534' }}>{message || 'File Processed Successfully'}</h3>
                        <p style={{ color: '#15803d', fontSize: '0.9rem' }}>
                            {data.length > 0 ? `Found ${data.length} records in ${file?.name}` : 'Click Dashboard to see your results!'}
                        </p>
                    </div>
                </div>
                <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={20} color="#166534" />
                </button>
            </div>
          </div>
        ) : (
            <div className="card" style={{ border: '1px solid var(--error)', backgroundColor: '#fef2f2' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <AlertTriangle color="var(--error)" size={32} />
                    <div>
                        <h3 style={{ color: '#991b1b' }}>{message || 'Processing Failed'}</h3>
                        <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>Please check your file format and try again.</p>
                    </div>
                    <button onClick={reset} className="btn-secondary" style={{ marginLeft: 'auto' }}>Try Again</button>
                </div>
            </div>
        )}

      {/* IMPORTING OVERLAY */}
      {status === 'importing' && (
        <div className="modal-overlay" style={{ 
            position: 'fixed', 
            inset: 0, 
            backgroundColor: 'rgba(15, 23, 42, 0.9)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            backdropFilter: 'blur(8px)' 
        }}>
            <div className="card scale-in" style={{ maxWidth: '400px', width: '90%', padding: 'clamp(1.5rem, 8vw, 3rem)', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <Loader2 size={32} color="var(--primary)" className="animate-spin" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Processing Data...</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1rem' }}>
                    We are validating and saving your records. Please stay on this page.
                </p>
                <div style={{ 
                    width: '100%', 
                    height: '4px', 
                    backgroundColor: 'var(--surface-border)', 
                    borderRadius: '2px', 
                    overflow: 'hidden' 
                }}>
                    <div className="progress-bar-animate" style={{ 
                        height: '100%', 
                        backgroundColor: 'var(--primary)',
                        width: '100%'
                    }}></div>
                </div>
            </div>
        </div>
      )}

      {data.length > 0 && (
            <div className="card fade-in" style={{ padding: 'clamp(1rem, 5vw, 1.5rem)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Previewing Data</h3>
                    <button 
                        onClick={handleImport} 
                        disabled={status === 'importing'}
                        className="btn-primary"
                    >
                        Import Records
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.9rem' }}>
                                <th style={{ padding: '12px' }}>Year</th>
                                <th style={{ padding: '12px' }}>Subject</th>
                                <th style={{ padding: '12px' }}>Total Students</th>
                                <th style={{ padding: '12px' }}>Pass</th>
                                <th style={{ padding: '12px' }}>Fail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.slice(0, 5).map((item, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px' }}>{item.Year}</td>
                                    <td style={{ padding: '12px', fontWeight: '500' }}>{item.Subject}</td>
                                    <td style={{ padding: '12px' }}>{item.Total}</td>
                                    <td style={{ padding: '12px', color: 'var(--success)' }}>{item.Pass}</td>
                                    <td style={{ padding: '12px', color: 'var(--error)' }}>{item.Fail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {data.length > 5 && (
                        <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                            ... and {data.length - 5} more records
                        </p>
                    )}
                </div>
            </div>
        )}

        {/* Support Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            <div className="card" style={{ display: 'flex', gap: '1rem', backgroundColor: 'white' }}>
                <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: '#eff6ff' }}>
                    <FileSpreadsheet size={24} color="var(--primary)" />
                </div>
                <div>
                    <h4 style={{ marginBottom: '0.4rem', color: '#334155' }}>Download Template</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Use our standard Excel template to ensure metadata matches perfectly.
                    </p>
                    <button 
                        onClick={handleDownloadTemplate}
                        style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', padding: 0, fontWeight: '600', cursor: 'pointer' }}
                    >
                        Download .xlsx template
                    </button>
                </div>
            </div>
            <div className="card" style={{ display: 'flex', gap: '1rem', backgroundColor: 'white' }}>
                <div style={{ padding: '10px', borderRadius: '50%', backgroundColor: '#fefce8' }}>
                    <Info size={24} color="#ca8a04" />
                </div>
                <div>
                    <h4 style={{ marginBottom: '0.4rem', color: '#334155' }}>Header Requirements</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Your file must have these headers: <strong>Year, Subject, Total, Pass, Fail</strong>.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
