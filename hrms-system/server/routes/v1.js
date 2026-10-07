const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

const authController = require('../controllers/authController');
const candidateController = require('../controllers/candidateController');
const interviewController = require('../controllers/interviewController');
const offerController = require('../controllers/offerController');
const onboardingController = require('../controllers/onboardingController');
const exitController = require('../controllers/exitController');
const settingsController = require('../controllers/settingsController');
const broadcastController = require('../controllers/broadcastController');
const deptHiringController = require('../controllers/deptHiringController');
const joiningCallDeskController = require('../controllers/joiningCallDeskController');
const workforceAnalyticsController = require('../controllers/workforceAnalyticsController');
const dojPlanningController = require('../controllers/dojPlanningController');
const batchPlanController = require('../controllers/batchPlanController');

const { validateLogin } = require('../validators/authValidator');
const { validateAddCandidate, validateUpdateCandidate } = require('../validators/candidateValidator');

// ── Auth Module ──────────────────────────────────────────────
router.post('/auth/login', validateLogin, authController.login);
router.post('/auth/verify', authController.verifyUser);
router.post('/auth/logout', authenticate, authController.logout);
router.get('/auth/me', authenticate, authController.getMe);

// ── Candidates Module ────────────────────────────────────────
router.get('/candidates', candidateController.getCandidates);
router.post('/candidates', validateAddCandidate, candidateController.addCandidate);
router.post('/candidates/add', candidateController.addCandidate);
router.get('/candidates/deletion-logs', authenticate, candidateController.getDeletionLogs);
router.delete('/candidates/:appNo', authenticate, authorize('Admin', 'Super Admin'), candidateController.deleteCandidate);
router.put('/candidates/:appNo', validateUpdateCandidate, candidateController.updateCandidate);
router.post('/candidates/update', candidateController.updateCandidate);
router.get('/candidates/check-duplicate', candidateController.checkDuplicate);
router.post('/candidates/check-duplicate', candidateController.checkDuplicate);
router.get('/candidates/next-app-no', candidateController.getNextAppNo);
router.get('/candidates/kpis', candidateController.getKPIs);
router.get('/candidates/pending-actions', candidateController.getPendingActions);
router.get('/candidates/source-breakdown', candidateController.getSourceBreakdown);
router.get('/candidates/activity-full', candidateController.getActivityFull);
router.get('/candidates/activity', candidateController.getSystemActivity);
router.post('/candidates/upload-resume', upload.single('resume'), candidateController.uploadResume);
router.post('/candidates/upload-documents', upload.fields([{ name: 'resume' }, { name: 'photo' }, { name: 'aadhar' }]), candidateController.uploadDocuments);
router.get('/openings', candidateController.getOpenings);
router.post('/openings/update', authenticate, authorize('Admin', 'Super Admin'), candidateController.updateOpening);

// ── Interviews Module ────────────────────────────────────────
router.get('/interviews', interviewController.getInterviews);
router.get('/interviews/questions', interviewController.getInterviewQuestions);
router.post('/interviews/save-call-step', interviewController.saveCallStep);
router.get('/interviews/call-status', interviewController.getCallStatus);
router.post('/interviews/save-score', interviewController.saveScore);
router.post('/interviews/generate-token', interviewController.generateInterviewToken);
router.post('/interviews/approve-selection', interviewController.approveSelection);
router.post('/interviews/reject-candidate', interviewController.rejectCandidate);
router.get('/interviews/selected', interviewController.getSelectedCandidates);
router.get('/interviews/rejected', interviewController.getRejectedCandidates);

// ── Offers Module ────────────────────────────────────────────
router.get('/offers', offerController.getOffers);
router.post('/offers/direct', offerController.createDirectOffer);
router.post('/offers/log-call', offerController.logOfferCall);
router.post('/offers/update-details', offerController.updateOfferDetails);
router.post('/offers/accept', offerController.acceptOffer);
router.post('/offers/reject', offerController.rejectOffer);
router.post('/offers/mark-joined', offerController.markJoined);
router.post('/offers/update-status', offerController.updateOfferStatus);

// ── Onboarding Module ────────────────────────────────────────
router.get('/onboarding', onboardingController.getOnboardingList);
router.get('/onboarding/list', onboardingController.getOnboardingList);
router.post('/onboarding', onboardingController.createOnboarding);
router.post('/onboarding/create', onboardingController.createOnboarding);
router.get('/onboarding/items', onboardingController.getOnboardingItems);
router.post('/onboarding/update-item', onboardingController.updateOnboardingItem);
router.post('/onboarding/complete', onboardingController.completeOnboarding);

// ── Employees Module ─────────────────────────────────────────
router.get('/employees', candidateController.getEmployees);
router.post('/employees/bulk', authenticate, candidateController.bulkAddEmployees);

// ── Exit Module ──────────────────────────────────────────────
router.get('/exit', exitController.getExitList);
router.get('/exit/list', exitController.getExitList);
router.post('/exit', exitController.createExit);
router.post('/exit/create', exitController.createExit);
router.get('/exit/items', exitController.getExitItems);
router.post('/exit/update-item', exitController.updateExitItem);
router.post('/exit/complete', exitController.completeExit);

