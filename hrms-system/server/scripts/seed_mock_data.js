const db = require('../config/db');

async function seedMockData() {
  console.log('Seeding Mock Data (10 Candidates/Employees)...');
  try {
    const mockData = [
      { appNo: 'APP26-1001', name: 'John Doe', phone: '9876543210', role: 'Sales Executive', status: 'Offer Accepted' },
      { appNo: 'APP26-1002', name: 'Jane Smith', phone: '9876543211', role: 'Floor Manager', status: 'Interviewing' },
      { appNo: 'APP26-1003', name: 'Rahul Sharma', phone: '9876543212', role: 'Cashier', status: 'New' },
      { appNo: 'APP26-1004', name: 'Priya Singh', phone: '9876543213', role: 'Billing Executive', status: 'Joined' },
      { appNo: 'APP26-1005', name: 'Amit Kumar', phone: '9876543214', role: 'Store Keeper', status: 'Rejected' },
      { appNo: 'APP26-1006', name: 'Sneha Reddy', phone: '9876543215', role: 'Sales Executive', status: 'HR Round' },
      { appNo: 'APP26-1007', name: 'Vikram Patel', phone: '9876543216', role: 'Floor Manager', status: 'Offer Released' },
      { appNo: 'APP26-1008', name: 'Anjali Desai', phone: '9876543217', role: 'Cashier', status: 'Joined' },
      { appNo: 'APP26-1009', name: 'Rohan Mehta', phone: '9876543218', role: 'Billing Executive', status: 'Interviewing' },
      { appNo: 'APP26-1010', name: 'Kavita Joshi', phone: '9876543219', role: 'Store Keeper', status: 'Offer Accepted' }
    ];

    for (const c of mockData) {
      await db.query(
        `INSERT IGNORE INTO candidates (app_no, date, time, cand_name, gender, dob, address, email, phone, alt_phone,
         designation, qualification, experience, cur_company, cur_salary, exp_salary, source, notes, created_by, status)
         VALUES (?, CURDATE(), CURTIME(), ?, 'Male', '1995-01-01', 'Sample Address', ?, ?, '0000000000',
         ?, 'Graduate', '2 Years', 'Sample Co', 20000, 25000, 'Walk-in', 'Mock data', 'HR Admin', ?)`,
        [c.appNo, c.name, `${c.name.split(' ')[0].toLowerCase()}@example.com`, c.phone, c.role, c.status]
      );
    }
    console.log('✓ 10 Mock Candidates seeded.');
    return { success: true, message: "Mock data seeded successfully" };
  } catch (err) {
    console.error('Seeding Mock Data Error:', err.message);
    throw err;
  }
}

module.exports = { seedMockData };
