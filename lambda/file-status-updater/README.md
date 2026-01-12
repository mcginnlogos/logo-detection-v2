# S3 File Storage with Event Processing Pipeline

This SAM template deploys a complete S3 file storage system with event processing pipeline that:

1. **S3 Bucket** - Stores files with user-based access control
2. **SQS Queue** - Receives S3 events (create/delete) for files under `users/` prefix
3. **Lambda Function** - Processes SQS messages and updates file status in Supabase
4. **Dead Letter Queue** - Handles failed message processing
5. **CloudWatch Alarms** - Monitors the entire pipeline

## Architecture Flow

```
S3 Object Events → SQS Queue → Lambda Function → Supabase Database
                      ↓
                 Dead Letter Queue (on failure)
```

## Deployment

### Prerequisites

- AWS CLI configured
- SAM CLI installed
- Supabase project with service key

### Deploy the Stack

```bash
# Build and deploy
sam build
sam deploy --guided

# Or with parameters
sam deploy \
  --parameter-overrides \
    EnvironmentName=dev \
    FileStorageBucketName=your-bucket-name \
    SupabaseUrl=https://your-project.supabase.co \
    SupabaseServiceKey=your-service-key
```

### Environment Variables

The Lambda function uses these environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Service role key for database access
- `ENVIRONMENT` - Environment name (dev/staging/prod)

## Features

### S3 Bucket Configuration
- **Versioning enabled** for file history
- **CORS configured** for web uploads
- **Lifecycle rules** to clean up incomplete uploads and old versions
- **Public access blocked** for security
- **Event notifications** for `users/` prefix only

### SQS Configuration
- **Dead letter queue** with 3 retry attempts
- **Long polling** (20 seconds) for efficiency
- **Batch processing** up to 10 messages at once
- **5-minute visibility timeout** for Lambda processing

### Lambda Function
- **Node.js 18.x runtime**
- **256MB memory** allocation
- **30-second timeout**
- **Automatic retry** with DLQ fallback
- **CloudWatch logging** with 14-day retention

### Monitoring & Alarms
- **S3 bucket size** alarm (10GB threshold)
- **S3 object count** alarm (100k objects)
- **SQS DLQ messages** alarm (immediate alert)
- **SQS queue depth** alarm (100 messages)
- **Lambda errors** alarm (5 errors in 10 minutes)
- **Lambda duration** alarm (10+ second executions)

## IAM User Access

The template creates an IAM user with minimal permissions:
- **S3 access** limited to `users/*` prefix
- **SQS access** for receiving and deleting messages
- **No admin permissions** - principle of least privilege

## Outputs

The stack exports these values for use by your application:
- Bucket name, ARN, and domain
- SQS queue URL and ARN
- DLQ URL and ARN
- IAM access keys (store securely!)
- Lambda function ARN and name

## Local Development

```bash
# Test Lambda function locally
sam local invoke FileStatusUpdaterFunction --event events/s3-event.json

# Start local API (if you add API Gateway later)
sam local start-api
```

## Security Notes

- Store the `SecretAccessKey` output securely (AWS Secrets Manager recommended)
- Restrict CORS origins in production
- Consider using IAM roles instead of access keys for EC2/Lambda access
- Monitor CloudWatch alarms for security incidents