const fs = require('fs');
let content = fs.readFileSync('client/src/pages/OfferProcess.tsx', 'utf-8');

const targetStr = '<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">';
const remarksSection = `{drawerOffer.remarks && (
                  <div className="mt-3 pt-3 border-t border-[#e2dfd7]">
                    <span className="text-[#777777] block text-[10.5px]">Shortlist Remarks</span>
                    <span className="font-medium text-[#1E2D4E] text-xs italic">{drawerOffer.remarks}</span>
                  </div>
                )}`;

// Insert remarks just after the grid div ends (which is after its contents).
// The grid has 5 elements inside it.
// To make it simpler, let's just insert it after the Salary & Offer Details h4 block
const h4Str = '<h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">';
// Actually, let's just replace the whole first div block that has the grid, to be safe.
const targetGridStart = '<div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">';
content = content.replace(targetGridStart, targetGridStart + '\n' + remarksSection.replace('mt-3 pt-3 border-t border-[#e2dfd7]', 'col-span-1 sm:col-span-2 mb-2'));

fs.writeFileSync('client/src/pages/OfferProcess.tsx', content);
console.log('Fixed OfferProcess.tsx for remarks');
