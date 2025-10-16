import React from "react";
import { AssetInstance } from "@/store/sceneStore";
import {
  buildWallGeometry,
  calculateWallBoundingBox,
} from "@/lib/wallGeometry";

type WallRenderingProps = {
  asset: AssetInstance;
  leftPx: number;
  topPx: number;
  totalRotation: number;
};

export default function WallRendering({
  asset,
  leftPx,
  topPx,
  totalRotation,
}: WallRenderingProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: leftPx,
        top: topPx,
        transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
        cursor: "move",
      }}
    >
      {(() => {
        const boundingBox = calculateWallBoundingBox(asset);
        const width = Math.max(boundingBox.width, 100); // Minimum 100mm
        const height = Math.max(boundingBox.height, 100); // Minimum 100mm

        return (
          <svg
            width={width}
            height={height}
            viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
            style={{ overflow: "visible" }}
          >
            {asset.wallSegments &&
              asset.wallSegments.length > 0 &&
              (() => {
                const wallThickness = (asset.wallThickness ?? 1) * asset.scale;
                const wallGap = asset.wallGap ?? 8; // Wall gap in mm units (will be scaled)

                // Wall segments are already in relative coordinates
                const relativeSegments = asset.wallSegments;

                // Build wall geometry with mitered corners
                const geometry = buildWallGeometry(relativeSegments, wallGap);

                if (
                  geometry.outerPoints.length === 0 ||
                  geometry.innerPoints.length === 0
                ) {
                  return null;
                }

                // Apply scale to geometry points
                const outerPointsScaled = geometry.outerPoints.map((point) => ({
                  x: point.x * asset.scale,
                  y: point.y * asset.scale,
                }));

                const innerPointsScaled = geometry.innerPoints.map((point) => ({
                  x: point.x * asset.scale,
                  y: point.y * asset.scale,
                }));

                // Build continuous path for smooth corners - create one continuous outline
                const outerPath = outerPointsScaled
                  .map(
                    (point, index) =>
                      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
                  )
                  .join(" ");

                const innerPath = innerPointsScaled
                  .reverse()
                  .map(
                    (point, index) =>
                      `${index === 0 ? "L" : "L"} ${point.x} ${point.y}`
                  )
                  .join(" ");

                const fullPath = `${outerPath} ${innerPath} Z`;

                return (
                  <path
                    d={`
    M ${-width * 2} ${-height * 2}
    H ${width * 2}
    V ${height * 2}
    H ${-width * 2}
    Z
    ${fullPath}
  `}
                    fill={asset.lineColor ?? "#000000"}
                    fillRule="evenodd"
                  />
                );
              })()}
          </svg>
        );
      })()}
    </div>
  );
}
