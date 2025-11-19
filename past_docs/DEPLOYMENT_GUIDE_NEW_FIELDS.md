# Deployment Guide: Patient Status and Procedure Type Fields

**Date**: November 19, 2025  
**Author**: Backend Team  
**Version**: 1.0

## Overview

This guide documents the addition of two new fields to the consultation request API:
- `patientStatus` - Indicates if the user is a new or returning patient
- `procedureType` - Indicates the type of procedure(s) the patient is interested in

## Changes Summary

### Database Changes
- Added `PatientStatus` column (NVARCHAR(20), NOT NULL, DEFAULT 'new')
- Added `ProcedureType` column (NVARCHAR(100), NOT NULL, DEFAULT 'Not specified')
- Added check constraint for PatientStatus (must be 'new' or 'returning')

### API Changes
- Added validation for `patientStatus` field (required, must be "new" or "returning")
- Added validation for `procedureType` field (required, max 100 characters)
- Both fields have default values for backward compatibility

### Email Changes
- Added "REQUEST DETAILS" section in forwarded emails
- Displays patient status as "New patient" or "Returning patient"
- Displays procedure type

## Deployment Steps

### 1. Database Migration

**IMPORTANT**: Run the database migration BEFORE deploying the application code.

```bash
# Navigate to the project directory
cd /path/to/glowra-contact-request-api

# Run the migration using the migration script
node scripts/runMigration.js database/migrations/003_add_patient_status_and_procedure_type.sql
```

**Verify the migration:**
```sql
-- Check if columns were added
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ConsultationRequests'
  AND COLUMN_NAME IN ('PatientStatus', 'ProcedureType');

-- Check if constraint was added
SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_NAME = 'ConsultationRequests'
  AND CONSTRAINT_NAME = 'CK_ConsultationRequests_PatientStatus';
```

**Expected output:**
- PatientStatus: NVARCHAR(20), NOT NULL, default 'new'
- ProcedureType: NVARCHAR(100), NOT NULL, default 'Not specified'
- Constraint: CK_ConsultationRequests_PatientStatus (CHECK)

### 2. Deploy Application Code

```bash
# Pull the latest code
git pull origin main

# Install any new dependencies (if needed)
npm install

# Restart the application
npm restart
```

### 3. Verify Deployment

#### Test with new fields:
```bash
curl -X POST http://localhost:3002/api/consultation-requests \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+1234567890",
    "message": "Interested in facial treatments",
    "patientStatus": "returning",
    "procedureType": "Face",
    "clinicId": "clinic-test-123",
    "clinicName": "Test Clinic",
    "selectedProcedures": [
      {
        "id": "proc-1",
        "name": "Botox",
        "price": 500
      }
    ]
  }'
```

**Expected response:**
```json
{
  "success": true,
  "requestId": "some-uuid",
  "message": "Consultation request received successfully"
}
```

#### Test backward compatibility (without new fields):
```bash
curl -X POST http://localhost:3002/api/consultation-requests \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "clinicId": "clinic-test-456",
    "clinicName": "Test Clinic 2"
  }'
```

**Expected behavior:**
- Request should succeed
- `patientStatus` defaults to "new"
- `procedureType` defaults to "Not specified"

#### Test validation:
```bash
# Test invalid patientStatus
curl -X POST http://localhost:3002/api/consultation-requests \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "patientStatus": "invalid",
    "procedureType": "Face",
    "clinicId": "clinic-123",
    "clinicName": "Test Clinic"
  }'
```

**Expected response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "patientStatus": "Patient status must be either \"new\" or \"returning\""
  }
}
```

### 4. Verify Email Format

Check the email forwarded to `csrequestforwarding@glowra.com` contains:

```
A new consultation request has been received:

CONTACT INFORMATION:
- Name: Jane Smith
- Email: jane.smith@example.com
- Phone: +1234567890

REQUEST DETAILS:
- Patient Status: Returning patient
- Procedure Type: Face

CLINIC INFORMATION:
- Clinic ID: clinic-test-123
- Clinic Name: Test Clinic

...
```

## Backward Compatibility

### Existing Requests
All existing requests in the database will automatically receive default values:
- `PatientStatus`: 'new'
- `ProcedureType`: 'Not specified'

These defaults are applied at the database level via column defaults.

### Old API Clients
API clients that don't send the new fields will continue to work:
- The validation middleware marks these fields as optional with defaults
- Missing values default to "new" and "Not specified" respectively
- No breaking changes to existing integrations

## Files Modified

### New Files
- `database/migrations/003_add_patient_status_and_procedure_type.sql` - Database migration

### Modified Files
- `database/schema.sql` - Updated table definition
- `middleware/validation.js` - Added validation rules for new fields
- `services/consultationRequestService.js` - Updated to handle new fields
- `utils/emailService.js` - Updated email format to include new fields
- `README.md` - Updated API documentation

## Rollback Plan

If issues arise, you can rollback by:

1. **Revert application code:**
```bash
git revert <commit-hash>
npm restart
```

2. **Remove database columns (if needed):**
```sql
-- WARNING: This will delete data in these columns
ALTER TABLE ConsultationRequests DROP CONSTRAINT CK_ConsultationRequests_PatientStatus;
ALTER TABLE ConsultationRequests DROP COLUMN PatientStatus;
ALTER TABLE ConsultationRequests DROP COLUMN ProcedureType;
```

**Note:** It's generally safe to leave the columns in place even if you revert the code, as they have default values.

## Support

If you encounter any issues during deployment:
1. Check application logs for errors
2. Verify database migration completed successfully
3. Test the API endpoints manually
4. Check email service logs to ensure emails are being sent correctly

## Frontend Coordination

The frontend team can deploy their changes once this backend deployment is complete. They should verify:
- The API accepts the new fields
- Default values work correctly for backward compatibility
- Validation errors are displayed properly for invalid values

## Environment Variables

No new environment variables are required for this deployment.

## Testing Checklist

- [ ] Database migration completed successfully
- [ ] Application deployed and restarted
- [ ] Health check endpoint responds (GET /health)
- [ ] POST request with new fields succeeds
- [ ] POST request without new fields succeeds (backward compatibility)
- [ ] Invalid patientStatus returns validation error
- [ ] Email includes new fields in "REQUEST DETAILS" section
- [ ] Retry mechanism still works for failed requests
- [ ] Existing requests can be retrieved with new fields

## Success Criteria

Deployment is successful when:
1. All database columns are added
2. API accepts both old and new request formats
3. Emails include the new fields
4. No errors in application logs
5. Health check passes
6. Frontend team confirms they can submit requests with new fields

