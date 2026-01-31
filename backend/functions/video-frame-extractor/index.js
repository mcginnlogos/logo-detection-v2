import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler = async (event) => {
  console.log('Video Frame Extractor received event:', JSON.stringify(event, null, 2));
  
  // Parse frameRate - it might come as string or number, default to 1 if not provided
  let frameRate = 1;
  if (event.frameRate) {
    frameRate = typeof event.frameRate === 'string' ? parseFloat(event.frameRate) : event.frameRate;
    // Validate frame rate is between 1 and 30
    if (isNaN(frameRate) || frameRate < 1 || frameRate > 30) {
      console.warn(`Invalid frame rate ${event.frameRate}, using default of 1 fps`);
      frameRate = 1;
    }
  }
  console.log(`Using frame rate: ${frameRate} fps`);
  
  const { bucket, s3Key, userId, filename, fileId, hasActiveSubscription } = event;
  
  const tmpDir = '/tmp/video-processing';
  const videoPath = join(tmpDir, 'input.mp4');
  const framesDir = join(tmpDir, 'frames');
  
  try {
    // Create temp directories
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(framesDir, { recursive: true });
    
    // 1. Download video from S3
    console.log(`Downloading video from s3://${bucket}/${s3Key}`);
    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
    const response = await s3Client.send(getCommand);
    
    const writeStream = createWriteStream(videoPath);
    await pipeline(response.Body, writeStream);
    console.log('Video downloaded successfully');
    
    // 2. Extract frames using ffmpeg
    console.log(`Extracting frames at ${frameRate} fps`);
    const sourceFrameRate = await getVideoFrameRate(videoPath);
    console.log(`Source video frame rate: ${sourceFrameRate} fps`);
    await extractFrames(videoPath, framesDir, frameRate, sourceFrameRate);
    
    // 3. Upload frames to S3
    let frameFiles = readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
    console.log(`Extracted ${frameFiles.length} frames`);
    
    // Limit frames for free tier users
    const FREE_TIER_FRAME_LIMIT = 10;
    if (!hasActiveSubscription && frameFiles.length > FREE_TIER_FRAME_LIMIT) {
      console.log(`Free tier user - limiting to ${FREE_TIER_FRAME_LIMIT} frames`);
      frameFiles = frameFiles.slice(0, FREE_TIER_FRAME_LIMIT);
    }

    console.log(`Uploading ${frameFiles.length} frames to S3`);
    
    const frames = [];
    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      const framePath = join(framesDir, frameFile);
      const frameS3Key = `users/${userId}/frames/${fileId}/${frameFile}`;
      
      const fileStream = createReadStream(framePath);
      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: frameS3Key,
        Body: fileStream,
        ContentType: 'image/jpeg'
      });
      
      await s3Client.send(putCommand);
      
      frames.push({
        frameNumber: i + 1,
        s3Key: frameS3Key,
        filename: frameFile,
        timestamp: i / frameRate
      });
      
      // Clean up frame file
      unlinkSync(framePath);
    }
    
    console.log(`Successfully uploaded ${frames.length} frames`);
    
    // Clean up
    unlinkSync(videoPath);
    
    return {
      statusCode: 200,
      message: 'Frames extracted successfully',
      frameCount: frames.length,
      frames: frames,
      bucket: bucket,
      userId: userId,
      fileId: fileId,
      videoFilename: filename,
      s3Key: s3Key, // Include original video s3Key for job creation
    };
    
  } catch (error) {
    console.error('Error extracting frames:', error);
    throw error;
  }
};

function getVideoFrameRate(videoPath) {
  return new Promise((resolve, reject) => {
    const ffprobePath = process.env.FFPROBE_PATH || '/opt/bin/ffprobe';
    
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=r_frame_rate',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ];
    
    const ffprobe = spawn(ffprobePath, args);
    let output = '';
    
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        // Parse frame rate (e.g., "30/1" or "30000/1001")
        const [num, den] = output.trim().split('/').map(Number);
        const fps = num / den;
        resolve(fps);
      } else {
        reject(new Error(`ffprobe failed with code ${code}`));
      }
    });
    
    ffprobe.on('error', (err) => {
      reject(err);
    });
  });
}

function extractFrames(videoPath, outputDir, frameRate, sourceFrameRate) {
  return new Promise((resolve, reject) => {
    // ffmpeg is available at /opt/bin/ffmpeg from the Lambda layer
    const ffmpegPath = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
    
    // Calculate how many source frames to skip between extractions
    // For sourceFrameRate=30 and frameRate=1: skip every 30 frames
    // For sourceFrameRate=60 and frameRate=2: skip every 30 frames
    const skipFrames = Math.round(sourceFrameRate / frameRate);
    
    // Use select filter to extract frames at exact intervals
    const args = [
      '-i', videoPath,
      '-vf', `select='not(mod(n\\,${skipFrames}))',setpts=N/FRAME_RATE/TB`,
      '-vsync', 'vfr',
      '-q:v', '2',
      join(outputDir, 'frame_%04d.jpg')
    ];
    
    console.log(`Running ffmpeg: ${ffmpegPath} ${args.join(' ')}`);
    
    const ffmpeg = spawn(ffmpegPath, args);
    
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}
