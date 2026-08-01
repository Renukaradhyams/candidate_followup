-- Role Seed Script for BSC Enterprise HRMS
USE `hrms_db`;

INSERT INTO `Role` (`roleName`, `description`, `status`) VALUES
('Super Admin', 'Full system access across all companies and settings', 'Active'),
('Admin', 'Administrator access with user and settings management', 'Active'),
('HR', 'HR Operations, Candidate pipeline, Onboarding and Exit clearance', 'Active'),
('Recruiter', 'Candidate sourcing, screening and interview scheduling', 'Active'),
('Interviewer', 'Evaluation and feedback scoring for assigned rounds', 'Active'),
('Manager', 'Store Manager access for selection decisions and approvals', 'Active'),
('Employee', 'Self-service attendance, leaves, and profile view', 'Active'),
('Guest', 'Public candidate submission access', 'Active')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
