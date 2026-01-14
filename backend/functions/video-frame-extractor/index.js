import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler = async (event) => {
  console.log('Video Frame Extractor received event:', JSON.stringify(event, null, 2));
  
  const { bucket, s3Key, userId, filename, fileId, frameRate = 1 } = event;
  
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
    await extractFrames(videoPath, framesDir, frameRate);
    
    // 3. Upload frames to S3
    const frameFiles = readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
    console.log(`Extracted ${frameFiles.length} frames, uploading to S3`);
    
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
      videoFilename: filename
    };
    
  } catch (error) {
    console.error('Error extracting frames:', error);
    throw error;
  }
};

function extractFrames(videoPath, outputDir, frameRate) {
  return new Promise((resolve, reject) => {
    // ffmpeg is available at /opt/bin/ffmpeg from the Lambda layer
    const ffmpegPath = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
    
    const args = [
      '-i', videoPath,
      '-vf', `fps=${frameRate}`,
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
