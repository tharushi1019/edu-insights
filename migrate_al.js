const fs = require('fs');
let content = fs.readFileSync('app/dashboard/ol/page.tsx', 'utf8');

// The OL file now uses exam_type: 'OL'. We need to replace it with 'AL'.
content = content.replace(/exam_type: 'OL'/g, "exam_type: 'AL'");
content = content.replace(/.eq\('exam_type', 'OL'\)/g, ".eq('exam_type', 'AL')");

// Standard Replacements
content = content.replace(/OLPage/g, 'ALPage');
content = content.replace(/t\('olPerformance'\)/g, 't(\'alPerformance\')');
content = content.replace(/t\('olSubtitle'\)/g, 't(\'alSubtitle\')');
content = content.replace(/O\/L PERFORMANCE REPORT/g, 'A/L PERFORMANCE REPORT');
content = content.replace(/_OL_Report_/g, '_AL_Report_');
content = content.replace(/O-L-Export/g, 'A-L-Export');
content = content.replace(/O-L Results/g, 'A-L Results');
content = content.replace(/Add O\/L Record/g, 'Add A/L Record');
content = content.replace(/Bulk Upload O\/L Records/g, 'Bulk Upload A/L Records');
content = content.replace(/>W</g, '>F<'); // The W column header and Grade W label
content = content.replace(/'W'/g, '\'F\''); // The chart dataset label W -> F
content = content.replace(/item\.W/g, 'item.F'); // Excel import

// Excel import columns validation string
content = content.replace(/Total, A, B, C, S, W/g, 'Total, A, B, C, S, F, Absent');

// Replace the subject dropdown options
const alSubjects = `
                <optgroup label="Common Compulsory Papers">
                    <option value="General English (A/L)">General English</option>
                    <option value="Common General Test (A/L)">Common General Test</option>
                </optgroup>
                <optgroup label="Physical Science (Maths)">
                    <option value="Combined Mathematics (A/L)">Combined Mathematics</option>
                    <option value="Physics (A/L)">Physics</option>
                    <option value="Chemistry (A/L)">Chemistry</option>
                    <option value="Information & Communication Technology (ICT) (A/L)">Information & Communication Technology (ICT)</option>
                </optgroup>
                <optgroup label="Biological Science">
                    <option value="Biology (A/L)">Biology</option>
                    <option value="Chemistry (A/L)">Chemistry</option>
                    <option value="Physics (A/L)">Physics</option>
                    <option value="Agricultural Science (A/L)">Agricultural Science</option>
                </optgroup>
                <optgroup label="Commerce">
                    <option value="Accounting (A/L)">Accounting</option>
                    <option value="Business Studies (A/L)">Business Studies</option>
                    <option value="Economics (A/L)">Economics</option>
                    <option value="Business Statistics (A/L)">Business Statistics</option>
                    <option value="Information & Communication Technology (ICT) (A/L)">Information & Communication Technology (ICT)</option>
                </optgroup>
                <optgroup label="Technology">
                    <option value="Engineering Technology (A/L)">Engineering Technology</option>
                    <option value="Bio Systems Technology (A/L)">Bio Systems Technology</option>
                    <option value="Science for Technology (A/L)">Science for Technology</option>
                    <option value="Information & Communication Technology (ICT) (A/L)">Information & Communication Technology (ICT)</option>
                </optgroup>
                <optgroup label="Arts: Social Sciences">
                    <option value="Geography (A/L)">Geography</option>
                    <option value="Political Science (A/L)">Political Science</option>
                    <option value="Economics (A/L)">Economics</option>
                    <option value="History (A/L)">History</option>
                    <option value="Logic & Scientific Method (A/L)">Logic & Scientific Method</option>
                    <option value="Media & Communication Studies (A/L)">Media & Communication Studies</option>
                </optgroup>
                <optgroup label="Arts: Languages & Literature">
                    <option value="Sinhala (A/L)">Sinhala</option>
                    <option value="Tamil (A/L)">Tamil</option>
                    <option value="English (A/L)">English</option>
                    <option value="French (A/L)">French</option>
                    <option value="Japanese (A/L)">Japanese</option>
                    <option value="Chinese (A/L)">Chinese</option>
                    <option value="Arabic (A/L)">Arabic</option>
                    <option value="Pali (A/L)">Pali</option>
                    <option value="Sanskrit (A/L)">Sanskrit</option>
                </optgroup>
                <optgroup label="Arts: Aesthetics & Others">
                    <option value="Art (A/L)">Art</option>
                    <option value="Dancing (A/L)">Dancing</option>
                    <option value="Music (A/L)">Music</option>
                    <option value="Drama & Theatre (A/L)">Drama & Theatre</option>
                    <option value="Home Economics (A/L)">Home Economics</option>
                    <option value="Agricultural Science (A/L)">Agricultural Science</option>
                </optgroup>`;
                
