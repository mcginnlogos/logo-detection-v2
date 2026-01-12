# AWS Infrastructure

This directory contains CloudFormation templates for deploying the AWS infrastructure required by the application.

## Stacks

### 1. S3 File Storage Stack (`s3-file-storage-stack.yaml`)

Creates the S3 infrastructure for file storage with user-based access control.

**Resources Created:**
- S3 bucket with versioning and lifecycle policies
- IAM user with restricted S3 access (users/* prefix only)
- Access keys for application authentication
- CloudWatch alarms for monitoring
- CORS configuration for web access

**Security Features:**
- Public access blocked on S3 bucket
- IAM policies restrict access to user-specific prefixes
- Versioning enabled for data protection
- Lifecycle rules for cleanup

### 2. Logo Detection Stack (`logo-detection-stack.yaml`)

Creates the infrastructure for logo detection processing using AWS Bedrock.

**Resources Created:**
- SQS queue for job processing
- Lambda function for Bedrock integration
- Dead letter queue for failed jobs
- CloudWatch monitoring and alarms

## Deployment

### Prerequisites

1. AWS CLI installed and configured
2. Appropriate AWS permissions for CloudFormation, S3, IAM
3. Choose an environment name (dev, staging, prod)

### Deploy S3 File Storage Stack

```bash
# Using the deployment script
./scripts/deploy-s3-stack.sh dev

# Or manually with AWS CLI
aws cloudformation deploy \
  --template-file aws-infrastructure/s3-file-storage-stack.yaml \
  --stack-name logo-detection-file-storage-dev \
  --parameter-overrides EnvironmentName=dev \
  --capabilities CAPABILITY_IAM
```

### Deploy Logo Detection Stack

```bash
aws cloudformation deploy \
  --template-file aws-infrastructure/logo-detection-stack.yaml \
  --stack-name logo-detection-processing-dev \
  --parameter-overrides EnvironmentName=dev \
  --capabilities CAPABILITY_IAM
```

## Configuration

After deployment, update your application's environment variables:

### From S3 File Storage Stack Outputs:
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<AccessKeyId from stack output>
AWS_SECRET_ACCESS_KEY=<SecretAccessKey from stack output>
AWS_S3_BUCKET=<BucketName from stack output>
```

### From Logo Detection Stack Outputs:
```bash
LOGO_DETECTION_QUEUE_URL=<QueueUrl from stack output>
BEDROCK_OUTPUT_BUCKET=<BedrockOutputBucketName from stack output>
```

## Monitoring

Both stacks include CloudWatch alarms:

**S3 File Storage:**
- Bucket size monitoring (alerts at 10GB)
- Object count monitoring (alerts at 100k objects)

**Logo Detection:**
- Dead letter queue message alerts
- Lambda function error alerts

## Security Considerations

1. **S3 Access Control**: Files are stored with user ID prefixes (`users/{user_id}/`) and IAM policies enforce this isolation
2. **Presigned URLs**: Temporary access with 1-hour expiry for file preview/download
3. **No Public Access**: S3 bucket blocks all public access
4. **Encryption**: Consider enabling S3 encryption at rest for sensitive data
5. **Access Keys**: Store AWS access keys securely (use AWS Secrets Manager in production)

## Cost Optimization

1. **Lifecycle Policies**: Automatically delete old file versions after 30 days
2. **Incomplete Multipart Uploads**: Cleanup after 1 day
3. **CloudWatch Logs**: 30-day retention for cost control
4. **S3 Storage Classes**: Consider using IA or Glacier for long-term storage

## Cleanup

To delete the stacks and all resources:

```bash
# Delete S3 files first (CloudFormation won't delete non-empty buckets)
aws s3 rm s3://your-bucket-name --recursive

# Delete the stacks
aws cloudformation delete-stack --stack-name logo-detection-file-storage-dev
aws cloudformation delete-stack --stack-name logo-detection-processing-dev
```

## Troubleshooting

### Common Issues:

1. **Stack deployment fails**: Check IAM permissions and parameter values
2. **S3 access denied**: Verify AWS credentials and IAM policies
3. **CORS errors**: Check S3 CORS configuration matches your domain
4. **File upload fails**: Verify bucket name and region in environment variables

### Useful Commands:

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name logo-detection-file-storage-dev

# View stack events
aws cloudformation describe-stack-events --stack-name logo-detection-file-storage-dev

# Test S3 access
aws s3 ls s3://your-bucket-name/users/ --profile your-profile
```