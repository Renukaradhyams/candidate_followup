import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, Auth, UserSession } from '../services/api';
import Topbar from '../components/Topbar';
import Sidebar from '../components/Sidebar';
import Toast, { showToast } from '../components/Toast';
import {
  Users,
  Layers,
  UserCheck,
  UserPlus,
  UserX,
  Search,
  Filter,
  Plus,
  Edit3,
  Trash2,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Printer,
  X,
  Building2,
  Phone,
  Mail,
  Briefcase,
  ArrowRightLeft,
  Eye,
  Award,
  BadgeCheck,
  Store,
  RefreshCw,
  FolderTree,
  MoreVertical,
  CheckSquare,
  Square
} from 'lucide-react';

interface Candidate {
  id: number;
  app_no: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  designation: string;
  section?: string;
  photo_url?: string;
  status: string;
  isJoinedStore?: boolean;
  storeStatusLabel?: string;
  offered_doj?: string;
  actual_doj?: string;
}

interface BatchPlan {
  id: number;
  batch_code: string;
  name: string;
  type: string;
  description?: string;
  capacity: number;
  batch_leader_app_no?: string | null;
  status: string;
}

interface BatchGroup {
  id: number;
  group_code: string;
  batch_id: number;
  name: string;
  group_leader_app_no?: string | null;
  max_members: number;
  description?: string;
  status: string;
}

interface GroupMember {
  id: number;
  candidate_app_no: string;
  batch_id: number;
  group_id: number;
  assigned_at?: string;
  assigned_by?: string;
}

interface ActivityLog {
  id: number;
  action_type: string;
  description: string;
  by_user: string;
  created_at: string;
}

