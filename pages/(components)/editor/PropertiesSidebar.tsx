"use client";

import React, { useState } from "react";
import { FaUserCircle, FaChevronDown, FaChevronRight } from "react-icons/fa";
import { IoPlayOutline } from "react-icons/io5";
import ShareModal from "./ShareModal";
import { useAssetProperties } from "@/hooks/useAssetProperties";
import { useSceneStore } from "@/store/sceneStore";

export default function PropertiesSidebar(): React.JSX.Element {
  const {
    selectedAsset,
    unit,
    assetX,
    assetY,
    assetScale,
    assetRotation,
    onChangeX,
    onChangeY,
    onChangeScale,
    onChangeRotation,
    onChangeUnit,
    updateAsset
  } = useAssetProperties();

  const showGrid = useSceneStore((s) => s.showGrid);
  const toggleGrid = useSceneStore((s) => s.toggleGrid);
  const addAsset = useSceneStore((s) => s.addAsset);
  
  // Wall drawing state
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const finishWallDrawing = useSceneStore((s) => s.finishWallDrawing);
  const cancelWallDrawing = useSceneStore((s) => s.cancelWallDrawing);

  const [showModel, setShowModel] = useState(true);
  const [showCanvas, setShowCanvas] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [modelName, setModelName] = useState<string>("");
  const [canvasName, setCanvasName] = useState<string>("");

  const roundForDisplay = (num: number) => Math.round(num * 100) / 100;

  return (
    <aside className="h-screen flex flex-col p-3 overflow-y-auto text-sm">
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <FaUserCircle className="text-blue-600 bg-blue-100 rounded-full p-0.5" size={28} />
        <div className="flex items-center gap-1">
          <button className="p-1 rounded hover:bg-gray-100">
            <IoPlayOutline size={14} />
          </button>
          <button
            className="bg-[var(--accent)] text-white px-2 py-1.5 rounded text-xs shadow"
            onClick={() => setShowShareModal(true)}
          >
            Share
          </button>
        </div>
      </div>

      {/* Model Section */}
      <div className="mb-5">
        <button
          className="flex items-center gap-1 text-xs font-semibold tracking-wide mb-1"
          onClick={() => setShowModel((s) => !s)}
        >
          {showModel ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />} Model
        </button>
        {showModel && (
          <div className="space-y-3 pl-5 text-xs">
            <div className="flex justify-between items-center">
              <span>Name</span>
              <input
                type="text"
                value={modelName}
                placeholder="New Model"
                onChange={(e) => setModelName(e.target.value)}
                className="sidebar-input"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="w-full">Owner</span>
              <span className="font-medium w-full">John Doe</span>
            </div>
          </div>
        )}
      </div>

      {/* Canvas / Asset Properties Section */}
      <div className="mb-3">
        <button
          className="flex items-center gap-1 text-xs font-semibold tracking-wide mb-1"
          onClick={() => setShowCanvas((s) => !s)}
        >
          {showCanvas ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />} Model Pages
        </button>
        {showCanvas && (
          <div className="space-y-1 pl-5 text-xs">
            {/* Canvas Name */}
            <div className="flex justify-between items-center">
              <span>Name</span>
              <input
                type="text"
                placeholder="New page name"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                className="sidebar-input"
              />
            </div>

            {/* Grid Toggle */}
            <div className="flex justify-between items-center py-2">
              <span>Grid</span>
              <div className="inline-flex rounded-lg bg-[#0000000D] p-1">
                <button
                  onClick={() => !showGrid && toggleGrid()}
                  className={`px-4 py-1 text-xs rounded-md transition-all ${
                    showGrid 
                      ? 'bg-white text-gray-900 shadow-sm font-medium' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Show
                </button>
                <button
                  onClick={() => showGrid && toggleGrid()}
                  className={`px-4 py-1 text-xs rounded-md transition-all ${
                    !showGrid 
                      ? 'bg-white text-gray-900 shadow-sm font-medium' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Hide
                </button>
              </div>
            </div>

            {/* Wall Drawing Controls */}
            {wallDrawingMode && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs font-medium text-blue-800 mb-2">Wall Drawing</div>
                <div className="text-xs text-blue-600 mb-3">
                  Segments: {currentWallSegments.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={finishWallDrawing}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded shadow"
                  >
                    Finish Wall
                  </button>
                  <button
                    onClick={cancelWallDrawing}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded shadow"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}


            {/* Transform Controls */}
            {selectedAsset && (
              <div className="mt-2">
                <div className="text-xs font-medium mb-2">Selected Asset</div>

                <div className="flex justify-between items-center mb-2">
                  <span>X ({unit})</span>
                  <input
                    type="number"
                    value={roundForDisplay(assetX)}
                    onChange={(e) => onChangeX(Number(e.target.value))}
                    className="sidebar-input w-28 text-xs"
                    step={0.01}
                  />
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span>Y ({unit})</span>
                  <input
                    type="number"
                    value={roundForDisplay(assetY)}
                    onChange={(e) => onChangeY(Number(e.target.value))}
                    className="sidebar-input w-28 text-xs"
                    step={0.01}
                  />
                </div>

                <div className="flex justify-between items-center mb-2">
                  <span>Scale</span>
                  <input
                    type="number"
                    value={assetScale}
                    onChange={(e) => onChangeScale(Number(e.target.value))}
                    step={0.01}
                    min={0.01}
                    className="sidebar-input w-28 text-xs"
                  />
                </div>

                {/* Universal sizing properties - disabled for text */}
                {selectedAsset.type !== "text" && (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Width (px)</span>
                      <input
                        type="number"
                        value={selectedAsset.width || 24}
                        onChange={(e) => updateAsset(selectedAsset.id, { width: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Height (px)</span>
                      <input
                        type="number"
                        value={selectedAsset.height || 24}
                        onChange={(e) => updateAsset(selectedAsset.id, { height: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                  </div>
                )}

                {/* Shape-specific properties */}
                {selectedAsset.type === "square" || selectedAsset.type === "circle" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Fill Color</span>
                      <input
                        type="color"
                        value={selectedAsset.fillColor || "#93C5FD"}
                        onChange={(e) => updateAsset(selectedAsset.id, { fillColor: e.target.value })}
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "line" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Stroke Width</span>
                      <input
                        type="number"
                        value={selectedAsset.strokeWidth || 2}
                        onChange={(e) => updateAsset(selectedAsset.id, { strokeWidth: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Stroke Color</span>
                      <input
                        type="color"
                        value={selectedAsset.strokeColor || "#3B82F6"}
                        onChange={(e) => updateAsset(selectedAsset.id, { strokeColor: e.target.value })}
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "double-line" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Line Width</span>
                      <input
                        type="number"
                        value={selectedAsset.strokeWidth || 2}
                        onChange={(e) => updateAsset(selectedAsset.id, { strokeWidth: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Line Gap</span>
                      <input
                        type="number"
                        value={selectedAsset.lineGap || 8}
                        onChange={(e) => updateAsset(selectedAsset.id, { lineGap: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Line Color</span>
                      <input
                        type="color"
                        value={selectedAsset.lineColor || "#3B82F6"}
                        onChange={(e) => updateAsset(selectedAsset.id, { lineColor: e.target.value })}
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "drawn-line" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Stroke Width</span>
                      <input
                        type="number"
                        value={selectedAsset.strokeWidth || 2}
                        onChange={(e) => updateAsset(selectedAsset.id, { strokeWidth: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                        min={1}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Stroke Color</span>
                      <input
                        type="color"
                        value={selectedAsset.strokeColor || "#3B82F6"}
                        onChange={(e) => updateAsset(selectedAsset.id, { strokeColor: e.target.value })}
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                  </div>
                ) : selectedAsset.type === "text" ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span>Text</span>
                      <input
                        type="text"
                        value={selectedAsset.text || ""}
                        onChange={(e) => updateAsset(selectedAsset.id, { text: e.target.value })}
                        className="sidebar-input w-28 text-xs"
                        placeholder="Enter text"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Font Size</span>
                      <input
                        type="number"
                        value={selectedAsset.fontSize || 16}
                        onChange={(e) => updateAsset(selectedAsset.id, { fontSize: Number(e.target.value) })}
                        className="sidebar-input w-28 text-xs"
                        min={8}
                        max={72}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Text Color</span>
                      <input
                        type="color"
                        value={selectedAsset.textColor || "#000000"}
                        onChange={(e) => updateAsset(selectedAsset.id, { textColor: e.target.value })}
                        className="w-28 h-6 p-0 border-none"
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Font Family</span>
                      <select
                        value={selectedAsset.fontFamily || "Arial"}
                        onChange={(e) => updateAsset(selectedAsset.id, { fontFamily: e.target.value })}
                        className="sidebar-input w-28 text-xs"
                      >
                        <option value="Arial">Arial</option>
                        <option value="Helvetica">Helvetica</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Courier New">Courier New</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {/* Background Color */}
                <div className="flex justify-between items-center mb-2 mt-2">
                  <span>Background</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!(selectedAsset.backgroundColor && selectedAsset.backgroundColor !== "transparent")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateAsset(selectedAsset.id, { backgroundColor: "#FFFFFF" });
                        } else {
                          updateAsset(selectedAsset.id, { backgroundColor: "transparent" });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    {selectedAsset.backgroundColor && selectedAsset.backgroundColor !== "transparent" && (
                      <input
                        type="color"
                        value={selectedAsset.backgroundColor}
                        onChange={(e) => updateAsset(selectedAsset.id, { backgroundColor: e.target.value })}
                        className="w-8 h-6 p-0 border-none"
                      />
                    )}
                  </div>
                </div>

                {/* Rotation */}
                <div className="flex justify-between items-center mb-2 mt-2">
                  <span>Rotation (deg)</span>
                  <input
                    type="number"
                    value={assetRotation}
                    onChange={(e) => onChangeRotation(Number(e.target.value))}
                    step={1}
                    className="sidebar-input w-28 text-xs"
                  />
                </div>

                {/* Unit dropdown */}
                <div className="flex justify-between items-center mt-3">
                  <span>Unit</span>
                  <select
                    value={unit}
                    onChange={(e) => onChangeUnit(e.target.value)}
                    className="sidebar-input w-22"
                  >
                    <option>px</option>
                    <option>cm</option>
                    <option>mm</option>
                  </select>
                </div>

                {/* Remove Asset Button */}
                <div className="mt-4">
                  <button
                    className="w-full text-xs bg-red-500 hover:bg-red-600 text-white py-1.5 rounded shadow"
                    onClick={() => {
                      useSceneStore.getState().removeAsset(selectedAsset.id);
                    }}
                  >
                    Remove Asset
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

