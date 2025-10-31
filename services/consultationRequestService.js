const { getPool, sql } = require('../db');
const { sendConsultationRequestEmail } = require('../utils/emailService');
const { randomUUID } = require('crypto');
require('dotenv').config();

// Get current environment (defaults to 'production' if not set)
const getCurrentEnvironment = () => {
  return process.env.NODE_ENV || 'production';
};

/**
 * Create a new consultation request and attempt to send email
 */
async function createRequest(requestData) {
  const pool = await getPool();
  const requestId = randomUUID();
  const createdAt = new Date();
  
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    
    // Insert request into database
    const request = new sql.Request(transaction);
    
    const selectedProceduresJson = JSON.stringify(requestData.selectedProcedures || []);
    const environment = getCurrentEnvironment();
    
    const insertQuery = `
      INSERT INTO ConsultationRequests 
      (RequestId, FirstName, LastName, Email, Phone, Message, ClinicId, ClinicName, 
       SelectedProcedures, Status, RetryCount, Environment, CreatedAt)
      VALUES 
      (@requestId, @firstName, @lastName, @email, @phone, @message, @clinicId, 
       @clinicName, @selectedProcedures, @status, @retryCount, @environment, @createdAt)
    `;
    
    request.input('requestId', sql.UniqueIdentifier, requestId);
    request.input('firstName', sql.NVarChar, requestData.firstName);
    request.input('lastName', sql.NVarChar, requestData.lastName);
    request.input('email', sql.NVarChar, requestData.email);
    request.input('phone', sql.NVarChar, requestData.phone || null);
    request.input('message', sql.NVarChar, requestData.message || null);
    request.input('clinicId', sql.NVarChar, requestData.clinicId);
    request.input('clinicName', sql.NVarChar, requestData.clinicName);
    request.input('selectedProcedures', sql.NVarChar(sql.MAX), selectedProceduresJson);
    request.input('status', sql.NVarChar, 'pending');
    request.input('retryCount', sql.Int, 0);
    request.input('environment', sql.NVarChar, environment);
    request.input('createdAt', sql.DateTime2, createdAt);
    
    await request.query(insertQuery);
    
    await transaction.commit();
    
    // Attempt to send email immediately
    const requestObj = {
      requestId,
      firstName: requestData.firstName,
      lastName: requestData.lastName,
      email: requestData.email,
      phone: requestData.phone,
      message: requestData.message,
      clinicId: requestData.clinicId,
      clinicName: requestData.clinicName,
      selectedProcedures: requestData.selectedProcedures || [],
      createdAt
    };
    
    // Try to send email (non-blocking - if it fails, retry worker will handle it)
    sendEmail(requestId, requestObj).catch(err => {
      console.error(`Failed to send email for request ${requestId}:`, err);
    });
    
    return {
      requestId,
      status: 'pending',
      createdAt
    };
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating consultation request:', error);
    throw error;
  }
}

/**
 * Atomically claim a request for processing (prevents multiple instances from processing same request)
 * Returns true if successfully claimed, false if already claimed by another instance
 * Also ensures requests are only processed by instances in the same environment
 */
async function claimRequestForProcessing(requestId) {
  const pool = await getPool();
  const request = new sql.Request(pool);
  const environment = getCurrentEnvironment();
  
  // Atomically update status to 'processing' only if:
  // 1. It's still eligible (pending/retrying/failed)
  // 2. It belongs to the same environment
  // 3. Retry count hasn't exceeded limit
  // This prevents race conditions AND cross-environment processing
  const claimQuery = `
    UPDATE ConsultationRequests 
    SET Status = 'processing'
    WHERE RequestId = @requestId 
      AND Status IN ('pending', 'retrying', 'failed')
      AND RetryCount < 6
      AND Environment = @environment
  `;
  
  request.input('requestId', sql.UniqueIdentifier, requestId);
  request.input('environment', sql.NVarChar, environment);
  const result = await request.query(claimQuery);
  
  // Return true if a row was updated (successfully claimed), false otherwise
  return result.rowsAffected[0] > 0;
}

/**
 * Send email for a consultation request
 */
