-- Migration: Add PatientStatus and ProcedureType columns to ConsultationRequests
-- Purpose: Add new fields to track patient status and procedure type for consultation requests
-- Author: System
-- Date: November 19, 2025

-- Add PatientStatus column
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[ConsultationRequests]') 
    AND name = 'PatientStatus'
)
BEGIN
    ALTER TABLE [dbo].[ConsultationRequests]
    ADD [PatientStatus] NVARCHAR(20) NOT NULL DEFAULT 'new';
    
    PRINT 'PatientStatus column added successfully';
END
ELSE
BEGIN
    PRINT 'PatientStatus column already exists';
END
GO

-- Add ProcedureType column
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[ConsultationRequests]') 
    AND name = 'ProcedureType'
)
BEGIN
    ALTER TABLE [dbo].[ConsultationRequests]
    ADD [ProcedureType] NVARCHAR(100) NOT NULL DEFAULT 'Not specified';
    
    PRINT 'ProcedureType column added successfully';
END
ELSE
BEGIN
    PRINT 'ProcedureType column already exists';
END
GO

-- Add check constraint for PatientStatus
IF NOT EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE object_id = OBJECT_ID(N'[dbo].[CK_ConsultationRequests_PatientStatus]')
)
BEGIN
    ALTER TABLE [dbo].[ConsultationRequests]
    ADD CONSTRAINT CK_ConsultationRequests_PatientStatus 
    CHECK ([PatientStatus] IN ('new', 'returning'));
    
    PRINT 'Check constraint CK_ConsultationRequests_PatientStatus added successfully';
END
ELSE
BEGIN
    PRINT 'Check constraint CK_ConsultationRequests_PatientStatus already exists';
END
GO

PRINT 'Migration completed successfully';
GO

