-- Database Triggers for Automated Audit Trails and Pipeline Day Tracking
USE `hrms_db`;

DELIMITER $$

-- Trigger 1: Auto update updatedAt on Candidate modification
CREATE TRIGGER `trg_candidate_before_update`
BEFORE UPDATE ON `Candidate`
FOR EACH ROW
BEGIN
  SET NEW.updatedAt = CURRENT_TIMESTAMP;
  IF OLD.createdAt IS NOT NULL THEN
    SET NEW.daysInPipeline = TIMESTAMPDIFF(DAY, OLD.createdAt, CURRENT_TIMESTAMP);
  END IF;
END$$

DELIMITER ;
