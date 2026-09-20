# 📄 AWS Serverless Document Approval System

An enterprise-grade, serverless document approval and management platform built on **Amazon Web Services (AWS)**. This system allows employees to securely submit text requests or PDF documents, enables real-time notification alerts via SES, and provides administrators with secure, presigned URL-based access for document review and status updates.

---

## 🏗️ Architecture & AWS Services Used

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
