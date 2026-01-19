'use client';

import { Download } from 'lucide-react';

interface ImageExportProps {
  logos: Array<{
    name: string;
    confidence: number;
    locations: Array<{
      bounding_box: {
        left: number;
        top: number;
        width: number;
        height: number;
      };
    }>;
  }>;
  filename: string;
}

export default function ImageExport({ logos, filename }: ImageExportProps) {
  const handleExportCSV = () => {
    const headers = ['Logo Name', 'Confidence', 'X Position', 'Y Position', 'Width', 'Height'];
    const rows = logos.flatMap(logo =>
      logo.locations.map(loc => [
        logo.name,
        (logo.confidence * 100).toFixed(1) + '%',
        (loc.bounding_box.left * 100).toFixed(1) + '%',
        (loc.bounding_box.top * 100).toFixed(1) + '%',
        (loc.bounding_box.width * 100).toFixed(1) + '%',
        (loc.bounding_box.height * 100).toFixed(1) + '%',
      ])
    );

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadFile(csv, `${filename}-logos.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    const data = {
      filename,
      totalLogos: logos.length,
      logos: logos.map(logo => ({
        name: logo.name,
        confidence: logo.confidence,
        locations: logo.locations.map(loc => loc.bounding_box),
      })),
    };

    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `${filename}-logos.json`, 'application/json');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (logos.length === 0) return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={handleExportCSV}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        Export CSV
      </button>
      <button
        onClick={handleExportJSON}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-secondary transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        Export JSON
      </button>
    </div>
  );
}
