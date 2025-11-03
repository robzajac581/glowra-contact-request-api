const express = require('express');
const router = express.Router();
const clinicListingService = require('../services/clinicListingService');
const { clinicListingRequestValidation, handleValidationErrors } = require('../middleware/validation');

/**
 * POST /api/clinic-listing-requests
 * Create a new clinic listing request (new listing or adjustment)
 */
router.post('/', clinicListingRequestValidation, handleValidationErrors, async (req, res) => {
  try {
    const result = await clinicListingService.createListingRequest(req.body);
    
    res.status(200).json({
      success: true,
      requestId: result.requestId,
      status: result.status,
      message: 'Clinic listing request received successfully'
    });
  } catch (error) {
    console.error('Error creating clinic listing request:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

