-- Migration: Make ProcedureType nullable
-- Purpose: Remove procedureType requirement as frontend no longer sends this field
-- Author: System
-- Date: January 25, 2026

-- Make ProcedureType column nullable
IF EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[ConsultationRequests]') 
    AND name = 'ProcedureType'
    AND is_nullable = 0
)
BEGIN
    ALTER TABLE [dbo].[ConsultationRequests]
    ALTER COLUMN [ProcedureType] NVARCHAR(100) NULL;
    
    PRINT 'ProcedureType column made nullable successfully';
END
ELSE
BEGIN
    PRINT 'ProcedureType column is already nullable or does not exist';
END
GO

PRINT 'Migration completed successfully';
GO