// ── Settings Module ──────────────────────────────────────────
router.get('/settings/users', settingsController.getUsers);
router.post('/settings/users', authenticate, authorize('Admin', 'Super Admin'), settingsController.addUser);
router.post('/settings/users/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addUser);
router.put('/settings/users', authenticate, authorize('Admin', 'Super Admin'), settingsController.updateUser);
router.post('/settings/users/update', authenticate, authorize('Admin', 'Super Admin'), settingsController.updateUser);
router.get('/settings/page-visibility', settingsController.getPageSettings);
router.put('/settings/page-visibility', authenticate, authorize('Admin', 'Super Admin'), settingsController.savePageSettings);
router.post('/settings/page-visibility', authenticate, authorize('Admin', 'Super Admin'), settingsController.savePageSettings);
router.get('/settings/designations', settingsController.getDesignations);
router.post('/settings/designations', authenticate, authorize('Admin', 'Super Admin'), settingsController.addDesignation);
router.post('/settings/designations/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addDesignation);
router.delete('/settings/designations', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteDesignation);
router.post('/settings/designations/delete', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteDesignation);
router.get('/settings/questions', settingsController.getAllInterviewQuestions);
router.post('/settings/questions', authenticate, authorize('Admin', 'Super Admin'), settingsController.addInterviewQuestion);
router.post('/settings/questions/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addInterviewQuestion);
router.delete('/settings/questions', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteInterviewQuestion);
router.post('/settings/questions/delete', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteInterviewQuestion);
router.post('/settings/change-employee-number', authenticate, authorize('Admin', 'Super Admin'), settingsController.changeEmployeeNumber);
router.post('/settings/bulk-change-employee-number', authenticate, authorize('Admin', 'Super Admin'), settingsController.bulkChangeEmployeeNumber);

// ── Broadcast Routes ─────────────────────────────────────────
router.get('/broadcasts', broadcastController.getBroadcasts);
router.post('/broadcasts', broadcastController.createBroadcast);
router.delete('/broadcasts/:id', authenticate, authorize('Admin', 'Super Admin'), broadcastController.deleteBroadcast);

// ── Dept Hiring & Section Allocation Routes ───────────────
router.get('/dept-hiring/targets', deptHiringController.getHiringTargets);
router.post('/dept-hiring/targets', deptHiringController.saveHiringTarget);
router.get('/section-allocations', deptHiringController.getSectionAllocations);
router.post('/section-allocations', deptHiringController.saveSectionAllocation);
router.post('/section-allocations/bulk', deptHiringController.bulkSaveSectionAllocation);
router.get('/dept-hiring/sections', deptHiringController.getDepartmentSections);
router.post('/dept-hiring/sections/add', deptHiringController.addDepartmentSection);
router.post('/dept-hiring/sections/edit', deptHiringController.editDepartmentSection);
router.post('/dept-hiring/sections/delete', deptHiringController.deleteDepartmentSection);

// ── Joining Call Desk Routes ──────────────────────────────────
router.get('/joining-call-desk/summary', joiningCallDeskController.getSummary);
router.get('/joining-call-desk/analytics', joiningCallDeskController.getAnalytics);
router.get('/joining-call-desk/by-designation/:designation', authenticate, joiningCallDeskController.getByDesignation);
router.get('/joining-call-desk', joiningCallDeskController.getAll);
router.post('/joining-call-desk/update-status', authenticate, joiningCallDeskController.updateStatus);
router.get('/joining-call-desk/history/:appNo', authenticate, joiningCallDeskController.getHistory);
router.post('/joining-call-desk/update-doj', authenticate, joiningCallDeskController.updateDoj);

// ── Not Joined Desk Routes ───────────────────────────────────
router.get('/not-joined-desk/summary', authenticate, joiningCallDeskController.getNotJoinedSummary);
router.get('/not-joined-desk/analytics', authenticate, joiningCallDeskController.getNotJoinedAnalytics);
router.get('/not-joined-desk/by-designation/:designation', authenticate, joiningCallDeskController.getNotJoinedByDesignation);
router.get('/not-joined-desk/all', authenticate, joiningCallDeskController.getNotJoinedAll);

// ── Workforce Analytics & DOJ Planning ───────────────────────
router.get('/workforce-analytics', workforceAnalyticsController.getAnalytics);
router.get('/doj-planning', authenticate, dojPlanningController.getOverview);

// ── BSC Batch Plan Routes ─────────────────────────────────────
router.get('/batch-plan/data', batchPlanController.getBatchPlanData);
router.post('/batch-plan/batches', authenticate, batchPlanController.createBatch);
router.put('/batch-plan/batches/:id', authenticate, batchPlanController.updateBatch);
router.delete('/batch-plan/batches/:id', authenticate, batchPlanController.deleteBatch);
router.post('/batch-plan/assign-batch-leader', authenticate, batchPlanController.assignBatchLeader);
router.post('/batch-plan/groups', authenticate, batchPlanController.createGroup);
router.put('/batch-plan/groups/:id', authenticate, batchPlanController.updateGroup);
router.delete('/batch-plan/groups/:id', authenticate, batchPlanController.deleteGroup);
router.post('/batch-plan/assign-group-leader', authenticate, batchPlanController.assignGroupLeader);
router.post('/batch-plan/add-member', authenticate, batchPlanController.addMemberToGroup);
router.post('/batch-plan/bulk-add-members', authenticate, batchPlanController.bulkAddMembers);
router.post('/batch-plan/move-member', authenticate, batchPlanController.moveMemberGroup);
router.post('/batch-plan/remove-member', authenticate, batchPlanController.removeMemberFromGroup);
router.get('/batch-plan/attendance', batchPlanController.getBatchAttendance);
router.post('/batch-plan/attendance', authenticate, batchPlanController.saveBatchAttendance);
router.get('/batch-plan/attendance/summary', batchPlanController.getBatchAttendanceSummary);

// ── Public Routes ────────────────────────────────────────────
router.get('/public/interview', interviewController.getInterviewByToken);
router.post('/public/interview-score', interviewController.submitInterviewScore);
router.post('/public/candidate-entry', validateAddCandidate, candidateController.addCandidate);
router.get('/public/check-duplicate', candidateController.checkDuplicate);
router.get('/public/designations', settingsController.getDesignations);

module.exports = router;
