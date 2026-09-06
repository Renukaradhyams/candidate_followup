import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import ToastContainer, { showToast } from '../components/Toast';
import { API, Auth, UserSession } from '../services/api';
import {
  CheckSquare,
  Sun,
  Sunrise,
  Calendar,
  Users,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Filter,
  Crown,
  Star,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Download,
  Info,
  Lock,
  Unlock,
  ShieldAlert,
  FolderTree,
  LayoutGrid,
  ListFilter,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface BatchPlan {
  id: number;
  batch_code: string;
  name: string;
  type: string;
  description: string;
  capacity: number;
  batch_leader_app_no: string | null;
  status: string;
}

interface BatchGroup {
  id: number;
  group_code: string;
  batch_id: number;
  name: string;
  group_leader_app_no: string | null;
  max_members: number;
}

interface GroupMember {
  id: number;
  candidate_app_no: string;
  batch_id: number;
  group_id: number | null;
}

interface Candidate {
  id: number;
  app_no: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  photo_url?: string;
  section?: string;
}

interface BatchMemberInfo {
  appNo: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  photoUrl?: string;
  roleInBatch: 'Batch Leader' | 'Group Leader' | 'Group Member';
  groupName: string;
  groupId: number | null;
}

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Leave';

export default function BatchAttendance() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Auto-save State
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Core Data
  const [batches, setBatches] = useState<BatchPlan[]>([]);
  const [groups, setGroups] = useState<BatchGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Selected State
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [activeTab, setActiveTab] = useState<'morning' | 'afternoon' | 'matrix'>('morning');
  const [layoutMode, setLayoutMode] = useState<'group_wise' | 'all_members'>('group_wise');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Batch Leader' | 'Group Leader' | 'Group Member'>('All');

  // Attendance Records for current day
  const [attendanceState, setAttendanceState] = useState<Record<string, {
    morningStatus: AttendanceStatus;
    morningRemarks: string;
    afternoonStatus: AttendanceStatus;
    afternoonRemarks: string;
  }>>({});

  // Matrix Summary Records (all 20 days)
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Check Session
  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    const sess = Auth.get();
    setSession(sess);
  }, [navigate]);

  // Is Batch Leader Role check
  const isBatchLeaderRole = useMemo(() => {
    return session?.role === 'Batch Leader';
  }, [session]);

  // Current Time Cutoff Lock logic for Batch Leader
  // Morning cutoff: 12:00 PM (12:00:00)
  // Afternoon cutoff: 6:30 PM (18:30:00)
  const lockStatus = useMemo(() => {
    if (!isBatchLeaderRole) {
      return { isMorningLocked: false, isAfternoonLocked: false, isPastDateLocked: false, message: 'Admin / Manager Override Active — Unrestricted Edit' };
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    if (selectedDate < todayStr) {
      return {
        isMorningLocked: true,
        isAfternoonLocked: true,
        isPastDateLocked: true,
        message: '🔒 Past date attendance is locked for Batch Leader. Contact System Admin to modify.'
      };
    }

    if (selectedDate > todayStr) {
      return {
        isMorningLocked: true,
        isAfternoonLocked: true,
        isPastDateLocked: true,
        message: '🔒 Future date attendance cannot be marked in advance.'
      };
    }

    // Today's cutoff check
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();
    const morningCutoffMins = 12 * 60; // 12:00 PM = 720 mins
    const afternoonCutoffMins = 18 * 60 + 30; // 6:30 PM = 1110 mins

    const morningLocked = curMinutes >= morningCutoffMins;
    const afternoonLocked = curMinutes >= afternoonCutoffMins;

    let msg = '';
    if (morningLocked && afternoonLocked) {
      msg = '🔒 Attendance closed for today (Morning cutoff 12:00 PM, Afternoon cutoff 6:30 PM passed). Admin override required.';
    } else if (morningLocked) {
      msg = '🔒 Morning session attendance closed at 12:00 PM. Afternoon session open until 6:30 PM.';
    } else {
      msg = '⏱️ Morning session open until 12:00 PM. Afternoon session open until 6:30 PM.';
    }

    return {
      isMorningLocked: morningLocked,
      isAfternoonLocked: afternoonLocked,
      isPastDateLocked: false,
      message: msg
    };
  }, [isBatchLeaderRole, selectedDate]);

  // Is current session tab locked for current user
  const isCurrentSessionLocked = useMemo(() => {
    if (activeTab === 'morning') return lockStatus.isMorningLocked;
    if (activeTab === 'afternoon') return lockStatus.isAfternoonLocked;
    return false;
  }, [activeTab, lockStatus]);

  // Load Batch Plan Structure
  const loadBatchStructure = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.getBatchPlanData();
      if (res && res.success !== false) {
        setBatches(res.batches || []);
        setGroups(res.groups || []);
        setGroupMembers(res.groupMembers || []);
        setCandidates(res.candidates || []);

        if (res.batches && res.batches.length > 0 && !selectedBatchId) {
          setSelectedBatchId(res.batches[0].id);
        }
      }
    } catch (err: any) {
      showToast('Error loading batch structure: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    loadBatchStructure();
  }, [loadBatchStructure]);

  // Selected Batch Object
  const currentBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId) || batches[0] || null;
  }, [batches, selectedBatchId]);

  // Compile Full Members of the Selected Batch (Batch Leader + Group Leaders + Group Members)
  const fullBatchMembers = useMemo<BatchMemberInfo[]>(() => {
    if (!currentBatch) return [];

    const memberMap = new Map<string, BatchMemberInfo>();
    const getCand = (appNo: string) => candidates.find(c => c.app_no === appNo);

    // 1. Batch Leader
    if (currentBatch.batch_leader_app_no) {
      const c = getCand(currentBatch.batch_leader_app_no);
      if (c) {
        memberMap.set(c.app_no, {
          appNo: c.app_no,
          name: c.name,
          phone: c.phone || '',
          email: c.email || '',
          department: c.department || '',
          designation: c.designation || '',
          photoUrl: c.photo_url,
          roleInBatch: 'Batch Leader',
          groupName: 'Batch Core Leadership',
          groupId: null
        });
      }
    }

    // 2. Group Leaders
    const batchGroupsList = groups.filter(g => g.batch_id === currentBatch.id);
    batchGroupsList.forEach(g => {
      if (g.group_leader_app_no) {
        const c = getCand(g.group_leader_app_no);
        if (c && !memberMap.has(c.app_no)) {
          memberMap.set(c.app_no, {
            appNo: c.app_no,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            department: c.department || '',
            designation: c.designation || '',
            photoUrl: c.photo_url,
            roleInBatch: 'Group Leader',
            groupName: g.name,
            groupId: g.id
          });
        }
      }
    });

    // 3. Group Members
    const batchMembersList = groupMembers.filter(m => m.batch_id === currentBatch.id);
    batchMembersList.forEach(m => {
      if (!memberMap.has(m.candidate_app_no)) {
        const c = getCand(m.candidate_app_no);
        const g = groups.find(grp => grp.id === m.group_id);
        if (c) {
          memberMap.set(c.app_no, {
            appNo: c.app_no,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            department: c.department || '',
            designation: c.designation || '',
            photoUrl: c.photo_url,
            roleInBatch: 'Group Member',
            groupName: g ? g.name : 'General',
            groupId: m.group_id
          });
        }
      }
    });

    return Array.from(memberMap.values());
  }, [currentBatch, groups, groupMembers, candidates]);

  // Grouped Members Map for Group-Wise Attendance List
  const groupedMembersList = useMemo(() => {
    const groupMap = new Map<string, { groupName: string; groupId: number | null; members: BatchMemberInfo[] }>();

    // Initialize entries for all groups in batch
    if (currentBatch) {
      // Core Leadership group
      groupMap.set('Batch Core Leadership', { groupName: 'Batch Core Leadership 👑', groupId: null, members: [] });
      const batchGroupsList = groups.filter(g => g.batch_id === currentBatch.id);
      batchGroupsList.forEach(g => {
        groupMap.set(g.name, { groupName: g.name, groupId: g.id, members: [] });
      });
    }

    fullBatchMembers.forEach(m => {
      const gName = m.roleInBatch === 'Batch Leader' ? 'Batch Core Leadership' : m.groupName;
      if (!groupMap.has(gName)) {
        groupMap.set(gName, { groupName: gName, groupId: m.groupId, members: [] });
      }
      groupMap.get(gName)?.members.push(m);
    });

    // Filter out empty group sections
    return Array.from(groupMap.values()).filter(g => g.members.length > 0);
  }, [currentBatch, groups, fullBatchMembers]);

  // Load Attendance Records for Selected Batch & Selected Day
  const loadDayAttendance = useCallback(async () => {
    if (!selectedBatchId) return;
    try {
      const res = await API.getBatchAttendance(selectedBatchId, selectedDay);
      if (res && res.success) {
        const map = res.attendanceMap || {};
        const newAttState: Record<string, any> = {};

        fullBatchMembers.forEach(m => {
          if (map[m.appNo]) {
            newAttState[m.appNo] = {
              morningStatus: map[m.appNo].morningStatus || 'Present',
              morningRemarks: map[m.appNo].morningRemarks || '',
              afternoonStatus: map[m.appNo].afternoonStatus || 'Present',
              afternoonRemarks: map[m.appNo].afternoonRemarks || ''
            };
          } else {
            // Default Present if not marked yet
            newAttState[m.appNo] = {
              morningStatus: 'Present',
              morningRemarks: '',
              afternoonStatus: 'Present',
              afternoonRemarks: ''
            };
          }
        });

        setAttendanceState(newAttState);
      }
    } catch (err: any) {
      showToast('Error loading attendance: ' + err.message, 'error');
    }
  }, [selectedBatchId, selectedDay, fullBatchMembers]);

  useEffect(() => {
    loadDayAttendance();
  }, [loadDayAttendance]);

  // Load 20-Day Matrix Summary
  const loadMatrixSummary = useCallback(async () => {
    if (!selectedBatchId) return;
    try {
      setMatrixLoading(true);
      const res = await API.getBatchAttendanceSummary(selectedBatchId);
      if (res && res.success) {
        setMatrixData(res.summary || []);
      }
    } catch (err: any) {
      showToast('Error loading attendance matrix: ' + err.message, 'error');
    } finally {
      setMatrixLoading(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (activeTab === 'matrix') {
      loadMatrixSummary();
    }
  }, [activeTab, loadMatrixSummary]);

  // Persist Attendance to Backend (Manual or Auto-save)
  const saveAttendanceToServer = async (updatedState?: Record<string, any>, showToastMsg = true) => {
    if (!selectedBatchId) return;
    const currentState = updatedState || attendanceState;

    try {
      setSaving(true);
      setAutoSaveStatus('saving');
      const records = fullBatchMembers.map(m => {
        const att = currentState[m.appNo] || {
          morningStatus: 'Present',
          morningRemarks: '',
          afternoonStatus: 'Present',
          afternoonRemarks: ''
        };
        return {
          candidateAppNo: m.appNo,
          morningStatus: att.morningStatus,
          morningRemarks: att.morningRemarks,
          afternoonStatus: att.afternoonStatus,
          afternoonRemarks: att.afternoonRemarks
        };
      });

      const payload = {
        batchId: selectedBatchId,
        dayNumber: selectedDay,
        attendanceDate: selectedDate,
        records
      };

      const res = await API.saveBatchAttendance(payload);
      if (res && res.success) {
        setAutoSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        if (showToastMsg) {
          showToast(`Day ${selectedDay} Attendance Saved! 🎉`, 'success');
        }
      } else {
        setAutoSaveStatus('idle');
        showToast(res.error || 'Failed to save attendance', 'error');
      }
    } catch (err: any) {
      setAutoSaveStatus('idle');
      showToast('Error saving attendance: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Status Change Handlers for Individual Member WITH AUTO SAVE
  const handleStatusChange = (appNo: string, sessionType: 'morning' | 'afternoon', status: AttendanceStatus) => {
    if (isCurrentSessionLocked) {
      showToast(`Cannot change ${sessionType} session attendance. Cutoff time has passed or locked for Batch Leader.`, 'warn');
      return;
    }

    const nextState = {
      ...attendanceState,
      [appNo]: {
        ...(attendanceState[appNo] || { morningStatus: 'Present', morningRemarks: '', afternoonStatus: 'Present', afternoonRemarks: '' }),
        [sessionType === 'morning' ? 'morningStatus' : 'afternoonStatus']: status
      }
    };

    setAttendanceState(nextState);
    // AUTO SAVE IMMEDIATELY ON TOGGLE
    saveAttendanceToServer(nextState, false);
  };

  const handleRemarksChange = (appNo: string, sessionType: 'morning' | 'afternoon', text: string) => {
    if (isCurrentSessionLocked) return;

    setAttendanceState(prev => ({
      ...prev,
      [appNo]: {
        ...(prev[appNo] || { morningStatus: 'Present', morningRemarks: '', afternoonStatus: 'Present', afternoonRemarks: '' }),
        [sessionType === 'morning' ? 'morningRemarks' : 'afternoonRemarks']: text
      }
    }));
  };

  // Bulk Actions WITH AUTO SAVE
  const handleMarkAllMorning = (status: AttendanceStatus) => {
    if (lockStatus.isMorningLocked) {
      showToast('Morning Session is locked for Batch Leader. Cutoff time (12:00 PM) passed.', 'warn');
      return;
    }

    const nextState: Record<string, any> = {};
    fullBatchMembers.forEach(m => {
      nextState[m.appNo] = {
        ...(attendanceState[m.appNo] || { morningRemarks: '', afternoonStatus: 'Present', afternoonRemarks: '' }),
        morningStatus: status
      };
    });

    setAttendanceState(nextState);
    saveAttendanceToServer(nextState, false);
    showToast(`Marked all members as ${status} for Morning Session (Auto-saved)`, 'info');
  };

  const handleMarkAllAfternoon = (status: AttendanceStatus) => {
    if (lockStatus.isAfternoonLocked) {
      showToast('Afternoon Session is locked for Batch Leader. Cutoff time (6:30 PM) passed.', 'warn');
      return;
    }

    const nextState: Record<string, any> = {};
    fullBatchMembers.forEach(m => {
      nextState[m.appNo] = {
        ...(attendanceState[m.appNo] || { morningStatus: 'Present', morningRemarks: '', afternoonRemarks: '' }),
        afternoonStatus: status
      };
    });

    setAttendanceState(nextState);
    saveAttendanceToServer(nextState, false);
    showToast(`Marked all members as ${status} for Afternoon Session (Auto-saved)`, 'info');
  };

  // Bulk Mark for specific Group WITH AUTO SAVE
  const handleMarkGroupSession = (groupMemberList: BatchMemberInfo[], sessionType: 'morning' | 'afternoon', status: AttendanceStatus) => {
    if (isCurrentSessionLocked) {
      showToast(`Session locked for Batch Leader. Cutoff time passed.`, 'warn');
      return;
    }

    const nextState = { ...attendanceState };
    groupMemberList.forEach(m => {
      nextState[m.appNo] = {
        ...(nextState[m.appNo] || { morningStatus: 'Present', morningRemarks: '', afternoonStatus: 'Present', afternoonRemarks: '' }),
        [sessionType === 'morning' ? 'morningStatus' : 'afternoonStatus']: status
      };
    });

    setAttendanceState(nextState);
    saveAttendanceToServer(nextState, false);
    showToast(`Group marked as ${status} for ${sessionType} session (Auto-saved)`, 'info');
  };

  // Filtered Members for Display
  const filteredMembers = useMemo(() => {
    return fullBatchMembers.filter(m => {
      if (roleFilter !== 'All' && m.roleInBatch !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.appNo.toLowerCase().includes(q) ||
          m.department.toLowerCase().includes(q) ||
          m.groupName.toLowerCase().includes(q) ||
          m.designation.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [fullBatchMembers, roleFilter, searchQuery]);

  // Attendance Stats for Current Session & Day
  const sessionStats = useMemo(() => {
    let present = 0, absent = 0, late = 0, halfDay = 0, leave = 0;
    fullBatchMembers.forEach(m => {
      const st = attendanceState[m.appNo];
      const status = activeTab === 'afternoon' ? st?.afternoonStatus : st?.morningStatus;
      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
      else if (status === 'Late') late++;
      else if (status === 'Half Day') halfDay++;
      else if (status === 'Leave') leave++;
    });
    return { present, absent, late, halfDay, leave, total: fullBatchMembers.length };
  }, [fullBatchMembers, attendanceState, activeTab]);

  // Export 20-Day Matrix to Excel
  const handleExportMatrixExcel = async () => {
    try {
      showToast('Generating 20-Day Batch Attendance Excel Report...', 'info');
      const res = await API.getBatchAttendanceSummary(selectedBatchId || 1);
      const allRecords = (res && res.summary) ? res.summary : [];
      const recordMap: Record<string, Record<number, { m: string; a: string }>> = {};

      allRecords.forEach((r: any) => {
        if (!recordMap[r.candidate_app_no]) recordMap[r.candidate_app_no] = {};
        recordMap[r.candidate_app_no][r.day_number] = {
          m: r.morning_status || 'Present',
          a: r.afternoon_status || 'Present'
        };
      });

      const excelRows = fullBatchMembers.map((m, idx) => {
        const rowObj: any = {
          '#': idx + 1,
          'App No': m.appNo,
          'Member Name': m.name,
          'Batch Role': m.roleInBatch,
          'Group': m.groupName,
          'Department': m.department,
          'Designation': m.designation,
        };

        let totalPresent = 0;
        let totalSessions = 40;

        for (let d = 1; d <= 20; d++) {
          const rec = recordMap[m.appNo]?.[d] || { m: '—', a: '—' };
          rowObj[`Day ${d} (M)`] = rec.m;
          rowObj[`Day ${d} (A)`] = rec.a;
          if (rec.m === 'Present' || rec.m === 'Late') totalPresent++;
          if (rec.a === 'Present' || rec.a === 'Late') totalPresent++;
        }

        rowObj['Total Present Sessions'] = `${totalPresent} / 40`;
        rowObj['Attendance Rate (%)'] = `${((totalPresent / totalSessions) * 100).toFixed(1)}%`;

        return rowObj;
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, '20_Day_Attendance');
      const bName = currentBatch ? currentBatch.name.replace(/[^a-zA-Z0-9]/g, '_') : 'Batch';
      XLSX.writeFile(wb, `BSC_${bName}_20Day_Attendance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('Exported 20-Day Attendance Report! 📊', 'success');
    } catch (err: any) {
      showToast('Export failed: ' + err.message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex font-sans">
      <ToastContainer />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="BSC BATCH ATTENDANCE DESK"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Batch Plan', href: '/batch-plan' }, { label: 'Batch Attendance' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Header Card */}
          <div className="card-glass p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border border-[#e2dfd7] shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#1E2D4E] text-[#C9952A] flex items-center justify-center shadow-md border border-[#C9952A]/40 flex-shrink-0">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-[#1E2D4E] tracking-tight">
                      20-DAY BATCH ATTENDANCE DESK
                    </h2>
                    <span className="px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#C9952A]/20 text-[#1E2D4E] border border-[#C9952A]/40 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#C9952A]" />
                      BATCH LEADER DESK
                    </span>

                    {/* Auto Save Status Badge */}
                    {autoSaveStatus === 'saving' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                        Auto-saving...
                      </span>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Auto-saved {lastSavedTime ? `at ${lastSavedTime}` : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#666] font-semibold mt-0.5">
                    Take and manage daily Morning &amp; Afternoon session attendance for the complete batch (Batch Leader, Group Leaders &amp; Group Members) for 20 days.
                  </p>
                </div>
              </div>
            </div>

            {/* Batch Switcher */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-end flex-wrap">
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl border border-[#e2dfd7] shadow-xs">
                <span className="text-xs font-black text-[#777] uppercase tracking-wider">Select Batch:</span>
                <select
                  value={selectedBatchId || ''}
                  onChange={(e) => setSelectedBatchId(Number(e.target.value))}
                  className="text-xs font-black text-[#1E2D4E] bg-transparent focus:outline-none cursor-pointer"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.batch_code})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => saveAttendanceToServer(undefined, true)}
                disabled={saving}
                className="btn-primary text-xs py-2.5 px-4 flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
                <span>{saving ? 'Saving...' : `Save Day ${selectedDay} Attendance`}</span>
              </button>
            </div>
          </div>

          {/* Time Cutoff Rules Banner */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold shadow-xs ${
            isCurrentSessionLocked
              ? 'bg-rose-50/90 border-rose-300 text-rose-950'
              : !isBatchLeaderRole
              ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
              : 'bg-amber-50/90 border-amber-300 text-amber-950'
          }`}>
            <div className="flex items-center gap-2.5">
              {isCurrentSessionLocked ? (
                <Lock className="w-5 h-5 text-rose-600 flex-shrink-0" />
              ) : !isBatchLeaderRole ? (
                <Unlock className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              ) : (
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
              )}
              <div>
                <div className="font-extrabold uppercase tracking-wider text-[10.5px]">
                  SESSION CUTOFF RULES: Morning Session (12:00 PM Cutoff) • Afternoon Session (6:30 PM Cutoff)
                </div>
                <div className="text-[11.5px] mt-0.5">
                  {lockStatus.message}
                </div>
              </div>
            </div>

            {!isBatchLeaderRole && (
              <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-[10.5px] font-black uppercase tracking-wider flex-shrink-0 shadow-2xs">
                Admin Mode Active
              </span>
            )}
          </div>

          {/* 20-Day Navigation Strip */}
          <div className="card-glass p-4 border border-[#e2dfd7] space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C9952A]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#1E2D4E]">
                  Training / Orientation Schedule (Next 20 Days)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#777]">Selected Day Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 rounded-xl border border-[#e2dfd7] bg-white text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]"
                />
              </div>
            </div>

            {/* 20 Day Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {Array.from({ length: 20 }, (_, i) => i + 1).map(day => (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`
                    px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap flex flex-col items-center min-w-[65px] border
                    ${selectedDay === day
                      ? 'bg-[#1E2D4E] text-white border-[#1E2D4E] shadow-md ring-2 ring-[#C9952A]'
                      : 'bg-white text-[#555] border-[#e2dfd7] hover:bg-[#F9F7F4]'}
                  `}
                >
                  <span className="text-[9.5px] uppercase tracking-wider text-[#C9952A]">DAY</span>
                  <span className="text-sm leading-tight">{day}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Session Tabs & Layout Switcher */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* View Mode Tabs */}
            <div className="flex items-center p-1 rounded-2xl bg-[#E2DFD7]/60 border border-[#e2dfd7] w-full md:w-auto">
              <button
                onClick={() => setActiveTab('morning')}
                className={`
                  flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2
                  ${activeTab === 'morning' ? 'bg-amber-500 text-white shadow-md' : 'text-[#555] hover:text-[#1E2D4E]'}
                `}
              >
                <Sunrise className="w-4 h-4" />
                <span>Morning Session 🌅 (Before 12 PM)</span>
                {lockStatus.isMorningLocked && isBatchLeaderRole && <Lock className="w-3.5 h-3.5 text-amber-200" />}
              </button>

              <button
                onClick={() => setActiveTab('afternoon')}
                className={`
                  flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2
                  ${activeTab === 'afternoon' ? 'bg-indigo-600 text-white shadow-md' : 'text-[#555] hover:text-[#1E2D4E]'}
                `}
              >
                <Sun className="w-4 h-4" />
                <span>Afternoon Session ☀️ (Before 6:30 PM)</span>
                {lockStatus.isAfternoonLocked && isBatchLeaderRole && <Lock className="w-3.5 h-3.5 text-indigo-200" />}
              </button>

              <button
                onClick={() => setActiveTab('matrix')}
                className={`
                  flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2
                  ${activeTab === 'matrix' ? 'bg-[#1E2D4E] text-white shadow-md' : 'text-[#555] hover:text-[#1E2D4E]'}
                `}
              >
                <FileSpreadsheet className="w-4 h-4 text-[#C9952A]" />
                <span>20-Day Matrix Summary 📊</span>
              </button>
            </div>

            {/* Layout Mode (Group Wise vs All Members) */}
            {activeTab !== 'matrix' && (
              <div className="flex items-center gap-2 justify-between md:justify-end">
                <div className="flex items-center p-1 rounded-xl bg-white border border-[#e2dfd7] shadow-xs">
                  <button
                    onClick={() => setLayoutMode('group_wise')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      layoutMode === 'group_wise' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#666] hover:text-[#1E2D4E]'
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>Group-Wise List 📂</span>
                  </button>
                  <button
                    onClick={() => setLayoutMode('all_members')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      layoutMode === 'all_members' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'text-[#666] hover:text-[#1E2D4E]'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Flat Roster View</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Session Overview Stats Cards */}
          {activeTab !== 'matrix' && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="card-glass p-3.5 border border-emerald-200 bg-emerald-50/40 space-y-1">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-[10px] font-black uppercase tracking-wider">Present</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-900">{sessionStats.present}</div>
              </div>

              <div className="card-glass p-3.5 border border-rose-200 bg-rose-50/40 space-y-1">
                <div className="flex items-center justify-between text-rose-800">
                  <span className="text-[10px] font-black uppercase tracking-wider">Absent</span>
                  <XCircle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-2xl font-black text-rose-900">{sessionStats.absent}</div>
              </div>

              <div className="card-glass p-3.5 border border-amber-200 bg-amber-50/40 space-y-1">
                <div className="flex items-center justify-between text-amber-800">
                  <span className="text-[10px] font-black uppercase tracking-wider">Late</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-900">{sessionStats.late}</div>
              </div>

              <div className="card-glass p-3.5 border border-blue-200 bg-blue-50/40 space-y-1">
                <div className="flex items-center justify-between text-blue-800">
                  <span className="text-[10px] font-black uppercase tracking-wider">Half Day</span>
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-900">{sessionStats.halfDay}</div>
              </div>

              <div className="card-glass p-3.5 border border-slate-200 bg-slate-100/60 space-y-1 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Members</span>
                  <Users className="w-4 h-4 text-slate-600" />
                </div>
                <div className="text-2xl font-black text-slate-900">{sessionStats.total}</div>
              </div>
            </div>
          )}

          {/* Search & Filter Strip */}
          <div className="card-glass p-4 border border-[#e2dfd7] flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#777]" />
              <input
                type="text"
                placeholder="Search member name, App ID, designation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-bold pl-10 pr-4 py-2.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A]"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
              <span className="text-[10px] font-black uppercase text-[#777] tracking-wider">Filter Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="text-xs font-bold px-3 py-2 rounded-xl border border-[#e2dfd7] bg-white text-[#1E2D4E]"
              >
                <option value="All">All Batch Members ({fullBatchMembers.length})</option>
                <option value="Batch Leader">👑 Batch Leader</option>
                <option value="Group Leader">⭐️ Group Leaders</option>
                <option value="Group Member">👤 Group Members</option>
              </select>

              {activeTab !== 'matrix' && (
                <div className="flex items-center gap-1.5 border-l border-[#e2dfd7] pl-3">
                  <button
                    onClick={() => activeTab === 'morning' ? handleMarkAllMorning('Present') : handleMarkAllAfternoon('Present')}
                    disabled={isCurrentSessionLocked}
                    className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold hover:bg-emerald-200 transition-colors cursor-pointer border border-emerald-300 disabled:opacity-40"
                  >
                    All Present ✅
                  </button>
                  <button
                    onClick={() => activeTab === 'morning' ? handleMarkAllMorning('Absent') : handleMarkAllAfternoon('Absent')}
                    disabled={isCurrentSessionLocked}
                    className="px-3 py-1.5 rounded-xl bg-rose-100 text-rose-800 text-xs font-bold hover:bg-rose-200 transition-colors cursor-pointer border border-rose-300 disabled:opacity-40"
                  >
                    All Absent ❌
                  </button>
                </div>
              )}

              {activeTab === 'matrix' && (
                <button
                  onClick={handleExportMatrixExcel}
                  className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Export 20-Day Excel</span>
                </button>
              )}
            </div>
          </div>

          {/* ATTENDANCE CONTENT: MORNING & AFTERNOON SESSION (GROUP WISE LIST VIEW) */}
          {activeTab !== 'matrix' && layoutMode === 'group_wise' && (
            <div className="space-y-6">
              {groupedMembersList.map(groupSec => {
                // Apply search/role filters to group members
                const groupFilteredMembers = groupSec.members.filter(m => {
                  if (roleFilter !== 'All' && m.roleInBatch !== roleFilter) return false;
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    return (
                      m.name.toLowerCase().includes(q) ||
                      m.appNo.toLowerCase().includes(q) ||
                      m.department.toLowerCase().includes(q) ||
                      m.designation.toLowerCase().includes(q)
                    );
                  }
                  return true;
                });

                if (groupFilteredMembers.length === 0) return null;

                // Group session stats
                const groupPresentCount = groupFilteredMembers.filter(m => {
                  const att = attendanceState[m.appNo];
                  const status = activeTab === 'afternoon' ? att?.afternoonStatus : att?.morningStatus;
                  return status === 'Present';
                }).length;

                return (
                  <div key={groupSec.groupName} className="card-glass overflow-hidden border border-[#e2dfd7] shadow-sm">
                    {/* Group Header Card */}
                    <div className="p-4 bg-[#1E2D4E] text-white flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#C9952A] text-slate-900 font-black flex items-center justify-center text-xs shadow-md">
                          <FolderTree className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-extrabold text-base leading-tight flex items-center gap-2">
                            <span>{groupSec.groupName}</span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-[#C9952A] border border-white/20">
                              {groupFilteredMembers.length} Members
                            </span>
                          </div>
                          <div className="text-[11px] text-white/70 font-semibold mt-0.5">
                            Group Attendance Status: <strong className="text-emerald-400 font-black">{groupPresentCount} / {groupFilteredMembers.length} Present</strong>
                          </div>
                        </div>
                      </div>

                      {/* Group Level Quick Bulk Actions */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white/70 uppercase">Group Set:</span>
                        <button
                          onClick={() => handleMarkGroupSession(groupFilteredMembers, activeTab === 'morning' ? 'morning' : 'afternoon', 'Present')}
                          disabled={isCurrentSessionLocked}
                          className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-2xs transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          Mark Group Present ✅
                        </button>
                        <button
                          onClick={() => handleMarkGroupSession(groupFilteredMembers, activeTab === 'morning' ? 'morning' : 'afternoon', 'Absent')}
                          disabled={isCurrentSessionLocked}
                          className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-extrabold shadow-2xs transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          Mark Group Absent ❌
                        </button>
                      </div>
                    </div>

                    {/* Group Members Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777] bg-[#F9F7F4]">
                            <th className="py-3 px-4">Member Name &amp; ID</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4">Department &amp; Designation</th>
                            <th className="py-3 px-4">Attendance Status</th>
                            <th className="py-3 px-4">Session Notes / Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2dfd7]/60 font-medium">
                          {groupFilteredMembers.map(m => {
                            const att = attendanceState[m.appNo] || {
                              morningStatus: 'Present',
                              morningRemarks: '',
                              afternoonStatus: 'Present',
                              afternoonRemarks: ''
                            };

                            const currentStatus = activeTab === 'morning' ? att.morningStatus : att.afternoonStatus;
                            const currentRemarks = activeTab === 'morning' ? att.morningRemarks : att.afternoonRemarks;

                            return (
                              <tr key={m.appNo} className="hover:bg-black/5 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[#1E2D4E] text-[#C9952A] font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs border border-[#C9952A]/30">
                                      {m.photoUrl ? (
                                        <img src={API.fileUrl(m.photoUrl) || ''} alt={m.name} className="w-full h-full object-cover" />
                                      ) : (
                                        m.name.slice(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-extrabold text-[#1E2D4E] text-sm leading-tight">{m.name}</div>
                                      <div className="text-[10.5px] text-[#777] font-mono font-bold mt-0.5">{m.appNo}</div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  {m.roleInBatch === 'Batch Leader' ? (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 w-fit shadow-2xs">
                                      <Crown className="w-3 h-3 text-amber-600" />
                                      Batch Leader
                                    </span>
                                  ) : m.roleInBatch === 'Group Leader' ? (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1 w-fit shadow-2xs">
                                      <Star className="w-3 h-3 text-blue-600" />
                                      Group Leader
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1 w-fit">
                                      <User className="w-3 h-3 text-slate-500" />
                                      Group Member
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-[#1E2D4E]">{m.department || '—'}</div>
                                  <div className="text-[11px] text-[#C9952A] font-extrabold truncate">{m.designation || 'Staff'}</div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {(['Present', 'Absent', 'Late', 'Half Day', 'Leave'] as AttendanceStatus[]).map(st => {
                                      const isActive = currentStatus === st;
                                      let btnClass = 'bg-white text-[#555] border-[#e2dfd7] hover:bg-[#F9F7F4]';
                                      if (isActive) {
                                        if (st === 'Present') btnClass = 'bg-emerald-600 text-white border-emerald-700 shadow-xs';
                                        else if (st === 'Absent') btnClass = 'bg-rose-600 text-white border-rose-700 shadow-xs';
                                        else if (st === 'Late') btnClass = 'bg-amber-500 text-white border-amber-600 shadow-xs';
                                        else if (st === 'Half Day') btnClass = 'bg-blue-600 text-white border-blue-700 shadow-xs';
                                        else if (st === 'Leave') btnClass = 'bg-purple-600 text-white border-purple-700 shadow-xs';
                                      }

                                      return (
                                        <button
                                          key={st}
                                          disabled={isCurrentSessionLocked}
                                          onClick={() => handleStatusChange(m.appNo, activeTab === 'morning' ? 'morning' : 'afternoon', st)}
                                          className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer disabled:opacity-40 ${btnClass}`}
                                        >
                                          {st}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <input
                                    type="text"
                                    disabled={isCurrentSessionLocked}
                                    placeholder="Remarks / Reason..."
                                    value={currentRemarks}
                                    onChange={(e) => handleRemarksChange(m.appNo, activeTab === 'morning' ? 'morning' : 'afternoon', e.target.value)}
                                    className="w-full text-xs p-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] disabled:opacity-50"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ATTENDANCE CONTENT: MORNING & AFTERNOON SESSION (FLAT ROSTER VIEW) */}
          {activeTab !== 'matrix' && layoutMode === 'all_members' && (
            <div className="card-glass overflow-hidden border border-[#e2dfd7] shadow-sm">
              <div className="p-4 bg-[#1E2D4E] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeTab === 'morning' ? <Sunrise className="w-5 h-5 text-amber-400" /> : <Sun className="w-5 h-5 text-amber-400" />}
                  <span className="font-extrabold text-sm uppercase tracking-wider">
                    {activeTab === 'morning' ? 'Morning Session Attendance' : 'Afternoon Session Attendance'} — Day {selectedDay} ({selectedDate})
                  </span>
                </div>
                <span className="text-xs font-bold text-[#C9952A]">
                  {filteredMembers.length} Members Listed
                </span>
              </div>

              {loading ? (
                <div className="p-12 text-center text-xs font-bold text-[#777]">
                  Loading batch member roster...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-12 text-center text-xs font-bold text-[#777]">
                  No batch members match the search or filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#e2dfd7] text-[10.5px] font-black uppercase text-[#777] bg-[#F9F7F4]">
                        <th className="py-3 px-4">Member Name &amp; ID</th>
                        <th className="py-3 px-4">Batch Role</th>
                        <th className="py-3 px-4">Group</th>
                        <th className="py-3 px-4">Department &amp; Designation</th>
                        <th className="py-3 px-4">Attendance Status</th>
                        <th className="py-3 px-4">Session Notes / Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dfd7]/60 font-medium">
                      {filteredMembers.map(m => {
                        const att = attendanceState[m.appNo] || {
                          morningStatus: 'Present',
                          morningRemarks: '',
                          afternoonStatus: 'Present',
                          afternoonRemarks: ''
                        };

                        const currentStatus = activeTab === 'morning' ? att.morningStatus : att.afternoonStatus;
                        const currentRemarks = activeTab === 'morning' ? att.morningRemarks : att.afternoonRemarks;

                        return (
                          <tr key={m.appNo} className="hover:bg-black/5 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#1E2D4E] text-[#C9952A] font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs border border-[#C9952A]/30">
                                  {m.photoUrl ? (
                                    <img src={API.fileUrl(m.photoUrl) || ''} alt={m.name} className="w-full h-full object-cover" />
                                  ) : (
                                    m.name.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <div className="font-extrabold text-[#1E2D4E] text-sm leading-tight">{m.name}</div>
                                  <div className="text-[10.5px] text-[#777] font-mono font-bold mt-0.5">{m.appNo}</div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              {m.roleInBatch === 'Batch Leader' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 w-fit shadow-2xs">
                                  <Crown className="w-3 h-3 text-amber-600" />
                                  Batch Leader
                                </span>
                              ) : m.roleInBatch === 'Group Leader' ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1 w-fit shadow-2xs">
                                  <Star className="w-3 h-3 text-blue-600" />
                                  Group Leader
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1 w-fit">
                                  <User className="w-3 h-3 text-slate-500" />
                                  Group Member
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 font-extrabold text-[#1E2D4E]">
                              {m.groupName}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-bold text-[#1E2D4E]">{m.department || '—'}</div>
                              <div className="text-[11px] text-[#C9952A] font-extrabold truncate">{m.designation || 'Staff'}</div>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {(['Present', 'Absent', 'Late', 'Half Day', 'Leave'] as AttendanceStatus[]).map(st => {
                                  const isActive = currentStatus === st;
                                  let btnClass = 'bg-white text-[#555] border-[#e2dfd7] hover:bg-[#F9F7F4]';
                                  if (isActive) {
                                    if (st === 'Present') btnClass = 'bg-emerald-600 text-white border-emerald-700 shadow-xs';
                                    else if (st === 'Absent') btnClass = 'bg-rose-600 text-white border-rose-700 shadow-xs';
                                    else if (st === 'Late') btnClass = 'bg-amber-500 text-white border-amber-600 shadow-xs';
                                    else if (st === 'Half Day') btnClass = 'bg-blue-600 text-white border-blue-700 shadow-xs';
                                    else if (st === 'Leave') btnClass = 'bg-purple-600 text-white border-purple-700 shadow-xs';
                                  }

                                  return (
                                    <button
                                      key={st}
                                      disabled={isCurrentSessionLocked}
                                      onClick={() => handleStatusChange(m.appNo, activeTab === 'morning' ? 'morning' : 'afternoon', st)}
                                      className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer disabled:opacity-40 ${btnClass}`}
                                    >
                                      {st}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>

                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                disabled={isCurrentSessionLocked}
                                placeholder="Remarks / Reason..."
                                value={currentRemarks}
                                onChange={(e) => handleRemarksChange(m.appNo, activeTab === 'morning' ? 'morning' : 'afternoon', e.target.value)}
                                className="w-full text-xs p-2 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-[#1E2D4E] focus:outline-none focus:border-[#C9952A] disabled:opacity-50"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 3: 20-DAY MATRIX SUMMARY VIEW */}
          {activeTab === 'matrix' && (
            <div className="card-glass overflow-hidden border border-[#e2dfd7] shadow-sm space-y-4 p-5">
              <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3">
                <div>
                  <h3 className="font-black text-[#1E2D4E] text-sm uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#C9952A]" />
                    <span>Complete 20-Day Batch Attendance Matrix</span>
                  </h3>
                  <p className="text-xs text-[#666] font-semibold mt-0.5">
                    Grid overview showing Morning (M) and Afternoon (A) attendance records across all 20 days.
                  </p>
                </div>
                <button
                  onClick={handleExportMatrixExcel}
                  className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Complete Excel Sheet</span>
                </button>
              </div>

              {matrixLoading ? (
                <div className="p-12 text-center text-xs font-bold text-[#777]">
                  Loading 20-Day attendance matrix...
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="border-b border-[#e2dfd7] text-[10px] font-black uppercase text-[#777] bg-[#F9F7F4]">
                        <th className="py-2.5 px-3 sticky left-0 bg-[#F9F7F4] z-10 shadow-xs">Member</th>
                        <th className="py-2.5 px-2">Role</th>
                        <th className="py-2.5 px-2">Group</th>
                        {Array.from({ length: 20 }, (_, i) => i + 1).map(d => (
                          <th key={d} className="py-2.5 px-1.5 text-center border-l border-[#e2dfd7]/60">
                            <div>Day {d}</div>
                            <div className="text-[9px] text-[#C9952A]">M | A</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2dfd7]/60 font-medium">
                      {filteredMembers.map(m => {
                        const candRecords = matrixData.filter((r: any) => r.candidate_app_no === m.appNo);
                        const dayMap: Record<number, { m: string; a: string }> = {};
                        candRecords.forEach((r: any) => {
                          dayMap[r.day_number] = {
                            m: r.morning_status || 'P',
                            a: r.afternoon_status || 'P'
                          };
                        });

                        return (
                          <tr key={m.appNo} className="hover:bg-black/5 transition-colors">
                            <td className="py-2.5 px-3 font-extrabold text-[#1E2D4E] sticky left-0 bg-white z-10 truncate max-w-[160px] shadow-xs">
                              {m.name}
                            </td>
                            <td className="py-2.5 px-2 text-[10px] font-bold text-[#555] whitespace-nowrap">
                              {m.roleInBatch}
                            </td>
                            <td className="py-2.5 px-2 text-[10px] font-bold text-[#1E2D4E] whitespace-nowrap">
                              {m.groupName}
                            </td>

                            {Array.from({ length: 20 }, (_, i) => i + 1).map(d => {
                              const rec = dayMap[d] || { m: '—', a: '—' };
                              const getBadgeColor = (val: string) => {
                                if (val === 'Present' || val === 'P') return 'text-emerald-700 bg-emerald-50';
                                if (val === 'Absent' || val === 'A') return 'text-rose-700 bg-rose-50 font-black';
                                if (val === 'Late' || val === 'L') return 'text-amber-700 bg-amber-50';
                                return 'text-slate-400';
                              };

                              return (
                                <td key={d} className="py-2.5 px-1 text-center font-mono font-bold text-[10px] border-l border-[#e2dfd7]/40">
                                  <span className={`px-1 py-0.5 rounded ${getBadgeColor(rec.m)}`}>{rec.m[0]}</span>
                                  <span className="text-[#aaa] mx-0.5">|</span>
                                  <span className={`px-1 py-0.5 rounded ${getBadgeColor(rec.a)}`}>{rec.a[0]}</span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
