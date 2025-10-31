-- Query to verify ConsultationRequests table and recent records

-- Check recent requests
SELECT TOP 10
    RequestId,
    FirstName,
    LastName,
    Email,
    ClinicName,
    Status,
    RetryCount,
    CreatedAt
FROM ConsultationRequests
ORDER BY CreatedAt DESC;

-- Check status distribution
SELECT 
    Status,
    COUNT(*) as Count
FROM ConsultationRequests
GROUP BY Status;
