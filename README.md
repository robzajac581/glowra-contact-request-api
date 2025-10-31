# Glowra Contact Request API

Handles consultation requests and other contact requests with automatic email forwarding, retry logic, and manual reprocessing capabilities.

## Overview

This API receives consultation requests from the frontend, stores them in a database, forwards them via email to `csrequestforwarding@glowra.com`, and includes automatic retry logic with exponential backoff to ensure requests don't get lost.

## Features

- RESTful API endpoints for consultation requests
- Automatic email forwarding via SendGrid
- Database storage with SQL Server
- Automatic retry mechanism with exponential backoff (5min, 30min, 2hr, 12hr, 24hr)
- Background worker for processing retries (runs every 5 minutes)
- Manual reprocessing endpoint for failed requests
- Comprehensive request validation
- Error handling and logging

## Tech Stack

- **Runtime**: Node.js (v18+ LTS)
- **Framework**: Express.js (v4.21+)
- **Database**: Microsoft SQL Server with mssql package (v11.0+)
- **Email**: SendGrid API
- **Scheduling**: node-cron (v4.2+) for background retry jobs
- **Validation**: express-validator

## Prerequisites

- Node.js v18+ installed
- Microsoft SQL Server database
- SendGrid account and API key
- ODBC Driver 17 for SQL Server (for database connections)

## Setup

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Create the database table:**
   Run the SQL script in `database/schema.sql` to create the `ConsultationRequests` table:
   ```sql
   -- Execute database/schema.sql in your SQL Server database
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your configuration:
   ```bash
   cp .env.example .env
   ```

   Required environment variables:
   ```env
   DB_SERVER=your-sql-server-host
   DB_NAME=your-database-name
   DB_USER=your-database-user
   DB_PASSWORD=your-database-password
   
   SENDGRID_API_KEY=your-sendgrid-api-key
   EMAIL_FROM=noreply@glowra.com
   EMAIL_TO=csrequestforwarding@glowra.com
   
   PORT=3002
   NODE_ENV=development
   TZ=UTC
   ```

4. **Start the server:**
   ```bash
   npm start
   ```
   
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### POST `/api/consultation-requests`

Create a new consultation request.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "message": "I'm interested in Botox treatments",
  "clinicId": "clinic-123",
  "clinicName": "Beautiful Skin Clinic",
  "selectedProcedures": [
    {
      "id": "proc-1",
      "name": "Botox Injection",
      "price": 500.00
    }
  ]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "requestId": "req-abc123xyz",
  "message": "Consultation request received successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "firstName": "First name is required",
    "email": "Invalid email format"
  }
}
```

### POST `/api/consultation-requests/:requestId/reprocess`

Manually reprocess a failed or pending request.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Request queued for reprocessing",
  "requestId": "req-abc123xyz",
  "status": "retrying"
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Request not found"
}
```

### GET `/health`

Health check endpoint.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T14:30:00.000Z"
}
```

## Retry Logic

The system automatically retries failed email sends with exponential backoff:

- **Retry 1**: 5 minutes after creation/failure
- **Retry 2**: 30 minutes after creation
- **Retry 3**: 2 hours after creation
- **Retry 4**: 12 hours after creation
- **Retry 5**: 24 hours after creation

A background worker runs every 5 minutes to process eligible retries. After 5 failed attempts, the request status is set to `failed` and no further automatic retries occur. Manual reprocessing can be triggered via the reprocess endpoint.

## Request Statuses

- `pending`: Initial state, not yet processed
- `processing`: Currently being processed
- `sent`: Successfully sent via email
- `retrying`: Currently in retry queue
- `failed`: Failed after all retries exhausted

## Email Format

Emails sent to `csrequestforwarding@glowra.com` include:

- Contact information (name, email, phone)
- Clinic information (ID and name)
- Selected procedures with prices
- Total estimate
- Optional message from the requester
- Request ID and submission timestamp

## Project Structure

```
├── app.js                          # Main application entry point
├── db.js                           # Database connection pool
├── routes/
│   └── consultationRequests.js     # API route handlers
├── services/
│   └── consultationRequestService.js  # Business logic
├── jobs/
│   └── retryProcessor.js           # Background retry worker
├── utils/
│   └── emailService.js             # Email sending logic
├── middleware/
│   └── validation.js               # Request validation
├── database/
│   └── schema.sql                  # Database schema
└── package.json                    # Dependencies
```

## Development

The API follows the same architecture pattern as the neighboring Glowra Search API:

- Connection pooling pattern for database (`db.js`)
- Service layer pattern for business logic (`services/`)
- Route handlers for API endpoints (`routes/`)
- Scheduled jobs for background tasks (`jobs/`)
- Utility modules for external integrations (`utils/`)

## Error Handling

- Validation errors return 400 with detailed field-level error messages
- Server errors return 500 with requestId included (if available)
- All errors are logged with context
- Requests are stored even if initial processing fails

## License

ISC
