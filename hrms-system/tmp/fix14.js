const fs = require('fs');
let content = fs.readFileSync('client/src/pages/Candidates.tsx', 'utf-8');

// 1. Add confirmStatusModal and highlightAppNo states
const stateSearch = `  const [directOfferModal, setDirectOfferModal] = useState<{ open: boolean; candidate: any | null }>({ open: false, candidate: null });`;
const stateReplace = `  const [directOfferModal, setDirectOfferModal] = useState<{ open: boolean; candidate: any | null }>({ open: false, candidate: null });
  const [confirmStatusModal, setConfirmStatusModal] = useState<{ open: boolean; candidate: any | null; newStatus: string }>({ open: false, candidate: null, newStatus: '' });
  const [highlightAppNo, setHighlightAppNo] = useState<string | null>(null);`;

content = content.replace(stateSearch, stateReplace);

// 2. Add handleStatusSelect and executeStatusChange functions
const handlerSearch = `  const handleDeleteCandidate = async (appNo: string) => {`;
const handlerReplace = `  const handleStatusSelect = (candidate: any, targetStatus: string) => {
    if (!candidate || candidate.status === targetStatus) return;

    if (targetStatus === 'Shortlisted' || targetStatus === 'Offer Sent') {
      setDirectOfferModal({ open: true, candidate });
      setOfferForm({ salary: "", incentive: "", doj: "", desig: candidate.desig || "", department: candidate.department || "", remarks: "" });
      return;
    }

    setConfirmStatusModal({ open: true, candidate, newStatus: targetStatus });
  };

  const executeStatusChange = async () => {
    if (!confirmStatusModal.candidate || !confirmStatusModal.newStatus || actionLoading) return;
    const c = confirmStatusModal.candidate;
    const targetStatus = confirmStatusModal.newStatus;

    setActionLoading(true);
    try {
      if (targetStatus === 'Rejected') {
        await API.rejectCandidate({ appNo: c.appNo, remarks: 'Status updated to Rejected', candName: c.name });
      } else {
        await API.updateCandidate(c.appNo, { status: targetStatus, remarks: \`Status updated to \${targetStatus}\` });
      }
      showToast(\`\${c.name} updated to \${targetStatus} 🎉\`, 'success');
      setHighlightAppNo(c.appNo);
      setTimeout(() => setHighlightAppNo(null), 2500);
      setConfirmStatusModal({ open: false, candidate: null, newStatus: '' });
      loadCandidates();
    } catch (err: any) {
      showToast('Failed to update status: ' + err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCandidate = async (appNo: string) => {`;

content = content.replace(handlerSearch, handlerReplace);

// 3. Update table row rendering & interactive status dropdown
const rowSearch = `                    (filtered || []).map((c) => (
                      <tr key={c.appNo} className="hover:bg-black/5 transition-colors font-medium">
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#555555] font-bold">{c.appNo}</td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => openDrawer(c)}
                            className="flex items-center gap-3 group text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {c.initials}
                            </div>
                            <span className="font-extrabold text-[#1E2D4E] group-hover:underline">{c.name}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#555555]">{maskPhone(c.phone)}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-semibold">{c.gender || '—'}</td>
                        <td className="py-3.5 px-4 text-[#1E2D4E] font-extrabold">{c.desig}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-medium">{c.source}</td>
                        <td className="py-3.5 px-4 text-[#666666] whitespace-nowrap font-medium">{c.date}</td>
                        <td className="py-3.5 px-4">
                          <StatusBadge status={c.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.status === 'New' && (
                              <button
                                onClick={() => handleStatusChange('shortlist', c)}
                                className="px-2.5 py-1 rounded-lg border border-[#1E2D4E] text-[#1E2D4E] font-bold hover:bg-[#1E2D4E] hover:text-white transition-all text-[11px]"
                              >
                                Shortlist
                              </button>
                            )}
                            {(c.status === 'Shortlisted' || c.status === '1st Call' || c.status === '2nd Call') && (
                              <button
                                onClick={() => handleStatusChange('schedule', c)}
                                className="px-2.5 py-1 rounded-lg bg-[#1E2D4E] text-white font-bold hover:bg-[#162340] transition-all text-[11px] shadow-xs"
                              >
                                📅 Schedule Interview
                              </button>
                            )}
                            <button
                              onClick={() => navigate(\`/candidate-entry?edit=\${c.appNo}\`)}
                              className="p-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors"
                              title="Edit Candidate Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteCandidate(c.appNo)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors"
                                title="Delete Candidate Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))`;

