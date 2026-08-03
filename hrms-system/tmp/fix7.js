const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Candidates.tsx', 'utf-8');

const statusSearch = `<td className="py-3.5 px-4">
                          <StatusBadge status={c.status} size="sm" />
                        </td>`;
const statusReplace = `<td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
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
                            className="px-2 py-1 text-[11px] rounded bg-white border border-[#e2dfd7] text-[#1E2D4E] font-bold outline-none cursor-pointer"
                          >
                            <option value="New">New</option>
                            <option value="Shortlisted">Shortlisted</option>
                            <option value="1st Call Done">1st Call Done</option>
                            <option value="2nd Call Done">2nd Call Done</option>
                            <option value="Interview Scheduled">Interview Scheduled</option>
                            <option value="Interviewed">Interviewed</option>
                            <option value="Selected">Selected</option>
                            <option value="Offer Sent">Offer Sent</option>
                            <option value="Offer Accepted">Offer Accepted</option>
                            <option value="Joined">Joined</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </td>`;
content = content.replace(statusSearch, statusReplace);

fs.writeFileSync('client/src/pages/Candidates.tsx', content);
console.log('Fixed Candidates.tsx status dropdown');
