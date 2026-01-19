'use client';

import { Clock, Eye } from 'lucide-react';
import { LogoPresence } from '@/utils/logo-analytics';

interface VideoAnalyticsProps {
  logoPresences: LogoPresence[];
  videoDuration: number;
  onLogoClick: (logoName: string, timestamp: number) => void;
  selectedLogo: string | null;
}

export default function VideoAnalytics({
  logoPresences,
  videoDuration,
  onLogoClick,
  selectedLogo,
}: VideoAnalyticsProps) {
  const totalLogos = logoPresences.reduce((sum, lp) => sum + lp.totalAppearances, 0);
  const uniqueLogos = logoPresences.length;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="text-2xl font-bold text-foreground">{uniqueLogos}</div>
          <div className="text-sm text-muted-foreground">Unique Logos</div>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="text-2xl font-bold text-foreground">{totalLogos}</div>
          <div className="text-sm text-muted-foreground">Total Appearances</div>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <div className="text-2xl font-bold text-foreground">{videoDuration.toFixed(1)}s</div>
          <div className="text-sm text-muted-foreground">Video Duration</div>
        </div>
      </div>

      {/* Logo List */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Logo Timeline</h3>
        
        {logoPresences.length === 0 ? (
          <div className="p-8 rounded-lg bg-secondary/50 border border-border text-center">
            <p className="text-muted-foreground">No logos detected in this video</p>
          </div>
        ) : (
          logoPresences.map((presence) => (
            <div
              key={presence.logoName}
              className={`p-4 rounded-lg border transition-all ${
                selectedLogo === presence.logoName
                  ? 'bg-primary/10 border-primary'
                  : 'bg-card border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-base font-medium text-foreground capitalize">
                    {presence.logoName}
                  </h4>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {presence.totalAppearances} appearance{presence.totalAppearances !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {presence.totalDuration.toFixed(1)}s total
                    </span>
                    <span>
                      {(presence.avgConfidence * 100).toFixed(1)}% confidence
                    </span>
                  </div>
                </div>
              </div>

              {/* Timeline visualization */}
              <div className="relative h-8 bg-secondary/50 rounded overflow-hidden mb-2">
                {presence.appearances.map((app, idx) => {
                  const left = (app.startTime / videoDuration) * 100;
                  const width = Math.max(((app.endTime - app.startTime) / videoDuration) * 100, 0.5); // Minimum 0.5% width
                  
                  return (
                    <div
                      key={idx}
                      className="absolute h-full bg-primary hover:bg-primary/80 cursor-pointer transition-colors"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      onClick={() => onLogoClick(presence.logoName, app.startTime)}
                      title={`${app.startTime.toFixed(1)}s - ${app.endTime.toFixed(1)}s`}
                    />
                  );
                })}
              </div>

              {/* Appearance details */}
              <div className="space-y-1">
                {presence.appearances.map((app, idx) => (
                  <button
                    key={idx}
                    onClick={() => onLogoClick(presence.logoName, app.startTime)}
                    className="w-full text-left px-3 py-2 rounded bg-secondary/50 hover:bg-secondary transition-colors text-xs"
                  >
                    <span className="text-foreground font-medium">
                      {app.startTime.toFixed(1)}s - {app.endTime.toFixed(1)}s
                    </span>
                    <span className="text-muted-foreground ml-2">
                      ({app.duration.toFixed(1)}s, frames {app.startFrame}-{app.endFrame})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
