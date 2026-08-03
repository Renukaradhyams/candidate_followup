const fs = require('fs');
let content = fs.readFileSync('server/controllers/offerController.js', 'utf-8');

const querySearch = `        SELECT 
          so.*,
          he.hr_score_json,
          he.assigned_score_json,
          c.salary,
          c.department as cand_department
        FROM selection_offers so`;
const queryReplace = `        SELECT 
          so.*,
          he.hr_score_json,
          he.assigned_score_json,
          c.salary,
          c.department as cand_department,
          c.dob,
          c.email,
          c.phone,
          c.gender,
          c.experience,
          c.retail_experience,
          c.blood_group as maritalStatus,
          c.city_state as location,
          c.expected_salary as expectedSalary,
          c.current_salary as currentSalary,
          c.previous_company as currentCompany,
          c.languages_known as languages,
          c.source
        FROM selection_offers so`;
content = content.replace(querySearch, queryReplace);

const mapSearch = `        return {
          appNo: r.app_no,
          name: r.name,
          initials,
          color: colors[colorIndex],
          desig: r.designation,`;
const mapReplace = `        return {
          appNo: r.app_no,
          name: r.name,
          initials,
          color: colors[colorIndex],
          desig: r.designation,
          dob: (r.dob && !isNaN(new Date(r.dob).getTime())) ? new Date(r.dob).toISOString().split('T')[0] : '',
          email: r.email || '',
          phone: r.phone || '',
          gender: r.gender || '',
          experience: r.experience || '',
          retailExperience: r.retail_experience || '',
          maritalStatus: r.maritalStatus || '',
          location: r.location || '',
          expectedSalary: r.expectedSalary || '',
          currentSalary: r.currentSalary || '',
          currentCompany: r.currentCompany || '',
          languages: r.languages || '',
          source: r.source || '',`;
content = content.replace(mapSearch, mapReplace);

fs.writeFileSync('server/controllers/offerController.js', content);
console.log('Fixed offerController.js');
