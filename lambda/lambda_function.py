import json
import boto3
import os
import uuid
import base64
from datetime import datetime

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
ses = boto3.client('ses')

# Load configuration from environment variables
table_name = os.environ.get('TABLE_NAME')
bucket_name = os.environ.get('BUCKET_NAME')
admin_email = os.environ.get('ADMIN_EMAIL')

table = dynamodb.Table(table_name)

def lambda_handler(event, context):
    try:
        http_method = event.get('httpMethod')
        path = event.get('path')
        
        # Handle CORS preflight OPTIONS request
        if http_method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT'
                },
                'body': json.dumps('CORS preflight successfully handled')
            }
        
        # 1. SUBMIT DOCUMENT OR PDF (POST /documents)
        if http_method == 'POST' and path == '/documents':
            body = json.loads(event.get('body', '{}'))
            document_id = str(uuid.uuid4())
            employee_id = body.get('employee_id') # Employee email address
            title = body.get('title')
            submission_type = body.get('submission_type')
            content = body.get('content', '')
            file_base64 = body.get('file_base64', '') # Base64 encoded file data if PDF
            file_name_orig = body.get('file_name', '')
            
            file_name = ''
            if submission_type == 'pdf' and file_base64:
                if not bucket_name:
                    print("ERROR: BUCKET_NAME environment variable is missing!")
                else:
                    try:
                        file_name = f"{int(datetime.utcnow().timestamp())}_{file_name_orig}"
                        file_bytes = base64.b64decode(file_base64)
                        print(f"Attempting to upload {file_name} to bucket {bucket_name}...")
                        
                        s3.put_object(
                            Bucket=bucket_name,
                            Key=file_name,
                            Body=file_bytes,
                            ContentType='application/pdf'
                        )
                        print("SUCCESS: File uploaded to S3 successfully!")
                        content = f"Uploaded File: {file_name_orig}"
                    except Exception as s3_upload_err:
                        print(f"CRITICAL S3 Upload Error: {str(s3_upload_err)}")
                        raise s3_upload_err
            
            item = {
                'document_id': document_id,
                'employee_id': employee_id,
                'title': title,
                'submission_type': submission_type,
                'content': content,
                'file_name': file_name,
                'status': 'pending',
                'approver_email': '',
                'created_at': datetime.utcnow().isoformat()
            }
            
            # Save request item into DynamoDB table
            table.put_item(Item=item)
            
            # Send notification email to Admin via SES
            if admin_email:
                try:
                    ses.send_email(
                        Source=admin_email,
                        Destination={'ToAddresses': [admin_email]},
                        Message={
                            'Subject': {'Data': f'New Approval Request Pending: {title}'},
                            'Body': {'Text': {'Data': f'Hello Admin,\n\nEmployee {employee_id} has submitted a new request ({submission_type}) titled "{title}" waiting for your review.'}}
                        }
                    )
                except Exception as ses_admin_err:
                    print(f"SES Admin Notification Error: {str(ses_admin_err)}")
            
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Document submitted successfully', 'document_id': document_id})
            }

        # 2. GET DOCUMENTS (GET /documents) - Generates Secure Presigned URLs for S3 files
        elif http_method == 'GET' and path == '/documents':
            query_params = event.get('queryStringParameters') or {}
            employee_id = query_params.get('employee_id')
            
            if employee_id:
                response = table.query(
                    IndexName='employee_index',
                    KeyConditionExpression=boto3.dynamodb.conditions.Key('employee_id').eq(employee_id)
                )
                items = response.get('Items', [])
            else:
                response = table.scan()
                items = response.get('Items', [])
            
            # Generate temporary S3 presigned URLs for PDF file viewing
            for item in items:
                if item.get('submission_type') == 'pdf' and item.get('file_name') and bucket_name:
                    try:
                        presigned_url = s3.generate_presigned_url(
                            'get_object',
                            Params={'Bucket': bucket_name, 'Key': item['file_name']},
                            ExpiresIn=3600
                        )
                        item['file_url'] = presigned_url
                    except Exception as s3_presign_err:
                        print(f"S3 Presign Error: {str(s3_presign_err)}")
                        item['file_url'] = ''
                else:
                    item['file_url'] = ''
                
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(items)
            }

        # 3. UPDATE STATUS & SEND INDIVIDUAL NO-REPLY EMAIL VIA SES (PUT /status)
        elif http_method == 'PUT' and path == '/status':
            body = json.loads(event.get('body', '{}'))
            document_id = body.get('document_id')
            status = body.get('status')
            approver_email = body.get('approver_email')
            
            doc_response = table.get_item(Key={'document_id': document_id})
            item = doc_response.get('Item', {})
            employee_id = item.get('employee_id')
            title = item.get('title', 'Document')
            
            table.update_item(
                Key={'document_id': document_id},
                UpdateExpression='SET #st = :s, approver_email = :a',
                ExpressionAttributeNames={'#st': 'status'},
                ExpressionAttributeValues={':s': status, ':a': approver_email}
            )
            
            # Send No-Reply email to the specific employee via SES
            if employee_id and admin_email:
                try:
                    ses.send_email(
                        Source=admin_email,
                        Destination={'ToAddresses': [employee_id]},
                        Message={
                            'Subject': {'Data': f'Document Status Update: {status.capitalize()}'},
                            'Body': {'Text': {'Data': f'Hello,\n\nYour document request "{title}" has been {status.upper()} by Admin ({approver_email}).\n\nThis is an automated No-Reply notification.\n\nBest regards,\nServerless Approval System'}}
                        }
                    )
                except Exception as ses_emp_err:
                    print(f"SES Employee Notification Error: {str(ses_emp_err)}")
            
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': f'Document status successfully updated to {status}'})
            }

        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid endpoint or method'})
        }

    except Exception as e:
        print(f"Lambda Exception: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
