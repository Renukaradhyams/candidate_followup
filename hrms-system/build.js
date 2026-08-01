const fs = require('fs');
const { execSync } = require('child_process');

console.log('[Build] Starting client build...');
execSync('cd client && npm install --legacy-peer-deps && npm run build', {stdio: 'inherit'});

const src = fs.existsSync('client/out') ? 'client/out' : 'client/.next';
if (fs.existsSync(src)) {
    if (!fs.existsSync('../dist')) fs.cpSync(src, '../dist', {recursive: true});
    if (!fs.existsSync('dist')) fs.cpSync(src, 'dist', {recursive: true});
    console.log('[Build] Copied client build to dist directories.');
} else {
    console.warn('[Build] Warning: Client build directory not found.');
}
