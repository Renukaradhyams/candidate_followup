const fs = require('fs');

let offer = fs.readFileSync('client/src/pages/OfferProcess.tsx', 'utf-8');
const startMatch = '{drawerOffer && (';
const endMatch = '        </div>\n      )}';

const startIndex = offer.indexOf(startMatch);
const endIndex = offer.indexOf(endMatch, startIndex) + endMatch.length;

if(startIndex !== -1) {
  const replacement = `{drawerOffer && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setDrawerOffer(null)} />
          <div className="relative w-full max-w-2xl bg-[#EDE8DE] h-full shadow-2xl flex flex-col z-10 animate-slide-in">
            <div className="bg-[#1E2D4E] text-white p-4 lg:p-6 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black text-lg lg:text-xl tracking-tight">{drawerOffer.name}</h3>
                <div className="text-white/70 text-xs font-mono font-medium flex gap-3 mt-1">
                  <span>{drawerOffer.appNo}</span>
                  <span>{drawerOffer.email}</span>
                </div>
              </div>
              <button onClick={() => setDrawerOffer(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#C9952A]" />
                  <span>Salary & Offer Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div><span className="text-[#777777] block text-[10.5px]">Expected Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{drawerOffer.expectedSalary ? \`₹ \${drawerOffer.expectedSalary}\` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Salary</span><span className="font-extrabold text-[#1E2D4E] font-mono">{(drawerOffer.previousSalary || drawerOffer.currentSalary) ? \`₹ \${drawerOffer.previousSalary || drawerOffer.currentSalary}\` : '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Notice Period</span><span className="font-bold text-[#1E2D4E]">{drawerOffer.noticePeriod || drawerOffer.offeredDoj || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Allocated Department</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.department || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Designation Role</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.desig || drawerOffer.designation || '—'}</span></div>
                </div>
              </div>
              <div className="p-5 rounded-2xl bg-white border border-[#e2dfd7] shadow-xs space-y-3">
                <h4 className="font-extrabold text-[#1E2D4E] uppercase text-xs tracking-wider border-b border-[#e2dfd7] pb-2 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#C9952A]" />
                  <span>Work Experience Details</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div><span className="text-[#777777] block text-[10.5px]">Total Work Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.experience || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Prior / Retail Experience</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.retailExperience || drawerOffer.retail_experience || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Company / Employer</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.previousCompany || drawerOffer.previous_company || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Previous Role / Designation</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.previousDesignation || drawerOffer.previous_designation || '—'}</span></div>
                  <div><span className="text-[#777777] block text-[10.5px]">Highest Qualification</span><span className="font-extrabold text-[#1E2D4E]">{drawerOffer.qualification || '—'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}`;
      
  offer = offer.substring(0, startIndex - 6) + replacement + offer.substring(endIndex);
  fs.writeFileSync('client/src/pages/OfferProcess.tsx', offer);
  console.log('Fixed Drawer');
} else {
  console.log('Drawer not found');
}
