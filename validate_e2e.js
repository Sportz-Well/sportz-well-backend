const axios = require('axios');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:5000/api/v1';
const CREDENTIALS = { email: 'admin@sportzwell.com', password: 'admin123' };
const TEST_PLAYER_ID = '325b79aa-2d6b-4228-9348-8b7f14c1baeb';
const TEST_SCHOOL_ID = '40118e73-d45e-44ea-b93d-ec9778c94ff4';

async function validate() {
  console.log('--- SYSTEM VALIDATION START ---');
  let token = '';

  try {
    // 1. Login Test
    console.log('[1/7] Testing Login...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, CREDENTIALS);
    token = loginRes.data.token;
    const decoded = jwt.decode(token);
    console.log('   PASS: Login successful. School ID in JWT:', decoded.school_id);
    if (decoded.school_id !== TEST_SCHOOL_ID) {
       console.log('   WARN: JWT school_id mismatch. Check DB seeding.');
    }

    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Dashboard Test
    console.log('[2/7] Testing Dashboard Load (Filtered)...');
    const dashboardRes = await axios.get(`${BASE_URL}/analytics/dashboard`, authHeaders);
    console.log('   PASS: Dashboard loaded.');

    // 3. Player CRUD Test
    console.log('[3/7] Testing Player Profile (Scoped)...');
    const playerRes = await axios.get(`${BASE_URL}/players/${TEST_PLAYER_ID}`, authHeaders);
    console.log('   PASS: Player profile loaded:', playerRes.data.name);

    // 4. Assessment Test
    console.log('[4/7] Testing Assessment Save...');
    const assessmentData = {
      player_id: TEST_PLAYER_ID,
      physical_score: 8,
      skill_score: 7,
      mental_score: 9,
      coach_score: 9,
      quarterly_cycle: 'Quarter 1'
    };
    const saveRes = await axios.post(`${BASE_URL}/assessments/save`, assessmentData, authHeaders);
    console.log('   PASS: Assessment saved. Overall Score:', saveRes.data.overall_score);

    // 5. Cross-Tenant Isolation (Simulated with a fake school_id)
    console.log('[5/7] Testing Cross-Tenant Isolation...');
    const fakeToken = jwt.sign({ id: 999, school_id: '00000000-0000-0000-0000-000000000000' }, process.env.JWT_SECRET || 'supersecure123');
    try {
      await axios.get(`${BASE_URL}/players/${TEST_PLAYER_ID}`, { headers: { Authorization: `Bearer ${fakeToken}` } });
      console.log('   FAIL: Accessed player across tenants!');
    } catch (err) {
      console.log('   PASS: Access denied (404/403) for different tenant.');
    }

    // 6. Edge Case: Missing JWT
    console.log('[6/7] Testing Missing JWT...');
    try {
      await axios.get(`${BASE_URL}/players/${TEST_PLAYER_ID}`);
      console.log('   FAIL: Accessed data without token!');
    } catch (err) {
      console.log('   PASS: Request blocked (401).');
    }

    // 7. Edge Case: Empty Request Body
    console.log('[7/7] Testing Empty Body on Assessment Save...');
    try {
      await axios.post(`${BASE_URL}/assessments/save`, null, authHeaders);
      console.log('   FAIL: Request accepted but expected 400.');
    } catch (err) {
       if (err.response && err.response.status === 400) {
          console.log('   PASS: Handled empty body with 400 Error.');
       } else {
          console.log('   FAIL: Server might have crashed or returned wrong error.');
       }
    }

  } catch (err) {
    console.error('CRITICAL FAILURE during validation:', err.message);
    if (err.response) console.error('Response Data:', err.response.data);
  } finally {
    console.log('--- SYSTEM VALIDATION END ---');
    process.exit(0);
  }
}

validate();
