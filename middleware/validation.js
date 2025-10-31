const { body, validationResult } = require('express-validator');

/**
 * Validation rules for consultation request
 */
const consultationRequestValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 255 })
    .withMessage('First name must be less than 255 characters'),
  
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 255 })
    .withMessage('Last name must be less than 255 characters'),
  
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('phone')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),
  
  body('message')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Message must be less than 5000 characters'),
  
  body('clinicId')
    .trim()
    .notEmpty()
    .withMessage('Clinic ID is required')
    .isLength({ max: 255 })
    .withMessage('Clinic ID must be less than 255 characters'),
  
  body('clinicName')
    .trim()
    .notEmpty()
    .withMessage('Clinic name is required')
    .isLength({ max: 255 })
    .withMessage('Clinic name must be less than 255 characters'),
  
  body('selectedProcedures')
    .optional()
    .isArray()
    .withMessage('Selected procedures must be an array'),
  
  body('selectedProcedures.*.id')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Procedure ID must be less than 255 characters'),
  
  body('selectedProcedures.*.name')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Procedure name must be less than 255 characters'),
  
  body('selectedProcedures.*.price')
    .optional()
    .isNumeric()
    .withMessage('Procedure price must be a number')
];

/**
 * Middleware to handle validation errors
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = {};
    errors.array().forEach(error => {
      // Extract field name from error path
      const field = error.path || error.param;
      if (!errorDetails[field]) {
        errorDetails[field] = error.msg;
      }
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorDetails
    });
  }
  
  next();
}

module.exports = {
  consultationRequestValidation,
  handleValidationErrors
};

