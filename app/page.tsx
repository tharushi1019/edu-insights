import Link from 'next/link';

export const metadata = {
  title: "Edu-Insights - Student Analytics System",
  description: "Comprehensive analytics for student exam performance",
};

export default function Home() {
  return (
    <main className="container" style={{ minHeight: '90vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: '#f8f9fa', color: '#333' }}>
      <div className="card" style={{ padding: '4rem 2rem', maxWidth: '800px', width: '100%', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1.5rem', color: '#0070f3' }}>
          Edu-Insights
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2.5rem', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
          විභාග ප්‍රතිඵල විශ්ලේෂණය සඳහා වන නවීනතම පද්ධතිය. 
          Smart performance tracking for schools and teachers.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="btn-primary">
            Get Started / ආරම්භ කරන්න
          </Link>
          <Link href="#features" className="btn-secondary">
            Learn More
          </Link>
        </div>
      </div>

      <div id="features" style={{ marginTop: '6rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', width: '100%' }}>
        <div className="card" style={{ padding: '2rem', backgroundColor: 'white' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Multi-User Support</h3>
          <p style={{ color: 'var(--text-muted)' }}>Secure login for teachers and administrators with isolated data storage.</p>
        </div>
        <div className="card" style={{ padding: '2rem', backgroundColor: 'white' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--success)' }}>Excel Integration</h3>
          <p style={{ color: 'var(--text-muted)' }}>Bulk upload your data via Excel sheets for instant visualization.</p>
        </div>
        <div className="card" style={{ padding: '2rem', backgroundColor: 'white' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>Professional Charts</h3>
          <p style={{ color: 'var(--text-muted)' }}>Analyze years of data with clean bar and pie charts designed for reports.</p>
        </div>
      </div>
    </main>
  );
}
