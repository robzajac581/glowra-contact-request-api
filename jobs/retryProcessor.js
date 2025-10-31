const cron = require('node-cron');
const consultationRequestService = require('../services/consultationRequestService');

/**
 * Process pending retries with exponential backoff
 */
async function processRetries() {
  try {
    console.log('[Retry Processor] Starting retry processing cycle...');
    
    const pendingRequests = await consultationRequestService.getPendingRetries();
    
    console.log(`[Retry Processor] Found ${pendingRequests.length} requests eligible for retry`);
    
    for (const request of pendingRequests) {
      try {
        console.log(`[Retry Processor] Processing request ${request.requestId} (retry ${request.retryCount + 1})`);
        
        const requestData = {
          requestId: request.requestId,
          firstName: request.firstName,
          lastName: request.lastName,
          email: request.email,
          phone: request.phone,
          message: request.message,
          clinicId: request.clinicId,
          clinicName: request.clinicName,
          selectedProcedures: request.selectedProcedures,
          createdAt: request.createdAt
        };
        
        await consultationRequestService.sendEmail(request.requestId, requestData);
        
        console.log(`[Retry Processor] Completed processing request ${request.requestId}`);
      } catch (error) {
        console.error(`[Retry Processor] Error processing request ${request.requestId}:`, error);
      }
    }
    
    console.log('[Retry Processor] Retry processing cycle completed');
  } catch (error) {
    console.error('[Retry Processor] Error in retry processing cycle:', error);
  }
}

/**
 * Initialize the retry processor cron job
 * Runs every 5 minutes
 */
function initializeRetryProcessor() {
  // Run every 5 minutes: */5 * * * *
  cron.schedule('*/5 * * * *', () => {
    processRetries();
  });
  
  console.log('Retry processor initialized - will run every 5 minutes');
  
  // Run immediately on startup to catch any pending requests
  processRetries();
}

module.exports = {
  initializeRetryProcessor,
  processRetries
};

