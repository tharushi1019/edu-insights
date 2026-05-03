
export type Language = 'en' | 'si';

export const translations = {
  en: {
    // Sidebar / Navigation
    dashboard: "Dashboard",
    trends: "Performance Trends",
    addRecord: "Add Record",
    excelUpload: "Excel Upload",
    settings: "Settings",
    signOut: "Sign Out",
    portalTitle: "Academic Analytics Portal",

    // Dashboard Overview
    overviewTitle: "Academic Overview",
    overviewSubtitle: "Performance summary for the academic year",
    totalStudents: "Total Students Sat",
    overallPassRate: "Overall Pass Rate",
    bestSubject: "Best Performing Subject",
    totalSubjects: "Total Subjects Analyzed",
    visualInsights: "Subject Visual Insights",
    passRateComparison: "Pass Rate Comparison",
    successMetrics: "Success metrics across all subjects",
    officialPdf: "Generate Official PDF",
    exportExcel: "Export Raw Data (Excel)",
    tabularSummary: "Tabular Summary",
    subject: "Subject",
    totalSat: "Total Sat",
    passed: "Passed",
    failed: "Failed",
    successRate: "Success Rate",
    actions: "Actions",
    editRecord: "Edit Record",

    // Trends Page
    performanceTrends: "Performance Trends",
    trendsSubtitle: "Deep dive into historical growth and participation metrics.",
    participationMetrics: "Participation & Success Metrics",
    last5Years: "Last 5 Academic Years",
    downloadTrendPdf: "Download Trend PDF",
    institutionBranding: "Institution Branding",
    subjectFilter: "Subject Filter",

    // Add Record
    addNewRecord: "Add New Exam Record",
    addSubtitle: "Manually input student performance data for specific subjects.",
    selectSubject: "Select Subject",
    enterYear: "Enter Academic Year",
    saveRecord: "Save Record",

    // Settings
    systemSettings: "System Settings",
    settingsSubtitle: "Manage your institution branding and account preferences.",
    institutionBrandingTitle: "Institution Branding",
    schoolNameLabel: "Default School Name",
    saveChanges: "Save Profile Changes",
    accountSecurity: "Account & Security",
    resetAnalytics: "Reset Analytics",
    deleteAccount: "Delete Account",

    // Onboarding
    welcome: "Welcome to EduInsights!",
    onboardingDesc: "To personalize your academic reports, please enter your institution's name.",
    getStarted: "Get Started",
  },
  si: {
    // Sidebar / Navigation
    dashboard: "පුවරුව",
    trends: "කාර්යසාධන ප්‍රවණතා",
    addRecord: "වාර්තාවක් එක් කරන්න",
    excelUpload: "Excel මගින් එක් කරන්න",
    settings: "සැකසුම්",
    signOut: "ඉවත් වන්න",
    portalTitle: "ශාස්ත්‍රීය විශ්ලේෂණ ද්වාරය",

    // Dashboard Overview
    overviewTitle: "ශාස්ත්‍රීය දළ විශ්ලේෂණය",
    overviewSubtitle: "අධ්‍යයන වර්ෂය සඳහා කාර්යසාධන සාරාංශය",
    totalStudents: "මුළු සිසුන් ගණන",
    overallPassRate: "මුළු සමත් ප්‍රතිශතය",
    bestSubject: "හොඳම විෂය",
    totalSubjects: "විශ්ලේෂණය කළ විෂයයන්",
    visualInsights: "විෂය දෘශ්‍ය තීක්ෂ්ණ බුද්ධිය",
    passRateComparison: "සමත් ප්‍රතිශත සංසන්දනය",
    successMetrics: "සියලුම විෂයයන්හි සාර්ථකත්ව මිනුම්",
    officialPdf: "නිල PDF වාර්තාවක් සාදන්න",
    exportExcel: "දත්ත අපනයනය කරන්න (Excel)",
    tabularSummary: "වගු සාරාංශය",
    subject: "විෂයය",
    totalSat: "පෙනී සිටි මුළු ගණන",
    passed: "සමත්",
    failed: "අසමත්",
    successRate: "සාර්ථකත්ව ප්‍රතිශතය",
    actions: "ක්‍රියා",
    editRecord: "වාර්තාව සංස්කරණය කරන්න",

    // Trends Page
    performanceTrends: "කාර්යසාධන ප්‍රවණතා",
    trendsSubtitle: "ඓතිහාසික වර්ධනය සහ සහභාගීත්ව මිනුම් පිළිබඳ ගැඹුරු විශ්ලේෂණය.",
    participationMetrics: "සහභාගීත්වය සහ සාර්ථකත්ව මිනුම්",
    last5Years: "අවසාන අධ්‍යයන වර්ෂ 5",
    downloadTrendPdf: "ප්‍රවණතා PDF බාගන්න",
    institutionBranding: "ආයතනික සන්නාමය",
    subjectFilter: "විෂය පෙරහන",

    // Add Record
    addNewRecord: "නව විභාග වාර්තාවක් එක් කරන්න",
    addSubtitle: "විශේෂිත විෂයයන් සඳහා ශිෂ්‍ය කාර්යසාධන දත්ත අතින් ඇතුළත් කරන්න.",
    selectSubject: "විෂය තෝරන්න",
    enterYear: "අධ්‍යයන වර්ෂය ඇතුළත් කරන්න",
    saveRecord: "වාර්තාව සුරකින්න",

    // Settings
    systemSettings: "පද්ධති සැකසුම්",
    settingsSubtitle: "ඔබේ ආයතනික සන්නාමය සහ ගිණුම් මනාප කළමනාකරණය කරන්න.",
    institutionBrandingTitle: "ආයතනික සන්නාමය",
    schoolNameLabel: "පාසලේ නම",
    saveChanges: "වෙනස්කම් සුරකින්න",
    accountSecurity: "ගිණුම සහ ආරක්ෂාව",
    resetAnalytics: "දත්ත නැවත සකසන්න",
    deleteAccount: "ගිණුම මකා දමන්න",

    // Onboarding
    welcome: "EduInsights වෙත සාදරයෙන් පිළිගනිමු!",
    onboardingDesc: "ඔබේ ශාස්ත්‍රීය වාර්තා පුද්ගලීකරණය කිරීමට, කරුණාකර ඔබේ පාසලේ නම ඇතුළත් කරන්න.",
    getStarted: "ආරම්භ කරන්න",
  }
};
