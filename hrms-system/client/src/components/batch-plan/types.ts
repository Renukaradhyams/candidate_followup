export interface Candidate {
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
  created_at?: string;
}

export interface BatchPlan {
  id: number;
  batch_code: string;
  name: string;
  type: string;
  description?: string;
  capacity: number;
  batch_leader_app_no?: string | null;
  status: string;
}

export interface BatchGroup {
  id: number;
  group_code: string;
  batch_id: number;
  name: string;
  group_leader_app_no?: string | null;
  max_members: number;
  description?: string;
  status: string;
}

export interface GroupMember {
  id: number;
  candidate_app_no: string;
  batch_id: number;
  group_id: number;
  assigned_at?: string;
  assigned_by?: string;
}

export interface ActivityLog {
  id: number;
  action_type: string;
  description: string;
  by_user: string;
  created_at: string;
}

export interface MemberAssignmentInfo {
  batchId: number;
  groupId: number;
  batchName: string;
  groupName: string;
}
