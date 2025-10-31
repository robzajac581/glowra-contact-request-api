-- Migration: Add Environment Column to ConsultationRequests
-- Purpose: Track which environment created each request to prevent cross-environment retries
-- Author: System
-- Date: October 31, 2025

-- Add Environment column if it doesn't exist
IF NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ConsultationRequests' AND COLUMN_NAME = 'Environment'
)
BEGIN
    -- Step 1: Add column as nullable first
    ALTER TABLE [dbo].[ConsultationRequests] 
    ADD [Environment] NVARCHAR(50) NULL;
    
    PRINT 'Environment column added to ConsultationRequests table';
END
ELSE
BEGIN
    PRINT 'Environment column already exists';
END
GO

-- Set default for existing rows (backfill) - only if column was just added
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ConsultationRequests' AND COLUMN_NAME = 'Environment'
)
BEGIN
    -- Backfill existing rows with 'production'
    UPDATE [dbo].[ConsultationRequests] 
    SET [Environment] = 'production'
    WHERE [Environment] IS NULL;
    
    PRINT 'Backfilled existing rows with production environment';
END
GO

-- Make it NOT NULL after backfill
IF EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_NAME = 'ConsultationRequests' 
  AND COLUMN_NAME = 'Environment' 
  AND IS_NULLABLE = 'YES'
)
BEGIN
    ALTER TABLE [dbo].[ConsultationRequests] 
    ALTER COLUMN [Environment] NVARCHAR(50) NOT NULL;
    
    PRINT 'Made Environment column NOT NULL';
END
GO

-- Add default constraint if it doesn't exist
IF NOT EXISTS (
  SELECT * FROM sys.default_constraints 
  WHERE parent_object_id = OBJECT_ID('ConsultationRequests') 
  AND name = 'DF_ConsultationRequests_Environment'
)
BEGIN
    ALTER TABLE [dbo].[ConsultationRequests] 
    ADD CONSTRAINT DF_ConsultationRequests_Environment DEFAULT 'production' FOR [Environment];
    
    PRINT 'Added default constraint for Environment column';
END
ELSE
BEGIN
    PRINT 'Default constraint already exists';
END
GO

-- Create index on Environment column for filtering performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConsultationRequests_Environment')
BEGIN
    CREATE INDEX IX_ConsultationRequests_Environment ON [dbo].[ConsultationRequests] ([Environment]);
    PRINT 'Created index IX_ConsultationRequests_Environment';
END
ELSE
BEGIN
    PRINT 'Index IX_ConsultationRequests_Environment already exists';
END
GO

-- Drop old composite index if it exists
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConsultationRequests_Status_RetryCount_CreatedAt')
BEGIN
    DROP INDEX IX_ConsultationRequests_Status_RetryCount_CreatedAt 
    ON [dbo].[ConsultationRequests];
    PRINT 'Dropped old composite index';
END
GO

-- Create new composite index with Environment
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt')
BEGIN
    CREATE INDEX IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt 
    ON [dbo].[ConsultationRequests] ([Environment], [Status], [RetryCount], [CreatedAt]);
    PRINT 'Created composite index IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt';
END
ELSE
BEGIN
    PRINT 'Index IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt already exists';
END
GO

PRINT 'Migration completed successfully';
GO

