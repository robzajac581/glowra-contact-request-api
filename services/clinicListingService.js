const { getPool, sql } = require('../db');
const { sendClinicListingEmail } = require('../utils/emailService');
const { randomUUID } = require('crypto');

/**
 * Create a new clinic listing request and send email
 */
async function createListingRequest(requestData) {
  const pool = await getPool();
  const requestId = randomUUID();
  const createdAt = new Date();
  
  const transaction = new sql.Transaction(pool);
  
  try {
    await transaction.begin();
    
    // Insert request into database
    const request = new sql.Request(transaction);
    
    const insertQuery = `
      INSERT INTO ClinicListingRequests 
      (RequestId, ClinicName, City, State, Address, Website, ClinicCategory, PrimaryContactName, 
       Email, Phone, AdditionalDetails, Message, RequestType, Status, CreatedAt)
      VALUES 
      (@requestId, @clinicName, @city, @state, @address, @website, @clinicCategory, @primaryContactName, 
       @email, @phone, @additionalDetails, @message, @requestType, @status, @createdAt)
    `;
    
    request.input('requestId', sql.UniqueIdentifier, requestId);
    request.input('clinicName', sql.NVarChar, requestData.clinicName);
    request.input('city', sql.NVarChar, requestData.city);
    request.input('state', sql.NVarChar, requestData.state);
    request.input('address', sql.NVarChar, requestData.address);
    request.input('website', sql.NVarChar, requestData.website || null);
    request.input('clinicCategory', sql.NVarChar, requestData.clinicCategory || null);
    request.input('primaryContactName', sql.NVarChar, requestData.primaryContactName || null);
    request.input('email', sql.NVarChar, requestData.email);
    request.input('phone', sql.NVarChar, requestData.phone || null);
    request.input('additionalDetails', sql.NVarChar(sql.MAX), requestData.additionalDetails || null);
    request.input('message', sql.NVarChar(sql.MAX), requestData.message || null);
    request.input('requestType', sql.NVarChar, requestData.requestType);
    request.input('status', sql.NVarChar, 'sent');
    request.input('createdAt', sql.DateTime2, createdAt);
    
    await request.query(insertQuery);
    
    await transaction.commit();
    
    // Prepare request object for email
    const requestObj = {
      requestId,
      clinicName: requestData.clinicName,
      city: requestData.city,
      state: requestData.state,
      address: requestData.address,
      website: requestData.website,
      clinicCategory: requestData.clinicCategory,
      primaryContactName: requestData.primaryContactName,
      email: requestData.email,
      phone: requestData.phone,
      additionalDetails: requestData.additionalDetails,
      message: requestData.message,
      requestType: requestData.requestType,
      createdAt
    };
    
    // Send email synchronously
    const emailResult = await sendClinicListingEmail(requestObj);
    
    // If email fails, update status to failed
    if (!emailResult.success) {
      const updateRequest = new sql.Request(pool);
      const updateQuery = `
        UPDATE ClinicListingRequests 
        SET Status = @status
        WHERE RequestId = @requestId
      `;
      
      updateRequest.input('requestId', sql.UniqueIdentifier, requestId);
      updateRequest.input('status', sql.NVarChar, 'failed');
      
      await updateRequest.query(updateQuery);
      
      console.error(`Failed to send email for clinic listing request ${requestId}:`, emailResult.error);
    }
    
    return {
      requestId,
      status: emailResult.success ? 'sent' : 'failed',
      createdAt
    };
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating clinic listing request:', error);
    throw error;
  }
}

module.exports = {
  createListingRequest
};