async function sendEmail(requestId, requestData) {
  const pool = await getPool();
  
  try {
    // Atomically claim this request for processing
    // If another instance already claimed it, return early
    const claimed = await claimRequestForProcessing(requestId);
    if (!claimed) {
      console.log(`Request ${requestId} already being processed by another instance`);
      return { success: false, error: 'Request already being processed' };
    }
    
    // Attempt to send email
    const result = await sendConsultationRequestEmail({
      requestId,
      ...requestData
    });
    
    if (result.success) {
      // Update status to sent
      await updateRequestStatus(requestId, 'sent');
      return { success: true };
    } else {
      // Update status to retrying and increment retry count
      const request = await getRequestById(requestId);
      if (request) {
        const newRetryCount = request.retryCount + 1;
        const status = newRetryCount >= 6 ? 'failed' : 'retrying';
        
        const updateRequest = new sql.Request(pool);
        const updateQuery = `
          UPDATE ConsultationRequests 
          SET Status = @status, 
              RetryCount = @retryCount,
              LastRetryAt = @lastRetryAt,
              ErrorMessage = @errorMessage
          WHERE RequestId = @requestId
        `;
        
        updateRequest.input('requestId', sql.UniqueIdentifier, requestId);
        updateRequest.input('status', sql.NVarChar, status);
        updateRequest.input('retryCount', sql.Int, newRetryCount);
        updateRequest.input('lastRetryAt', sql.DateTime2, new Date());
        updateRequest.input('errorMessage', sql.NVarChar(sql.MAX), result.error || null);
        
        await updateRequest.query(updateQuery);
      }
      
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error(`Error sending email for request ${requestId}:`, error);
    
    // Update status to retrying
    const request = await getRequestById(requestId);
    if (request) {
      const newRetryCount = request.retryCount + 1;
      const status = newRetryCount >= 6 ? 'failed' : 'retrying';
      
      const updateRequest = new sql.Request(pool);
      const updateQuery = `
        UPDATE ConsultationRequests 
        SET Status = @status, 
            RetryCount = @retryCount,
            LastRetryAt = @lastRetryAt,
            ErrorMessage = @errorMessage
        WHERE RequestId = @requestId
      `;
      
      updateRequest.input('requestId', sql.UniqueIdentifier, requestId);
      updateRequest.input('status', sql.NVarChar, status);
      updateRequest.input('retryCount', sql.Int, newRetryCount);
      updateRequest.input('lastRetryAt', sql.DateTime2, new Date());
      updateRequest.input('errorMessage', sql.NVarChar(sql.MAX), error.message || 'Unknown error');
      
      await updateRequest.query(updateQuery);
    }
    
    return { success: false, error: error.message };
  }
}

/**
 * Update request status
 */
async function updateRequestStatus(requestId, status) {
  const pool = await getPool();
  const request = new sql.Request(pool);
  
  const updateQuery = `
    UPDATE ConsultationRequests 
    SET Status = @status
    WHERE RequestId = @requestId
  `;
  
  request.input('requestId', sql.UniqueIdentifier, requestId);
  request.input('status', sql.NVarChar, status);
  
  await request.query(updateQuery);
}

/**
 * Get request by ID
 */
async function getRequestById(requestId) {
  const pool = await getPool();
  const request = new sql.Request(pool);
  
  const selectQuery = `
    SELECT RequestId, FirstName, LastName, Email, Phone, Message, 
           ClinicId, ClinicName, SelectedProcedures, Status, RetryCount, 
           LastRetryAt, ErrorMessage, CreatedAt
    FROM ConsultationRequests
    WHERE RequestId = @requestId
  `;
  
  request.input('requestId', sql.UniqueIdentifier, requestId);
  
  const result = await request.query(selectQuery);
  
  if (result.recordset.length === 0) {
    return null;
  }
  
  const row = result.recordset[0];
  return {
    requestId: row.RequestId,
    firstName: row.FirstName,
    lastName: row.LastName,
    email: row.Email,
    phone: row.Phone,
    message: row.Message,
    clinicId: row.ClinicId,
    clinicName: row.ClinicName,
    selectedProcedures: JSON.parse(row.SelectedProcedures || '[]'),
    status: row.Status,
    retryCount: row.RetryCount,
    lastRetryAt: row.LastRetryAt,
    errorMessage: row.ErrorMessage,
    createdAt: row.CreatedAt
  };
}

/**
 * Reprocess a request (reset retry count and set status to retrying)
 */
async function reprocessRequest(requestId) {
  const pool = await getPool();
  const request = new sql.Request(pool);
  
  const updateQuery = `
    UPDATE ConsultationRequests 
    SET Status = @status, 
        RetryCount = @retryCount,
        LastRetryAt = NULL,
        ErrorMessage = NULL
    WHERE RequestId = @requestId
  `;
  
  request.input('requestId', sql.UniqueIdentifier, requestId);
  request.input('status', sql.NVarChar, 'retrying');
  request.input('retryCount', sql.Int, 0);
  
  await request.query(updateQuery);
  
  return await getRequestById(requestId);
}

/**
 * Get pending requests that need retry processing
 * Returns requests that are eligible for retry based on exponential backoff schedule
 * Note: This only SELECTs requests - actual processing uses atomic updates to prevent race conditions
 */
async function getPendingRetries() {
  const pool = await getPool();
  const request = new sql.Request(pool);
  
  // Retry schedule: 5min, 30min, 2hr, 12hr, 24hr
  const retryIntervals = [5, 30, 120, 720, 1440]; // in minutes
  
  const now = new Date();
  const environment = getCurrentEnvironment();
  
  // Only select requests that:
  // 1. Are NOT currently being processed
  // 2. Belong to the same environment (prevents cross-environment retries)
  // 3. Meet retry eligibility criteria
  const selectQuery = `
    SELECT RequestId, FirstName, LastName, Email, Phone, Message, 
           ClinicId, ClinicName, SelectedProcedures, Status, RetryCount, 
           LastRetryAt, ErrorMessage, CreatedAt
    FROM ConsultationRequests
    WHERE Status IN ('pending', 'retrying', 'failed')
      AND Status != 'processing'  -- Exclude requests currently being processed
      AND Environment = @environment  -- Only process requests from same environment
      AND RetryCount < 6
      AND (
        -- For pending requests (initial attempt failed), retry after 5 minutes
        (Status = 'pending' AND DATEDIFF(MINUTE, CreatedAt, @now) >= 5)
        OR
        -- For retrying/failed requests, check based on retry count
        -- retryCount=1 means initial attempt failed, so first retry should be at 5 minutes
        -- retryCount=2 means first retry failed, so second retry should be at 30 minutes
        -- retryCount=3 means second retry failed, so third retry should be at 2 hours
        -- retryCount=4 means third retry failed, so fourth retry should be at 12 hours
        -- retryCount=5 means fourth retry failed, so fifth retry should be at 24 hours
        (Status IN ('retrying', 'failed') AND 
         DATEDIFF(MINUTE, CreatedAt, @now) >= 
         CASE RetryCount
           WHEN 1 THEN 5
           WHEN 2 THEN 30
           WHEN 3 THEN 120
           WHEN 4 THEN 720
           WHEN 5 THEN 1440
           ELSE 999999
         END)
      )
    ORDER BY CreatedAt ASC
  `;
  
  request.input('now', sql.DateTime2, now);
  request.input('environment', sql.NVarChar, environment);
  
  const result = await request.query(selectQuery);
  
  return result.recordset.map(row => ({
    requestId: row.RequestId,
    firstName: row.FirstName,
    lastName: row.LastName,
    email: row.Email,
    phone: row.Phone,
    message: row.Message,
    clinicId: row.ClinicId,
    clinicName: row.ClinicName,
    selectedProcedures: JSON.parse(row.SelectedProcedures || '[]'),
    status: row.Status,
    retryCount: row.RetryCount,
    lastRetryAt: row.LastRetryAt,
    errorMessage: row.ErrorMessage,
    createdAt: row.CreatedAt
  }));
}

module.exports = {
  createRequest,
  sendEmail,
  getRequestById,
  reprocessRequest,
  getPendingRetries
};

