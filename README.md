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

### 1. Backend Setup (AWS Lambda & DynamoDB)

* Create a DynamoDB table named `document_approvals` with partition key `document_id` (String) and a GSI named `employee_index` on `employee_id`.
* Create an S3 bucket for document storage.
* Create an AWS Lambda function (Python 3.x), paste the code from `lambda/lambda_function.py`, and attach an IAM Role with permissions for DynamoDB, S3, and SES.
* Configure the following **Environment Variables** in Lambda:
* `TABLE_NAME`: `document_approvals`
* `BUCKET_NAME`: `your-s3-bucket-name`
* `ADMIN_EMAIL`: `your-verified-ses-email@domain.com`



### 2. API Gateway Configuration

* Create a **REST API** in API Gateway linked to your Lambda function via Lambda Proxy Integration.
* Configure resources and methods:
* `POST /documents` (Submit document/PDF)
* `GET /documents` (Fetch history or admin list with presigned URLs)
* `PUT /status` (Update approval status & trigger SES email)


* Enable CORS on all resources and deploy the API to a stage (`prod`).

### 3. Frontend Configuration

* Update `api_base_url` and `poolData` parameters inside `frontend/script.js` with your active API Gateway endpoint and Cognito User Pool details.
* Upload the frontend files (`index.html`, `style.css`, `script.js`) to an S3 bucket configured for static website hosting.

---

## 👨‍💻 Author

**Ali Soliman**

*Cloud Security & DevOps / Cloud Engineering*

```
