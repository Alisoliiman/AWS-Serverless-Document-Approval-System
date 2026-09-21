# 📄 AWS Serverless Document Approval System

<p align="center">
  <img src="https://img.shields.io/badge/AWS-Free%20Tier-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-3.14-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Serverless-100%25-black?style=for-the-badge&logo=serverless&logoColor=white"/>
</p>

An enterprise-grade, serverless document approval and management platform built on **Amazon Web Services (AWS)**. This system allows employees to securely submit text requests or PDF documents, enables real-time notification alerts via SES, and provides administrators with secure, presigned URL-based access for document review and status updates.

---

## 🏗️ Architecture & AWS Services Used

![Architecture Diagram](images/AWS%20Serverless%20Document%20Approval%20System.png)

* **Frontend**: Hosted on **Amazon S3** (HTML, CSS, JavaScript, AWS SDK).
* **API Layer**: **Amazon API Gateway (REST API)** managing secure routing and CORS.
* **Compute Engine**: **AWS Lambda (Python 3.x)** handling core business logic, Base64 file decoding, and S3/DynamoDB integration.
* **Database**: **Amazon DynamoDB** storing document metadata, status tracking, and employee queries via Global Secondary Indexes (GSIs).
* **Storage**: **Amazon S3** securely storing raw PDF submissions with strict bucket privacy.
* **Messaging / Notifications**: **Amazon SES (Simple Email Service)** delivering automated, individual No-Reply email notifications.
* **Authentication**: **Amazon Cognito User Pools** managing role-based access control (Employees & Admins).

---

## ⚙️ System Workflow

1. **Authentication**: Users log in through Amazon Cognito, which issues a JWT token containing group claims (`Admins` or `Employees`).
2. **Submission**: 
   * Employees select between text notes or PDF file uploads.
   * PDFs are converted to Base64 in the frontend and securely transferred via API Gateway to Lambda.
   * Lambda decodes the payload, uploads the PDF to S3 with a unique timestamp, and logs the metadata in DynamoDB.
   * An automated notification email is dispatched to the administrator via SES.
3. **Review & Approval**: 
   * Administrators view pending requests. Lambda generates temporary **S3 Presigned URLs** (1-hour expiration) for secure, direct PDF viewing.
   * Upon approval or rejection, the system updates DynamoDB and triggers an automated **No-Reply SES email** directly to the respective employee.

---

## 📂 Repository Structure

```text
├── lambda/
│   └── lambda_function.py      # Python backend handling API routes, S3 uploads, and SES emails
├── frontend/
│   ├── index.html              # Main dashboard interface (Employee & Admin views)
│   ├── style.css               # Modern responsive styling
│   └── script.js               # Frontend logic, Cognito auth, and API communication
└── README.md                   # Project documentation

```

---

## 🚀 Deployment Guide

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
2. **Bucket name**: `document-storage-bucket-ID` (or your unique bucket name).
3. **Region**: Choose your target region.
4. Keep **Block Public Access** enabled (recommended for security since we use Presigned URLs).
5. Click **Create bucket**.

### 3. Amazon SES (Simple Email Service)
1. Open the **SES Console**.
2. Go to **Verified identities** and click **Create identity**.
3. Choose **Email address** and enter your admin/testing email address.
4. Verify the email by clicking the confirmation link sent to your inbox. *(Note: If SES is still in Sandbox mode, both sender and recipient emails must be verified).*

### 4. IAM Policy & Role
**Create the Policy:**

1. Opem **IAM Console** and click **Create Role**
2. **Trusted entity type**: AWS Service
3. **Use case**: Lambda
4. From **Add permissions** choose **Create inlince Policy**
6. Click the **JSON** tab → paste:
```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"dynamodb:PutItem",
				"dynamodb:GetItem",
				"dynamodb:UpdateItem",
				"dynamodb:Query",
				"dynamodb:Scan"
			],
			"Resource": [
				"arn:aws:dynamodb:eu-west-3:251880984053:table/document_approvals",
				"arn:aws:dynamodb:eu-west-3:251880984053:table/document_approvals/index/employee_index"
			]
		},
		{
			"Effect": "Allow",
			"Action": [
				"s3:PutObject",
				"s3:GetObject"
			],
			"Resource": "arn:aws:s3:::document-storage-bucket-ID/*"
		},
		{
			"Effect": "Allow",
			"Action": [
				"ses:SendEmail",
				"ses:SendRawEmail"
			],
			"Resource": "*"
		},
		{
			"Effect": "Allow",
			"Action": [
				"logs:CreateLogGroup",
				"logs:CreateLogStream",
				"logs:PutLogEvents"
			],
			"Resource": "*"
		}
	]
}
```

