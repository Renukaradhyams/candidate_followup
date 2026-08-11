/**
 * BSC Enterprise HRMS API Client Service
 */

const getApiBase = () => {
  // @ts-ignore - suppress vite env errors in standard TS compiler
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return '/api';
};

export interface UserSession {
  username: string;
  role: 'HR' | 'Manager' | 'Admin' | 'Super Admin' | string;
  fullName: string;
  displayName: string;
  token?: string;
}

export const Auth = {
  save(session: UserSession) {
    try {
      localStorage.setItem('bsc_crm_session', JSON.stringify({
        ...session,
        loginAt: Date.now()
      }));
    } catch (e) {}
  },

  get(): (UserSession & { loginAt: number }) | null {
    try {
      const data = localStorage.getItem('bsc_crm_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  check(): boolean {
    const session = this.get();
    if (!session || !session.token) {
      this.clear();
      return false;
    }
    // 24h expiration
    if (Date.now() - session.loginAt > 24 * 60 * 60 * 1000) {
      this.clear();
      return false;
    }
    return true;
  },

  clear() {
    try {
      localStorage.removeItem('bsc_crm_session');
    } catch (e) {}
  },

  logout() {
    this.clear();
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const session = Auth.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (session && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    headers['x-auth-token'] = session.token; // Fallback for Hostinger Apache stripping Authorization header
  }

  const apiBase = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.message || `HTTP ${res.status}`;
      if (res.status === 403) {
        console.error(`[403 FORBIDDEN ERROR] Access denied for URL: ${url}`, errorData);
      } else if (res.status === 401 && !endpoint.includes('/auth/login')) {
        console.warn(`[401 UNAUTHORIZED] Token expired or invalid for URL: ${url}`);
      }
      throw new Error(errorMsg);
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`[API Fetch Error: ${endpoint}]`, err.message);
    throw err;
  }
};

// Legacy Apps Script API Action Dispatcher Wrapper for 100% compatibility
export const API = {
  async call(action: string, params: any = {}) {
    try {
      const res = await apiFetch('/legacy', {
        method: 'POST',
        body: JSON.stringify({ action, ...params })
      });
      return res;
    } catch (err: any) {
      console.warn(`[Legacy Dispatch Error: ${action}]`, err.message);
      return { success: false, error: err.message };
    }
  },

  // Auth
  async verifyUser(username: string, password: string) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  // Candidates
  async uploadDocuments(formData: FormData, candName?: string, appNo?: string) {
    const session = Auth.get();
    const headers: Record<string, string> = {};
    if (session && session.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
      headers['x-auth-token'] = session.token;
    }
    if (candName) {
      headers['x-candidate-name'] = encodeURIComponent(candName);
    }
    if (appNo) {
      headers['x-app-no'] = appNo;
    }
    const apiBase = getApiBase();
    const url = `${apiBase}/candidates/upload-documents`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
  async getCandidates(filters: any = {}) {
    const query = new URLSearchParams(filters).toString();
    return apiFetch(`/candidates?${query}`);
  },
  async getEmployees() {
    return apiFetch('/employees');
  },
  async addCandidate(data: any) {
    // Legacy route uses /add or we just map it in our generic call
    return apiFetch('/candidates', {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  },
  async deleteCandidate(appNo: string) {
    return apiFetch(`/candidates/${appNo}`, {
      method: 'DELETE'
    });
  },
  async updateCandidate(appNo: string, updates: any, candName?: string, doneBy?: string) {
    return apiFetch(`/candidates/${appNo}`, {
      method: 'PUT',
      body: JSON.stringify({ appNo, updates, candName, doneBy })
    });
  },
  async checkDuplicate(phone: string) {
    return apiFetch(`/candidates/check-duplicate?phone=${encodeURIComponent(phone)}`);
  },
  async getNextAppNo() {
    return apiFetch('/candidates/next-app-no');
  },
  async getKPIs(dateRange?: string, fromDate?: string, toDate?: string) {
    const params = new URLSearchParams();
    if (dateRange) params.append('range', dateRange);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return apiFetch(`/candidates/kpis${qs ? `?${qs}` : ''}`);
  },
  async getPendingActions() {
    return apiFetch('/candidates/pending-actions');
  },
  async getSourceBreakdown() {
    return apiFetch('/candidates/source-breakdown');
  },
  async getActivityFull(appNo: string) {
    return apiFetch(`/candidates/activity-full?appNo=${encodeURIComponent(appNo)}`);
  },
  async getActivity(params: { limit?: number } = {}) {
    return apiFetch(`/candidates/activity?limit=${params.limit || 10}`);
  },

  // Interviews
  async getInterviews() {
    return apiFetch('/interviews');
  },
  async getInterviewQuestions(desig?: string, round?: string) {
    const query = new URLSearchParams({ desig: desig || '', round: round || 'HR' }).toString();
    return apiFetch(`/interviews/questions?${query}`);
  },
  async saveCallStep(p: any) {
    return apiFetch('/interviews/save-call-step', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async getCallStatus(appNo: string) {
    return apiFetch(`/interviews/call-status?appNo=${encodeURIComponent(appNo)}`);
  },
  async saveScore(appNo: string, round: string, scores: any, offeredSalary?: string, offeredDoj?: string) {
    return apiFetch('/interviews/save-score', {
      method: 'POST',
      body: JSON.stringify({ appNo, round, scores, offeredSalary, offeredDoj })
    });
  },
  async generateInterviewToken(p: any) {
    return apiFetch('/interviews/generate-token', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async approveSelection(p: any) {
    return apiFetch('/interviews/approve-selection', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async rejectCandidate(p: any) {
    return apiFetch('/interviews/reject-candidate', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async getSelectedCandidates() {
    return apiFetch('/interviews/selected');
  },
  async getRejectedCandidates() {
    return apiFetch('/interviews/rejected');
  },

  // Offers
  async getOffers() {
    return apiFetch('/offers');
  },
  async createDirectOffer(p: any) {
    return apiFetch('/offers/direct', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async logOfferCall(p: any) {
    return apiFetch('/offers/log-call', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async updateOfferStatus(p: any) {
    return apiFetch('/offers/update-status', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async updateOfferDetails(p: any) {
    return apiFetch('/offers/update-details', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async acceptOffer(p: any) {
    return apiFetch('/offers/accept', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async rejectOffer(p: any) {
    return apiFetch('/offers/reject', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async markJoined(p: any) {
    return apiFetch('/offers/mark-joined', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },

  // Onboarding & Exit
  async getOnboardingList() { return apiFetch('/onboarding/list'); },
  async createOnboarding(p: any) { return apiFetch('/onboarding/create', { method: 'POST', body: JSON.stringify(p) }); },
  async getOnboardingItems(recordId: string) { return apiFetch(`/onboarding/items?recordId=${encodeURIComponent(recordId)}`); },
  async updateOnboardingItem(p: any) { return apiFetch('/onboarding/update-item', { method: 'POST', body: JSON.stringify(p) }); },
  async completeOnboarding(p: any) { return apiFetch('/onboarding/complete', { method: 'POST', body: JSON.stringify(p) }); },

  async getExitList() { return apiFetch('/exit/list'); },
  async createExit(p: any) { return apiFetch('/exit/create', { method: 'POST', body: JSON.stringify(p) }); },
  async getExitItems(recordId: string) { return apiFetch(`/exit/items?recordId=${encodeURIComponent(recordId)}`); },
  async updateExitItem(p: any) { return apiFetch('/exit/update-item', { method: 'POST', body: JSON.stringify(p) }); },
  async completeExit(p: any) { return apiFetch('/exit/complete', { method: 'POST', body: JSON.stringify(p) }); },

  // Settings
  async getUsers() { return apiFetch('/settings/users'); },
  async addUser(p: any) { return apiFetch('/settings/users/add', { method: 'POST', body: JSON.stringify(p) }); },
  async updateUser(p: any) { return apiFetch('/settings/users/update', { method: 'POST', body: JSON.stringify(p) }); },
  async getPageSettings() { 
    try {
      return await apiFetch('/settings/page-visibility'); 
    } catch (e) {
      return {};
    }
  },
  async savePageSettings(settings: any) { return apiFetch('/settings/page-visibility', { method: 'POST', body: JSON.stringify({ settings }) }); },
  async getDesignations() { return apiFetch('/settings/designations'); },
  async getPublicDesignations() { return API.call('getPublicDesignations'); },
  async addDesignation(name: string) { return apiFetch('/settings/designations/add', { method: 'POST', body: JSON.stringify({ name }) }); },
  async deleteDesignation(name: string) { return apiFetch('/settings/designations/delete', { method: 'POST', body: JSON.stringify({ name }) }); },

  // Broadcasts
  async getBroadcasts() { return apiFetch('/broadcasts'); },
  async createBroadcast(payload: any) { return apiFetch('/broadcasts', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteBroadcast(id: string | number) { return apiFetch(`/broadcasts/${id}`, { method: 'DELETE' }); },

  // Department Hiring & Section Allocation
  async getHiringTargets() { return apiFetch('/dept-hiring/targets'); },
  async saveHiringTarget(payload: any) { return apiFetch('/dept-hiring/targets', { method: 'POST', body: JSON.stringify(payload) }); },
  async getSectionAllocations() { return apiFetch('/section-allocations'); },
  async saveSectionAllocation(payload: any) { return apiFetch('/section-allocations', { method: 'POST', body: JSON.stringify(payload) }); },
  async bulkSaveSectionAllocation(payload: any) { return apiFetch('/section-allocations/bulk', { method: 'POST', body: JSON.stringify(payload) }); },

  // Department Sections CRUD
  async getDepartmentSections() { return apiFetch('/dept-hiring/sections'); },
  async addDepartmentSection(payload: any) { return apiFetch('/dept-hiring/sections/add', { method: 'POST', body: JSON.stringify(payload) }); },
  async editDepartmentSection(payload: any) { return apiFetch('/dept-hiring/sections/edit', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteDepartmentSection(payload: number | string | { id?: number | string; department?: string; sectionName?: string }) { 
    const bodyObj = typeof payload === 'object' ? payload : { id: payload };
    return apiFetch('/dept-hiring/sections/delete', { method: 'POST', body: JSON.stringify(bodyObj) }); 
  },

  // File URL Helper
  fileUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    let clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.startsWith('uploads/')) clean = `/${clean}`;
    const filename = clean.split('/').pop() || clean;
    if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume') && !clean.includes('applicants')) return `/uploads/candidate-resumes/${filename}`;
    if ((filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) && !clean.includes('applicants')) return `/uploads/employee-documents/${filename}`;
    if (clean.startsWith('/uploads/')) return clean;
    return `/uploads/misc/${filename}`;
  }
};
