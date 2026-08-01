-- Granular Permissions Seed Script for BSC Enterprise HRMS
USE `hrms_db`;

INSERT INTO `Permission` (`permissionName`, `module`, `action`, `description`) VALUES
-- Candidates
('candidate:view', 'Candidates', 'View', 'View candidate pipeline and details'),
('candidate:create', 'Candidates', 'Create', 'Register new candidate'),
('candidate:update', 'Candidates', 'Update', 'Edit candidate profile and status'),
('candidate:delete', 'Candidates', 'Delete', 'Soft delete candidate'),
('candidate:export', 'Candidates', 'Export', 'Export candidate CSV/Excel'),

-- Interviews
('interview:view', 'Interviews', 'View', 'View interview schedules'),
('interview:create', 'Interviews', 'Create', 'Schedule interview'),
('interview:evaluate', 'Interviews', 'Update', 'Score interview rounds'),
('interview:approve', 'Interviews', 'Approve', 'Approve candidate selection'),
('interview:reject', 'Interviews', 'Reject', 'Reject candidate with remarks'),

-- Offers
('offer:view', 'Offers', 'View', 'View offers'),
('offer:create', 'Offers', 'Create', 'Generate offer letter'),
('offer:approve', 'Offers', 'Approve', 'Accept and confirm offer'),
('offer:join', 'Offers', 'Update', 'Mark candidate joined'),

-- Onboarding & Exit
('onboarding:manage', 'Onboarding', 'Manage', 'Manage onboarding checklist'),
('exit:manage', 'Exit', 'Manage', 'Manage exit FnF clearance'),

-- System Administration
('users:manage', 'Settings', 'Manage Users', 'Create, update, deactivate users'),
('settings:manage', 'Settings', 'Manage Settings', 'Manage System and Page Visibility Settings'),
('reports:export', 'Reports', 'Export', 'Generate & export HR reports')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);
