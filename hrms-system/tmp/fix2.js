const fs = require('fs');
let c = fs.readFileSync('client/src/pages/Candidates.tsx', 'utf-8');
c = c.replace(/const \[offerForm, setOfferForm\] = useState\(\{ salary: '', doj: '', desig: '', department: '' \}\);/, 'const [offerForm, setOfferForm] = useState({ salary: "", doj: "", desig: "", department: "", remarks: "" });');
c = c.replace(/setOfferForm\(\{ salary: '', doj: '', desig: candidate\.desig \|\| '', department: candidate\.department \|\| '' \}\);/, 'setOfferForm({ salary: "", doj: "", desig: candidate.desig || "", department: candidate.department || "", remarks: "" });');
c = c.replace(/department: offerForm\.department/, 'department: offerForm.department,\n          remarks: offerForm.remarks');
const divSearch = '<div className="grid grid-cols-2 gap-4">';
const divReplace = `<div>
                  <label className="block text-xs font-bold text-[#1E2D4E] mb-1">Remarks (Optional)</label>
                  <textarea 
                    value={offerForm.remarks}
                    onChange={e => setOfferForm({...offerForm, remarks: e.target.value})}
                    placeholder="Enter any notes or remarks..."
                    className="w-full px-3 py-2 border border-[#e2dfd7] rounded-xl text-sm min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">`;
c = c.replace(divSearch, divReplace);
fs.writeFileSync('client/src/pages/Candidates.tsx', c);
console.log('Done');
