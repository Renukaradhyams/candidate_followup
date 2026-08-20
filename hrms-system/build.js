const fs = require('fs');
const { execSync } = require('child_process');

console.log('[Build] Starting client build...');
execSync('cd client && npm install --legacy-peer-deps && npm run build', {stdio: 'inherit'});

const path = require('path');
const src = path.join(__dirname, 'client', 'dist');
const dist = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'client', 'public');

if (fs.existsSync(src)) {
    if (fs.existsSync(dist)) {
        fs.rmSync(dist, { recursive: true, force: true });
    }
    fs.cpSync(src, dist, { recursive: true });

    if (fs.existsSync(publicDir)) {
        const files = fs.readdirSync(publicDir);
        files.forEach(file => {
            const pubPath = path.join(publicDir, file);
            fs.copyFileSync(pubPath, path.join(dist, file));
            fs.copyFileSync(pubPath, path.join(src, file));
        });
        console.log('[Build] Copied PWA public assets to dist/ & client/dist/');
    }
    console.log('[Build] Copied client build to dist/');
} else {
    console.warn('[Build] Warning: Client build directory not found at:', src);
}

console.log('[Build] Build complete.');
