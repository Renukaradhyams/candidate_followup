const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Candidates.tsx', 'utf-8');

const target = `                          <td className="py-3.5 px-4 text-[#666666] whitespace-nowrap font-medium">{c.date}</td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={c.status} size="sm" />
                          </td>
                          <td className="py-3.5 px-4 text-right">`;

const replacement = `                          <td className="py-3.5 px-4 text-[#666666] whitespace-nowrap font-medium">{c.date}</td>
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
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
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">`;

content = content.replace(target, replacement);

fs.writeFileSync('client/src/pages/Candidates.tsx', content);
console.log('Fixed Candidates.tsx status dropdown successfully');
