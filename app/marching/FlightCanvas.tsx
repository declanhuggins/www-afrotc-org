import React from "react";
import { Cadet, degToRad } from "./lib";

interface FlightCanvasProps {
  cadets: Cadet[];
  width: number;
  height: number;
  areaWidth: number;
  areaHeight: number;
  boundary: boolean;
  previewCadets?: Cadet[];
  inchesToPixels: (inches: number) => number;
}

export const FlightCanvas: React.FC<FlightCanvasProps> = ({ cadets, width, height, areaWidth, areaHeight, boundary, previewCadets, inchesToPixels }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const AIRMAN_WIDTH = inchesToPixels(20);
  const AIRMAN_LENGTH = inchesToPixels(10);
  const GUIDON_TRIANGLE_SIZE = inchesToPixels(8);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    // Draw boundary
    const minX = (width - areaWidth) / 2;
    const minY = (height - areaHeight) / 2;
    ctx.strokeStyle = boundary ? "#dc2626" : "#2563eb";
    ctx.lineWidth = 3;
    ctx.strokeRect(minX, minY, areaWidth, areaHeight);
    // Draw preview (if any)
    if (previewCadets) {
      for (const cadet of previewCadets) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.translate(cadet.x, cadet.y);
        ctx.rotate(degToRad(cadet.dir));
        if (cadet.isGuidon) {
          // Draw camo rectangle for guidon (same as cadet)
          ctx.fillStyle = "#b6a77a"; // tan
          ctx.fillRect(-AIRMAN_WIDTH/2, -AIRMAN_LENGTH/2, AIRMAN_WIDTH, AIRMAN_LENGTH);
          // Add simple camo pattern: green and brown blobs
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = "#6b7a4b"; // green
          ctx.beginPath();
          ctx.ellipse(-AIRMAN_WIDTH/4, 0, AIRMAN_WIDTH/4, AIRMAN_LENGTH/3, 0, 0, 2*Math.PI);
          ctx.fill();
          ctx.fillStyle = "#7c6f4c"; // brown
          ctx.beginPath();
          ctx.ellipse(AIRMAN_WIDTH/6, AIRMAN_LENGTH/6, AIRMAN_WIDTH/5, AIRMAN_LENGTH/4, Math.PI/6, 0, 2*Math.PI);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
          // Draw guidon flag: center the triangle's centroid at the top right shoulder, pointing up
          ctx.save();
          // Top right shoulder: right edge, top of the guidon rectangle
          ctx.translate(AIRMAN_WIDTH/2, -AIRMAN_LENGTH/2);
          // Define triangle points (bottom left, bottom right, top)
          const A = { x: 0, y: GUIDON_TRIANGLE_SIZE/2 }; // bottom left
          const B = { x: GUIDON_TRIANGLE_SIZE, y: GUIDON_TRIANGLE_SIZE/2 }; // bottom right
          const C = { x: GUIDON_TRIANGLE_SIZE/2, y: -GUIDON_TRIANGLE_SIZE/2 }; // top
          // Compute centroid
          const centroid = {
            x: (A.x + B.x + C.x) / 3,
            y: (A.y + B.y + C.y) / 3,
          };
          // Draw triangle with centroid at (0,0)
          ctx.beginPath();
          ctx.moveTo(A.x - centroid.x, A.y - centroid.y);
          ctx.lineTo(B.x - centroid.x, B.y - centroid.y);
          ctx.lineTo(C.x - centroid.x, C.y - centroid.y);
          ctx.closePath();
          ctx.fillStyle = "#fde68a";
          ctx.fill();
          ctx.restore();
        } else {
          // Camo preview: light tan
          ctx.fillStyle = "#d6c7a1";
          ctx.fillRect(-AIRMAN_WIDTH/2, -AIRMAN_LENGTH/2, AIRMAN_WIDTH, AIRMAN_LENGTH);
        }
        // Draw patrol cap at center (for all preview cadets)
        ctx.save();
        // Cap body (circle)
        const capRadius = inchesToPixels(3.5);
        ctx.beginPath();
        ctx.arc(0, 0, capRadius, 0, 2 * Math.PI);
        ctx.fillStyle = "#b6a77a"; // light camo brown
        ctx.fill();
        // Bill (trapezoid): base 7in, top 5in, height 4.5in, reversed 180deg, base slightly inside the circle
        const baseW = inchesToPixels(7);
        const topW = inchesToPixels(5);
        const billH = inchesToPixels(4.5);
        ctx.fillStyle = "#7c6f4c"; // darker camo brown
        ctx.beginPath();
        ctx.moveTo(-baseW/2, 0);
        ctx.lineTo(-topW/2, -billH);
        ctx.lineTo(topW/2, -billH);
        ctx.lineTo(baseW/2, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // Draw cadets
    for (const cadet of cadets) {
      ctx.save();
      ctx.translate(cadet.x, cadet.y);
      ctx.rotate(degToRad(cadet.dir));
      if (cadet.isGuidon) {
        // Draw camo rectangle for guidon (same as cadet)
        ctx.fillStyle = "#b6a77a"; // tan
        ctx.fillRect(-AIRMAN_WIDTH/2, -AIRMAN_LENGTH/2, AIRMAN_WIDTH, AIRMAN_LENGTH);
        // Add simple camo pattern: green and brown blobs
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#6b7a4b"; // green
        ctx.beginPath();
        ctx.ellipse(-AIRMAN_WIDTH/4, 0, AIRMAN_WIDTH/4, AIRMAN_LENGTH/3, 0, 0, 2*Math.PI);
        ctx.fill();
        ctx.fillStyle = "#7c6f4c"; // brown
        ctx.beginPath();
        ctx.ellipse(AIRMAN_WIDTH/6, AIRMAN_LENGTH/6, AIRMAN_WIDTH/5, AIRMAN_LENGTH/4, Math.PI/6, 0, 2*Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
        // Draw guidon flag: center the triangle's centroid at the top right shoulder, pointing up
        ctx.save();
        // Top right shoulder: right edge, top of the guidon rectangle
        ctx.translate(AIRMAN_WIDTH/2, -AIRMAN_LENGTH/2);
        // Define triangle points (bottom left, bottom right, top)
        const A = { x: 0, y: GUIDON_TRIANGLE_SIZE/2 }; // bottom left
        const B = { x: GUIDON_TRIANGLE_SIZE, y: GUIDON_TRIANGLE_SIZE/2 }; // bottom right
        const C = { x: GUIDON_TRIANGLE_SIZE/2, y: -GUIDON_TRIANGLE_SIZE/2 }; // top
        // Compute centroid
        const centroid = {
          x: (A.x + B.x + C.x) / 3,
          y: (A.y + B.y + C.y) / 3,
        };
        // Draw triangle with centroid at (0,0)
        ctx.beginPath();
        ctx.moveTo(A.x - centroid.x, A.y - centroid.y);
        ctx.lineTo(B.x - centroid.x, B.y - centroid.y);
        ctx.lineTo(C.x - centroid.x, C.y - centroid.y);
        ctx.closePath();
        ctx.fillStyle = "#fde68a";
        ctx.fill();
        ctx.restore();
      } else {
        // OCP camo base color
        ctx.fillStyle = "#b6a77a"; // tan
        ctx.fillRect(-AIRMAN_WIDTH/2, -AIRMAN_LENGTH/2, AIRMAN_WIDTH, AIRMAN_LENGTH);
        // Add simple camo pattern: green and brown blobs
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#6b7a4b"; // green
        ctx.beginPath();
        ctx.ellipse(-AIRMAN_WIDTH/4, 0, AIRMAN_WIDTH/4, AIRMAN_LENGTH/3, 0, 0, 2*Math.PI);
        ctx.fill();
        ctx.fillStyle = "#7c6f4c"; // brown
        ctx.beginPath();
        ctx.ellipse(AIRMAN_WIDTH/6, AIRMAN_LENGTH/6, AIRMAN_WIDTH/5, AIRMAN_LENGTH/4, Math.PI/6, 0, 2*Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // Draw patrol cap at center (for all cadets, including guidon)
      ctx.save();
      const capRadius = inchesToPixels(4.5);
      ctx.beginPath();
      ctx.arc(0, 0, capRadius, 0, 2 * Math.PI);
      ctx.fillStyle = "#7c6f4c"; // brown cap body
      ctx.fill();
      const baseW = inchesToPixels(9);
      const topW = inchesToPixels(6);
      const billH = inchesToPixels(7);
      ctx.fillStyle = "#6b7a4b"; // green bill
      ctx.beginPath();
      ctx.moveTo(-baseW/2, 0);
      ctx.lineTo(-topW/2, -billH);
      ctx.lineTo(topW/2, -billH);
      ctx.lineTo(baseW/2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }
  }, [AIRMAN_LENGTH, AIRMAN_WIDTH, GUIDON_TRIANGLE_SIZE, cadets, width, height, areaWidth, areaHeight, boundary, previewCadets, inchesToPixels]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 shadow-lg transition-colors duration-300"
      style={{ marginBottom: 16 }}
    />
  );
};
