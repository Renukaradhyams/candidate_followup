const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Candidates.tsx', 'utf-8');

// 1. Fix .map calls
content = content.replace(/filtered\.map\(/g, '(filtered || []).map(');
content = content.replace(/designations\.map\(/g, '(designations || []).map(');
content = content.replace(/selRejData\.map\(/g, '(selRejData || []).map(');
content = content.replace(/activityLog\.map\(/g, '(activityLog || []).map(');
content = content.replace(/candidates\.map\(/g, '(candidates || []).map(');

// 2. Add inline dropdown instead of StatusBadge
const target = `<td className="py-3.5 px-4">
                          <StatusBadge status={c.status} size="sm" />
                        </td>`;

const replacement = `<td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={c.status} size="sm" />
                            <select
                              value={c.status}
                              onChange={async (e) => {
                                const newStatus = e.target.value;
                                try {
                                  await API.updateCandidate(c.appNo, { status: newStatus, remarks: 'Status updated manually' });
                                  loadCandidates();
                                  showToast(\`Status updated to \${newStatus}\`, 'success');
                                } catch(err) {
                                  showToast('Failed to update status', 'error');
                                }
                              }}
                              className="px-1 py-0.5 text-[10px] font-bold text-slate-500 bg-transparent cursor-pointer border-none outline-none hover:text-slate-800 transition-colors"
                            >
                              <option value="New">New</option>
                              <option value="Shortlisted">Shortlisted</option>
                              <option value="Interview Completed">Interview Completed</option>
                              <option value="Selected">Selected</option>
                              <option value="Offer Sent">Offer Sent</option>
                              <option value="On Hold">On Hold</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </div>
                        </td>`;

content = content.replace(target, replacement);

fs.writeFileSync('client/src/pages/Candidates.tsx', content);
console.log('Fixed Candidates.tsx map and status dropdown');
