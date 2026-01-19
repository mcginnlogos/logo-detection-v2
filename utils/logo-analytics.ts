export interface LogoDetection {
  id: string;
  name: string;
  confidence: number;
  frameIndex: number;
  timestamp: number;
}

export interface LogoPresence {
  logoName: string;
  appearances: Array<{
    startTime: number;
    endTime: number;
    duration: number;
    startFrame: number;
    endFrame: number;
    avgConfidence: number;
  }>;
  totalDuration: number;
  totalAppearances: number;
  avgConfidence: number;
}

export interface VideoAnalytics {
  totalLogos: number;
  uniqueLogos: number;
  logoPresences: LogoPresence[];
  videoDuration: number;
}

/**
 * Calculate logo presence durations with gap tolerance
 * @param detections - All logo detections across frames
 * @param frameGapTolerance - Number of frames to tolerate missing logo (default: 1)
 * @returns Aggregated logo presence data
 */
export function calculateLogoPresence(
  detections: LogoDetection[],
  frameGapTolerance: number = 1
): LogoPresence[] {
  if (detections.length === 0) return [];

  // Calculate average frame spacing for duration estimation
  const sortedByFrame = [...detections].sort((a, b) => a.frameIndex - b.frameIndex);
  let avgFrameSpacing = 0.033; // Default 30fps
  
  if (sortedByFrame.length > 1) {
    const spacings: number[] = [];
    for (let i = 1; i < sortedByFrame.length; i++) {
      const timeDiff = sortedByFrame[i].timestamp - sortedByFrame[i - 1].timestamp;
      const frameDiff = sortedByFrame[i].frameIndex - sortedByFrame[i - 1].frameIndex;
      if (frameDiff > 0 && timeDiff > 0) {
        spacings.push(timeDiff / frameDiff);
      }
    }
    if (spacings.length > 0) {
      avgFrameSpacing = spacings.reduce((sum, s) => sum + s, 0) / spacings.length;
    }
  }

  // Group by logo name
  const logoGroups = detections.reduce((acc, detection) => {
    if (!acc[detection.name]) {
      acc[detection.name] = [];
    }
    acc[detection.name].push(detection);
    return acc;
  }, {} as Record<string, LogoDetection[]>);

  return Object.entries(logoGroups).map(([logoName, logos]) => {
    // Sort by frame index
    const sorted = logos.sort((a, b) => a.frameIndex - b.frameIndex);
    
    const appearances: LogoPresence['appearances'] = [];
    let currentAppearance: LogoDetection[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const frameGap = curr.frameIndex - prev.frameIndex;

      // If within tolerance, add to current appearance
      if (frameGap <= frameGapTolerance + 1) {
        currentAppearance.push(curr);
      } else {
        // Save current appearance and start new one
        appearances.push(createAppearanceWithDuration(currentAppearance, avgFrameSpacing));
        currentAppearance = [curr];
      }
    }

    // Add final appearance
    if (currentAppearance.length > 0) {
      appearances.push(createAppearanceWithDuration(currentAppearance, avgFrameSpacing));
    }

    const totalDuration = appearances.reduce((sum, app) => sum + app.duration, 0);
    const avgConfidence = logos.reduce((sum, l) => sum + l.confidence, 0) / logos.length;

    return {
      logoName,
      appearances,
      totalDuration,
      totalAppearances: appearances.length,
      avgConfidence,
    };
  });
}

function createAppearanceWithDuration(detections: LogoDetection[], frameSpacing: number) {
  const startTime = detections[0].timestamp;
  const endTime = detections[detections.length - 1].timestamp;
  const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

  // Duration calculation:
  // - Single frame: use frame spacing (time until next frame)
  // - Multiple frames: time from start to end + one frame spacing to include the end frame's duration
  const duration = detections.length === 1 
    ? frameSpacing 
    : (endTime - startTime) + frameSpacing;

  return {
    startTime,
    endTime,
    duration,
    startFrame: detections[0].frameIndex,
    endFrame: detections[detections.length - 1].frameIndex,
    avgConfidence,
  };
}

/**
 * Export logo analytics to CSV format
 */
export function exportToCSV(presences: LogoPresence[], filename: string): void {
  const headers = ['Logo Name', 'Start Time (s)', 'End Time (s)', 'Duration (s)', 'Start Frame', 'End Frame', 'Avg Confidence'];
  const rows = presences.flatMap(presence =>
    presence.appearances.map(app => [
      presence.logoName,
      app.startTime.toFixed(2),
      app.endTime.toFixed(2),
      app.duration.toFixed(2),
      app.startFrame,
      app.endFrame,
      (app.avgConfidence * 100).toFixed(1) + '%',
    ])
  );

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadFile(csv, filename, 'text/csv');
}

/**
 * Export logo analytics to JSON format
 */
export function exportToJSON(presences: LogoPresence[], filename: string): void {
  const json = JSON.stringify({ logoPresences: presences }, null, 2);
  downloadFile(json, filename, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
