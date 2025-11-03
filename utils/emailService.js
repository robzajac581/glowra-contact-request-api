const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Format email body according to SLA specification
 */
function formatEmailBody(request) {
  const { firstName, lastName, email, phone, message, clinicId, clinicName, selectedProcedures } = request;
  
  let body = 'A new consultation request has been received:\n\n';
  
  body += 'CONTACT INFORMATION:\n';
  body += `- Name: ${firstName} ${lastName}\n`;
  body += `- Email: ${email}\n`;
  body += `- Phone: ${phone || '(not provided)'}\n`;
  body += '\n';
  
  body += 'CLINIC INFORMATION:\n';
  body += `- Clinic ID: ${clinicId}\n`;
  body += `- Clinic Name: ${clinicName}\n`;
  body += '\n';
  
  if (selectedProcedures && selectedProcedures.length > 0) {
    body += 'SELECTED PROCEDURES:\n';
    let total = 0;
    selectedProcedures.forEach((proc, index) => {
      const price = proc.price || 0;
      total += price;
      body += `${index + 1}. ${proc.name} - $${price.toFixed(2)}\n`;
    });
    body += `\nTotal Estimate: $${total.toFixed(2)}\n`;
    body += '\n';
  }
  
  if (message) {
    body += 'MESSAGE:\n';
    body += `${message}\n`;
    body += '\n';
  }
  
  body += '---\n';
  body += `Request ID: ${request.requestId}\n`;
  body += `Submitted: ${new Date(request.createdAt).toISOString().replace('T', ' ').substring(0, 19)} UTC\n`;
  
  return body;
}

/**
 * Send consultation request email
 * @param {Object} request - The consultation request object
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendConsultationRequestEmail(request) {
  try {
    const emailTo = process.env.CONSULTATION_REQUEST_EMAIL_TO || 'csrequestforwarding@glowra.com';
    const emailFrom = process.env.EMAIL_FROM || 'noreply@glowra.com';
    const subject = `New Consultation Request - ${request.clinicName} - ${request.requestId}`;
    const body = formatEmailBody(request);
    
    const msg = {
      to: emailTo,
      from: emailFrom,
      subject: subject,
      text: body
    };
    
    await sgMail.send(msg);
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid email error:', error);
    
    // Extract error message
    let errorMessage = 'Email sending failed';
    if (error.response) {
      errorMessage = error.response.body?.errors?.[0]?.message || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Format clinic listing email body
 */
function formatClinicListingEmailBody(request) {
  const { clinicName, city, state, address, website, clinicCategory, primaryContactName, email, phone, additionalDetails, message, requestType, requestId, createdAt } = request;
  
  const requestTypeLabel = requestType === 'new' ? 'New Clinic Listing' : 'Clinic Listing Adjustment';
  
  let body = `A new clinic listing request has been received:\n\n`;
  body += `REQUEST TYPE: ${requestTypeLabel}\n\n`;
  
  body += 'CLINIC INFORMATION:\n';
  body += `- Clinic Name: ${clinicName}\n`;
  body += `- Address: ${address}\n`;
  body += `- City: ${city}\n`;
  body += `- State: ${state}\n`;
  if (website) {
    body += `- Website: ${website}\n`;
  }
  if (clinicCategory) {
    body += `- Category: ${clinicCategory}\n`;
  }
  body += '\n';
  
  body += 'CONTACT INFORMATION:\n';
  body += `- Email: ${email}\n`;
  if (primaryContactName) {
    body += `- Primary Contact Name: ${primaryContactName}\n`;
  }
  if (phone) {
    body += `- Phone: ${phone}\n`;
  }
  body += '\n';
  
  if (additionalDetails) {
    body += 'ADDITIONAL DETAILS:\n';
    body += `${additionalDetails}\n`;
    body += '\n';
  }
  
  if (message) {
    body += 'MESSAGE TO GLOWRA:\n';
    body += `${message}\n`;
    body += '\n';
  }
  
  body += '---\n';
  body += `Request ID: ${requestId}\n`;
  body += `Submitted: ${new Date(createdAt).toISOString().replace('T', ' ').substring(0, 19)} UTC\n`;
  
  return body;
}

/**
 * Send clinic listing request email
 * @param {Object} request - The clinic listing request object
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendClinicListingEmail(request) {
  try {
    const emailTo = process.env.CLINIC_LISTING_EMAIL_TO || 'list@glowra.com';
    const emailFrom = process.env.EMAIL_FROM || 'noreply@glowra.com';
    const requestTypeLabel = request.requestType === 'new' ? 'New Listing' : 'Adjustment';
    const subject = `New Clinic Listing Request - ${requestTypeLabel} - ${request.clinicName} - ${request.requestId}`;
    const body = formatClinicListingEmailBody(request);
    
    const msg = {
      to: emailTo,
      from: emailFrom,
      subject: subject,
      text: body
    };
    
    await sgMail.send(msg);
    
    return { success: true };
  } catch (error) {
    console.error('SendGrid email error:', error);
    
    // Extract error message
    let errorMessage = 'Email sending failed';
    if (error.response) {
      errorMessage = error.response.body?.errors?.[0]?.message || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { success: false, error: errorMessage };
  }
}

module.exports = {
  sendConsultationRequestEmail,
  sendClinicListingEmail,
  formatEmailBody,
  formatClinicListingEmailBody
};

