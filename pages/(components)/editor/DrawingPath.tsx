import React from 'react';
import { AssetInstance, useSceneStore } from '@/store/sceneStore';
import { 
  buildWallGeometry, 
  findNearbyWallSegment, 
  mergeWallSegments, 
  snapTo90Degrees 
} from '@/lib/wallGeometry';

interface DrawingPathProps {
  isDrawing: boolean;
  tempPath: { x: number; y: number }[];
  wallDrawingMode: boolean;
  currentWallSegments: { start: { x: number; y: number }; end: { x: number; y: number } }[];
  currentWallStart: { x: number; y: number } | null;
  currentWallTempEnd: { x: number; y: number } | null;
  assets: AssetInstance[];
  canvasPxW: number;
  canvasPxH: number;
  mmToPx: number;
  lastMousePosition: { x: number; y: number };
  clientToCanvasMM: (clientX: number, clientY: number) => { x: number; y: number };
}

export default function DrawingPath({
  isDrawing,
  tempPath,
  wallDrawingMode,
  currentWallSegments,
  currentWallStart,
  currentWallTempEnd,
  assets,
  canvasPxW,
  canvasPxH,
  mmToPx,
  lastMousePosition,
  clientToCanvasMM
}: DrawingPathProps) {
  // Read ALL hooks unconditionally to keep hook order stable across renders
  const shapeMode = useSceneStore((s) => s.shapeMode);
  const shapeStart = useSceneStore((s) => s.shapeStart);
  const shapeTempEnd = useSceneStore((s) => s.shapeTempEnd);

  // Now gate rendering
  if (!isDrawing && !wallDrawingMode && !shapeMode) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={canvasPxW}
      height={canvasPxH}
      style={{ zIndex: 5 }}
    >
      {/* Shape drawing preview */}
      {shapeMode && shapeStart && shapeTempEnd && (
        (() => {
          const x1 = shapeStart.x * mmToPx;
          const y1 = shapeStart.y * mmToPx;
          const x2 = shapeTempEnd.x * mmToPx;
          const y2 = shapeTempEnd.y * mmToPx;
          const left = Math.min(x1, x2);
          const top = Math.min(y1, y2);
          const w = Math.abs(x2 - x1);
          const h = Math.abs(y2 - y1);

          if (shapeMode === 'rectangle') {
            return (
              <rect x={left} y={top} width={w} height={h} fill="none" stroke="#111827" strokeWidth={1.5} strokeDasharray="6,4" />
            );
          }
          if (shapeMode === 'ellipse') {
            return (
              <ellipse cx={left + w / 2} cy={top + h / 2} rx={w / 2} ry={h / 2} fill="none" stroke="#111827" strokeWidth={1.5} strokeDasharray="6,4" />
            );
          }
          if (shapeMode === 'line') {
            return (
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#111827" strokeWidth={2} strokeDasharray="6,4" />
            );
          }
          return null;
        })()
      )}
      {/* Temporary Drawing Path for pen mode */}
      {isDrawing && tempPath.length > 0 && !wallDrawingMode && (
        <>
          {tempPath.length === 1 ? (
            <circle
              cx={tempPath[0].x * mmToPx}
              cy={tempPath[0].y * mmToPx}
              r="2"
              fill="#000000"
            />
          ) : (
            <path
              d={`M ${tempPath[0].x * mmToPx} ${tempPath[0].y * mmToPx} ${tempPath.slice(1).map(point => `L ${point.x * mmToPx} ${point.y * mmToPx}`).join(' ')}`}
              stroke="#000000"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </>
      )}

      {/* Wall Drawing Visual Feedback */}
      {wallDrawingMode && (
        <>
          {/* Render completed wall segments */}
          {currentWallSegments.length > 0 && (() => {
            const wallThickness = 1; // Consistent with default wall thickness
            const wallGap = 8; // 8mm gap in mm units
            
            // Convert segments to mm units for geometry calculation
            const segmentsInMM = currentWallSegments.map(segment => ({
              start: { x: segment.start.x, y: segment.start.y },
              end: { x: segment.end.x, y: segment.end.y }
            }));
            
            // Check if current wall connects to any existing walls
            const wallAssets = assets.filter(asset => asset.wallSegments && asset.wallSegments.length > 0);
            let mergedSegments = segmentsInMM;
            let connectedAsset: AssetInstance | null = null;
            
            // Check if the first or last point of current wall connects to an existing wall
            if (segmentsInMM.length > 0) {
              const firstPoint = segmentsInMM[0].start;
              const lastPoint = segmentsInMM[segmentsInMM.length - 1].end;
              
              const firstConnection = findNearbyWallSegment(firstPoint, wallAssets);
              const lastConnection = findNearbyWallSegment(lastPoint, wallAssets);
              
              if (firstConnection) {
                connectedAsset = firstConnection.asset;
                mergedSegments = mergeWallSegments(segmentsInMM, connectedAsset);
              } else if (lastConnection) {
                connectedAsset = lastConnection.asset;
                mergedSegments = mergeWallSegments(segmentsInMM, connectedAsset);
              }
            }
            
            // Build wall geometry with mitered corners
            const geometry = buildWallGeometry(mergedSegments, wallGap);
            
            if (geometry.outerPoints.length === 0 || geometry.innerPoints.length === 0) {
              return null;
            }
            
            // Convert geometry points to pixels
            const outerPointsPx = geometry.outerPoints.map(point => ({
              x: point.x * mmToPx,
              y: point.y * mmToPx
            }));
            
            const innerPointsPx = geometry.innerPoints.map(point => ({
              x: point.x * mmToPx,
              y: point.y * mmToPx
            }));
            
            // Build continuous path for smooth corners - create one continuous outline
            const outerPath = outerPointsPx.map((point, index) => 
              `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
            ).join(' ');
            
            // Connect back to start with inner path
            const innerPath = innerPointsPx.reverse().map((point, index) => 
              `${index === 0 ? 'L' : 'L'} ${point.x} ${point.y}`
            ).join(' ');
            
            const fullPath = `${outerPath} ${innerPath} Z`;
            
            // Render as a single continuous path with stroke (outline only)
            return (
              <path
                d={fullPath}
                fill="none"
                stroke="#000000"
                strokeWidth={wallThickness}
                strokeLinejoin="round"
                strokeLinecap="square"
              />
            );
          })()}
          
          {/* Render current wall segment being drawn */}
          {currentWallStart && currentWallTempEnd && (() => {
            const wallGap = 8; // 8mm gap in mm units
            
            // Check if the current segment is snapped to 90 degrees
            const originalPoint = clientToCanvasMM(lastMousePosition.x, lastMousePosition.y);
            const snappedPoint = snapTo90Degrees(currentWallStart, originalPoint);
            const isSnapped = Math.abs(snappedPoint.x - originalPoint.x) > 0.1 || Math.abs(snappedPoint.y - originalPoint.y) > 0.1;
            
            // Create temporary segment for geometry calculation
            const tempSegment = {
              start: { x: currentWallStart.x, y: currentWallStart.y },
              end: { x: currentWallTempEnd.x, y: currentWallTempEnd.y }
            };
            
            // Build wall geometry for the current segment
            const geometry = buildWallGeometry([tempSegment], wallGap);
            
            if (geometry.outerPoints.length === 0 || geometry.innerPoints.length === 0) {
              return null;
            }
            
            // Convert geometry points to pixels
            const outerPointsPx = geometry.outerPoints.map(point => ({
              x: point.x * mmToPx,
              y: point.y * mmToPx
            }));
            
            const innerPointsPx = geometry.innerPoints.map(point => ({
              x: point.x * mmToPx,
              y: point.y * mmToPx
            }));
            
            // Build continuous path for the current segment - create one continuous outline
            const outerPath = outerPointsPx.map((point, index) => 
              `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
            ).join(' ');
            
            // Connect back to start with inner path
            const innerPath = innerPointsPx.reverse().map((point, index) => 
              `${index === 0 ? 'L' : 'L'} ${point.x} ${point.y}`
            ).join(' ');
            
            // If the mouse is approaching the first node, avoid closing the path so the "top cap" isn't drawn
            const firstPoint = currentWallSegments.length > 0 ? currentWallSegments[0].start : null;
            const isClosing = firstPoint ? (Math.hypot(currentWallTempEnd.x - firstPoint.x, currentWallTempEnd.y - firstPoint.y) <= 2) : false;
            const fullPath = isClosing ? `${outerPath} ${innerPath}` : `${outerPath} ${innerPath} Z`;
            
            return (
              <>
                <path
                  d={fullPath}
                  fill="none"
                  stroke={isSnapped ? "#22C55E" : "#000000"} // Green when snapped, black when not
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="square"
                  strokeDasharray={isSnapped ? "10,5" : "5,5"} // Different dash pattern when snapped
                  opacity="0.7"
                />
              {(() => {
                // Dimension label for the current segment (in mm)
                const dx = currentWallTempEnd.x - currentWallStart.x;
                const dy = currentWallTempEnd.y - currentWallStart.y;
                const lengthMm = Math.sqrt(dx * dx + dy * dy);
                const midX = ((currentWallStart.x + currentWallTempEnd.x) / 2) * mmToPx;
                const midY = ((currentWallStart.y + currentWallTempEnd.y) / 2) * mmToPx - 12;
                return (
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#111827"
                    fontWeight="bold"
                    pointerEvents="none"
                    style={{ userSelect: 'none' }}
                  >
                    {Math.round(lengthMm)} mm
                  </text>
                );
              })()}
                {/* Show snap angle indicator */}
                {isSnapped && (() => {
                  const dx = currentWallTempEnd.x - currentWallStart.x;
                  const dy = currentWallTempEnd.y - currentWallStart.y;
                  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                  const normalizedAngle = ((angle % 360) + 360) % 360;
                  const snapAngle = Math.round(normalizedAngle / 90) * 90;
                  
                  const midX = ((currentWallStart.x + currentWallTempEnd.x) / 2) * mmToPx;
                  const midY = ((currentWallStart.y + currentWallTempEnd.y) / 2) * mmToPx;
                  
                  return (
                    <text
                      x={midX}
                      y={midY - 10}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#22C55E"
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {snapAngle}°
                    </text>
                  );
                })()}
              </>
            );
          })()}
          
          {/* Render start point */}
          {currentWallStart && (
            <circle
              cx={currentWallStart.x * mmToPx}
              cy={currentWallStart.y * mmToPx}
              r="3"
              fill="#000000"
              stroke="white"
              strokeWidth="1"
            />
          )}
        </>
      )}
    </svg>
  );
}
