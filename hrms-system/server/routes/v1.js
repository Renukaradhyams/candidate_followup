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
router.put('/candidates/:id', validateUpdateCandidate, candidateController.updateCandidate);
router.post('/candidates/check-duplicate', candidateController.checkDuplicate);
router.get('/candidates/kpis', candidateController.getKPIs);
router.get('/candidates/activity-full', candidateController.getActivityFull);
router.post('/candidates/upload-resume', upload.single('resume'), candidateController.uploadResume);

// ── Interviews Module ────────────────────────────────────────
router.get('/interviews', interviewController.getInterviews);
router.get('/interviews/questions', interviewController.getInterviewQuestions);
router.post('/interviews/save-call-step', interviewController.saveCallStep);
router.post('/interviews/save-score', interviewController.saveScore);
router.post('/interviews/generate-token', interviewController.generateInterviewToken);
router.post('/interviews/approve-selection', interviewController.approveSelection);
router.post('/interviews/reject-candidate', interviewController.rejectCandidate);
router.get('/interviews/selected', interviewController.getSelectedCandidates);
router.get('/interviews/rejected', interviewController.getRejectedCandidates);

// ── Offers Module ────────────────────────────────────────────
router.get('/offers', offerController.getOffers);
router.post('/offers/log-call', offerController.logOfferCall);
router.post('/offers/update-details', offerController.updateOfferDetails);
router.post('/offers/accept', offerController.acceptOffer);
router.post('/offers/reject', offerController.rejectOffer);
router.post('/offers/mark-joined', offerController.markJoined);

// ── Onboarding Module ────────────────────────────────────────
router.get('/onboarding', onboardingController.getOnboardingList);
router.post('/onboarding', onboardingController.createOnboarding);
router.get('/onboarding/items', onboardingController.getOnboardingItems);
router.post('/onboarding/update-item', onboardingController.updateOnboardingItem);
router.post('/onboarding/complete', onboardingController.completeOnboarding);

// ── Employees Module ─────────────────────────────────────────
router.get('/employees', offerController.getOffers); // Joined employee list mapping

// ── Exit Module ──────────────────────────────────────────────
router.get('/exit', exitController.getExitList);
router.post('/exit', exitController.createExit);
router.get('/exit/items', exitController.getExitItems);
router.post('/exit/update-item', exitController.updateExitItem);
router.post('/exit/complete', exitController.completeExit);

// ── Settings Module ──────────────────────────────────────────
router.get('/settings/users', settingsController.getUsers);
router.post('/settings/users', settingsController.addUser);
router.put('/settings/users', settingsController.updateUser);
router.get('/settings/page-visibility', settingsController.getPageSettings);
router.put('/settings/page-visibility', settingsController.savePageSettings);
router.get('/settings/designations', settingsController.getDesignations);
router.post('/settings/designations', settingsController.addDesignation);
router.delete('/settings/designations', settingsController.deleteDesignation);
router.get('/settings/questions', settingsController.getAllInterviewQuestions);
router.post('/settings/questions', settingsController.addInterviewQuestion);
router.delete('/settings/questions', settingsController.deleteInterviewQuestion);

// ── Public Routes ────────────────────────────────────────────
router.get('/public/interview', interviewController.getInterviewByToken);
router.post('/public/interview-score', interviewController.submitInterviewScore);
router.post('/public/candidate-entry', validateAddCandidate, candidateController.addCandidate);

module.exports = router;
