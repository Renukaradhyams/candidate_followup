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

// ── Auth Routes ──────────────────────────────────────────────
router.post('/auth/login', authController.login);
router.post('/auth/verify', authController.verifyUser);
router.get('/auth/me', authenticate, authController.getMe);

// ── Public Routes (Interview Token & Candidate Entry) ─────────
router.get('/public/interview', interviewController.getInterviewByToken);
router.post('/public/interview-score', interviewController.submitInterviewScore);
router.post('/public/candidate-entry', candidateController.addCandidate);
router.get('/public/check-duplicate', candidateController.checkDuplicate);
router.get('/public/designations', settingsController.getDesignations);

router.get('/public/migrate-db', async (req, res) => {
  try {
    const db = require('../config/db');
    let results = [];
    const newCols = [
      'religion VARCHAR(100) NULL',
      'caste VARCHAR(100) NULL'
    ];
    for (let col of newCols) {
      try {
        await db.query(`ALTER TABLE candidates ADD COLUMN ${col}`);
        results.push(`Added ${col}`);
      } catch (e) {
        results.push(`Column ${col.split(' ')[0]} might already exist: ${e.message}`);
      }
    }
    res.json({ success: true, message: 'Migration completed', results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Candidate Routes ─────────────────────────────────────────
router.get('/candidates', candidateController.getCandidates);
router.post('/candidates', candidateController.addCandidate);
router.post('/candidates/add', candidateController.addCandidate);
router.put('/candidates/:appNo', candidateController.updateCandidate);
router.post('/candidates/update', candidateController.updateCandidate);
router.delete('/candidates/:appNo', authenticate, authorize('Admin', 'Super Admin'), candidateController.deleteCandidate);
router.get('/candidates/check-duplicate', candidateController.checkDuplicate);
router.get('/candidates/next-app-no', candidateController.getNextAppNo);
router.get('/candidates/kpis', candidateController.getKPIs);
router.get('/candidates/pending-actions', candidateController.getPendingActions);
router.get('/candidates/source-breakdown', candidateController.getSourceBreakdown);
router.get('/candidates/activity-full', candidateController.getActivityFull);
router.post('/candidates/upload-resume', upload.single('resume'), candidateController.uploadResume);
router.post('/candidates/upload-documents', upload.fields([{ name: 'resume' }, { name: 'photo' }, { name: 'aadhar' }]), candidateController.uploadDocuments);
router.get('/candidates/activity', candidateController.getSystemActivity);
router.get('/openings', candidateController.getOpenings);
router.post('/openings/update', authenticate, authorize('Admin', 'Super Admin'), candidateController.updateOpening);
router.get('/employees', candidateController.getEmployees);
router.post('/employees/bulk', authenticate, candidateController.bulkAddEmployees);

// ── Interview Routes ─────────────────────────────────────────
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

// ── Offer Routes ─────────────────────────────────────────────
router.get('/offers', offerController.getOffers);
router.post('/offers/log-call', offerController.logOfferCall);
router.post('/offers/update-details', offerController.updateOfferDetails);
router.post('/offers/accept', offerController.acceptOffer);
router.post('/offers/reject', offerController.rejectOffer);
router.post('/offers/mark-joined', offerController.markJoined);
router.post('/offers/update-status', offerController.updateOfferStatus);

// ── Onboarding Routes ────────────────────────────────────────
router.get('/onboarding/list', onboardingController.getOnboardingList);
router.post('/onboarding/create', onboardingController.createOnboarding);
router.get('/onboarding/items', onboardingController.getOnboardingItems);
router.post('/onboarding/update-item', onboardingController.updateOnboardingItem);
router.post('/onboarding/complete', onboardingController.completeOnboarding);

// ── Exit Routes ──────────────────────────────────────────────
router.get('/exit/list', exitController.getExitList);
router.post('/exit/create', exitController.createExit);
router.get('/exit/items', exitController.getExitItems);
router.post('/exit/update-item', exitController.updateExitItem);
router.post('/exit/complete', exitController.completeExit);

// ── Settings Routes ──────────────────────────────────────────
router.get('/settings/users', settingsController.getUsers);
router.post('/settings/users/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addUser);
router.post('/settings/users/update', authenticate, authorize('Admin', 'Super Admin'), settingsController.updateUser);
router.get('/settings/page-visibility', settingsController.getPageSettings);
router.post('/settings/page-visibility', authenticate, authorize('Admin', 'Super Admin'), settingsController.savePageSettings);
router.get('/settings/designations', settingsController.getDesignations);
router.post('/settings/designations/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addDesignation);
router.post('/settings/designations/delete', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteDesignation);
router.get('/settings/questions', settingsController.getAllInterviewQuestions);
router.post('/settings/questions/add', authenticate, authorize('Admin', 'Super Admin'), settingsController.addInterviewQuestion);
router.post('/settings/questions/delete', authenticate, authorize('Admin', 'Super Admin'), settingsController.deleteInterviewQuestion);

// ── Broadcast Routes ─────────────────────────────────────────
router.get('/broadcasts', broadcastController.getBroadcasts);
router.post('/broadcasts', broadcastController.createBroadcast);
router.delete('/broadcasts/:id', authenticate, authorize('Admin', 'Super Admin'), broadcastController.deleteBroadcast);

// ── Legacy Google Apps Script Action Dispatcher Endpoint ─────
// Dispatches legacy `{ action: 'verifyUser', ... }` requests to appropriate controller actions
router.get('/legacy', async (req, res) => {
  if (req.query.action === 'getInterviewByToken') {
    return interviewController.getInterviewByToken(req, res);
  }
  return res.json({ status: 'BSC HRMS API v5 Online' });
});

router.post('/legacy', async (req, res) => {
  const { action } = req.body;
  const dispatchMap = {
    verifyUser: authController.verifyUser,
    getCandidates: candidateController.getCandidates,
    addCandidate: candidateController.addCandidate,
    getActivityFull: candidateController.getActivityFull,
    getActivity: candidateController.getSystemActivity,
    updateCandidate: candidateController.updateCandidate,
    checkDuplicate: candidateController.checkDuplicate,
    getNextAppNo: candidateController.getNextAppNo,
    getKPIs: candidateController.getKPIs,
    getPendingActions: candidateController.getPendingActions,
    getSourceBreakdown: candidateController.getSourceBreakdown,
    getDesignations: settingsController.getDesignations,
    getPublicDesignations: settingsController.getPublicDesignations,
    getOpenings: candidateController.getOpenings,
    updateOpening: candidateController.updateOpening,
    saveCallStep: interviewController.saveCallStep,
    getCallStatus: interviewController.getCallStatus,
    getInterviews: interviewController.getInterviews,
    getInterviewQuestions: interviewController.getInterviewQuestions,
    saveScore: interviewController.saveScore,
    generateInterviewToken: interviewController.generateInterviewToken,
    getInterviewByToken: interviewController.getInterviewByToken,
    submitInterviewScore: interviewController.submitInterviewScore,
    getOffers: offerController.getOffers,
    logOfferCall: offerController.logOfferCall,
    updateOfferDetails: offerController.updateOfferDetails,
    acceptOffer: offerController.acceptOffer,
    rejectOffer: offerController.rejectOffer,
    markJoined: offerController.markJoined,
    updateOfferStatus: offerController.updateOfferStatus,
    approveSelection: interviewController.approveSelection,
    rejectCandidate: interviewController.rejectCandidate,
    getSelectedCandidates: interviewController.getSelectedCandidates,
    getRejectedCandidates: interviewController.getRejectedCandidates,
    getUsers: settingsController.getUsers,
    addUser: settingsController.addUser,
    updateUser: settingsController.updateUser,
    getPageSettings: settingsController.getPageSettings,
    savePageSettings: settingsController.savePageSettings,
    getAllInterviewQuestions: settingsController.getAllInterviewQuestions,
    addInterviewQuestion: settingsController.addInterviewQuestion,
    deleteInterviewQuestion: settingsController.deleteInterviewQuestion,
    addDesignation: settingsController.addDesignation,
    deleteDesignation: settingsController.deleteDesignation,
    getEmployees: candidateController.getEmployees,
    getOnboardingList: onboardingController.getOnboardingList,
    createOnboarding: onboardingController.createOnboarding,
    getOnboardingItems: onboardingController.getOnboardingItems,
    updateOnboardingItem: onboardingController.updateOnboardingItem,
    completeOnboarding: onboardingController.completeOnboarding,
    getExitList: exitController.getExitList,
    createExit: exitController.createExit,
    getExitItems: exitController.getExitItems,
    updateExitItem: exitController.updateExitItem,
    completeExit: exitController.completeExit
  };

  if (dispatchMap[action]) {
    return dispatchMap[action](req, res);
  }
  return errorRes(res, `Unknown action: ${action}`, [], 400);
});

module.exports = router;