const rowReplace = `                    (filtered || []).map((c) => (
                      <tr 
                        key={c.appNo} 
                        className={\`transition-all duration-300 font-medium \${highlightAppNo === c.appNo ? 'bg-amber-100/80 ring-2 ring-[#C9952A]' : 'hover:bg-black/5'}\`}
                      >
                        <td className="py-3.5 px-4 font-mono text-[11px] text-[#555555] font-bold">{c.appNo}</td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => openDrawer(c)}
                            className="flex items-center gap-3 group text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-[#1E2D4E] text-white font-black text-xs flex items-center justify-center shadow-xs">
                              {c.initials}
                            </div>
                            <span className="font-extrabold text-[#1E2D4E] group-hover:underline">{c.name}</span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[#555555]">{maskPhone(c.phone)}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-semibold">{c.gender || '—'}</td>
                        <td className="py-3.5 px-4 text-[#1E2D4E] font-extrabold">{c.desig}</td>
                        <td className="py-3.5 px-4 text-[#555555] font-medium">{c.source}</td>
                        <td className="py-3.5 px-4 text-[#666666] whitespace-nowrap font-medium">{c.date}</td>
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={c.status} size="sm" />
                            <select
                              value={c.status}
                              onChange={(e) => handleStatusSelect(c, e.target.value)}
                              className="px-2 py-0.5 text-[11px] font-extrabold bg-white border border-[#e2dfd7] hover:border-[#1E2D4E] text-[#1E2D4E] rounded-lg cursor-pointer outline-none shadow-2xs transition-all hover:bg-[#F9F7F4]"
                              title="Click to move status"
                            >
                              <option value="New">▼ New</option>
                              <option value="Shortlisted">▼ Shortlisted</option>
                              <option value="1st Call Logged">▼ 1st Call Logged</option>
                              <option value="Interview Scheduled">▼ Interview Scheduled</option>
                              <option value="Interview Completed">▼ Interview Completed</option>
                              <option value="Selected">▼ Selected</option>
                              <option value="Offer Sent">▼ Offer Sent</option>
                              <option value="Joined">▼ Joined</option>
                              <option value="On Hold">▼ On Hold</option>
                              <option value="Rejected">▼ Rejected</option>
                            </select>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openDrawer(c)}
                              className="px-2 py-1 rounded-lg border border-[#e2dfd7] text-[#1E2D4E] font-bold hover:bg-[#F9F7F4] transition-all text-[11px]"
                              title="View Full Profile"
                            >
                              View
                            </button>
                            <button
                              onClick={() => navigate(\`/candidate-entry?edit=\${c.appNo}\`)}
                              className="p-1.5 rounded-lg border border-emerald-600 text-emerald-700 font-bold hover:bg-emerald-50 transition-colors"
                              title="Edit Candidate Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteCandidate(c.appNo)}
                                className="p-1.5 rounded-lg border border-rose-200 text-rose-600 font-bold hover:bg-rose-50 transition-colors"
                                title="Delete Candidate Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))`;

content = content.replace(rowSearch, rowReplace);

// 4. Inject Confirm Status Modal JSX right before ToastContainer or bottom
const modalJSX = `
      {/* Professional Status Change Confirmation Modal */}
      {confirmStatusModal.open && confirmStatusModal.candidate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#1E2D4E]/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#e2dfd7] space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#1E2D4E] text-white flex items-center justify-center font-black text-sm shadow-md">
                  {confirmStatusModal.candidate.initials}
                </div>
                <div>
                  <h3 className="font-extrabold text-[#1E2D4E] text-base">Move Candidate Status</h3>
                  <div className="text-xs text-[#777777] font-semibold">{confirmStatusModal.candidate.name} ({confirmStatusModal.candidate.appNo})</div>
                </div>
              </div>
              <button onClick={() => setConfirmStatusModal({ open: false, candidate: null, newStatus: '' })} className="text-[#888888] hover:text-[#1E2D4E]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#F9F7F4] p-4 rounded-2xl border border-[#e2dfd7] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#777777] uppercase text-[10px]">Current Status</span>
                <StatusBadge status={confirmStatusModal.candidate.status} size="sm" />
              </div>
              <div className="flex justify-center text-[#C9952A]">
                <ChevronRight className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#777777] uppercase text-[10px]">New Status</span>
                <StatusBadge status={confirmStatusModal.newStatus} size="sm" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#e2dfd7]">
              <button 
                onClick={() => setConfirmStatusModal({ open: false, candidate: null, newStatus: '' })} 
                className="px-4 py-2 rounded-xl border border-[#e2dfd7] font-bold text-xs text-[#1E2D4E] hover:bg-[#F9F7F4] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeStatusChange} 
                disabled={actionLoading} 
                className="btn-primary text-xs shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Confirm Status Change'}
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace('<ToastContainer />', `${modalJSX}\n      <ToastContainer />`);

fs.writeFileSync('client/src/pages/Candidates.tsx', content);
console.log('Successfully updated Candidates.tsx with interactive status dropdown and confirmation modal.');
