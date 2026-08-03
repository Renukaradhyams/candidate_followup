const fs = require('fs');
let content = fs.readFileSync('client/src/pages/OfferProcess.tsx', 'utf-8');

const targetStr = `                  <div><span className="text-[#777777] block text-[10.5px]">Expected Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerOffer.expectedSalary ? \`₹ \${drawerOffer.expectedSalary}\` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{(drawerOffer.previousSalary || drawerOffer.currentSalary) ? \`₹ \${drawerOffer.previousSalary || drawerOffer.currentSalary}\` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Notice Period</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.noticePeriod || drawerOffer.offeredDoj || '—'}</span></div>`;

const replaceStr = `                  <div><span className="text-[#777777] block text-[10.5px]">Offered Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono text-emerald-700">{drawerOffer.salary ? \`₹ \${drawerOffer.salary}\` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Estimated Date of Joining</span><span className="font-extrabold text-[#1E2D4E] text-amber-700">{drawerOffer.estDoj || drawerOffer.offeredDoj || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Expected Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerOffer.expectedSalary ? \`₹ \${drawerOffer.expectedSalary}\` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{(drawerOffer.previousSalary || drawerOffer.currentSalary) ? \`₹ \${drawerOffer.previousSalary || drawerOffer.currentSalary}\` : '—'}</span></div>`;

content = content.replace(targetStr, replaceStr);

fs.writeFileSync('client/src/pages/OfferProcess.tsx', content);
console.log('Fixed OfferProcess.tsx for drawer fields');
