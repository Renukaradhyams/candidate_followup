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

import { Candidate, BatchPlan, BatchGroup, GroupMember, ActivityLog, MemberAssignmentInfo } from '../components/batch-plan/types';
import GroupModal from '../components/batch-plan/GroupModal';
import AddMemberModal from '../components/batch-plan/AddMemberModal';
import SelectLeaderModal from '../components/batch-plan/SelectLeaderModal';
import EditBatchModal from '../components/batch-plan/EditBatchModal';
import EditGroupModal from '../components/batch-plan/EditGroupModal';
import MemberProfileModal from '../components/batch-plan/MemberProfileModal';
import MoveMemberModal from '../components/batch-plan/MoveMemberModal';
import BatchCard from '../components/batch-plan/BatchCard';
import GroupCard from '../components/batch-plan/GroupCard';
import UnassignedEmployeesSection from '../components/batch-plan/UnassignedEmployeesSection';

export default function BatchPlanPage() {
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

  // View state & Navigation Tabs
  const [viewMode, setViewMode] = useState<'cards' | 'hierarchy'>('cards');
  const [activeTab, setActiveTab] = useState<'batches' | 'unassigned' | 'leadership' | 'activity'>('batches');
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBatch, setFilterBatch] = useState('All');
  const [filterDept, setFilterDept] = useState('All');
  const [filterDesig, setFilterDesig] = useState('All');
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<'All' | 'Assigned' | 'Unassigned'>('All');

  // MODAL STATES
  // 1. Group Modal (centered modal for Open Group)
  const [groupModalState, setGroupModalState] = useState<{
    open: boolean;
    group: BatchGroup | null;
  }>({ open: false, group: null });

  // 2. Add Member Modal
  const [addMemberModalState, setAddMemberModalState] = useState<{
    open: boolean;
    targetBatchId: number | null;
    targetGroupId: number | null;
    targetGroupName: string;
  }>({ open: false, targetBatchId: null, targetGroupId: null, targetGroupName: '' });

  // 3. Searchable Leader Selector Modal
  const [selectLeaderModalState, setSelectLeaderModalState] = useState<{
    open: boolean;
    title: string;
    roleType: 'batch_leader' | 'group_leader';
    targetEntityName: string;
    targetBatchId?: number | null;
    targetGroupId?: number | null;
  }>({ open: false, title: '', roleType: 'group_leader', targetEntityName: '' });

  // 4. Batch Edit Modal
  const [editBatchModalState, setEditBatchModalState] = useState<{
    open: boolean;
    batch: BatchPlan | null;
  }>({ open: false, batch: null });

  // 5. Group Edit Modal
  const [editGroupModalState, setEditGroupModalState] = useState<{
    open: boolean;
    group: BatchGroup | null;
    selectedBatchId: number | null;
  }>({ open: false, group: null, selectedBatchId: null });

  // 6. Member Profile Modal
  const [memberProfileModalState, setMemberProfileModalState] = useState<{
    open: boolean;
    candidate: Candidate | null;
  }>({ open: false, candidate: null });

  // 7. Move Member Modal
  const [moveMemberModalState, setMoveMemberModalState] = useState<{
    open: boolean;
    candidateAppNo: string;
    memberName: string;
    currentGroupId: number;
    currentGroupName: string;
    currentBatchId: number;
  }>({ open: false, candidateAppNo: '', memberName: '', currentGroupId: 0, currentGroupName: '', currentBatchId: 0 });

  // 8. Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', onConfirm: () => {} });

  // Load Data from backend API
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.getBatchPlanData();
      if (res && res.success !== false) {
        setBatches(res.batches || []);
        setGroups(res.groups || []);
        setGroupMembers(res.groupMembers || []);
        const joinedStoreCandidates = (res.candidates || []).filter((c: any) => {
          const s = (c.status || '').toLowerCase().trim();
          const os = (c.offer_status || '').toLowerCase().trim();
          return s.includes('store') || os.includes('store') || s === 'successfully joined store' || s === 'joined store' || c.isJoinedStore;
        });
        setCandidates(joinedStoreCandidates);
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

  // Lookup maps
  const candidateMap = useMemo(() => {
    const map = new Map<string, Candidate>();
    candidates.forEach(c => map.set(c.app_no, c));
    return map;
  }, [candidates]);

  const memberAssignmentMap = useMemo(() => {
    const map = new Map<string, MemberAssignmentInfo>();
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

  const assignedAppNoSet = useMemo(() => {
    return new Set(groupMembers.map(m => m.candidate_app_no));
  }, [groupMembers]);

  const groupMemberCountMap = useMemo(() => {
    const map = new Map<number, number>();
    groupMembers.forEach(m => {
      map.set(m.group_id, (map.get(m.group_id) || 0) + 1);
    });
    return map;
  }, [groupMembers]);

  const batchMemberCountMap = useMemo(() => {
    const map = new Map<number, number>();
    groupMembers.forEach(m => {
      map.set(m.batch_id, (map.get(m.batch_id) || 0) + 1);
    });
    return map;
  }, [groupMembers]);

  const batchGroupLeaderCountMap = useMemo(() => {
    const map = new Map<number, number>();
    groups.forEach(g => {
      if (g.group_leader_app_no) {
        map.set(g.batch_id, (map.get(g.batch_id) || 0) + 1);
      }
    });
    return map;
  }, [groups]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => { if (c.department) set.add(c.department); });
    return Array.from(set).sort();
  }, [candidates]);

  const designations = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach(c => { if (c.designation) set.add(c.designation); });
    return Array.from(set).sort();
  }, [candidates]);

  // Dashboard KPIs
  const totalBatches = useMemo(() => batches.filter(b => b.status === 'Active').length, [batches]);
  const totalJoinedEmployees = useMemo(() => candidates.length, [candidates]);
  const totalAssignedEmployees = useMemo(() => assignedAppNoSet.size, [assignedAppNoSet]);
  const unassignedMembersCount = useMemo(() => candidates.filter(c => !assignedAppNoSet.has(c.app_no)).length, [candidates, assignedAppNoSet]);
  const totalBatchLeaders = useMemo(() => batches.filter(b => b.batch_leader_app_no).length, [batches]);
  const totalGroups = useMemo(() => groups.filter(g => g.status === 'Active').length, [groups]);
  const totalGroupLeaders = useMemo(() => groups.filter(g => g.group_leader_app_no).length, [groups]);

  // Unassigned Joined Candidates list
  const unassignedCandidatesList = useMemo(() => {
    return candidates.filter(c => !assignedAppNoSet.has(c.app_no));
  }, [candidates, assignedAppNoSet]);

  // Health helpers
  const getBatchHealth = (b: BatchPlan) => {
    const bGroups = groups.filter(g => g.batch_id === b.id);
    if (bGroups.length === 0) {
      return b.batch_leader_app_no ? { status: 'READY', color: 'emerald', text: 'Ready' } : { status: 'PARTIALLY ASSIGNED', color: 'amber', text: 'Leader Pending' };
    }
    const missingLeaders = bGroups.filter(g => !g.group_leader_app_no).length;
    if (!b.batch_leader_app_no || missingLeaders > 0) {
      return { status: 'INCOMPLETE', color: 'rose', text: `${missingLeaders} Leader${missingLeaders > 1 ? 's' : ''} Missing` };
    }
    return { status: 'READY', color: 'emerald', text: 'Ready & Complete' };
  };

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  // --- ACTIONS & API HANDLERS ---
  const handleSaveBatch = async (payload: any) => {
    try {
      if (payload.id) {
        await API.updateBatch(payload.id, payload);
        showToast(`Batch "${payload.name}" updated successfully`, 'success');
      } else {
        await API.createBatch(payload);
        showToast(`New Batch "${payload.name}" created successfully`, 'success');
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save batch', 'error');
    }
  };

  const handleDeleteBatch = async (batchId: number, batchName: string) => {
    setConfirmModal({
      open: true,
      title: 'Deactivate Batch?',
      message: `Are you sure you want to deactivate Batch "${batchName}"? Group member assignments will be preserved safely.`,
      onConfirm: async () => {
        try {
          const res = await API.deleteBatch(batchId);
          if (res && res.success !== false) {
            showToast(res.message || `Batch "${batchName}" deactivated`, 'success');
            loadData();
          }
        } catch (err: any) {
          showToast(err.message || 'Failed to deactivate batch', 'error');
        }
      }
    });
  };

  const handleSaveGroup = async (payload: any) => {
    try {
      if (payload.id) {
        await API.updateGroup(payload.id, payload);
        showToast(`Group "${payload.name}" updated successfully`, 'success');
      } else {
        await API.createGroup(payload);
        showToast(`New Group "${payload.name}" created successfully`, 'success');
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save group', 'error');
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    setConfirmModal({
      open: true,
      title: 'Delete Group?',
      message: `Are you sure you want to delete Group "${groupName}"? Assigned members will become UNASSIGNED.`,
      onConfirm: async () => {
        try {
          const res = await API.deleteGroup(groupId);
          if (res && res.success !== false) {
            showToast(`Group "${groupName}" deleted. Members set to UNASSIGNED`, 'success');
            loadData();
          }
        } catch (err: any) {
          showToast(err.message || 'Failed to delete group', 'error');
        }
      }
    });
  };

  const handleAssignLeaderFromModal = async (cand: Candidate) => {
    const { roleType, targetBatchId, targetGroupId, targetEntityName } = selectLeaderModalState;
    try {
      if (roleType === 'batch_leader' && targetBatchId) {
        await API.assignBatchLeader({
          batchId: targetBatchId,
          batchLeaderAppNo: cand.app_no,
          leaderName: cand.name
        });
        showToast(`${cand.name} assigned as Batch Leader for ${targetEntityName}`, 'success');
      } else if (roleType === 'group_leader' && targetGroupId) {
        await API.assignGroupLeader({
          groupId: targetGroupId,
          groupLeaderAppNo: cand.app_no,
          leaderName: cand.name
        });
        showToast(`${cand.name} assigned as Group Leader for ${targetEntityName}`, 'success');
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign leader', 'error');
    }
  };

  const handleRemoveLeader = async (roleType: 'batch_leader' | 'group_leader', id: number, name: string) => {
    setConfirmModal({
      open: true,
      title: `Remove ${roleType === 'batch_leader' ? 'Batch' : 'Group'} Leader?`,
      message: `Are you sure you want to remove the leader for "${name}"? This will not delete the employee record.`,
      onConfirm: async () => {
        try {
          if (roleType === 'batch_leader') {
            await API.assignBatchLeader({ batchId: id, batchLeaderAppNo: null, leaderName: 'Unassigned' });
            showToast(`Batch Leader removed from ${name}`, 'success');
          } else {
            await API.assignGroupLeader({ groupId: id, groupLeaderAppNo: null, leaderName: 'Unassigned' });
            showToast(`Group Leader removed from ${name}`, 'success');
          }
          loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to remove leader', 'error');
        }
      }
    });
  };

  const handleSingleAddMember = async (cand: Candidate) => {
    const { targetBatchId, targetGroupId, targetGroupName } = addMemberModalState;
    if (!targetBatchId || !targetGroupId) return;

    try {
      await API.addMemberToGroup({
        candidateAppNo: cand.app_no,
        batchId: targetBatchId,
        groupId: targetGroupId,
        memberName: cand.name,
        groupName: targetGroupName || 'Group'
      });

      // Immediate local state update for instant UI feedback
      setGroupMembers(prev => [
        ...prev.filter(m => m.candidate_app_no !== cand.app_no),
        {
          id: Date.now(),
          candidate_app_no: cand.app_no,
          batch_id: targetBatchId,
          group_id: targetGroupId
        }
      ]);

      showToast(`${cand.name} added to ${targetGroupName}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to add member', 'error');
    }
  };

  const handleBulkAddMembers = async (candidateAppNos: string[]) => {
    const { targetBatchId, targetGroupId, targetGroupName } = addMemberModalState;
    if (!targetBatchId || !targetGroupId || candidateAppNos.length === 0) return;

    try {
      await API.bulkAddMembers({
        candidateAppNos,
        batchId: targetBatchId,
        groupId: targetGroupId,
        groupName: targetGroupName
      });

      // Immediate local state update
      const newEntries = candidateAppNos.map((appNo, idx) => ({
        id: Date.now() + idx,
        candidate_app_no: appNo,
        batch_id: targetBatchId,
        group_id: targetGroupId
      }));

      const appNoSet = new Set(candidateAppNos);
      setGroupMembers(prev => [
        ...prev.filter(m => !appNoSet.has(m.candidate_app_no)),
        ...newEntries
      ]);

      showToast(`Assigned ${candidateAppNos.length} members to ${targetGroupName} successfully`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Bulk member addition failed', 'error');
    }
  };

  const handleMoveMemberSubmit = async (targetBatchId: number, targetGroupId: number) => {
    const { candidateAppNo, memberName, currentGroupName } = moveMemberModalState;
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

      // Immediate state update
      setGroupMembers(prev => prev.map(m => {
        if (m.candidate_app_no === candidateAppNo) {
          return { ...m, batch_id: targetBatchId, group_id: targetGroupId };
        }
        return m;
      }));

      showToast(`${memberName} moved from ${currentGroupName} to ${targetGroupName}`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to move member', 'error');
    }
  };

  const handleRemoveMemberSubmit = async (candidateAppNo: string, memberName: string, groupName: string) => {
    setConfirmModal({
      open: true,
      title: 'Remove Member?',
      message: `Are you sure you want to remove ${memberName} from ${groupName}? The employee will become UNASSIGNED in the Joined Store Directory.`,
      onConfirm: async () => {
        try {
          await API.removeMemberFromGroup({
            candidateAppNo,
            memberName,
            groupName
          });

          // Immediate state update
          setGroupMembers(prev => prev.filter(m => m.candidate_app_no !== candidateAppNo));

          showToast(`${memberName} removed from ${groupName} (now UNASSIGNED)`, 'success');
          loadData();
        } catch (err: any) {
          showToast(err.message || 'Failed to remove member', 'error');
        }
      }
    });
  };

  const handleQuickAssignFromUnassigned = async (candidateAppNo: string, memberName: string, batchId: number, groupId: number, groupName: string) => {
    try {
      await API.addMemberToGroup({
        candidateAppNo,
        batchId,
        groupId,
        memberName,
        groupName
      });

      setGroupMembers(prev => [
        ...prev.filter(m => m.candidate_app_no !== candidateAppNo),
        { id: Date.now(), candidate_app_no: candidateAppNo, batch_id: batchId, group_id: groupId }
      ]);

      showToast(`${memberName} assigned to ${groupName} successfully`, 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Assignment failed', 'error');
    }
  };

  // EXPORT WORKBOOK (7 Sheets)
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

      // Sheet 2: Group Structure
      xml += `\n <Worksheet ss:Name="Group Structure"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">Group Code</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Batch</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group Leader</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Members Count</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Max Capacity</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell></Row>`;
      groups.forEach(g => {
        const parentBatch = batches.find(b => b.id === g.batch_id)?.name || 'Unknown';
        const leaderCand = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no)?.name : 'Unassigned';
        const mCount = groupMemberCountMap.get(g.id) || 0;
        xml += `\n  <Row><Cell><Data ss:Type="String">${g.group_code}</Data></Cell><Cell><Data ss:Type="String">${g.name}</Data></Cell><Cell><Data ss:Type="String">${parentBatch}</Data></Cell><Cell><Data ss:Type="String">${leaderCand}</Data></Cell><Cell><Data ss:Type="Number">${mCount}</Data></Cell><Cell><Data ss:Type="Number">${g.max_members}</Data></Cell><Cell><Data ss:Type="String">${g.status}</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 3: Members
      xml += `\n <Worksheet ss:Name="Members"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">App No / Emp ID</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Member Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Phone</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Designation</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Batch</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Group</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Joined Store Status</Data></Cell></Row>`;
      groupMembers.forEach(gm => {
        const cand = candidateMap.get(gm.candidate_app_no);
        const parentBatch = batches.find(b => b.id === gm.batch_id)?.name || 'Unknown';
        const parentGroup = groups.find(g => g.id === gm.group_id)?.name || 'Batch Direct';
        xml += `\n  <Row><Cell><Data ss:Type="String">${gm.candidate_app_no}</Data></Cell><Cell><Data ss:Type="String">${cand?.name || '-'}</Data></Cell><Cell><Data ss:Type="String">${cand?.phone || '-'}</Data></Cell><Cell><Data ss:Type="String">${cand?.department || '-'}</Data></Cell><Cell><Data ss:Type="String">${cand?.designation || '-'}</Data></Cell><Cell><Data ss:Type="String">${parentBatch}</Data></Cell><Cell><Data ss:Type="String">${parentGroup}</Data></Cell><Cell><Data ss:Type="String">Joined Store</Data></Cell></Row>`;
      });
      xml += `\n </Table></Worksheet>`;

      // Sheet 4: Unassigned Members
      xml += `\n <Worksheet ss:Name="Unassigned Members"><Table>`;
      xml += `\n  <Row><Cell ss:StyleID="Header"><Data ss:Type="String">App No / Emp ID</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Name</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Phone</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Department</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Designation</Data></Cell><Cell ss:StyleID="Header"><Data ss:Type="String">Status</Data></Cell></Row>`;
      unassignedCandidatesList.forEach(c => {
        xml += `\n  <Row><Cell><Data ss:Type="String">${c.app_no}</Data></Cell><Cell><Data ss:Type="String">${c.name}</Data></Cell><Cell><Data ss:Type="String">${c.phone || '-'}</Data></Cell><Cell><Data ss:Type="String">${c.department || '-'}</Data></Cell><Cell><Data ss:Type="String">${c.designation || '-'}</Data></Cell><Cell><Data ss:Type="String">Joined Store (Unassigned)</Data></Cell></Row>`;
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
      showToast('Excel workbook exported successfully!', 'success');
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
          {/* HEADER BANNER */}
          <div className="card-glass p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-l-4 border-l-[#C9952A] shadow-md print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#1E2D4E] text-[#C9952A]">
                  <FolderTree className="w-5 h-5" />
                </span>
                <div>
                  <h1 className="text-xl font-black text-[#1E2D4E] tracking-tight">BSC BATCH PLAN</h1>
                  <p className="text-xs font-extrabold text-[#C9952A] tracking-wider uppercase">
                    Member, Leader & Group Management
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#555555] font-semibold mt-2 max-w-3xl">
                Modal-based management system for batches, groups, and leadership. Member source: <strong className="text-[#1E2D4E]">JOINED STORE DIRECTORY ONLY</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setEditBatchModalState({ open: true, batch: null })}
                className="px-4 py-2 rounded-xl bg-[#1E2D4E] hover:bg-[#162340] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 text-[#C9952A]" />
                <span>+ Create Batch</span>
              </button>

              <button
                onClick={() => setEditGroupModalState({ open: true, group: null, selectedBatchId: selectedBatchId || batches[0]?.id || null })}
                className="px-4 py-2 rounded-xl bg-[#C9952A] hover:bg-[#b08020] text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Group</span>
              </button>

              <button
                onClick={exportExcel}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-[#F9F7F4] flex items-center gap-1.5 shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Export Excel</span>
              </button>

              <button
                onClick={exportPDF}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-[#F9F7F4] flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4 text-slate-700" />
                <span>Print PDF</span>
              </button>
            </div>
          </div>

          {/* KPIS SUMMARY BAR */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 print:hidden">
            <div className="card-glass p-3.5 border-l-4 border-l-[#C9952A] bg-white">
              <div className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">JOINED EMPLOYEES</div>
              <div className="text-xl font-black text-[#C9952A] mt-1">{totalJoinedEmployees}</div>
              <div className="text-[9.5px] text-[#C9952A] font-extrabold mt-0.5">Joined Store Directory</div>
            </div>

            <div className="card-glass p-3.5 border-l-4 border-l-emerald-600 bg-white">
              <div className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">ASSIGNED EMPLOYEES</div>
              <div className="text-xl font-black text-emerald-800 mt-1">{totalAssignedEmployees}</div>
              <div className="text-[9.5px] text-emerald-700 font-extrabold mt-0.5">Assigned to Groups</div>
            </div>

            <div
              onClick={() => setActiveTab('unassigned')}
              className="card-glass p-3.5 border-l-4 border-l-rose-500 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">UNASSIGNED EMPLOYEES</div>
              <div className="text-xl font-black text-rose-600 mt-1">{unassignedMembersCount}</div>
              <div className="text-[9.5px] text-rose-700 font-extrabold mt-0.5">Click to view & assign</div>
            </div>

            <div
              onClick={() => setActiveTab('leadership')}
              className="card-glass p-3.5 border-l-4 border-l-indigo-600 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">BATCH LEADERS</div>
              <div className="text-xl font-black text-indigo-900 mt-1">{totalBatchLeaders}</div>
              <div className="text-[9.5px] text-indigo-700 font-extrabold mt-0.5">{totalBatches - totalBatchLeaders} Pending</div>
            </div>

            <div
              onClick={() => setActiveTab('batches')}
              className="card-glass p-3.5 border-l-4 border-l-purple-600 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">GROUPS</div>
              <div className="text-xl font-black text-purple-900 mt-1">{totalGroups}</div>
              <div className="text-[9.5px] text-purple-700 font-extrabold mt-0.5">Configured Groups</div>
            </div>

            <div
              onClick={() => setActiveTab('leadership')}
              className="card-glass p-3.5 border-l-4 border-l-emerald-600 bg-white cursor-pointer hover:shadow-md transition-all"
            >
              <div className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">GROUP LEADERS</div>
              <div className="text-xl font-black text-emerald-900 mt-1">{totalGroupLeaders}</div>
              <div className="text-[9.5px] text-emerald-700 font-extrabold mt-0.5">{totalGroups - totalGroupLeaders} Pending</div>
            </div>
          </div>

          {/* VIEW SWITCHER & NAVIGATION TABS */}
          <div className="card-glass p-4 space-y-3 print:hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#e2dfd7] pb-3">
              {/* View Toggle */}
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'batches' ? 'bg-[#C9952A] text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  Batches & Groups
                </button>

                <button
                  onClick={() => setActiveTab('unassigned')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    activeTab === 'unassigned' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  <span>Unassigned Joined Pool</span>
                  <span className="px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black">
                    {unassignedMembersCount}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('leadership')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'leadership' ? 'bg-indigo-700 text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  Leadership Structure
                </button>

                <button
                  onClick={() => setActiveTab('activity')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'activity' ? 'bg-[#1E2D4E] text-white shadow-xs' : 'bg-white text-[#1E2D4E] hover:bg-[#F9F7F4]'
                  }`}
                >
                  Recent Activity
                </button>
              </div>
            </div>

            {/* Global Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Global Search</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Batch Filter</label>
                <select
                  value={filterBatch}
                  onChange={e => {
                    setFilterBatch(e.target.value);
                    if (e.target.value !== 'All') {
                      const found = batches.find(b => b.name === e.target.value);
                      if (found) setSelectedBatchId(found.id);
                    } else {
                      setSelectedBatchId(null);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-[#e2dfd7] bg-[#F9F7F4] text-xs font-bold text-[#1E2D4E]"
                >
                  <option value="All">All Batches</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.name}>{b.name} ({b.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Department</label>
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
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Designation</label>
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
            </div>
          </div>

          {/* TAB 1: BATCHES & GROUPS */}
          {activeTab === 'batches' && (
            <>
              {viewMode === 'cards' ? (
                /* CARDS VIEW MODE */
                <div className="space-y-6">
                  {selectedBatchId ? (
                    /* DEDICATED BATCH VIEW WITH GROUP CARDS */
                    (() => {
                      const b = batches.find(x => x.id === selectedBatchId);
                      if (!b) return null;
                      const bLeader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
                      const bGroups = groups.filter(g => g.batch_id === b.id);
                      const bMemberCount = batchMemberCountMap.get(b.id) || 0;
                      const health = getBatchHealth(b);

                      return (
                        <div className="space-y-6">
                          {/* Batch Header Banner */}
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
                                <p className="text-xs text-slate-600 font-medium mt-1">{b.description || 'BSC Management Batch Structure'}</p>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setEditBatchModalState({ open: true, batch: b })}
                                  className="px-3.5 py-2 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-[#F9F7F4] flex items-center gap-1.5 shadow-xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Edit Batch</span>
                                </button>

                                <button
                                  onClick={() => setEditGroupModalState({ open: true, group: null, selectedBatchId: b.id })}
                                  className="px-4 py-2 rounded-xl bg-[#C9952A] text-white hover:bg-[#b08020] text-xs font-black flex items-center gap-1.5 shadow-sm"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>+ Create Group</span>
                                </button>
                              </div>
                            </div>

                            {/* Batch KPI Row */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-2">
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase block">Batch Leader</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{bLeader ? bLeader.name : 'Unassigned'}</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase block">Members</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{bMemberCount} / {b.capacity}</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase block">Groups</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{bGroups.length} Configured</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase block">Group Leaders</span>
                                <span className="font-extrabold text-[#1E2D4E] text-xs">{batchGroupLeaderCountMap.get(b.id) || 0} / {bGroups.length}</span>
                              </div>
                              <div className="bg-[#F9F7F4] p-3 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 uppercase block">Status</span>
                                <span className="font-extrabold text-emerald-700 text-xs">{b.status}</span>
                              </div>
                            </div>
                          </div>

                          {/* BATCH LEADER CARD */}
                          <div className="card-glass p-5 border-l-4 border-l-[#C9952A] bg-white">
                            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3 mb-4">
                              <h3 className="font-black text-[#1E2D4E] text-sm uppercase tracking-wider flex items-center gap-2">
                                <Award className="w-4 h-4 text-[#C9952A]" />
                                <span>BATCH LEADER</span>
                              </h3>
                              <button
                                onClick={() => setSelectLeaderModalState({
                                  open: true,
                                  title: `SELECT BATCH LEADER FOR ${b.name}`,
                                  roleType: 'batch_leader',
                                  targetEntityName: b.name,
                                  targetBatchId: b.id
                                })}
                                className="px-3.5 py-1.5 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold"
                              >
                                {bLeader ? 'Change Leader' : '+ Assign Batch Leader'}
                              </button>
                            </div>

                            {bLeader ? (
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#F9F7F4] border border-[#e2dfd7]">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl bg-[#1E2D4E] text-white font-black flex items-center justify-center text-lg shadow-md border-2 border-[#C9952A] overflow-hidden flex-shrink-0">
                                    {bLeader.photo_url ? (
                                      <img src={API.fileUrl(bLeader.photo_url) || ''} alt={bLeader.name} className="w-full h-full object-cover" />
                                    ) : (
                                      bLeader.name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-black text-[#1E2D4E] text-base">{bLeader.name}</h4>
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                        Batch Leader
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-600 font-bold mt-0.5">
                                      ID: {bLeader.app_no} • {bLeader.designation} ({bLeader.department})
                                    </div>
                                    {bLeader.phone && (
                                      <div className="text-xs text-slate-500 font-semibold flex items-center gap-2 mt-1">
                                        <Phone className="w-3 h-3 text-slate-400" />
                                        <span>{bLeader.phone}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setMemberProfileModalState({ open: true, candidate: bLeader })}
                                    className="px-3.5 py-1.5 rounded-xl bg-white border border-[#e2dfd7] text-xs font-extrabold text-[#1E2D4E] hover:bg-slate-50"
                                  >
                                    View Profile
                                  </button>
                                  <button
                                    onClick={() => handleRemoveLeader('batch_leader', b.id, b.name)}
                                    className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                                  >
                                    Remove Leader
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-6 rounded-2xl border-2 border-dashed border-[#e2dfd7] text-center bg-[#F9F7F4]">
                                <UserX className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-600">No Batch Leader assigned for {b.name}</p>
                                <button
                                  onClick={() => setSelectLeaderModalState({
                                    open: true,
                                    title: `SELECT BATCH LEADER FOR ${b.name}`,
                                    roleType: 'batch_leader',
                                    targetEntityName: b.name,
                                    targetBatchId: b.id
                                  })}
                                  className="mt-3 px-4 py-2 rounded-xl bg-[#C9952A] text-white text-xs font-black hover:bg-[#b08020]"
                                >
                                  + Assign Batch Leader
                                </button>
                              </div>
                            )}
                          </div>

                          {/* GROUP CARDS GRID UNDER BATCH */}
                          <div className="card-glass p-5 border-l-4 border-l-indigo-600 bg-white">
                            <div className="flex items-center justify-between border-b border-[#e2dfd7] pb-3 mb-4">
                              <div>
                                <h3 className="font-black text-[#1E2D4E] text-base tracking-tight">GROUPS IN {b.name}</h3>
                                <p className="text-xs text-slate-500 font-medium">{bGroups.length} Groups Configured</p>
                              </div>
                              <button
                                onClick={() => setEditGroupModalState({ open: true, group: null, selectedBatchId: b.id })}
                                className="px-4 py-2 rounded-xl bg-[#1E2D4E] text-white hover:bg-[#162340] text-xs font-extrabold flex items-center gap-1.5"
                              >
                                <Plus className="w-4 h-4 text-[#C9952A]" />
                                <span>+ Create Group</span>
                              </button>
                            </div>

                            {bGroups.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {bGroups.map(g => (
                                  <GroupCard
                                    key={g.id}
                                    group={g}
                                    leaderCandidate={g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no) || null : null}
                                    memberCount={groupMemberCountMap.get(g.id) || 0}
                                    onOpenGroupModal={grp => setGroupModalState({ open: true, group: grp })}
                                    onAddMemberDirect={(bId, gId, gName) => setAddMemberModalState({ open: true, targetBatchId: bId, targetGroupId: gId, targetGroupName: gName })}
                                    onEditGroup={grp => setEditGroupModalState({ open: true, group: grp, selectedBatchId: b.id })}
                                    onAssignGroupLeader={(gId, gName) => setSelectLeaderModalState({ open: true, title: `SELECT GROUP LEADER FOR ${gName}`, roleType: 'group_leader', targetEntityName: gName, targetGroupId: gId })}
                                    onDeleteGroup={(gId, gName) => handleDeleteGroup(gId, gName)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="p-8 text-center border-2 border-dashed border-[#e2dfd7] rounded-2xl bg-[#F9F7F4]">
                                <Layers className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                                <h4 className="font-extrabold text-sm text-[#1E2D4E]">No Groups created in {b.name}</h4>
                                <p className="text-xs text-slate-500 mt-1">Create groups to organize members under group leadership</p>
                                <button
                                  onClick={() => setEditGroupModalState({ open: true, group: null, selectedBatchId: b.id })}
                                  className="mt-3 px-4 py-2 rounded-xl bg-[#1E2D4E] text-white text-xs font-extrabold hover:bg-[#162340]"
                                >
                                  + Create Group 01
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* ALL BATCH CARDS GRID */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {batches.map(b => (
                        <BatchCard
                          key={b.id}
                          batch={b}
                          leaderCandidate={b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) || null : null}
                          groups={groups.filter(g => g.batch_id === b.id)}
                          memberCount={batchMemberCountMap.get(b.id) || 0}
                          groupLeaderCount={batchGroupLeaderCountMap.get(b.id) || 0}
                          onOpenBatch={batchId => setSelectedBatchId(batchId)}
                          onEditBatch={batchObj => setEditBatchModalState({ open: true, batch: batchObj })}
                          onAssignBatchLeader={(bId, bName) => setSelectLeaderModalState({ open: true, title: `SELECT BATCH LEADER FOR ${bName}`, roleType: 'batch_leader', targetEntityName: bName, targetBatchId: bId })}
                          onCreateGroup={bId => setEditGroupModalState({ open: true, group: null, selectedBatchId: bId })}
                          onViewHierarchy={() => setViewMode('hierarchy')}
                          onViewUnassigned={() => setActiveTab('unassigned')}
                          onDeactivateBatch={(bId, bName) => handleDeleteBatch(bId, bName)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* HIERARCHY VIEW MODE */
                <div className="card-glass p-6 bg-white space-y-6">
                  <div className="border-b border-[#e2dfd7] pb-3">
                    <h2 className="text-lg font-black text-[#1E2D4E]">ORGANIZATIONAL HIERARCHY</h2>
                    <p className="text-xs text-slate-500 font-medium">Click any element to open its modal manager</p>
                  </div>

                  <div className="space-y-6 font-mono text-xs">
                    <div className="p-4 rounded-2xl bg-[#1E2D4E] text-white border-2 border-[#C9952A] shadow-md max-w-xl">
                      <div className="font-black text-sm text-[#C9952A] uppercase tracking-wider">ADMIN WORKSPACE</div>
                      <div className="text-xs font-extrabold text-white mt-1">{session?.fullName || 'System Administrator'}</div>
                    </div>

                    <div className="pl-6 border-l-2 border-dashed border-[#1E2D4E]/40 space-y-6">
                      {batches.map(b => {
                        const bLeader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
                        const bGroups = groups.filter(g => g.batch_id === b.id);

                        return (
                          <div key={b.id} className="space-y-4">
                            <div
                              onClick={() => setSelectedBatchId(b.id)}
                              className="p-4 rounded-xl bg-[#F9F7F4] border-2 border-[#1E2D4E] shadow-sm max-w-2xl cursor-pointer hover:border-[#C9952A] transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm text-[#1E2D4E]">{b.name}</span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#C9952A]/20 text-[#C9952A]">{b.type}</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{batchMemberCountMap.get(b.id) || 0} Members</span>
                              </div>
                              <div className="text-xs font-extrabold text-indigo-900 mt-1">
                                Batch Leader: {bLeader ? `${bLeader.name} (${bLeader.app_no})` : '⚠️ Unassigned'}
                              </div>
                            </div>

                            <div className="pl-6 border-l-2 border-dashed border-[#C9952A]/60 space-y-4">
                              {bGroups.map(g => {
                                const gLeader = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no) : null;
                                const gMems = groupMembers.filter(m => m.group_id === g.id);

                                return (
                                  <div key={g.id} className="space-y-2">
                                    <div
                                      onClick={() => setGroupModalState({ open: true, group: g })}
                                      className="p-3 rounded-lg bg-white border border-slate-300 shadow-xs max-w-xl cursor-pointer hover:border-indigo-600 transition-colors"
                                    >
                                      <div className="font-black text-[#1E2D4E]">{g.name} ({g.group_code})</div>
                                      <div className="text-xs font-bold text-emerald-800">
                                        Group Leader: {gLeader ? `${gLeader.name} (${gLeader.app_no})` : '⚠️ Unassigned'}
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                        Members: {gMems.length} / {g.max_members}
                                      </div>
                                    </div>

                                    <div className="pl-6 space-y-1">
                                      {gMems.map((gm, mIdx) => {
                                        const cand = candidateMap.get(gm.candidate_app_no);
                                        return (
                                          <div
                                            key={gm.id}
                                            onClick={() => cand && setMemberProfileModalState({ open: true, candidate: cand })}
                                            className="flex items-center gap-2 text-xs font-sans p-1.5 rounded-lg bg-slate-50 max-w-lg border border-slate-200 cursor-pointer hover:bg-slate-100"
                                          >
                                            <span className="text-slate-400 font-mono">├──</span>
                                            <div className="flex-1">
                                              <span className="font-extrabold text-[#1E2D4E]">{cand?.name || gm.candidate_app_no}</span>
                                              <span className="text-[10px] text-slate-500 font-bold ml-2">ID: {cand?.app_no}</span>
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
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: UNASSIGNED JOINED EMPLOYEES POOL */}
          {activeTab === 'unassigned' && (
            <UnassignedEmployeesSection
              unassignedCandidates={unassignedCandidatesList}
              batches={batches}
              groups={groups}
              departments={departments}
              designations={designations}
              onAssignSubmit={handleQuickAssignFromUnassigned}
              onViewMemberProfile={cand => setMemberProfileModalState({ open: true, candidate: cand })}
            />
          )}

          {/* TAB 3: LEADERSHIP STRUCTURE */}
          {activeTab === 'leadership' && (
            <div className="space-y-6">
              {/* Batch Leaders Section */}
              <div className="card-glass p-5 bg-white space-y-4">
                <div className="border-b border-[#e2dfd7] pb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-[#1E2D4E] uppercase">BATCH LEADERSHIP DIRECTORY</h2>
                    <p className="text-xs text-slate-500 font-medium">Assigned leaders for top-level batches</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {batches.map(b => {
                    const bLeader = b.batch_leader_app_no ? candidateMap.get(b.batch_leader_app_no) : null;
                    return (
                      <div key={b.id} className="p-4 rounded-2xl border border-[#e2dfd7] bg-[#F9F7F4] flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-black text-[#C9952A] uppercase">{b.name} ({b.batch_code})</span>
                          {bLeader ? (
                            <div>
                              <div className="font-extrabold text-sm text-[#1E2D4E] mt-0.5">{bLeader.name}</div>
                              <div className="text-xs text-slate-500 font-semibold">ID: {bLeader.app_no} • {bLeader.department}</div>
                            </div>
                          ) : (
                            <div className="text-xs font-bold text-rose-600 mt-0.5">Leader Not Assigned</div>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectLeaderModalState({
                            open: true,
                            title: `SELECT BATCH LEADER FOR ${b.name}`,
                            roleType: 'batch_leader',
                            targetEntityName: b.name,
                            targetBatchId: b.id
                          })}
                          className="px-3 py-1.5 rounded-xl bg-[#1E2D4E] text-white text-xs font-extrabold hover:bg-[#162340]"
                        >
                          {bLeader ? 'Change Leader' : '+ Assign'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group Leaders Section */}
              <div className="card-glass p-5 bg-white space-y-4">
                <div className="border-b border-[#e2dfd7] pb-3">
                  <h2 className="text-lg font-black text-[#1E2D4E] uppercase">GROUP LEADERSHIP DIRECTORY</h2>
                  <p className="text-xs text-slate-500 font-medium">Group Leaders governing operational teams</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {groups.map(g => {
                    const gLeader = g.group_leader_app_no ? candidateMap.get(g.group_leader_app_no) : null;
                    const bName = batches.find(b => b.id === g.batch_id)?.name || 'Batch';

                    return (
                      <div key={g.id} className="p-4 rounded-2xl border border-[#e2dfd7] bg-white space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-[#1E2D4E]">{g.name}</span>
                          <span className="text-[10px] font-bold text-slate-400">{bName}</span>
                        </div>

                        {gLeader ? (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="font-extrabold text-xs text-[#1E2D4E]">{gLeader.name}</div>
                            <div className="text-[10px] text-slate-500">ID: {gLeader.app_no}</div>
                          </div>
                        ) : (
                          <div className="text-xs font-bold text-rose-600">Leader Not Assigned</div>
                        )}

                        <button
                          onClick={() => setSelectLeaderModalState({
                            open: true,
                            title: `SELECT GROUP LEADER FOR ${g.name}`,
                            roleType: 'group_leader',
                            targetEntityName: g.name,
                            targetGroupId: g.id
                          })}
                          className="w-full py-1.5 rounded-xl bg-[#C9952A] text-white text-xs font-black text-center hover:bg-[#b08020]"
                        >
                          {gLeader ? 'Change Leader' : '+ Assign Group Leader'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RECENT ACTIVITY */}
          {activeTab === 'activity' && (
            <div className="card-glass p-6 bg-white space-y-4">
              <div className="border-b border-[#e2dfd7] pb-3">
                <h2 className="text-lg font-black text-[#1E2D4E] uppercase">BATCH PLAN AUDIT LOG</h2>
                <p className="text-xs text-slate-500 font-medium">Audit trail of batch creation, leader assignments, and member movements</p>
              </div>

              <div className="space-y-3">
                {activities.map(act => (
                  <div key={act.id} className="p-3.5 rounded-xl border border-slate-200 bg-[#F9F7F4] flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#1E2D4E] text-white text-[10px] font-black uppercase">
                          {act.action_type}
                        </span>
                        <span className="text-xs font-extrabold text-[#1E2D4E]">{act.description}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-semibold mt-1">
                        By: <strong className="text-slate-700">{act.by_user}</strong> • {formatTimeAgo(act.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ALL MODAL OVERLAYS */}
      {/* 1. Group Modal (Open Group centered modal) */}
      <GroupModal
        isOpen={groupModalState.open}
        onClose={() => setGroupModalState({ open: false, group: null })}
        group={groupModalState.group}
        batch={batches.find(b => b.id === groupModalState.group?.batch_id) || null}
        groupMembers={groupMembers}
        candidateMap={candidateMap}
        onChangeLeader={(gId, gName) => setSelectLeaderModalState({
          open: true,
          title: `SELECT GROUP LEADER FOR ${gName}`,
          roleType: 'group_leader',
          targetEntityName: gName,
          targetGroupId: gId
        })}
        onRemoveLeader={(gId, gName) => handleRemoveLeader('group_leader', gId, gName)}
        onAddMember={(bId, gId, gName) => setAddMemberModalState({
          open: true,
          targetBatchId: bId,
          targetGroupId: gId,
          targetGroupName: gName
        })}
        onViewMember={cand => setMemberProfileModalState({ open: true, candidate: cand })}
        onMoveMember={(appNo, name, gId, gName, bId) => setMoveMemberModalState({
          open: true,
          candidateAppNo: appNo,
          memberName: name,
          currentGroupId: gId,
          currentGroupName: gName,
          currentBatchId: bId
        })}
        onRemoveMember={(appNo, name, gName) => handleRemoveMemberSubmit(appNo, name, gName)}
      />

      {/* 2. Add Member Modal */}
      <AddMemberModal
        isOpen={addMemberModalState.open}
        onClose={() => setAddMemberModalState({ open: false, targetBatchId: null, targetGroupId: null, targetGroupName: '' })}
        targetBatchId={addMemberModalState.targetBatchId}
        targetGroupId={addMemberModalState.targetGroupId}
        targetGroupName={addMemberModalState.targetGroupName}
        candidates={candidates}
        memberAssignmentMap={memberAssignmentMap}
        assignedAppNoSet={assignedAppNoSet}
        departments={departments}
        designations={designations}
        currentMemberCount={addMemberModalState.targetGroupId ? (groupMemberCountMap.get(addMemberModalState.targetGroupId) || 0) : 0}
        maxMembers={groups.find(g => g.id === addMemberModalState.targetGroupId)?.max_members || 9}
        onSingleAdd={handleSingleAddMember}
        onBulkAdd={handleBulkAddMembers}
        onMoveMember={(appNo, name, gId, gName, bId) => setMoveMemberModalState({
          open: true,
          candidateAppNo: appNo,
          memberName: name,
          currentGroupId: gId,
          currentGroupName: gName,
          currentBatchId: bId
        })}
      />

      {/* 3. Searchable Leader Selector Modal */}
      <SelectLeaderModal
        isOpen={selectLeaderModalState.open}
        onClose={() => setSelectLeaderModalState({ open: false, title: '', roleType: 'group_leader', targetEntityName: '' })}
        title={selectLeaderModalState.title}
        roleType={selectLeaderModalState.roleType}
        targetEntityName={selectLeaderModalState.targetEntityName}
        candidates={candidates}
        batches={batches}
        groups={groups}
        assignedAppNoSet={assignedAppNoSet}
        departments={departments}
        designations={designations}
        onAssignLeader={handleAssignLeaderFromModal}
      />

      {/* 4. Edit Batch Modal */}
      <EditBatchModal
        isOpen={editBatchModalState.open}
        onClose={() => setEditBatchModalState({ open: false, batch: null })}
        batch={editBatchModalState.batch}
        candidateMap={candidateMap}
        groups={groups}
        groupMembers={groupMembers}
        onSaveBatch={handleSaveBatch}
        onChangeBatchLeader={(bId, bName) => setSelectLeaderModalState({
          open: true,
          title: `SELECT BATCH LEADER FOR ${bName}`,
          roleType: 'batch_leader',
          targetEntityName: bName,
          targetBatchId: bId
        })}
      />

      {/* 5. Edit Group Modal */}
      <EditGroupModal
        isOpen={editGroupModalState.open}
        onClose={() => setEditGroupModalState({ open: false, group: null, selectedBatchId: null })}
        group={editGroupModalState.group}
        selectedBatchId={editGroupModalState.selectedBatchId}
        batches={batches}
        onSaveGroup={handleSaveGroup}
      />

      {/* 6. Member Profile Modal */}
      <MemberProfileModal
        isOpen={memberProfileModalState.open}
        onClose={() => setMemberProfileModalState({ open: false, candidate: null })}
        candidate={memberProfileModalState.candidate}
        assignmentInfo={memberProfileModalState.candidate ? memberAssignmentMap.get(memberProfileModalState.candidate.app_no) || null : null}
        groupLeaderName={(() => {
          if (!memberProfileModalState.candidate) return null;
          const assign = memberAssignmentMap.get(memberProfileModalState.candidate.app_no);
          if (!assign) return null;
          const g = groups.find(x => x.id === assign.groupId);
          if (!g || !g.group_leader_app_no) return null;
          return candidateMap.get(g.group_leader_app_no)?.name || null;
        })()}
        onMove={(appNo, name, gId, gName, bId) => setMoveMemberModalState({
          open: true,
          candidateAppNo: appNo,
          memberName: name,
          currentGroupId: gId,
          currentGroupName: gName,
          currentBatchId: bId
        })}
        onRemove={(appNo, name, gName) => handleRemoveMemberSubmit(appNo, name, gName)}
      />

      {/* 7. Move Member Modal */}
      <MoveMemberModal
        isOpen={moveMemberModalState.open}
        onClose={() => setMoveMemberModalState({ open: false, candidateAppNo: '', memberName: '', currentGroupId: 0, currentGroupName: '', currentBatchId: 0 })}
        candidateAppNo={moveMemberModalState.candidateAppNo}
        memberName={moveMemberModalState.memberName}
        currentGroupId={moveMemberModalState.currentGroupId}
        currentGroupName={moveMemberModalState.currentGroupName}
        currentBatchId={moveMemberModalState.currentBatchId}
        batches={batches}
        groups={groups}
        onMoveSubmit={handleMoveMemberSubmit}
      />

      {/* 8. Confirmation Dialog */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-[#e2dfd7] max-w-sm w-full space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg text-[#1E2D4E]">{confirmModal.title}</h3>
              <p className="text-xs text-slate-600 font-semibold mt-1.5">{confirmModal.message}</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} })}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const cb = confirmModal.onConfirm;
                  setConfirmModal({ open: false, title: '', message: '', onConfirm: () => {} });
                  cb();
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 shadow-sm"
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
