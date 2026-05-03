# 🎓 EduInsights Pro

> **High-Performance G.C.E. O/L Analytics Dashboard**

EduInsights is a production-grade analytics platform designed for educators to track, analyze, and report student examination performance with executive-level precision.

![Dashboard Preview](/logo.png)

## ✨ Key Features

-   **📊 Dynamic Analytical Dashboard**: Real-time visualization of subject performance, yearly trends, and success distributions.
-   **📄 Snapshot Pro PDF Engine**: Generate high-fidelity institutional reports with formal verification blocks and live chart embedding.
-   **📱 Fully Responsive**: Seamless experience across Desktop, Tablet, and Mobile with a dedicated navigation drawer.
-   **🔐 Enterprise Security**: Robust Row Level Security (RLS) powered by Supabase, ensuring data privacy per institution.
-   **🌐 Multi-Language Support**: Full support for English and Sinhala (සිංහල).
-   **📥 Bulk Data Import**: Effortless Excel (.xlsx) and CSV uploads for rapid data population.

## 🛠 Tech Stack

-   **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
-   **Database & Auth**: [Supabase](https://supabase.com/)
-   **Charts**: [Chart.js](https://www.chartjs.org/)
-   **Styling**: Vanilla CSS with Modern Design Tokens
-   **Reporting**: [jsPDF](https://rawgit.com/MrRio/jsPDF/master/docs/index.html) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jspdf-autotable)

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/tharushi1019/edu-insights.git
cd EduInsights
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup
Apply the `schema.sql` in your Supabase SQL Editor to initialize tables and RLS policies.

### 5. Run Development Server
```bash
npm run dev
```

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
 
