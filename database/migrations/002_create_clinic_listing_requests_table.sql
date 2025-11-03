-- Migration: Create ClinicListingRequests Table
-- Purpose: Schema for clinic listing request API - stores clinic listing requests (new listings and adjustments)
-- Author: System
-- Date: 2025

-- Create ClinicListingRequests table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ClinicListingRequests]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ClinicListingRequests] (
        [RequestId] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [ClinicName] NVARCHAR(255) NOT NULL,
        [City] NVARCHAR(255) NOT NULL,
        [State] NVARCHAR(255) NOT NULL,
        [Address] NVARCHAR(500) NOT NULL,
        [Website] NVARCHAR(500) NULL,
        [ClinicCategory] NVARCHAR(255) NULL,
        [PrimaryContactName] NVARCHAR(255) NULL,
        [Email] NVARCHAR(255) NOT NULL,
        [Phone] NVARCHAR(50) NULL,
        [AdditionalDetails] NVARCHAR(MAX) NULL,
        [Message] NVARCHAR(MAX) NULL,
        [RequestType] NVARCHAR(50) NOT NULL CHECK ([RequestType] IN ('new', 'adjustment')),
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'sent',
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    
    PRINT 'ClinicListingRequests table created successfully';
END
ELSE
BEGIN
    PRINT 'ClinicListingRequests table already exists';
END
GO

-- Create index on Status column
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ClinicListingRequests_Status')
BEGIN
    CREATE INDEX IX_ClinicListingRequests_Status ON [dbo].[ClinicListingRequests] ([Status]);
    PRINT 'Created index IX_ClinicListingRequests_Status';
END
ELSE
BEGIN
    PRINT 'Index IX_ClinicListingRequests_Status already exists';
END
GO

-- Create index on CreatedAt column
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ClinicListingRequests_CreatedAt')
BEGIN
    CREATE INDEX IX_ClinicListingRequests_CreatedAt ON [dbo].[ClinicListingRequests] ([CreatedAt]);
    PRINT 'Created index IX_ClinicListingRequests_CreatedAt';
END
ELSE
BEGIN
    PRINT 'Index IX_ClinicListingRequests_CreatedAt already exists';
END
GO

-- Create index on RequestType column
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ClinicListingRequests_RequestType')
BEGIN
    CREATE INDEX IX_ClinicListingRequests_RequestType ON [dbo].[ClinicListingRequests] ([RequestType]);
    PRINT 'Created index IX_ClinicListingRequests_RequestType';
END
ELSE
BEGIN
    PRINT 'Index IX_ClinicListingRequests_RequestType already exists';
END
GO

PRINT 'Migration completed successfully';
GO

