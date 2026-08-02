require('dotenv').config({ path: './hrms-system/server/.env' });
const candidateService = require('./hrms-system/server/services/candidateService');

async function test() {
  try {
    const data = {
      name: 'Test Name',
      phone: '1234567890',
      designation: 'Test Role'
    };
    const res = await candidateService.addCandidate(data);
    console.log('Success:', res);
  } catch (err) {
    console.error('Error adding candidate:', err);
  } finally {
    process.exit(0);
  }
}

test();
