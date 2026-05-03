import Link from 'next/link';

export const metadata = {
  title: "Edu-Insights - Student Analytics System",
  description: "Comprehensive analytics for student exam performance",
};

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: 'var(--background)', padding: '1rem' }}>
      <div className="card fade-in" style={{ padding: 'clamp(2rem, 8vw, 5rem) clamp(1rem, 5vw, 3rem)', maxWidth: '900px', width: '100%', textAlign: 'center', marginTop: 'clamp(2rem, 10vh, 5rem)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <img src="/logo.png" alt="EduInsights Logo" style={{ width: '80px', height: '80px', borderRadius: '20px', boxShadow: '0 12px 24px rgba(37, 99, 235, 0.2)' }} />
        </div>
        <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', fontWeight: '900', marginBottom: '1.5rem', color: 'var(--primary)', letterSpacing: '-0.04em', lineHeight: '1.1' }}>
          EduInsights
        </h1>
        <p style={{ fontSize: 'clamp(1.1rem, 3vw, 1.35rem)', color: 'var(--text-muted)', marginBottom: '3rem', maxWidth: '650px', margin: '0 auto 3rem', lineHeight: '1.6' }}>
          විභාග ප්‍රතිඵල විශ්ලේෂණය සඳහා වන නවීනතම පද්ධතිය. 
          Smart performance tracking for schools and teachers.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="btn-primary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
            Get Started / ආරම්භ කරන්න
          </Link>
          <Link href="#features" className="btn-secondary" style={{ padding: '16px 32px', fontSize: '1.1rem' }}>
            Learn More
          </Link>
        </div>
      </div>

      <div id="features" style={{ 
        marginTop: 'clamp(4rem, 15vh, 8rem)', 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: '1.5rem', 
        width: '100%',
        maxWidth: '1200px',
        paddingBottom: '5rem'
      }}>
        <div className="card slide-in" style={{ borderTop: '4px solid var(--primary)' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>Multi-User Support</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Secure login for teachers and administrators with isolated data storage and institute-wide reporting.</p>
        </div>
        <div className="card slide-in" style={{ borderTop: '4px solid var(--success)', animationDelay: '0.1s' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>Excel Integration</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Bulk upload your data via Excel sheets for instant visualization and historical record keeping.</p>
        </div>
        <div className="card slide-in" style={{ borderTop: '4px solid var(--accent)', animationDelay: '0.2s' }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>Professional Reports</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>Analyze years of data with clean charts designed for official school reports and principal reviews.</p>
        </div>
      </div>
    </main>
  );
}
