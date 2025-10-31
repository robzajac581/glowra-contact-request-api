const express = require('express');
const router = express.Router();
const consultationRequestService = require('../services/consultationRequestService');
const { consultationRequestValidation, handleValidationErrors } = require('../middleware/validation');

/**
 * POST /api/consultation-requests
 * Create a new consultation request
 */
router.post('/', consultationRequestValidation, handleValidationErrors, async (req, res) => {
  let requestId = null;
  
  try {
    const result = await consultationRequestService.createRequest(req.body);
    requestId = result.requestId;
    
    res.status(200).json({
      success: true,
      requestId: result.requestId,
      message: 'Consultation request received successfully'
    });
  } catch (error) {
    console.error('Error creating consultation request:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId: requestId || null
    });
  }
});

/**
 * POST /api/consultation-requests/:requestId/reprocess
 * Manually reprocess a failed or pending request
 */
router.post('/:requestId/reprocess', async (req, res) => {
  try {
    const { requestId } = req.params;
    
    // Validate requestId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(requestId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request ID format'
      });
    }
    
    const request = await consultationRequestService.getRequestById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    await consultationRequestService.reprocessRequest(requestId);
    
    // Queue for immediate processing
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
    
    // Attempt to send email immediately
    consultationRequestService.sendEmail(requestId, requestData).catch(err => {
      console.error(`Failed to send email for reprocessed request ${requestId}:`, err);
    });
    
    res.status(200).json({
      success: true,
      message: 'Request queued for reprocessing',
      requestId: requestId,
      status: 'retrying'
    });
  } catch (error) {
    console.error('Error reprocessing request:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

