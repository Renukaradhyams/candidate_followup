const fs = require('fs');
let content = fs.readFileSync('client/src/pages/OfferProcess.tsx', 'utf-8');
content = content.replace(/animate-fade-in-up/g, 'animate-fade-in');
content = content.replace(/animate-fade-in-scale/g, 'animate-scale-in');
fs.writeFileSync('client/src/pages/OfferProcess.tsx', content);
console.log('Fixed animations in OfferProcess.tsx');
