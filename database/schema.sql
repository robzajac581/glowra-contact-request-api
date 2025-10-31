-- Migration: Create ConsultationRequests Table
-- Purpose: Initial schema for consultation request API - stores consultation requests with retry logic support
-- Author: System
-- Date: October 31, 2025

-- Create ConsultationRequests table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ConsultationRequests]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ConsultationRequests] (
        [RequestId] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [FirstName] NVARCHAR(255) NOT NULL,
        [LastName] NVARCHAR(255) NOT NULL,
        [Email] NVARCHAR(255) NOT NULL,
        [Phone] NVARCHAR(50) NULL,
        [Message] NVARCHAR(MAX) NULL,
        [ClinicId] NVARCHAR(255) NOT NULL,
        [ClinicName] NVARCHAR(255) NOT NULL,
        [SelectedProcedures] NVARCHAR(MAX) NULL, -- JSON stored as text
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'pending',
        [RetryCount] INT NOT NULL DEFAULT 0,
        [LastRetryAt] DATETIME2 NULL,
        [ErrorMessage] NVARCHAR(MAX) NULL,
        [Environment] NVARCHAR(50) NOT NULL DEFAULT 'production', -- Tracks which environment created the request
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    
    PRINT 'ConsultationRequests table created successfully';
END
ELSE
BEGIN
    PRINT 'ConsultationRequests table already exists';
END
GO

-- Create index on Status column
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConsultationRequests_Status')
BEGIN
    CREATE INDEX IX_ConsultationRequests_Status ON [dbo].[ConsultationRequests] ([Status]);
    PRINT 'Created index IX_ConsultationRequests_Status';
END
ELSE
BEGIN
    PRINT 'Index IX_ConsultationRequests_Status already exists';
END
GO

-- Create index on RetryCount column
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConsultationRequests_RetryCount')
BEGIN
    CREATE INDEX IX_ConsultationRequests_RetryCount ON [dbo].[ConsultationRequests] ([RetryCount]);
    PRINT 'Created index IX_ConsultationRequests_RetryCount';
END
ELSE
BEGIN
    PRINT 'Index IX_ConsultationRequests_RetryCount already exists';
END
GO

-- Create index on CreatedAt column
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConsultationRequests_CreatedAt')
BEGIN
    CREATE INDEX IX_ConsultationRequests_CreatedAt ON [dbo].[ConsultationRequests] ([CreatedAt]);
    PRINT 'Created index IX_ConsultationRequests_CreatedAt';
END
ELSE
BEGIN
    PRINT 'Index IX_ConsultationRequests_CreatedAt already exists';
END
GO

-- Create index on Environment column
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

-- Create composite index for retry query performance (Environment + Status + RetryCount + CreatedAt)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt')
BEGIN
    CREATE INDEX IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt 
    ON [dbo].[ConsultationRequests] ([Environment], [Status], [RetryCount], [CreatedAt]);
    PRINT 'Created index IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt';
END
ELSE
BEGIN
    PRINT 'Index IX_ConsultationRequests_Environment_Status_RetryCount_CreatedAt already exists';
END
GO

PRINT 'Migration completed successfully';
GO
