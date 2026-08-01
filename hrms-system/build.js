const fs = require('fs');
const { execSync } = require('child_process');

console.log('[Build] Starting client build...');
execSync('cd client && npm install --legacy-peer-deps && npm run build', {stdio: 'inherit'});

const src = fs.existsSync('client/out') ? 'client/out' : 'client/.next';
if (fs.existsSync(src)) {
    fs.cpSync(src, '../dist', {recursive: true, force: true});
    fs.cpSync(src, 'dist', {recursive: true, force: true});
    console.log('[Build] Copied client build to dist directories.');
} else {
    console.warn('[Build] Warning: Client build directory not found.');
}

// ---------------------------------------------------------
// WIPE SAMPLE DATA DURING DEPLOYMENT
// ---------------------------------------------------------
const mysql = require('mysql2/promise');
(async () => {
    try {
        console.log('[Deploy-Wipe] Connecting to database to wipe sample data...');
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'u510366842_candidate_fo',
            password: process.env.DB_PASSWORD || 'Btpldvg@2026',
            database: process.env.DB_NAME || 'u510366842_candidate',
            waitForConnections: true,
            connectionLimit: 5,
        });

        await pool.query('DELETE FROM candidates');
        await pool.query('DELETE FROM interview_schedules');
        await pool.query('DELETE FROM interview_tokens');
        await pool.query('DELETE FROM hr_evaluations');
        await pool.query('DELETE FROM interview_questions');
        await pool.query('DELETE FROM rejected_candidates');
        await pool.query('DELETE FROM selected_candidates');
        await pool.query('DELETE FROM selection_offers');
        await pool.query('DELETE FROM onboarding_records');
        await pool.query('DELETE FROM onboarding_items');

        console.log('[Deploy-Wipe] SUCCESS! Sample data has been completely wiped!');
        process.exit(0);
    } catch (err) {
        console.error('[Deploy-Wipe] ERROR during data wipe:', err.message);
        process.exit(0);
    }
})();

