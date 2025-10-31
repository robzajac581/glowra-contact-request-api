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
    const emailTo = process.env.EMAIL_TO || 'csrequestforwarding@glowra.com';
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

module.exports = {
  sendConsultationRequestEmail,
  formatEmailBody
};

