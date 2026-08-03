const fs = require('fs');
let content = fs.readFileSync('client/src/pages/OfferProcess.tsx', 'utf-8');

content = content.replace(/filtered\.map\(/g, '(filtered || []).map(');
content = content.replace(/designations\.map\(/g, '(designations || []).map(');
content = content.replace(/filtered\.length/g, '(filtered || []).length');

fs.writeFileSync('client/src/pages/OfferProcess.tsx', content);
console.log('Fixed undefined map issues in OfferProcess.tsx');
