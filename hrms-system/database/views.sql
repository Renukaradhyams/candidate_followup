-- Database Views for Reporting and Dashboard Analytics
USE `hrms_db`;

-- 1. View for Active Candidate Pipeline Overview
CREATE OR REPLACE VIEW `v_CandidatePipeline` AS
SELECT 
  c.id,
  c.candidateCode,
  c.appNo,
  c.candidateName,
  c.mobile,
  c.email,
  c.designation,
  c.source,
  c.status,
  c.daysInPipeline,
  c.createdAt
FROM `Candidate` c
WHERE c.deletedAt IS NULL;

-- 2. View for Interview Schedule Analytics
CREATE OR REPLACE VIEW `v_InterviewSchedules` AS
SELECT 
  s.id,
  s.appNo,
  s.candidateName,
  s.designation,
  s.interviewDate,
  s.step,
  s.status AS scheduleStatus,
  p.assignedName AS evaluatorName,
  p.assignedDesignation AS evaluatorDesignation,
  p.status AS tokenStatus
FROM `InterviewSchedule` s
LEFT JOIN `InterviewPanel` p ON s.candidateId = p.candidateId AND p.status != 'replaced'
WHERE s.deletedAt IS NULL;