7. Click **Next**
8. **Policy name**: `document_lambda_Policy`
9. **Role named**: `document_lambda_role`
10. Click **Create role**

### 5. Amazon Cognito (Authentication)
1. Open the **Cognito Console** and create a **User Pool**.
2. Configure sign-in experience (Email).
3. Skip multi-factor authentication and configure password requirements.
4. Create the User Pool (note down **UserPoolId** and **ClientId**).
5. Create two users: one regular employee and one admin.
6. Create a group named `Admins` and assign your admin user to it.

### 6. AWS Lambda

1. Open the **Lambda Console** and click **Create function** (Author from scratch).
2. **Function name**: `document_handler`
3. **Runtime**: Python 3.x (2.12)
4. **Permissions**: Create a new IAM role with basic Lambda permissions, and attach policies granting access to **DynamoDB**, **S3**, and **SES**.
5. Paste the backend code from `lambda/lambda_function.py` into the code editor and click **Deploy**.
6. Go to **Configuration** -> **Environment variables** and add:
   * `TABLE_NAME`: `document_approvals`
   * `BUCKET_NAME`: `document-storage-bucket-251880984053`
   * `ADMIN_EMAIL`: `your-verified-ses-email@domain.com`
   *(⚠️ Ensure no trailing spaces exist in your bucket name value).*

### 7. API Gateway Configuration

1. Open the **API Gateway Console** and choose **REST API** (Build).
2. Set API name to `document-api` and create it.
3. Create a resource path `/documents`:
   * Add **POST** method (Integration: Lambda Function -> select your Lambda): Submit document/PDF.
   * Add **GET** method (Integration: Lambda Function): Fetch history or admin list with presigned URLs.
4. Create a resource path `/status`:
   * Add **PUT** method (Integration: Lambda Function): Update approval status & trigger SES email).

5. Enable **CORS** on all resources (`/documents` and `/status`) to allow browser access.
6. Click **Actions** -> **Deploy API**:
   * **Deployment stage**: Create a new stage named `prod`.
   * Copy the resulting **Invoke URL** (`https://xxxxxx.execute-api.eu-west-3.amazonaws.com/prod`).

### 8. Frontend Configuration

1. Open the **S3 Console** and click **Create bucket**.
2. **Bucket name**: `document-web-bucket-ID` (or your unique bucket name).
3. **Region**: Choose your target region.
4. Under **Block Public Access** → **uncheck** "Block all public access"
5. Confirm the warning checkbox
6. Click **Create bucket**

7. Open `frontend/script.js` and update your configurations:
   ```javascript
   const poolData = {
       UserPoolId: 'your-user-pool-id',
       ClientId: 'your-client-id'
   };
   const api_base_url = "[https://your-api-id.execute-api.region.amazonaws.com/prod](https://your-api-id.execute-api.region.amazonaws.com/prod)";

**Upload files:**

8. Open your bucket → click **Upload** → **Add files**
9. Select all 3 files from VSCode:
   - `frontend/index.html`
   - `frontend/style.css`
   - `frontend/script.js`
   - `frontend/error.html`

10. Click **Upload**

**Enable Static Website Hosting:**

11. Go to **Properties** tab → scroll down → **Static website hosting** → **Edit**
12. **Enable** → Index document: `index.html`, Error document: `error.html`.
13. Click **Save changes**

**Add Bucket Policy:**

14. Go to **Permissions** tab → **Bucket policy** → **Edit**
15. Paste (replace `YOUR-BUCKET-NAME` with your actual bucket name):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::document-web-bucket-ID/*"
        }
    ]
}
```

16. Click **Save changes**
---
## 🔮 Future Improvements

* [ ] Add **Amazon CloudFront** for global CDN delivery & custom HTTPS certificate
* [ ] Add **Priority filter** using Amazon Comprehend