const olSubjectsRegex = /<optgroup label="Compulsory Subjects">[\s\S]*?<\/optgroup>[\s\S]*?<optgroup label="Basket I: Commerce & Social Studies">[\s\S]*?<\/optgroup>[\s\S]*?<optgroup label="Basket II: Aesthetic Subjects">[\s\S]*?<\/optgroup>[\s\S]*?<optgroup label="Basket III: Technical & Practical Subjects">[\s\S]*?<\/optgroup>/g;
content = content.replace(olSubjectsRegex, alSubjects);

// Replace template array
const alTemplate = `[
      { Year: currentYear, Subject: 'General English (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Common General Test (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Combined Mathematics (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Physics (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Chemistry (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Biology (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Information & Communication Technology (ICT) (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Accounting (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Business Studies (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Economics (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Business Statistics (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Engineering Technology (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Bio Systems Technology (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Science for Technology (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Geography (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Political Science (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'History (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Logic & Scientific Method (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Media & Communication Studies (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Sinhala (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Art (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Dancing (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Music (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Drama & Theatre (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Home Economics (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 },
      { Year: currentYear, Subject: 'Agricultural Science (A/L)', Total: 0, A: 0, B: 0, C: 0, S: 0, F: 0, Absent: 0 }
    ]`;
const olTemplateRegex = /\[\s*\{\s*Year: currentYear, Subject: 'Mathematics'[\s\S]*?\]/g;
content = content.replace(olTemplateRegex, alTemplate);

// Template naming
content = content.replace(/OL Template/g, 'AL Template');
content = content.replace(/OL_Template\.xlsx/g, 'AL_Template.xlsx');
content = content.replace(/olBar/g, 'alBar');
content = content.replace(/subNamesOL/g, 'subNamesAL');
content = content.replace(/subADataOL/g, 'subADataAL');
content = content.replace(/subBDataOL/g, 'subBDataAL');
content = content.replace(/subCDataOL/g, 'subCDataAL');
content = content.replace(/subSDataOL/g, 'subSDataAL');
content = content.replace(/subWDataOL/g, 'subWDataAL');

// A/L Subject Suffix Auto-Appending & Normalization
content = content.replace(
  /const finalSubjectName = isCustomSubject \? formData\.customSubject : formData\.subject;\s*if \(!finalSubjectName\) throw new Error\('Please select or enter a subject'\);/,
  "let finalSubjectName = (isCustomSubject ? formData.customSubject : formData.subject || '').trim();\n      if (!finalSubjectName) throw new Error('Please select or enter a subject');\n\n      // Auto-append (A/L) if not present\n      if (!finalSubjectName.endsWith(' (A/L)')) {\n        finalSubjectName = `${finalSubjectName} (A/L)`;\n      }"
);

content = content.replace(
  "const uniqueSubjects = [...new Set(parsedData.map((item: any) => item.Subject))];",
  "const uniqueSubjects = [...new Set(parsedData.map((item: any) => {\n        let name = (item.Subject || '').trim();\n        if (!name.endsWith(' (A/L)')) {\n          name = `${name} (A/L)`;\n        }\n        return name;\n      }))];"
);

content = content.replace(
  "subject_id: subMap[item.Subject],",
  "subject_id: subMap[(item.Subject || '').trim().endsWith(' (A/L)') ? (item.Subject || '').trim() : `${(item.Subject || '').trim()} (A/L)`],"
);

fs.writeFileSync('app/dashboard/al/page.tsx', content);
console.log('Successfully generated clean app/dashboard/al/page.tsx with (A/L) suffix normalization');