export default function BatchPlan() {
  const navigate = useNavigate();
  const [session, setSession] = useState<UserSession | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data states
  const [batches, setBatches] = useState<BatchPlan[]>([]);
  const [groups, setGroups] = useState<BatchGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);

  // UI & View state
  const [viewMode, setViewMode] = useState<'cards' | 'hierarchy'>('cards');
  const [activeTab, setActiveTab] = useState<'batches' | 'unassigned' | 'leadership' | 'activity'>('batches');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterDesig, setFilterDesig] = useState('All');
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<'All' | 'Assigned' | 'Unassigned'>('All');
  const [filterLeaderStatus, setFilterLeaderStatus] = useState('All');

  // Bulk Selection State
  const [selectedAppNos, setSelectedAppNos] = useState<string[]>([]);
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [bulkTargetBatchId, setBulkTargetBatchId] = useState<number | null>(null);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState<number | null>(null);

  // Modals state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchPlan | null>(null);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BatchGroup | null>(null);

  // Searchable Employee Selector Modal
  const [employeeSelectorModal, setEmployeeSelectorModal] = useState<{
    open: boolean;
    title: string;
    type: 'batch_leader' | 'group_leader' | 'add_member';
    targetBatchId?: number | null;
    targetGroupId?: number | null;
    targetGroupName?: string;
  }>({ open: false, title: '', type: 'add_member' });

  // Duplicate Warning Modal
  const [duplicateWarningModal, setDuplicateWarningModal] = useState<{
    open: boolean;
    candidate: Candidate | null;
    existingBatchName: string;
    existingGroupName: string;
  }>({ open: false, candidate: null, existingBatchName: '', existingGroupName: '' });

  // Move Member Modal
  const [moveMemberModal, setMoveMemberModal] = useState<{
    open: boolean;
    candidateAppNo: string;
    memberName: string;
    currentGroupId: number;
    currentGroupName: string;
    currentBatchId: number;
  }>({ open: false, candidateAppNo: '', memberName: '', currentGroupId: 0, currentGroupName: '', currentBatchId: 0 });

  // Member Profile Modal
  const [memberProfileModal, setMemberProfileModal] = useState<{
    open: boolean;
    candidate: Candidate | null;
  }>({ open: false, candidate: null });

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.getBatchPlanData();
      if (res && res.success !== false) {
        setBatches(res.batches || []);
        setGroups(res.groups || []);
        setGroupMembers(res.groupMembers || []);
        setCandidates(res.candidates || []);
        setActivities(res.activities || []);
      }
    } catch (err: any) {
      console.warn('[Batch Plan load warning]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!Auth.check()) {
      navigate('/login', { replace: true });
      return;
    }
    setSession(Auth.get());
    loadData();
  }, [navigate, loadData]);

  // Lookup Maps
  const candidateMap = useMemo(() => {
    const map = new Map<string, Candidate>();
    candidates.forEach(c => map.set(c.app_no, c));
    return map;
  }, [candidates]);

  // Map of candidate_app_no -> { batchName, groupName, batchId, groupId }
  const memberAssignmentMap = useMemo(() => {
    const map = new Map<string, { batchId: number; groupId: number; batchName: string; groupName: string }>();
    groupMembers.forEach(m => {
      const b = batches.find(x => x.id === m.batch_id);
      const g = groups.find(x => x.id === m.group_id);
      map.set(m.candidate_app_no, {
        batchId: m.batch_id,
        groupId: m.group_id,
        batchName: b ? b.name : 'Batch',
        groupName: g ? g.name : 'Group'
      });
    });
    return map;
  }, [groupMembers, batches, groups]);

  // Assigned Candidate App Nos set
  const assignedAppNoSet = useMemo(() => {
    return new Set(groupMembers.map(m => m.candidate_app_no));
  }, [groupMembers]);

  // Group members count per group ID
  const groupMemberCountMap = useMemo(() => {
    const map = new Map<number, number>();
    groupMembers.forEach(m => {
      map.set(m.group_id, (map.get(m.group_id) || 0) + 1);
    });
    return map;
  }, [groupMembers]);

  // Batch members count per batch ID
  const batchMemberCountMap = useMemo(() => {
    const map = new Map<number, number>();
    groupMembers.forEach(m => {
      map.set(m.batch_id, (map.get(m.batch_id) || 0) + 1);
    });
    return map;
  }, [groupMembers]);

  // Group leaders count per batch ID
  const batchGroupLeaderCountMap = useMemo(() => {
    const map = new Map<number, number>();
    groups.forEach(g => {
      if (g.group_leader_app_no) {
        map.set(g.batch_id, (map.get(g.batch_id) || 0) + 1);
      }
    });
    return map;
  }, [groups]);

  // Unique Departments & Designations from Joined Store Candidates
  const departments = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => {
      if (c.department) set.add(c.department);
    });
    return Array.from(set).sort();
  }, [candidates]);

  const designations = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => {
      if (c.designation) set.add(c.designation);
    });
    return Array.from(set).sort();
  }, [candidates]);

  // Dynamic Dashboard KPIs (Never hardcoded!)
  const totalBatches = useMemo(() => batches.filter(b => b.status === 'Active').length, [batches]);
  const totalJoinedEmployees = useMemo(() => candidates.length, [candidates]);
  const totalAssignedEmployees = useMemo(() => assignedAppNoSet.size, [assignedAppNoSet]);
  const unassignedMembersCount = useMemo(() => candidates.filter(c => !assignedAppNoSet.has(c.app_no)).length, [candidates, assignedAppNoSet]);
  const totalBatchLeaders = useMemo(() => batches.filter(b => b.batch_leader_app_no).length, [batches]);
  const totalGroups = useMemo(() => groups.filter(g => g.status === 'Active').length, [groups]);
  const totalGroupLeaders = useMemo(() => groups.filter(g => g.group_leader_app_no).length, [groups]);

  // Filtered Candidates for Searchable Selector & Unassigned List
  const filteredCandidatesForSelector = useMemo(() => {
    return candidates.filter(c => {
      // Assignment Status Filter
      if (filterAssignmentStatus === 'Unassigned' && assignedAppNoSet.has(c.app_no)) return false;
      if (filterAssignmentStatus === 'Assigned' && !assignedAppNoSet.has(c.app_no)) return false;

      // Department Filter
      if (filterDept !== 'All' && c.department !== filterDept) return false;

      // Designation Filter
      if (filterDesig !== 'All' && c.designation !== filterDesig) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          (c.name || '').toLowerCase().includes(q) ||
          (c.app_no || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.department || '').toLowerCase().includes(q) ||
          (c.designation || '').toLowerCase().includes(q) ||
          (c.section || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [candidates, assignedAppNoSet, filterAssignmentStatus, filterDept, filterDesig, searchQuery]);

  // Health helpers
  const getBatchHealth = (b: BatchPlan) => {
    const bGroups = groups.filter(g => g.batch_id === b.id);
    if (bGroups.length === 0) {
      return b.batch_leader_app_no ? { status: 'READY', color: 'emerald', text: 'Ready' } : { status: 'PARTIALLY ASSIGNED', color: 'amber', text: 'Leader Pending' };
    }
    const missingLeaders = bGroups.filter(g => !g.group_leader_app_no).length;
    if (!b.batch_leader_app_no || missingLeaders > 0) {
      return { status: 'INCOMPLETE', color: 'rose', text: `${missingLeaders} Group Leader${missingLeaders > 1 ? 's' : ''} Missing` };
    }
    return { status: 'READY', color: 'emerald', text: 'Ready & Complete' };
  };

  const getGroupHealth = (g: BatchGroup) => {
    const count = groupMemberCountMap.get(g.id) || 0;
    const hasLeader = !!g.group_leader_app_no;
    const isFull = count >= g.max_members;

    if (count === 0 && !hasLeader) {
      return { label: 'GROUP EMPTY', color: 'rose', icon: AlertTriangle };
    }
    if (!hasLeader) {
      return { label: 'Leader Not Assigned', color: 'amber', icon: AlertTriangle };
    }
    if (isFull) {
      return { label: '✓ GROUP FULL', color: 'emerald', icon: CheckCircle2 };
    }
    const slots = g.max_members - count;
    return { label: `${slots} SLOT${slots > 1 ? 'S' : ''} AVAILABLE`, color: 'sky', icon: AlertTriangle };
  };

  // Helper formatting
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // --- ACTIONS & API HANDLERS ---
  const handleSaveBatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get('name') as string,
      batchCode: formData.get('batchCode') as string,
      type: formData.get('type') as string,
      description: formData.get('description') as string,
      capacity: parseInt(formData.get('capacity') as string, 10) || 80,
      batchLeaderAppNo: formData.get('batchLeaderAppNo') as string || null,
      status: formData.get('status') as string || 'Active'
    };

    try {
      if (editingBatch) {
        await API.updateBatch(editingBatch.id, payload);
        showToast(`Batch "${payload.name}" updated successfully`, 'success');
      } else {
        await API.createBatch(payload);
        showToast(`New Batch "${payload.name}" created successfully`, 'success');
      }
      setBatchModalOpen(false);
      setEditingBatch(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save batch', 'error');
    }
  };

  const handleDeleteBatch = async (batchId: number, batchName: string) => {
    try {
      const res = await API.deleteBatch(batchId);
      if (res && res.success !== false) {
        showToast(res.message || `Batch "${batchName}" processed`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete/deactivate batch', 'error');
    }
  };

  const handleSaveGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedBatchId && !editingGroup) {
      showToast('Please select a batch first', 'error');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const payload = {
      batchId: editingGroup ? editingGroup.batch_id : selectedBatchId,
      name: formData.get('name') as string,
      groupCode: formData.get('groupCode') as string,
      groupLeaderAppNo: formData.get('groupLeaderAppNo') as string || null,
      maxMembers: parseInt(formData.get('maxMembers') as string, 10) || 9,
      description: formData.get('description') as string,
      status: formData.get('status') as string || 'Active'
    };

    try {
      if (editingGroup) {
        await API.updateGroup(editingGroup.id, payload);
        showToast(`Group "${payload.name}" updated successfully`, 'success');
      } else {
        await API.createGroup(payload);
        showToast(`New Group "${payload.name}" created successfully`, 'success');
      }
      setGroupModalOpen(false);
      setEditingGroup(null);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save group', 'error');
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    try {
      const res = await API.deleteGroup(groupId);
      if (res && res.success !== false) {
        showToast(`Group "${groupName}" deleted. Members set to UNASSIGNED`, 'success');
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete group', 'error');
    }
  };

  // Selection Modal Handler for Batch Leader, Group Leader, or Group Member
  const handleSelectEmployeeForRole = async (cand: Candidate) => {
    const { type, targetBatchId, targetGroupId, targetGroupName } = employeeSelectorModal;

    // Check Duplicate Assignment check for group members
    if (type === 'add_member') {
      const existingAssign = memberAssignmentMap.get(cand.app_no);
      if (existingAssign && existingAssign.groupId !== targetGroupId) {
        setDuplicateWarningModal({
          open: true,
          candidate: cand,
          existingBatchName: existingAssign.batchName,
          existingGroupName: existingAssign.groupName
        });
        return;
      }
    }

    try {
      if (type === 'batch_leader' && targetBatchId) {
        await API.assignBatchLeader({
          batchId: targetBatchId,
          batchLeaderAppNo: cand.app_no,
          leaderName: cand.name
        });
        showToast(`${cand.name} assigned as Batch Leader`, 'success');
      } else if (type === 'group_leader' && targetGroupId) {
        await API.assignGroupLeader({
          groupId: targetGroupId,
          groupLeaderAppNo: cand.app_no,
          leaderName: cand.name
        });
        showToast(`${cand.name} assigned as Group Leader`, 'success');
      } else if (type === 'add_member' && targetBatchId && targetGroupId) {
        // Capacity check warning
        const currentGroup = groups.find(g => g.id === targetGroupId);
        const currentCount = groupMemberCountMap.get(targetGroupId) || 0;
        if (currentGroup && currentCount >= currentGroup.max_members) {
          setConfirmModal({
            open: true,
            title: 'Capacity Warning',
            message: `Group capacity is ${currentGroup.max_members} members. Continue adding ${cand.name} anyway?`,
            onConfirm: async () => {
              await API.addMemberToGroup({
                candidateAppNo: cand.app_no,
                batchId: targetBatchId,
                groupId: targetGroupId,
                memberName: cand.name,
                groupName: targetGroupName || 'Group'
              });
              showToast(`${cand.name} added to ${targetGroupName}`, 'success');
              setEmployeeSelectorModal({ open: false, title: '', type: 'add_member' });
              loadData();
            }
          });
          return;
        }

        await API.addMemberToGroup({
          candidateAppNo: cand.app_no,
          batchId: targetBatchId,
          groupId: targetGroupId,
          memberName: cand.name,
          groupName: targetGroupName || 'Group'
        });
        showToast(`${cand.name} added to ${targetGroupName}`, 'success');
      }

      setEmployeeSelectorModal({ open: false, title: '', type: 'add_member' });
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update assignment', 'error');
    }
  };

  const handleBulkAssignSubmit = async () => {
    if (selectedAppNos.length === 0 || !bulkTargetBatchId || !bulkTargetGroupId) {
      showToast('Please select employees, target batch, and target group', 'error');
      return;
    }

    const targetGroup = groups.find(g => g.id === bulkTargetGroupId);
    const targetGroupName = targetGroup ? targetGroup.name : 'Group';

    try {
      await API.bulkAddMembers({
        candidateAppNos: selectedAppNos,
        batchId: bulkTargetBatchId,
        groupId: bulkTargetGroupId,
        groupName: targetGroupName
      });
      showToast(`Assigned ${selectedAppNos.length} employees to ${targetGroupName} successfully`, 'success');
      setSelectedAppNos([]);
      setBulkAssignModalOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Bulk assignment failed', 'error');
    }
  };

  const handleMoveMemberSubmit = async (targetBatchId: number, targetGroupId: number) => {
    const { candidateAppNo, memberName, currentGroupName } = moveMemberModal;
    const targetGroup = groups.find(g => g.id === targetGroupId);
    const targetGroupName = targetGroup ? targetGroup.name : 'Target Group';

    try {
      await API.moveMemberGroup({
        candidateAppNo,
        targetBatchId,
        targetGroupId,
        memberName,
        fromGroupName: currentGroupName,
        toGroupName: targetGroupName
      });
      showToast(`${memberName} moved from ${currentGroupName} to ${targetGroupName}`, 'success');
      setMoveMemberModal({ open: false, candidateAppNo: '', memberName: '', currentGroupId: 0, currentGroupName: '', currentBatchId: 0 });
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to move member', 'error');
    }
  };

  const handleRemoveMemberSubmit = async (candidateAppNo: string, memberName: string, groupName: string) => {
    try {
      await API.removeMemberFromGroup({
        candidateAppNo,
        memberName,
        groupName
      });
      showToast(`${memberName} removed from ${groupName} (now UNASSIGNED)`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove member', 'error');
    }
  };

  // EXPORT FUNCTIONS
  const exportExcel = () => {
    try {
      let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E2D4E" ss:Pattern="Solid"/></Style>
  <Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#1E2D4E"/></Style>
  <Style ss:ID="Default"><Font ss:FontName="Calibri" ss:Size="10"/></Style>
 </Styles>`;

      // Sheet 1: Batch Summary
      xml += `\n <Worksheet ss:Name="Batch Summary"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Title"><Data ss:Type="String">BSC BATCH PLAN - BATCH SUMMARY</Data></Cell></Row>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Batch Code</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Batch Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Capacity</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Members</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Batch Leader</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Groups</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group Leaders</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell></Row>`;
      batches.forEach(b => {
        const leader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no)?.name || b.batch_leader_app_no : 'Unassigned';
        const mCount = batchMemberCountMap.get(b.id) || 0;
        const gCount = groups.filter(g => g.batch_id === b.id).length;
        const glCount = batchGroupLeaderCountMap.get(b.id) || 0;
        xml += `\n  <Row><Cell><Data ss:Type="String">${b.batch_code}</Data></Cell><Cell><Data ss:Type="String">${b.name}</Data></Cell><Cell><Data ss:Type="String">${b.type}</Data></Cell><Cell><Data ss:Type="Number">${b.capacity}</Data></Cell><Cell><Data ss:Type="Number">${mCount}</Data></Cell><Cell><Data ss:Type="String">${leader}</Data></Cell><Cell><Data ss:Type="Number">${gCount}</Data></Cell><Cell><Data ss:Type="Number">${glCount}</Data></Cell><Cell><Data ss:Type="String">${b.status}</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 2: Batch Leaders
      xml += `\n <Worksheet ss:Name="Batch Leaders"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Batch Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Leader App No</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Leader Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Phone</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Designation</Data></Cell></Row>`;
      batches.forEach(b => {
        const leaderCand = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
        xml += `\n  <Row><Cell><Data ss:Type="String">${b.name}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.app_no || '-'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.name || 'Unassigned'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.phone || '-'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.department || '-'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.designation || '-'}</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 3: Group Structure
      xml += `\n <Worksheet ss:Name="Group Structure"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Group Code</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Batch</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group Leader</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Members Count</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Max Capacity</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell></Row>`;
      groups.forEach(g => {
        const parentBatch = batches.find(b => b.id === g.batch_id)?.name || 'Unknown';
        const leaderCand = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no)?.name : 'Unassigned';
        const mCount = groupMemberCountMap.get(g.id) || 0;
        xml += `\n  <Row><Cell><Data ss:Type="String">${g.group_code}</Data></Cell><Cell><Data ss:Type="String">${g.name}</Data></Cell><Cell><Data ss:Type="String">${parentBatch}</Data></Cell><Cell><Data ss:Type="String">${leaderCand}</Data></Cell><Cell><Data ss:Type="Number">${mCount}</Data></Cell><Cell><Data ss:Type="Number">${g.max_members}</Data></Cell><Cell><Data ss:Type="String">${g.status}</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 4: Group Leaders
      xml += `\n <Worksheet ss:Name="Group Leaders"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Batch</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group Leader App No</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Phone</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Designation</Data></Cell></Row>`;
      groups.forEach(g => {
        const parentBatch = batches.find(b => b.id === g.batch_id)?.name || 'Unknown';
        const leaderCand = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no) : null;
        xml += `\n  <Row><Cell><Data ss:Type="String">${parentBatch}</Data></Cell><Cell><Data ss:Type="String">${g.name}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.app_no || '-'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.name || 'Unassigned'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.phone || '-'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.department || '-'}</Data></Cell><Cell><Data ss:Type="String">${leaderCand?.designation || '-'}</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 5: Members
      xml += `\n <Worksheet ss:Name="Members"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">App No / Emp ID</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Member Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Phone</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Designation</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Batch</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Joined Store Status</Data></Cell></Row>`;
      groupMembers.forEach(gm => {
        const cand = candidateMap.get(gm.candidate_app_no);
        const parentBatch = batches.find(b => b.id === gm.batch_id)?.name || 'Unknown';
        const parentGroup = groups.find(g => g.id === gm.group_id)?.name || 'Batch Direct';
        xml += `\n  <Row><Cell><Data ss:Type="String">${gm.candidate_app_no}</Data></Cell><Cell><Data ss:Type="String">${cand?.name || '-'}</Data></Cell><Cell><Data ss:Type="String">${cand?.phone || '-'}</Data></Cell><Cell><Data ss:Type="String">${cand?.department || '-'}</Data></Cell><Cell><Data ss:Type="String">${cand?.designation || '-'}</Data></Cell><Cell><Data ss:Type="String">${parentBatch}</Data></Cell><Cell><Data ss:Type="String">${parentGroup}</Data></Cell><Cell><Data ss:Type="String">${cand?.storeStatusLabel || 'Joined Store'}</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 6: Unassigned Members
      xml += `\n <Worksheet ss:Name="Unassigned Members"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">App No / Emp ID</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Phone</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Designation</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell></Row>`;
      candidates.filter(c => !assignedAppNoSet.has(c.app_no)).forEach(c => {
        xml += `\n  <Row><Cell><Data ss:Type="String">${c.app_no}</Data></Cell><Cell><Data ss:Type="String">${c.name}</Data></Cell><Cell><Data ss:Type="String">${c.phone || '-'}</Data></Cell><Cell><Data ss:Type="String">${c.department || '-'}</Data></Cell><Cell><Data ss:Type="String">${c.designation || '-'}</Data></Cell><Cell><Data ss:Type="String">Joined Store (Unassigned)</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 7: Complete Hierarchy
      xml += `\n <Worksheet ss:Name="Complete Hierarchy"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Level</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Entity Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Leader / Assigned Person</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Details / Count</Data></Cell></Row>`;
      xml += `\n  <Row><Cell><Data ss:Type="String">Top Level</Data></Cell><Cell><Data ss:Type="String">ADMIN / MANAGER</Data></Cell><Cell><Data ss:Type="String">${session?.fullName || 'Admin'}</Data></Cell><Cell><Data ss:Type="String">System Control</Data></Cell></Row>`;
      batches.forEach(b => {
        const bLeader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no)?.name : 'Unassigned';
        xml += `\n  <Row><Cell><Data ss:Type="String">Batch</Data></Cell><Cell><Data ss:Type="String">${b.name}</Data></Cell><Cell><Data ss:Type="String">Batch Leader: ${bLeader}</Data></Cell><Cell><Data ss:Type="String">Type: ${b.type}</Data></Cell></Row>`;
        const bGroups = groups.filter(g => g.batch_id === b.id);
        bGroups.forEach(g => {
          const gLeader = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no)?.name : 'Unassigned';
          xml += `\n  <Row><Cell><Data ss:Type="String">Group</Data></Cell><Cell><Data ss:Type="String">  └─ ${g.name}</Data></Cell><Cell><Data ss:Type="String">Group Leader: ${gLeader}</Data></Cell><Cell><Data ss:Type="String">Members: ${groupMemberCountMap.get(g.id) || 0}/${g.max_members}</Data></Cell></Row>`;
          const gMems = groupMembers.filter(m => m.group_id === g.id);
          gMems.forEach(m => {
            const cand = candidateMap.get(m.candidate_app_no);
            xml += `\n  <Row><Cell><Data ss:Type="String">Member</Data></Cell><Cell><Data ss:Type="String">      ├── ${cand?.name || m.candidate_app_no}</Data></Cell><Cell><Data ss:Type="String">${cand?.app_no || '-'}</Data></Cell><Cell><Data ss:Type="String">${cand?.department || '-'} | ${cand?.designation || '-'}</Data></Cell></Row>`;
          });
        });
      });
      xml += `\n </Table></Worksheet>`;

      xml += `\n</Workbook>`;

      const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BSC_Batch_Plan_Report_${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Excel workbook exported with 7 sheets!', 'success');
    } catch (e: any) {
      showToast('Excel export failed: ' + e.message, 'error');
    }
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#EDE8DE] flex font-sans">
      <Toast />
      <Sidebar session={session} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar
          title="BSC Batch Plan"
          breadcrumbs={[{ label: 'Talent Management' }, { label: 'BSC Batch Plan' }]}
          session={session}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-4 lg:p-6 space-y-6 flex-1 overflow-y-auto print:p-0 print:bg-white">
          {/* Header Banner */}
          <div className="card-glass p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-l-4 border-l-[#C9952A] shadow-md print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#1E2D4E] text-[#C9952A]">
                  <FolderTree className="w-5 h-5" />
                </span>
                <div>
                  <h1 className="text-xl font-black text-[#1E2D4E] tracking-tight">BSC BATCH PLAN</h1>
                  <p className="text-xs font-extrabold text-[#C9952A] tracking-wider uppercase">
                    Batch, Group & Leadership Management
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#555555] font-semibold mt-2 max-w-3xl">
                Create batches, assign Batch Leaders, create groups, assign Group Leaders, and manage members under each group. Employee source: <strong className="text-[#1E2D4E]">JOINED STORE DIRECTORY ONLY</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setEditingBatch(null);
                  setBatchModalOpen(true);
                }}
                className="btn-primary text-xs flex items-center gap-2 shadow-md bg-[#1E2D4E] hover:bg-[#162340] text-white px-4 py-2.5 rounded-xl font-extrabold"
              >
                <Plus className="w-4 h-4 text-[#C9952A]" />
                <span>+ Create New Batch</span>
              </button>

              <button
                onClick={exportExcel}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={exportPDF}
                className="px-3.5 py-2.5 rounded-xl bg-white border border-[#e2dfd7] text-[#1E2D4E] hover:bg-[#F9F7F4] text-xs font-extrabold flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4 text-[#C9952A]" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          {/* Print Only Header */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-[#1E2D4E]">BSC TEXTILES - BATCH & GROUP MANAGEMENT REPORT</h1>
            <p className="text-sm text-gray-600">Generated on: {new Date().toLocaleDateString()} | Confidential HR Report</p>
          </div>

          {/* TOP DASHBOARD SUMMARY (Dynamic KPI Cards with Click-to-Filter interactivity) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 print:grid-cols-4">
            <div
              onClick={() => {
                setActiveTab('batches');
                setFilterBatch('All');
                setSelectedBatchId(null);
              }}
              className="card-glass p-3.5 border-l-4 border-l-[#1E2D4E] bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">TOTAL BATCHES</div>
              <div className="text-xl font-black text-[#1E2D4E] mt-1">{totalBatches}</div>
              <div className="text-[9.5px] text-gray-400 font-extrabold mt-0.5">Active Batches</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('unassigned');
                setFilterAssignmentStatus('All');
              }}
              className="card-glass p-3.5 border-l-4 border-l-[#C9952A] bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">JOINED EMPLOYEES</div>
              <div className="text-xl font-black text-[#C9952A] mt-1">{totalJoinedEmployees}</div>
              <div className="text-[9.5px] text-[#C9952A] font-extrabold mt-0.5">Joined Store Directory</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('batches');
                setFilterAssignmentStatus('Assigned');
              }}
              className="card-glass p-3.5 border-l-4 border-l-emerald-600 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">ASSIGNED EMPLOYEES</div>
              <div className="text-xl font-black text-emerald-800 mt-1">{totalAssignedEmployees}</div>
              <div className="text-[9.5px] text-emerald-700 font-extrabold mt-0.5">Assigned to Groups</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('unassigned');
                setFilterAssignmentStatus('Unassigned');
              }}
              className="card-glass p-3.5 border-l-4 border-l-rose-500 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">UNASSIGNED EMPLOYEES</div>
              <div className="text-xl font-black text-rose-600 mt-1">{unassignedMembersCount}</div>
              <div className="text-[9.5px] text-rose-700 font-extrabold mt-0.5">Click to view & assign</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('leadership');
              }}
              className="card-glass p-3.5 border-l-4 border-l-indigo-600 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">BATCH LEADERS</div>
              <div className="text-xl font-black text-indigo-900 mt-1">{totalBatchLeaders}</div>
              <div className="text-[9.5px] text-indigo-700 font-extrabold mt-0.5">{totalBatches - totalBatchLeaders} Pending</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('batches');
              }}
              className="card-glass p-3.5 border-l-4 border-l-purple-600 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">GROUPS</div>
              <div className="text-xl font-black text-purple-900 mt-1">{totalGroups}</div>
              <div className="text-[9.5px] text-purple-700 font-extrabold mt-0.5">Configured Groups</div>
            </div>

            <div
              onClick={() => {
                setActiveTab('leadership');
              }}
              className="card-glass p-3.5 border-l-4 border-l-emerald-600 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-gray-500 uppercase tracking-wider">GROUP LEADERS</div>
              <div className="text-xl font-black text-emerald-900 mt-1">{totalGroupLeaders}</div>
              <div className="text-[9.5px] text-emerald-700 font-extrabold mt-0.5">{totalGroups - totalGroupLeaders} Pending</div>
            </div>
          </div>

          {/* VIEW SWITCHER & SEARCH / FILTERS */}
          <div className="card-glass p-4 space-y-3 print:hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
              {/* View Options Toggle */}
              <div className="flex items-center gap-1 bg-[#E0DACB] p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    viewMode === 'cards' ? 'bg-[#1E2D4E] text-white shadow-sm' : 'text-[#1E2D4E] hover:bg-white/50'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Cards View</span>
                </button>

                <button
                  onClick={() => setViewMode('hierarchy')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                    viewMode === 'hierarchy' ? 'bg-[#1E2D4E] text-white shadow-sm' : 'text-[#1E2D4E] hover:bg-white/50'
                  }`}
                >
                  <FolderTree className="w-3.5 h-3.5" />
                  <span>Hierarchy View</span>
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setActiveTab('batches')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'batches' ? 'bg-[#C9952A] text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  Batches & Groups
                </button>

                <button
                  onClick={() => setActiveTab('unassigned')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 ${
                    activeTab === 'unassigned' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  <span>Unassigned Joined Pool</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                    {unassignedMembersCount}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('leadership')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'leadership' ? 'bg-indigo-700 text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  Leadership Structure
                </button>

                <button
                  onClick={() => setActiveTab('activity')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'activity' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  Recent Activity
                </button>
              </div>
            </div>

            {/* Filters grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="text-[10px] font-black text-[#555555] uppercase block mb-1">Global Search</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search joined employee, ID, phone..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#555555] uppercase block mb-1">Batch Filter</label>
                <select
                  value={filterBatch}
                  onChange={e => setFilterBatch(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
                >
                  <option value="All">All Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.name}>{b.name} ({b.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#555555] uppercase block mb-1">Department</label>
                <select
                  value={filterDept}
                  onChange={e => setFilterDept(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
                >
                  <option value="All">All Departments</option>
                  {departments.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#555555] uppercase block mb-1">Designation</label>
                <select
                  value={filterDesig}
                  onChange={e => setFilterDesig(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
                >
                  <option value="All">All Designations</option>
                  {designations.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#555555] uppercase block mb-1">Assignment Status</label>
                <select
                  value={filterAssignmentStatus}
                  onChange={e => setFilterAssignmentStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
                >
                  <option value="All">All Statuses</option>
                  <option value="Unassigned">Unassigned Only</option>
                  <option value="Assigned">Assigned Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* TAB 1: BATCHES & GROUPS (CARDS OR HIERARCHY) */}
          {activeTab === 'batches' && (
            <>
              {viewMode === 'cards' ? (
                /* CARDS VIEW MODE */
                <div className="space-y-6">
                  {/* Selected Batch Detail View or All Batches List */}
                  {selectedBatchId ? (
                    // DEDICATED BATCH MANAGEMENT VIEW
                    (() => {
                      const b = batches.find(x => x.id === selectedBatchId);
                      if (!b) return null;
                      const bLeader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
                      const bGroups = groups.filter(g => g.batch_id === b.id);
                      const bMemberCount = batchMemberCountMap.get(b.id) || 0;
                      const health = getBatchHealth(b);

                      return (
                        <div className="space-y-6">
                          {/* Batch Top Header Banner */}
                          <div className="card-glass p-5 border-l-4 border-l-[#1E2D4E] bg-white">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#e2dfd7] pb-4">
                              <div>
                                <button
                                  onClick={() => setSelectedBatchId(null)}
                                  className="text-xs font-extrabold text-[#C9952A] hover:underline flex items-center gap-1 mb-1"
                                >
                                  ← Back to All Batches
                                </button>
                                <div className="flex items-center gap-3">
                                  <h2 className="text-2xl font-black text-[#1E2D4E]">{b.name}</h2>
                                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#1E2D4E]/10 text-[#1E2D4E]">
                                    {b.type} Batch
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-${health.color}-100 text-${health.color}-800`}>
                                    {health.status}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 font-medium mt-1">{b.description || 'BSC Management Batch Structure'}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setEditingBatch(b);
                                    setBatchModalOpen(true);
                                  }}
                                  className="px-3.5 py-2 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-[#F9F7F4] flex items-center gap-1.5 shadow-xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit Batch</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setEditingGroup(null);
                                    setGroupModalOpen(true);
                                  }}
                                  className="px-4 py-2 rounded-xl bg-[#C9952A] text-white hover:bg-[#b08020] text-xs font-black flex items-center gap-1.5 shadow-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>+ Create Group</span>
                                </button>
                              </div>
                            </div>

                            {/* Batch KPI Bar */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-2">
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/80">
                                <span className="text-[10px] font-black text-gray-500 uppercase block">Batch Leader</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{bLeader ? bLeader.name : 'Unassigned'}</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/80">
                                <span className="text-[10px] font-black text-gray-500 uppercase block">Members</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{bMemberCount} / {b.capacity}</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/80">
                                <span className="text-[10px] font-black text-gray-500 uppercase block">Groups</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{bGroups.length} Configured</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/80">
                                <span className="text-[10px] font-black text-gray-500 uppercase block">Group Leaders</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{batchGroupLeaderCountMap.get(b.id) || 0} / {bGroups.length}</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]/80">
                                <span className="text-[10px] font-black text-gray-500 uppercase block">Status</span>
                                <span className="font-extrabold text-emerald-700 text-xs">{b.status}</span>
                              </div>
                            </div>
                          </div>

                          {/* BATCH LEADER PROFILE CARD */}
                          <div className="card-glass p-5 border-l-4 border-l-[#C9952A] bg-white">
                            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3 mb-4">
                              <h3 className="font-black text-[#1E2D4E] text-sm uppercase tracking-wider flex items-center gap-2">
                                <Award className="w-4 h-4 text-[#C9952A]" />
                                <span>BATCH LEADER</span>
                              </h3>
                              <button
                                onClick={() =>
                                  setEmployeeSelectorModal({
                                    open: true,
                                    type: 'batch_leader',
                                    targetBatchId: b.id,
                                    title: `SELECT BATCH LEADER FOR ${b.name}`
                                  })
                                }
                                className="px-3.5 py-1.5 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold"
                              >
                                {bLeader ? 'Change Leader' : '+ Select Batch Leader'}
                              </button>
                            </div>

                            {bLeader ? (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#F9F7F4] border border-[#e2dfd7]">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl bg-[#1E2D4E] text-white font-black flex items-center justify-center text-lg shadow-md border-2 border-[#C9952A]">
                                    {bLeader.photo_url ? (
                                      <img src={API.fileUrl(bLeader.photo_url) || ''} alt={bLeader.name} className="w-full h-full object-cover rounded-2xl" />
                                    ) : (
                                      bLeader.name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-black text-[#1E2D4E] text-base">{bLeader.name}</h4>
                                      <span className="px-2 py-0.5 rounded-md bg-[#C9952A]/20 text-[#C9952A] text-[10px] font-black">
                                        Joined Store
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600 font-bold mt-0.5">
                                      ID: {bLeader.app_no} · {bLeader.designation} ({bLeader.department})
                                    </div>
                                    <div className="text-xs text-gray-500 font-semibold flex items-center gap-3 mt-1">
                                      <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" /> {bLeader.phone || 'N/A'}</span>
                                      <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" /> {bLeader.email || 'N/A'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setMemberProfileModal({ open: true, candidate: bLeader })}
                                    className="px-3 py-1.5 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-gray-50"
                                  >
                                    View Profile
                                  </button>
                                  <button
                                    onClick={() =>
                                      setConfirmModal({
                                        open: true,
                                        title: 'Remove Batch Leader?',
                                        message: `Are you sure you want to remove ${bLeader.name} as Batch Leader? This will not delete the employee record.`,
                                        onConfirm: async () => {
                                          await API.assignBatchLeader({ batchId: b.id, batchLeaderAppNo: null, leaderName: 'Unassigned' });
                                          showToast('Batch Leader removed', 'success');
                                          loadData();
                                        }
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                                  >
                                    Remove Leader
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-6 rounded-2xl border-2 border-dashed border-[#e2dfd7] text-center bg-[#F9F7F4]">
                                <UserX className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-xs font-bold text-gray-600">No Batch Leader assigned for {b.name}</p>
                                <button
                                  onClick={() =>
                                    setEmployeeSelectorModal({
                                      open: true,
                                      type: 'batch_leader',
                                      targetBatchId: b.id,
                                      title: `SELECT BATCH LEADER FOR ${b.name}`
                                    })
                                  }
                                  className="mt-3 px-4 py-2 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b08020]"
                                >
                                  + Select Batch Leader
                                </button>
                              </div>
                            )}
                          </div>

                          {/* GROUP MANAGEMENT SECTION */}
                          <div className="card-glass p-5 border-l-4 border-l-indigo-600 bg-white">
                            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3 mb-4">
                              <div>
                                <h3 className="font-black text-[#1E2D4E] text-base tracking-tight">GROUP MANAGEMENT</h3>
                                <p className="text-xs text-gray-500 font-medium">Groups under {b.name} ({bGroups.length} Groups)</p>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingGroup(null);
                                  setGroupModalOpen(true);
                                }}
                                className="px-4 py-2 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold flex items-center gap-1.5"
                              >
                                <Plus className="w-4 h-4 text-[#C9952A]" />
                                <span>+ Create Group</span>
                              </button>
                            </div>

                            {bGroups.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {bGroups.map(g => {
                                  const gLeader = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no) : null;
                                  const mCount = groupMemberCountMap.get(g.id) || 0;
                                  const gHealth = getGroupHealth(g);
                                  const HealthIcon = gHealth.icon;

                                  return (
                                    <div key={g.id} className="border border-[#e2dfd7] rounded-2xl p-4 bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                                      <div>
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                                          <div>
                                            <h4 className="font-black text-[#1E2D4E] text-base">{g.name}</h4>
                                            <span className="text-[10px] font-bold text-gray-400">{g.group_code}</span>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 bg-${gHealth.color}-100 text-${gHealth.color}-800`}>
                                            <HealthIcon className="w-3 h-3" />
                                            <span>{gHealth.label}</span>
                                          </span>
                                        </div>

                                        {/* Group Leader Info */}
                                        <div className="mt-3 bg-[#F9F7F4] p-3 rounded-xl border border-gray-200/70">
                                          <div className="text-[10px] font-black text-gray-400 uppercase">Group Leader</div>
                                          {gLeader ? (
                                            <div className="flex items-center gap-2.5 mt-1">
                                              <div className="w-8 h-8 rounded-lg bg-[#C9952A] text-white font-black text-xs flex items-center justify-center">
                                                {gLeader.name.slice(0, 2).toUpperCase()}
                                              </div>
                                              <div>
                                                <div className="font-extrabold text-xs text-[#1E2D4E] truncate max-w-[140px]">{gLeader.name}</div>
                                                <div className="text-[10px] text-gray-500 font-medium">ID: {gLeader.app_no}</div>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center justify-between mt-1">
                                              <span className="text-xs font-extrabold text-rose-600">Leader Not Assigned</span>
                                              <button
                                                onClick={() =>
                                                  setEmployeeSelectorModal({
                                                    open: true,
                                                    type: 'group_leader',
                                                    targetGroupId: g.id,
                                                    title: `SELECT GROUP LEADER FOR ${g.name}`
                                                  })
                                                }
                                                className="text-[10px] font-black text-[#1E2D4E] underline"
                                              >
                                                + Select
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        {/* Members count bar */}
                                        <div className="mt-3 flex items-center justify-between text-xs">
                                          <span className="font-extrabold text-gray-600">Members</span>
                                          <span className="font-black text-[#1E2D4E]">{mCount} / {g.max_members}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                          <div
                                            className="h-full bg-[#C9952A] rounded-full transition-all"
                                            style={{ width: `${Math.min(100, Math.round((mCount / g.max_members) * 100))}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* Group Action buttons */}
                                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5">
                                        <button
                                          onClick={() => setSelectedGroupId(g.id)}
                                          className="flex-1 py-1.5 px-2 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold text-center"
                                        >
                                          Open Group
                                        </button>

                                        <button
                                          onClick={() => {
                                            setEditingGroup(g);
                                            setGroupModalOpen(true);
                                          }}
                                          className="py-1.5 px-2 rounded-xl bg-white border border-[#e2dfd7] text-[#1E2D4E] hover:bg-gray-50 text-xs font-extrabold"
                                        >
                                          Edit
                                        </button>

                                        <button
                                          onClick={() =>
                                            setEmployeeSelectorModal({
                                              open: true,
                                              type: 'add_member',
                                              targetBatchId: b.id,
                                              targetGroupId: g.id,
                                              targetGroupName: g.name,
                                              title: `ADD EMPLOYEE TO ${g.name}`
                                            })
                                          }
                                          className="py-1.5 px-2.5 rounded-xl bg-[#C9952A] text-white hover:bg-[#b08020] text-xs font-black"
                                        >
                                          + Add
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="p-8 text-center border-2 border-dashed border-[#e2dfd7] rounded-2xl bg-[#F9F7F4]">
                                <Layers className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                <h4 className="font-extrabold text-sm text-[#1E2D4E]">No Groups created in {b.name}</h4>
                                <p className="text-xs text-gray-500 mt-1">Create groups to organize members under group leadership</p>
                                <button
                                  onClick={() => {
                                    setEditingGroup(null);
                                    setGroupModalOpen(true);
                                  }}
                                  className="mt-3 px-4 py-2 rounded-xl bg-[#1E2D4E] text-white text-xs font-extrabold hover:bg-[#162340]"
                                >
                                  + Create Group 01
                                </button>
                              </div>
                            )}
                          </div>

                          {/* GROUP DETAILS MODAL / EXPANDED VIEW IF SELECTED GROUP */}
                          {selectedGroupId && (() => {
                            const grp = groups.find(x => x.id === selectedGroupId);
                            if (!grp) return null;
                            const grpLeader = grp.group_leader_app_no ? candidateMap.get(grp.group_leader_app_no) : null;
                            const grpMems = groupMembers.filter(m => m.group_id === grp.id);

                            return (
                              <div className="card-glass p-5 border-l-4 border-l-purple-600 bg-white">
                                <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3 mb-4">
                                  <div>
                                    <button
                                      onClick={() => setSelectedGroupId(null)}
                                      className="text-xs font-extrabold text-[#C9952A] hover:underline mb-1"
                                    >
                                      ← Back to Groups List
                                    </button>
                                    <h3 className="font-black text-[#1E2D4E] text-lg">{grp.name} - MEMBERS DIRECTORY</h3>
                                    <p className="text-xs text-gray-500 font-medium">Group Code: {grp.group_code} · Leader: {grpLeader ? grpLeader.name : 'Unassigned'}</p>
                                  </div>

                                  <button
                                    onClick={() =>
                                      setEmployeeSelectorModal({
                                        open: true,
                                        type: 'add_member',
                                        targetBatchId: b.id,
                                        targetGroupId: grp.id,
                                        targetGroupName: grp.name,
                                        title: `ADD EMPLOYEE TO ${grp.name}`
                                      })
                                    }
                                    className="px-4 py-2 rounded-xl bg-[#C9952A] text-white hover:bg-[#b08020] text-xs font-black flex items-center gap-1.5"
                                  >
                                    <UserPlus className="w-4 h-4" />
                                    <span>+ Add Member</span>
                                  </button>
                                </div>

                                {/* Group Leader Summary */}
                                <div className="p-3.5 rounded-xl bg-[#F9F7F4] border border-[#e2dfd7] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#1E2D4E] text-[#C9952A] font-black flex items-center justify-center text-sm">
                                      GL
                                    </div>
                                    <div>
                                      <div className="text-[10px] font-black text-gray-500 uppercase">Group Leader</div>
                                      <div className="font-extrabold text-sm text-[#1E2D4E]">{grpLeader ? grpLeader.name : 'Not Assigned'}</div>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() =>
                                      setEmployeeSelectorModal({
                                        open: true,
                                        type: 'group_leader',
                                        targetGroupId: grp.id,
                                        title: `SELECT GROUP LEADER FOR ${grp.name}`
                                      })
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-gray-50"
                                  >
                                    {grpLeader ? 'Change Group Leader' : '+ Select Leader'}
                                  </button>
                                </div>

                                {/* Members List Table */}
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-[#1E2D4E] text-white uppercase text-[10.5px] tracking-wider">
                                        <th className="p-3 rounded-tl-xl">#</th>
                                        <th className="p-3">Member Details</th>
                                        <th className="p-3">Employee ID / App No</th>
                                        <th className="p-3">Phone</th>
                                        <th className="p-3">Department & Designation</th>
                                        <th className="p-3">Directory Status</th>
                                        <th className="p-3 text-right rounded-tr-xl">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e2dfd7]">
                                      {grpMems.length > 0 ? (
                                        grpMems.map((gm, idx) => {
                                          const cand = candidateMap.get(gm.candidate_app_no);
                                          if (!cand) return null;

                                          return (
                                            <tr key={gm.id} className="hover:bg-[#F9F7F4] transition-colors">
                                              <td className="p-3 font-black text-gray-400">{idx + 1}</td>
                                              <td className="p-3">
                                                <div className="flex items-center gap-2.5">
                                                  <div className="w-8 h-8 rounded-xl bg-[#C9952A] text-white font-black text-xs flex items-center justify-center">
                                                    {cand.name.slice(0, 2).toUpperCase()}
                                                  </div>
                                                  <div>
                                                    <div className="font-extrabold text-[#1E2D4E]">{cand.name}</div>
                                                    <span className="px-1.5 py-0.2 rounded bg-[#C9952A]/20 text-[#C9952A] text-[9.5px] font-black">
                                                      Joined Store
                                                    </span>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="p-3 font-bold text-gray-700">{cand.app_no}</td>
                                              <td className="p-3 font-bold text-gray-600">{cand.phone || 'N/A'}</td>
                                              <td className="p-3">
                                                <div className="font-bold text-[#1E2D4E]">{cand.department || 'General'}</div>
                                                <div className="text-[10px] text-gray-500 font-semibold">{cand.designation || 'Staff'}</div>
                                              </td>
                                              <td className="p-3">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                                  Assigned ({grp.name})
                                                </span>
                                              </td>
                                              <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                  <button
                                                    onClick={() => setMemberProfileModal({ open: true, candidate: cand })}
                                                    className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                    title="View Profile"
                                                  >
                                                    <Eye className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      setMoveMemberModal({
                                                        open: true,
                                                        candidateAppNo: cand.app_no,
                                                        memberName: cand.name,
                                                        currentGroupId: grp.id,
                                                        currentGroupName: grp.name,
                                                        currentBatchId: b.id
                                                      })
                                                    }
                                                    className="p-1.5 rounded-lg bg-[#1E2D4E]/10 text-[#1E2D4E] hover:bg-[#1E2D4E] hover:text-white"
                                                    title="Move Member"
                                                  >
                                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      setConfirmModal({
                                                        open: true,
                                                        title: 'Remove Member from Group?',
                                                        message: `Remove ${cand.name} from ${grp.name}? The employee will become UNASSIGNED. This will not delete the employee record.`,
                                                        onConfirm: () => handleRemoveMemberSubmit(cand.app_no, cand.name, grp.name)
                                                      })
                                                    }
                                                    className="p-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white"
                                                    title="Remove from Group"
                                                  >
                                                    <UserX className="w-3.5 h-3.5" />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })
                                      ) : (
                                        <tr>
                                          <td colSpan={7} className="p-6 text-center text-gray-500 font-bold">
                                            No members assigned to {grp.name} yet. Click "+ Add Member" to allocate.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()
                  ) : (
                    // LIST OF ALL BATCHES CARDS
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {batches.map(b => {
                        const bLeader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
                        const mCount = batchMemberCountMap.get(b.id) || 0;
                        const bGroups = groups.filter(g => g.batch_id === b.id);
                        const glCount = batchGroupLeaderCountMap.get(b.id) || 0;
                        const health = getBatchHealth(b);

                        return (
                          <div
                            key={b.id}
                            className="card-glass p-5 rounded-2xl border-l-4 border-l-[#1E2D4E] bg-white hover:shadow-xl transition-all flex flex-col justify-between space-y-4"
                          >
                            <div>
                              {/* Batch Card Header */}
                              <div className="flex items-start justify-between border-b border-[#e2dfd7] pb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-[#1E2D4E]">{b.name}</h3>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#1E2D4E]/10 text-[#1E2D4E]">
                                      {b.type}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 font-bold mt-0.5">{b.batch_code}</div>
                                </div>

                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-${health.color}-100 text-${health.color}-800`}>
                                  {b.status}
                                </span>
                              </div>

                              {/* Members & Capacity */}
                              <div className="mt-3 flex items-center justify-between text-xs">
                                <span className="font-extrabold text-gray-600">Total Joined Members</span>
                                <span className="font-black text-[#1E2D4E]">{mCount} / {b.capacity}</span>
                              </div>
                              <div className="w-full h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-[#1E2D4E] rounded-full transition-all"
                                  style={{ width: `${Math.min(100, Math.round((mCount / b.capacity) * 100))}%` }}
                                />
                              </div>

                              {/* Batch Leader Info */}
                              <div className="mt-4 bg-[#F9F7F4] p-3 rounded-xl border border-[#e2dfd7]">
                                <div className="text-[10px] font-black text-gray-400 uppercase">Batch Leader</div>
                                {bLeader ? (
                                  <div className="flex items-center gap-3 mt-1">
                                    <div className="w-9 h-9 rounded-xl bg-[#1E2D4E] text-[#C9952A] font-black text-xs flex items-center justify-center">
                                      {bLeader.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-extrabold text-xs text-[#1E2D4E]">{bLeader.name}</div>
                                      <div className="text-[10px] text-gray-500 font-medium">ID: {bLeader.app_no} · {bLeader.designation}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs font-extrabold text-rose-600 mt-1">
                                    Unassigned
                                  </div>
                                )}
                              </div>

                              {/* Groups Breakdown Summary */}
                              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                                <div className="bg-gray-50 p-2 rounded-lg border">
                                  <div className="text-[10px] font-black text-gray-400 uppercase">Groups</div>
                                  <div className="font-black text-[#1E2D4E]">{bGroups.length}</div>
                                </div>
                                <div className="bg-gray-50 p-2 rounded-lg border">
                                  <div className="text-[10px] font-black text-gray-400 uppercase">Group Leaders</div>
                                  <div className="font-black text-emerald-700">{glCount}</div>
                                </div>
                              </div>
                            </div>

                            {/* Batch Actions */}
                            <div className="pt-3 border-t border-[#e2dfd7] flex items-center gap-2">
                              <button
                                onClick={() => setSelectedBatchId(b.id)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold text-center shadow-xs"
                              >
                                Open Batch
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBatch(b);
                                  setBatchModalOpen(true);
                                }}
                                className="py-2 px-3 rounded-xl bg-white border border-[#e2dfd7] text-[#1E2D4E] hover:bg-gray-50 text-xs font-extrabold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  setEmployeeSelectorModal({
                                    open: true,
                                    type: 'batch_leader',
                                    targetBatchId: b.id,
                                    title: `SELECT BATCH LEADER FOR ${b.name}`
                                  });
                                }}
                                className="py-2 px-3 rounded-xl bg-[#C9952A]/20 text-[#C9952A] hover:bg-[#C9952A] hover:text-white text-xs font-black"
                              >
                                Change Leader
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* HIERARCHY VIEW MODE (Tree Structure) */
                <div className="card-glass p-6 bg-white space-y-6">
                  <div className="border-b border-[#e2dfd7] pb-3">
                    <h2 className="text-lg font-black text-[#1E2D4E]">COMPLETE ORGANIZATIONAL HIERARCHY</h2>
                    <p className="text-xs text-gray-500 font-medium">Visual tree structure of Admin → Batches → Batch Leaders → Groups → Group Leaders → Group Members</p>
                  </div>

                  {/* Hierarchy Root: Admin / Manager */}
                  <div className="space-y-6 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#1E2D4E] text-white border-2 border-[#C9952A] shadow-md max-w-xl">
                      <div className="font-black text-sm text-[#C9952A] uppercase tracking-wider">ADMIN / MANAGER WORKSPACE</div>
                      <div className="text-xs font-extrabold text-white mt-1">{session?.fullName || 'System Administrator'}</div>
                      <div className="text-[10px] text-gray-300 font-medium">Top Level Organizational Controller</div>
                    </div>

                    {/* Batches Tree */}
                    <div className="pl-6 border-l-2 border-dashed border-[#1E2D4E]/40 space-y-6">
                      {batches.map(b => {
                        const bLeader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
                        const bGroups = groups.filter(g => g.batch_id === b.id);

                        return (
                          <div key={b.id} className="space-y-4">
                            {/* Batch Node */}
                            <div className="p-4 rounded-xl bg-[#F9F7F4] border-2 border-[#1E2D4E] shadow-sm max-w-2xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm text-[#1E2D4E]">{b.name}</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#C9952A]/20 text-[#C9952A]">{b.type}</span>
                                </div>
                                <span className="text-[10px] font-bold text-gray-500">{batchMemberCountMap.get(b.id) || 0} Members</span>
                              </div>
                              <div className="text-xs font-extrabold text-indigo-900 mt-1">
                                Batch Leader: {bLeader ? `${bLeader.name} (${bLeader.app_no})` : '⚠️ Unassigned'}
                              </div>
                            </div>

                            {/* Groups Tree under Batch */}
                            <div className="pl-6 border-l-2 border-dashed border-[#C9952A]/60 space-y-4">
                              {bGroups.map(g => {
                                const gLeader = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no) : null;
                                const gMems = groupMembers.filter(m => m.group_id === g.id);

                                return (
                                  <div key={g.id} className="space-y-2">
                                    {/* Group Node */}
                                    <div className="p-3 rounded-lg bg-white border border-gray-300 shadow-xs max-w-xl">
                                      <div className="font-black text-[#1E2D4E]">{g.name} ({g.group_code})</div>
                                      <div className="text-xs font-bold text-emerald-800">
                                        Group Leader: {gLeader ? `${gLeader.name} (${gLeader.app_no})` : '⚠️ Unassigned'}
                                      </div>
                                      <div className="text-[10px] text-gray-500 mt-0.5">
                                        Members Count: {gMems.length} / {g.max_members}
                                      </div>
                                    </div>

                                    {/* Members under Group */}
                                    <div className="pl-6 space-y-1">
                                      {gMems.length > 0 ? (
                                        gMems.map((gm, mIdx) => {
                                          const cand = candidateMap.get(gm.candidate_app_no);
                                          const isLast = mIdx === gMems.length - 1;

                                          return (
                                            <div key={gm.id} className="flex items-center gap-2 text-xs font-sans p-1.5 rounded-lg bg-gray-50 max-w-lg border border-gray-200">
                                              <span className="text-gray-400 font-mono">{isLast ? '└──' : '├──'}</span>
                                              <div className="w-6 h-6 rounded bg-[#1E2D4E] text-white font-black text-[10px] flex items-center justify-center">
                                                {cand ? cand.name.slice(0, 2).toUpperCase() : 'M'}
                                              </div>
                                              <div className="flex-1">
                                                <span className="font-extrabold text-[#1E2D4E]">{cand?.name || gm.candidate_app_no}</span>
                                                <span className="text-[10px] text-gray-500 font-bold ml-2">ID: {cand?.app_no} · {cand?.department || 'Staff'}</span>
                                              </div>
                                              <span className="px-1.5 py-0.2 rounded bg-[#C9952A]/20 text-[#C9952A] text-[9px] font-black">
                                                Joined Store
                                              </span>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="text-[11px] text-gray-400 italic pl-4">No members assigned to this group</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: UNASSIGNED JOINED EMPLOYEES POOL (WITH BULK ASSIGNMENT) */}
          {activeTab === 'unassigned' && (
            <div className="card-glass p-6 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
                <div>
                  <h2 className="text-lg font-black text-[#1E2D4E]">UNASSIGNED JOINED EMPLOYEES</h2>
                  <p className="text-xs text-gray-500 font-medium">Joined Store Directory employees who currently have no Batch/Group assignment ({unassignedMembersCount} Employees)</p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedAppNos.length > 0 && (
                    <button
                      onClick={() => {
                        if (batches.length === 0) return;
                        const firstBatch = batches[0];
                        const firstGroup = groups.find(g => g.batch_id === firstBatch.id);
                        setBulkTargetBatchId(firstBatch.id);
                        setBulkTargetGroupId(firstGroup ? firstGroup.id : null);
                        setBulkAssignModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#C9952A] text-white hover:bg-[#b08020] text-xs font-black shadow-md flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Assign Selected ({selectedAppNos.length})</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1E2D4E] text-white uppercase text-[10.5px] tracking-wider">
                      <th className="p-3 rounded-tl-xl w-10">
                        <input
                          type="checkbox"
                          checked={selectedAppNos.length > 0 && selectedAppNos.length === filteredCandidatesForSelector.filter(c => !assignedAppNoSet.has(c.app_no)).length}
                          onChange={e => {
                            if (e.target.checked) {
                              const unassignedApps = filteredCandidatesForSelector.filter(c => !assignedAppNoSet.has(c.app_no)).map(c => c.app_no);
                              setSelectedAppNos(unassignedApps);
                            } else {
                              setSelectedAppNos([]);
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="p-3">Photo</th>
                      <th className="p-3">Employee Details</th>
                      <th className="p-3">Employee ID / App No</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Designation</th>
                      <th className="p-3">Source Directory</th>
                      <th className="p-3 text-right rounded-tr-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2dfd7]">
                    {candidates.filter(c => !assignedAppNoSet.has(c.app_no)).length > 0 ? (
                      candidates.filter(c => !assignedAppNoSet.has(c.app_no)).map(c => {
                        const isSelected = selectedAppNos.includes(c.app_no);
                        return (
                          <tr key={c.id} className={`hover:bg-[#F9F7F4] transition-colors ${isSelected ? 'bg-amber-50/60' : ''}`}>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedAppNos([...selectedAppNos, c.app_no]);
                                  } else {
                                    setSelectedAppNos(selectedAppNos.filter(x => x !== c.app_no));
                                  }
                                }}
                                className="rounded border-gray-300"
                              />
                            </td>
                            <td className="p-3">
                              <div className="w-9 h-9 rounded-xl bg-[#1E2D4E] text-[#C9952A] font-black flex items-center justify-center text-xs shadow-xs">
                                {c.photo_url ? (
                                  <img src={API.fileUrl(c.photo_url) || ''} alt={c.name} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  c.name.slice(0, 2).toUpperCase()
                                )}
                              </div>
                            </td>
                            <td className="p-3 font-extrabold text-[#1E2D4E]">
                              <div>{c.name}</div>
                              <span className="px-1.5 py-0.2 rounded bg-[#C9952A]/20 text-[#C9952A] text-[9.5px] font-black">
                                Joined Store
                              </span>
                            </td>
                            <td className="p-3 font-bold text-gray-700">{c.app_no}</td>
                            <td className="p-3 font-bold text-gray-600">{c.phone || 'N/A'}</td>
                            <td className="p-3 font-bold text-gray-800">{c.department || 'General'}</td>
                            <td className="p-3 font-bold text-gray-600">{c.designation || 'Staff'}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#C9952A]/10 text-[#C9952A]">
                                Joined Store Directory
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  if (batches.length === 0) {
                                    showToast('Please create a batch first', 'error');
                                    return;
                                  }
                                  const firstBatch = batches[0];
                                  const firstGroup = groups.find(g => g.batch_id === firstBatch.id);
                                  setEmployeeSelectorModal({
                                    open: true,
                                    type: 'add_member',
                                    targetBatchId: firstBatch.id,
                                    targetGroupId: firstGroup ? firstGroup.id : null,
                                    targetGroupName: firstGroup ? firstGroup.name : firstBatch.name,
                                    title: `ASSIGN ${c.name.toUpperCase()} TO BATCH / GROUP`
                                  });
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-black shadow-xs"
                              >
                                [ Assign ]
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="p-6 text-center text-gray-500 font-bold">
                          All personnel in Joined Store Directory are assigned! No unassigned employees.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LEADERSHIP STRUCTURE SUMMARY */}
          {activeTab === 'leadership' && (
            <div className="card-glass p-6 bg-white space-y-6">
              <div className="border-b border-[#e2dfd7] pb-3">
                <h2 className="text-lg font-black text-[#1E2D4E]">LEADERSHIP STRUCTURE OVERVIEW</h2>
                <p className="text-xs text-gray-500 font-medium">Clear summary of Batch Leaders & Group Leaders across all batches</p>
              </div>

              {/* Batch Leaders Overview */}
              <div className="space-y-3">
                <h3 className="font-black text-sm text-[#1E2D4E] uppercase tracking-wider">BATCH LEADERS SUMMARY</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {batches.map(b => {
                    const leader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
                    return (
                      <div key={b.id} className="p-4 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-[#1E2D4E]">{b.name}</span>
                          <span className="text-[10px] font-bold text-gray-500">{b.type}</span>
                        </div>
                        {leader ? (
                          <div className="flex items-center gap-3 pt-2">
                            <div className="w-10 h-10 rounded-xl bg-[#1E2D4E] text-[#C9952A] font-black text-xs flex items-center justify-center">
                              {leader.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-xs text-[#1E2D4E]">{leader.name}</div>
                              <div className="text-[10px] text-gray-500">ID: {leader.app_no} · {leader.designation}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-rose-600 pt-2 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Batch Leader Missing</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group Leaders Overview */}
              <div className="space-y-3 pt-4">
                <h3 className="font-black text-sm text-[#1E2D4E] uppercase tracking-wider">GROUP LEADERS BY BATCH</h3>
                <div className="space-y-4">
                  {batches.map(b => {
                    const bGroups = groups.filter(g => g.batch_id === b.id);
                    const assignedCount = batchGroupLeaderCountMap.get(b.id) || 0;

                    return (
                      <div key={b.id} className="p-4 rounded-xl border border-[#e2dfd7] bg-white space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                          <span className="font-black text-sm text-[#1E2D4E]">{b.name} Group Leadership</span>
                          <span className="text-xs font-extrabold text-emerald-700">
                            {assignedCount} / {bGroups.length} Group Leaders Assigned
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {bGroups.map(g => {
                            const gLeader = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no) : null;
                            return (
                              <div key={g.id} className="p-3 rounded-lg bg-[#F9F7F4] border border-gray-200">
                                <div className="font-black text-xs text-[#1E2D4E]">{g.name}</div>
                                {gLeader ? (
                                  <div className="text-xs font-extrabold text-emerald-800 mt-1 truncate">
                                    ✓ {gLeader.name}
                                  </div>
                                ) : (
                                  <div className="text-xs font-bold text-rose-600 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>Leader Not Assigned</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECENT ACTIVITY LOG */}
          {activeTab === 'activity' && (
            <div className="card-glass p-6 bg-white space-y-4">
              <div className="border-b border-[#e2dfd7] pb-3">
                <h2 className="text-lg font-black text-[#1E2D4E]">RECENT BATCH PLAN ACTIVITY</h2>
                <p className="text-xs text-gray-500 font-medium">Real activity log of leadership assignments, group creations, member moves & updates</p>
              </div>

              <div className="space-y-3">
                {activities.length > 0 ? (
                  activities.map(act => (
                    <div key={act.id} className="p-3.5 rounded-xl border border-gray-200 bg-[#F9F7F4] flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#1E2D4E]/10 text-[#1E2D4E] font-black text-xs flex items-center justify-center">
                          ✓
                        </div>
                        <div>
                          <div className="font-extrabold text-xs text-[#1E2D4E]">{act.description}</div>
                          <div className="text-[10px] text-gray-500 font-medium">By {act.by_user} · Action: {act.action_type}</div>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold whitespace-nowrap">
                        {formatTimeAgo(act.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-gray-500 font-bold">No activity history recorded yet.</div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- CENTERED MODALS SYSTEM --- */}

      {/* 1. MANDATORY SEARCHABLE JOINED STORE EMPLOYEE SELECTOR MODAL */}
      {employeeSelectorModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-[#e2dfd7] space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <h3 className="font-black text-lg text-[#1E2D4E] uppercase tracking-wider">{employeeSelectorModal.title}</h3>
                <p className="text-xs text-[#C9952A] font-extrabold">Source Directory: JOINED STORE DIRECTORY ONLY</p>
              </div>
              <button
                onClick={() => setEmployeeSelectorModal({ open: false, title: '', type: 'add_member' })}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar & Filters Header */}
            <div className="space-y-2.5 bg-[#F9F7F4] p-3 rounded-xl border border-gray-200 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search joined employee by name, ID, phone, department, designation..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-xs font-bold text-[#1E2D4E] focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-0.5">Department</label>
                  <select
                    value={filterDept}
                    onChange={e => setFilterDept(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-gray-300 font-bold bg-white text-xs"
                  >
                    <option value="All">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-0.5">Designation</label>
                  <select
                    value={filterDesig}
                    onChange={e => setFilterDesig(e.target.value)}
                    className="w-full p-1.5 rounded-lg border border-gray-300 font-bold bg-white text-xs"
                  >
                    <option value="All">All Designations</option>
                    {designations.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-500 uppercase block mb-0.5">Assignment Status</label>
                  <select
                    value={filterAssignmentStatus}
                    onChange={e => setFilterAssignmentStatus(e.target.value as any)}
                    className="w-full p-1.5 rounded-lg border border-gray-300 font-bold bg-white text-xs"
                  >
                    <option value="All">All Employees</option>
                    <option value="Unassigned">Unassigned Only</option>
                    <option value="Assigned">Assigned Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Results List */}
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100 border rounded-xl">
              {filteredCandidatesForSelector.length > 0 ? (
                filteredCandidatesForSelector.map(c => {
                  const assignInfo = memberAssignmentMap.get(c.app_no);
                  const isAssigned = !!assignInfo;

                  return (
                    <div key={c.id} className="p-3.5 flex items-center justify-between hover:bg-[#F9F7F4] text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#1E2D4E] text-[#C9952A] font-black flex items-center justify-center text-sm shadow-xs border border-[#C9952A]/30">
                          {c.photo_url ? (
                            <img src={API.fileUrl(c.photo_url) || ''} alt={c.name} className="w-full h-full object-cover rounded-2xl" />
                          ) : (
                            c.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-[#1E2D4E] text-sm">{c.name}</h4>
                            <span className="px-1.5 py-0.2 rounded bg-[#C9952A]/20 text-[#C9952A] text-[9.5px] font-black">
                              Joined Store
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-600 font-bold mt-0.5">
                            ID: {c.app_no} · Phone: {c.phone || 'N/A'}
                          </div>
                          <div className="text-[10.5px] text-gray-500 font-medium">
                            {c.designation || 'Staff'} • {c.department || 'General'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {isAssigned ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            Assigned to {assignInfo.batchName} / {assignInfo.groupName}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Available
                          </span>
                        )}

                        <button
                          onClick={() => handleSelectEmployeeForRole(c)}
                          className="px-4 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-xs hover:bg-[#162340] shadow-xs"
                        >
                          [ Select / Add ]
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500 font-bold">
                  No Joined Store Directory employees found matching query.
                </div>
              )}
            </div>

            <div className="pt-3 border-t shrink-0 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-bold">{filteredCandidatesForSelector.length} Eligible Employees Found</span>
              <button
                onClick={() => setEmployeeSelectorModal({ open: false, title: '', type: 'add_member' })}
                className="px-4 py-1.5 rounded-xl bg-gray-100 text-gray-700 font-extrabold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. DUPLICATE ASSIGNMENT WARNING MODAL */}
      {duplicateWarningModal.open && duplicateWarningModal.candidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-black text-lg text-[#1E2D4E]">Employee Already Assigned</h3>
            </div>

            <p className="text-xs text-gray-700 font-bold">
              <span className="text-[#1E2D4E] font-black">{duplicateWarningModal.candidate.name}</span> is already assigned to{' '}
              <span className="text-[#C9952A] font-black">{duplicateWarningModal.existingBatchName} / {duplicateWarningModal.existingGroupName}</span>.
            </p>

            <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                onClick={() => setDuplicateWarningModal({ open: false, candidate: null, existingBatchName: '', existingGroupName: '' })}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-xs"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  const cand = duplicateWarningModal.candidate;
                  setDuplicateWarningModal({ open: false, candidate: null, existingBatchName: '', existingGroupName: '' });
                  if (cand) setMemberProfileModal({ open: true, candidate: cand });
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white border border-[#1E2D4E] text-[#1E2D4E] font-extrabold text-xs"
              >
                View Assignment
              </button>

              <button
                onClick={() => {
                  const cand = duplicateWarningModal.candidate;
                  const assign = cand ? memberAssignmentMap.get(cand.app_no) : null;
                  setDuplicateWarningModal({ open: false, candidate: null, existingBatchName: '', existingGroupName: '' });
                  if (cand && assign) {
                    setMoveMemberModal({
                      open: true,
                      candidateAppNo: cand.app_no,
                      memberName: cand.name,
                      currentGroupId: assign.groupId,
                      currentGroupName: assign.groupName,
                      currentBatchId: assign.batchId
                    });
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-xs"
              >
                [ Move Employee ]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. BULK ASSIGNMENT MODAL */}
      {bulkAssignModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2dfd7] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-lg text-[#1E2D4E]">Bulk Assign ({selectedAppNos.length} Employees)</h3>
              <button onClick={() => setBulkAssignModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Target Batch *</label>
                <select
                  value={bulkTargetBatchId || ''}
                  onChange={e => {
                    const bId = Number(e.target.value);
                    setBulkTargetBatchId(bId);
                    const firstG = groups.find(g => g.batch_id === bId);
                    setBulkTargetGroupId(firstG ? firstG.id : null);
                  }}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Target Group *</label>
                <select
                  value={bulkTargetGroupId || ''}
                  onChange={e => setBulkTargetGroupId(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                >
                  {groups
                    .filter(g => g.batch_id === bulkTargetBatchId)
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({groupMemberCountMap.get(g.id) || 0}/{g.max_members} Members)</option>
                    ))}
                </select>
              </div>

              <div className="pt-4 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-extrabold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAssignSubmit}
                  className="px-5 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold hover:bg-[#162340]"
                >
                  [ Assign Selected ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CREATE / EDIT BATCH MODAL */}
      {batchModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#e2dfd7]">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-black text-lg text-[#1E2D4E]">
                {editingBatch ? `Edit Batch: ${editingBatch.name}` : '+ Create New Batch'}
              </h3>
              <button onClick={() => setBatchModalOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Batch Name *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingBatch?.name || ''}
                  placeholder="e.g. B-Alpha or B*"
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-[#1E2D4E] block mb-1">Batch Code</label>
                  <input
                    type="text"
                    name="batchCode"
                    defaultValue={editingBatch?.batch_code || ''}
                    placeholder="e.g. B-ALPHA"
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-[#1E2D4E] block mb-1">Batch Type</label>
                  <select
                    name="type"
                    defaultValue={editingBatch?.type || 'Regular'}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                  >
                    <option value="Senior">Senior</option>
                    <option value="Regular">Regular</option>
                    <option value="Special">Special</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingBatch?.description || ''}
                  placeholder="Batch description and guidelines..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-[#1E2D4E] block mb-1">Batch Capacity</label>
                  <input
                    type="number"
                    name="capacity"
                    defaultValue={editingBatch?.capacity || 80}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-[#1E2D4E] block mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editingBatch?.status || 'Active'}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Batch Leader (Joined Store Directory)</label>
                <select
                  name="batchLeaderAppNo"
                  defaultValue={editingBatch?.batch_leader_app_no || ''}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                >
                  <option value="">Unassigned</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.app_no}>
                      {c.name} ({c.app_no} - {c.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-extrabold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold hover:bg-[#162340]"
                >
                  {editingBatch ? 'Save Batch' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. CREATE / EDIT GROUP MODAL */}
      {groupModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#e2dfd7]">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className="font-black text-lg text-[#1E2D4E]">
                {editingGroup ? `Edit Group: ${editingGroup.name}` : '+ Create Group'}
              </h3>
              <button onClick={() => setGroupModalOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4 text-xs">
              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Group Name *</label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editingGroup?.name || ''}
                  placeholder="e.g. Group 01"
                  required
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold focus:outline-none focus:border-[#1E2D4E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-[#1E2D4E] block mb-1">Group Code</label>
                  <input
                    type="text"
                    name="groupCode"
                    defaultValue={editingGroup?.group_code || ''}
                    placeholder="e.g. GRP-01"
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-[#1E2D4E] block mb-1">Maximum Members</label>
                  <input
                    type="number"
                    name="maxMembers"
                    defaultValue={editingGroup?.max_members || 9}
                    className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Group Leader (Joined Store Directory)</label>
                <select
                  name="groupLeaderAppNo"
                  defaultValue={editingGroup?.group_leader_app_no || ''}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                >
                  <option value="">Unassigned</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.app_no}>
                      {c.name} ({c.app_no} - {c.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-[#1E2D4E] block mb-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={editingGroup?.description || ''}
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-medium"
                />
              </div>

              <div className="pt-4 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-extrabold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold hover:bg-[#162340]"
                >
                  {editingGroup ? 'Save Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MOVE MEMBER MODAL */}
      {moveMemberModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2dfd7] space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-lg text-[#1E2D4E]">MOVE EMPLOYEE</h3>
              <button
                onClick={() => setMoveMemberModal({ open: false, candidateAppNo: '', memberName: '', currentGroupId: 0, currentGroupName: '', currentBatchId: 0 })}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="font-extrabold text-[#1E2D4E]">
                Move <span className="text-[#C9952A]">{moveMemberModal.memberName}</span> from{' '}
                <span className="underline">{moveMemberModal.currentGroupName}</span> to destination:
              </p>

              <div>
                <label className="font-extrabold text-gray-700 block mb-1">Select Destination Batch & Group *</label>
                <select
                  id="targetGroupSelect"
                  className="w-full p-2.5 rounded-xl border border-gray-300 font-bold"
                >
                  {groups
                    .filter(g => g.id !== moveMemberModal.currentGroupId)
                    .map(g => {
                      const parentB = batches.find(b => b.id === g.batch_id)?.name || '';
                      return (
                        <option key={g.id} value={`${g.batch_id}||${g.id}`}>
                          {parentB} → {g.name} ({groupMemberCountMap.get(g.id) || 0}/{g.max_members} Members)
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="pt-4 border-t flex items-center justify-end gap-2">
                <button
                  onClick={() => setMoveMemberModal({ open: false, candidateAppNo: '', memberName: '', currentGroupId: 0, currentGroupName: '', currentBatchId: 0 })}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-extrabold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const sel = (document.getElementById('targetGroupSelect') as HTMLSelectElement).value;
                    const [bId, gId] = sel.split('||').map(Number);
                    handleMoveMemberSubmit(bId, gId);
                  }}
                  className="px-5 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold hover:bg-[#162340]"
                >
                  [ Move Employee ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MEMBER PROFILE MODAL */}
      {memberProfileModal.open && memberProfileModal.candidate && (() => {
        const c = memberProfileModal.candidate;
        const gm = groupMembers.find(m => m.candidate_app_no === c.app_no);
        const assignedBatch = gm ? batches.find(b => b.id === gm.batch_id) : null;
        const assignedGroup = gm ? groups.find(g => g.id === gm.group_id) : null;
        const batchLeader = assignedBatch?.batch_leader_app_no ? candidateMap.get(assignedBatch.batch_leader_app_no) : null;
        const groupLeader = assignedGroup?.group_leader_app_no ? candidateMap.get(assignedGroup.group_leader_app_no) : null;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#e2dfd7] space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-black text-lg text-[#1E2D4E]">Employee Assignment Profile</h3>
                <button onClick={() => setMemberProfileModal({ open: false, candidate: null })} className="p-1 text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#1E2D4E] text-white font-black text-xl flex items-center justify-center border-2 border-[#C9952A]">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-black text-[#1E2D4E] text-base">{c.name}</h4>
                    <div className="text-xs font-bold text-gray-600">ID: {c.app_no}</div>
                    <div className="text-xs text-[#C9952A] font-extrabold mt-0.5">{c.designation} ({c.department})</div>
                    <div className="text-[10px] text-emerald-700 font-extrabold">Source: Joined Store Directory</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-2.5 rounded-xl bg-gray-50 border">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Phone</span>
                    <span className="font-extrabold text-[#1E2D4E]">{c.phone || 'N/A'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 border">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Email</span>
                    <span className="font-extrabold text-[#1E2D4E]">{c.email || 'N/A'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 border">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Assigned Batch</span>
                    <span className="font-extrabold text-indigo-900">{assignedBatch ? assignedBatch.name : 'Unassigned'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 border">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Assigned Group</span>
                    <span className="font-extrabold text-emerald-900">{assignedGroup ? assignedGroup.name : 'Unassigned'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 border">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Batch Leader</span>
                    <span className="font-extrabold text-[#1E2D4E]">{batchLeader ? batchLeader.name : 'N/A'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-gray-50 border">
                    <span className="text-[10px] font-black text-gray-400 uppercase block">Group Leader</span>
                    <span className="font-extrabold text-[#1E2D4E]">{groupLeader ? groupLeader.name : 'N/A'}</span>
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-end gap-2">
                  {assignedGroup && (
                    <button
                      onClick={() => {
                        setMemberProfileModal({ open: false, candidate: null });
                        setMoveMemberModal({
                          open: true,
                          candidateAppNo: c.app_no,
                          memberName: c.name,
                          currentGroupId: assignedGroup.id,
                          currentGroupName: assignedGroup.name,
                          currentBatchId: assignedBatch ? assignedBatch.id : 0
                        });
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold"
                    >
                      [ Move Employee ]
                    </button>
                  )}
                  <button
                    onClick={() => setMemberProfileModal({ open: false, candidate: null })}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-extrabold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 8. CONFIRMATION DIALOG MODAL */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-[#e2dfd7] space-y-4">
            <h3 className="font-black text-lg text-[#1E2D4E]">{confirmModal.title}</h3>
            <p className="text-xs text-gray-600 font-medium">{confirmModal.message}</p>

            <div className="pt-4 border-t flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} })}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-extrabold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} });
                }}
                className="px-4 py-2 rounded-xl bg-[#1E2D4E] text-white font-extrabold text-xs hover:bg-[#162340]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
