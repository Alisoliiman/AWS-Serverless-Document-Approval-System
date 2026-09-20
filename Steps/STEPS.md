# 🚀 Step-by-Step Implementation Guide: AWS Serverless Document Approval System

This document outlines the sequential steps required to provision, deploy, and run the Serverless Document Approval System on AWS.

---

## Phase 1: AWS Infrastructure Setup

### 1. Amazon DynamoDB
1. Open the **DynamoDB Console** and click **Create table**.
2. **Table name**: `document_approvals`
3. **Partition key**: `document_id` (String)
4. Under **Settings**, select **Customize settings**.
5. Scroll down to **Read/Write capacity settings** and choose **On-demand**.
6. Create the table.
7. Once created, go to the **Indexes** tab and click **Create secondary index**:
   * **Partition key**: `employee_id` (String)
   * **Index name**: `employee_index`
   * **Capacity mode**: On-demand
   * Click **Create index**.

### 2. Amazon S3 (Document Storage)
1. Open the **S3 Console** and click **Create bucket**.
2. **Bucket name**: `document-storage-bucket-251880984053` (or your unique bucket name).
3. **Region**: Choose your target region (e.g., `eu-west-3`).
4. Keep **Block Public Access** enabled (recommended for security since we use Presigned URLs).
5. Click **Create bucket**.

### 3. Amazon SES (Simple Email Service)
1. Open the **SES Console**.
2. Go to **Verified identities** and click **Create identity**.
3. Choose **Email address** and enter your admin/testing email address.
4. Verify the email by clicking the confirmation link sent to your inbox. *(Note: If SES is still in Sandbox mode, both sender and recipient emails must be verified).*

### 4. Amazon Cognito (Authentication)
1. Open the **Cognito Console** and create a **User Pool**.
2. Configure sign-in experience (Email).
3. Skip multi-factor authentication and configure password requirements.
4. Create the User Pool (e.g., note down **UserPoolId** and **ClientId**).
5. Create two users: one regular employee and one admin.
6. Create a group named `Admins` and assign your admin user to it.

---

## Phase 2: Backend Deployment (AWS Lambda)

1. Open the **Lambda Console** and click **Create function** (Author from scratch).
2. **Function name**: `document-approval-backend`
3. **Runtime**: Python 3.x
4. **Permissions**: Create a new IAM role with basic Lambda permissions, and attach policies granting access to **DynamoDB**, **S3**, and **SES**.
5. Paste the backend code from `lambda/lambda_function.py` into the code editor and click **Deploy**.
6. Go to **Configuration** -> **Environment variables** and add:
   * `TABLE_NAME`: `document_approvals`
   * `BUCKET_NAME`: `document-storage-bucket-251880984053`
   * `ADMIN_EMAIL`: `your-verified-ses-email@domain.com`
   *(⚠️ Ensure no trailing spaces exist in your bucket name value).*

---

## Phase 3: API Gateway Configuration

1. Open the **API Gateway Console** and choose **REST API** (Build).
2. Set API name to `DocumentApprovalAPI` and create it.
3. Create a resource path `/documents`:
   * Add **POST** method (Integration: Lambda Function -> select your Lambda).
   * Add **GET** method (Integration: Lambda Function).
4. Create a resource path `/status`:
   * Add **PUT** method (Integration: Lambda Function).
5. Enable **CORS** on all resources (`/documents` and `/status`) to allow browser access.
6. Click **Actions** -> **Deploy API**:
   * **Deployment stage**: Create a new stage named `prod`.
   * Copy the resulting **Invoke URL** (e.g., `https://xxxxxx.execute-api.eu-west-3.amazonaws.com/prod`).

---

## Phase 4: Frontend Configuration & Hosting

1. Open `frontend/script.js` and update your configurations:
   ```javascript
   const poolData = {
       UserPoolId: 'your-user-pool-id',
       ClientId: 'your-client-id'
   };
   const api_base_url = "[https://your-api-id.execute-api.region.amazonaws.com/prod](https://your-api-id.execute-api.region.amazonaws.com/prod)";
