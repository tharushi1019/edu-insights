# 🎓 EduInsights Pro

[![Next.js](https://img.shields.io/badge/Next.js-15+-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **High-Performance G.C.E. O/L Analytics Dashboard**
> EduInsights is a production-grade analytics platform designed for educators to track, analyze, and report student examination performance with executive-level precision.

![Dashboard Preview](/dashboard-preview.png)

## 🚀 Overview

EduInsights Pro transforms raw examination data into actionable intelligence. Built with a focus on speed, security, and user experience, it empowers educational institutions to identify trends and optimize student outcomes.

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| **📊 Analytics** | Real-time visualization of subject performance, yearly trends, and success distributions. |
| **📄 Reporting** | **Snapshot Pro PDF Engine**: Generate high-fidelity reports with formal verification blocks. |
| **📥 Data Management** | Effortless Excel (.xlsx) and CSV uploads for rapid data population. |
| **📱 Mobile First** | Seamless experience across all devices with a dedicated navigation drawer. |
| **🔐 Security** | Enterprise-grade Row Level Security (RLS) powered by Supabase. |
| **🌐 Localization** | Native support for English and Sinhala (සිංහල). |

## 🛠 Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) (App Router, React 19)
- **Backend**: [Supabase](https://supabase.com/) (Auth, Database, RLS)
- **Charts**: [Chart.js](https://www.chartjs.org/) & [React-Chartjs-2](https://react-chartjs-2.js.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Vanilla CSS with Modern Design Tokens
- **Reporting**: [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jspdf-autotable)
- **Data**: [SheetJS (XLSX)](https://sheetjs.com/)

## 📁 Project Structure

```text
├── app/            # Next.js App Router (Pages & API)
├── components/     # Reusable UI Components
├── context/        # React Context Providers
├── lib/            # Utility functions & Supabase Client
├── public/         # Static assets (Images, Icons)
└── schema.sql      # Database initialization script
```

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

---
Built with ❤️ for Educators.
