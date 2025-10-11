"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useSceneStore, AssetInstance, EventData } from "@/store/sceneStore";
import { PaperSize } from "@/lib/paperSizes";
import { PAPER_SIZES } from "@/lib/paperSizes";

// Type for API response that wraps EventData
type EventDataResponse = {
  data: EventData;
} | EventData;
import { ASSET_LIBRARY } from "@/lib/assets";
import { RotateCw, RotateCcw } from "lucide-react";

type CanvasProps = {
  workspaceZoom: number;
  mmToPx: number;
  canvasPos: { x: number; y: number };
  setCanvasPos: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  canvas?: { size: string; width: number; height: number } | null;
  assets?: AssetInstance[];
  eventData?: EventDataResponse | null;
};

export default function Canvas({ workspaceZoom, mmToPx, canvasPos, setCanvasPos, canvas: propCanvas, assets: propAssets, eventData }: CanvasProps) {
  // Use store data for rendering (synced from props)
  const canvas = useSceneStore((s) => s.canvas);
  const assets = useSceneStore((s) => s.assets);
  const addAsset = useSceneStore((s) => s.addAsset);
  const addAssetObject = useSceneStore((s) => s.addAssetObject);
  const updateAsset = useSceneStore((s) => s.updateAsset);
  const selectedAssetId = useSceneStore((s) => s.selectedAssetId);
  const selectAsset = useSceneStore((s) => s.selectAsset);
  const reset = useSceneStore((s) => s.reset);
  const markAsSaved = useSceneStore((s) => s.markAsSaved);
  const showGrid = useSceneStore((s) => s.showGrid);
  const isPenMode = useSceneStore((s) => s.isPenMode);
  const isWallMode = useSceneStore((s) => s.isWallMode);
  const isDrawing = useSceneStore((s) => s.isDrawing);
  const currentPath = useSceneStore((s) => s.currentPath);
  const tempPath = useSceneStore((s) => s.tempPath);
  const wallDrawingMode = useSceneStore((s) => s.wallDrawingMode);
  const currentWallSegments = useSceneStore((s) => s.currentWallSegments);
  const currentWallStart = useSceneStore((s) => s.currentWallStart);
  const currentWallTempEnd = useSceneStore((s) => s.currentWallTempEnd);
  const setPenMode = useSceneStore((s) => s.setPenMode);
  const setWallMode = useSceneStore((s) => s.setWallMode);
  const setIsDrawing = useSceneStore((s) => s.setIsDrawing);
  const setCurrentPath = useSceneStore((s) => s.setCurrentPath);
  const setTempPath = useSceneStore((s) => s.setTempPath);
  const addPointToPath = useSceneStore((s) => s.addPointToPath);
  const clearPath = useSceneStore((s) => s.clearPath);
  const setWallDrawingMode = useSceneStore((s) => s.setWallDrawingMode);
  const startWallSegment = useSceneStore((s) => s.startWallSegment);
  const updateWallTempEnd = useSceneStore((s) => s.updateWallTempEnd);
  const commitWallSegment = useSceneStore((s) => s.commitWallSegment);
  const finishWallDrawing = useSceneStore((s) => s.finishWallDrawing);
  const cancelWallDrawing = useSceneStore((s) => s.cancelWallDrawing);
  const copyAsset = useSceneStore((s) => s.copyAsset);
  const pasteAsset = useSceneStore((s) => s.pasteAsset);
  const clipboard = useSceneStore((s) => s.clipboard);

  // Sync props data to store when props change (only once per data change)
  const hasSyncedRef = useRef(false);
  const lastDataRef = useRef<string>('');
  
  useEffect(() => {
    if (propCanvas && propAssets) {
      // Create a unique identifier for this data set
      const dataId = JSON.stringify({ canvas: propCanvas, assets: propAssets });
      
      // Only sync if the data has actually changed and we haven't synced this data yet
      if (dataId !== lastDataRef.current) {
        
        // Reset store and populate with current props data
        reset();
        
        // Set canvas only if size is a known PaperSize (A1–A5)
        const isKnownSize = !!(propCanvas.size && (propCanvas.size as keyof typeof PAPER_SIZES) in PAPER_SIZES);
        if (isKnownSize) {
          const setCanvas = useSceneStore.getState().setCanvas;
          setCanvas(propCanvas.size as PaperSize);
        }
        
        // Add assets
        propAssets.forEach(asset => {
          addAssetObject(asset);
        });
        
        // Mark as saved since this is from the backend
        markAsSaved();
        
        // Update the refs
        lastDataRef.current = dataId;
        hasSyncedRef.current = true;
      }
    }
  }, [propCanvas, propAssets]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingAssetRef = useRef<string | null>(null);
  const isMovingCanvas = useRef(false);
  const lastCanvasPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isScalingAsset = useRef(false);
  const isAdjustingHeight = useRef(false);
  const isRotatingAsset = useRef(false);
  const initialScale = useRef(1);
  const initialHeight = useRef(1);
  const initialDistance = useRef(0);
  const initialRotation = useRef(0);
  const initialMouseAngle = useRef(0);
  const scaleHandleType = useRef<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const heightHandleType = useRef<'top' | 'bottom' | null>(null);
  const currentDrawingPath = useRef<{ x: number; y: number }[]>([]);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const [rotation, setRotation] = useState<number>(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null);
  // Use store canvas when known; otherwise fall back to provided dimensions so we can still render an empty layout without paper
  const effectiveWidthMm = (canvas?.width ?? propCanvas?.width ?? 0);
  const effectiveHeightMm = (canvas?.height ?? propCanvas?.height ?? 0);
  const canvasPxW = effectiveWidthMm * mmToPx;
  const canvasPxH = effectiveHeightMm * mmToPx;

  const clientToCanvasMM = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || !effectiveWidthMm || !effectiveHeightMm) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const theta = (-rotation * Math.PI) / 180;
    const ux = dx * Math.cos(theta) - dy * Math.sin(theta);
    const uy = dx * Math.sin(theta) + dy * Math.cos(theta);
    const halfWscreen = (canvasPxW * workspaceZoom) / 2;
    const halfHscreen = (canvasPxH * workspaceZoom) / 2;
    const xMm = (ux + halfWscreen) / (mmToPx * workspaceZoom);
    const yMm = (uy + halfHscreen) / (mmToPx * workspaceZoom);
    return { x: xMm, y: yMm };
  }, [effectiveWidthMm, effectiveHeightMm, canvasPxW, canvasPxH, workspaceZoom, mmToPx, rotation]);


  // Function to straighten a path if it's close to being a straight line
  const straightenPath = useCallback((path: { x: number; y: number }[]) => {
    if (path.length < 3) return path;
    
    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    
    // Calculate straight-line distance
    const straightDistance = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
    );
    
    // Calculate actual path distance
    let actualDistance = 0;
    for (let i = 1; i < path.length; i++) {
      const segmentDistance = Math.sqrt(
        Math.pow(path[i].x - path[i-1].x, 2) + Math.pow(path[i].y - path[i-1].y, 2)
      );
      actualDistance += segmentDistance;
    }
    
    // Calculate straightness ratio (1.0 = perfectly straight)
    const straightnessRatio = straightDistance / actualDistance;
    
    // If the path is close to straight (ratio > 0.85), straighten it
    if (straightnessRatio > 0.85) {
      // Create a straight line with multiple points for smooth rendering
      const numPoints = Math.max(3, Math.ceil(straightDistance / 5)); // 1 point per 5mm
      const straightenedPath: { x: number; y: number }[] = [];
      
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const x = startPoint.x + (endPoint.x - startPoint.x) * t;
        const y = startPoint.y + (endPoint.y - startPoint.y) * t;
        straightenedPath.push({ x, y });
      }
      
      return straightenedPath;
    }
    
    // If not straight enough, return original path
    return path;
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Store mouse position for use in mouse up handler
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      if (isRotatingAsset.current && selectedAssetId) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
          
          // Calculate angle from asset center to mouse position
          const deltaX = mouseX - asset.x;
          const deltaY = mouseY - asset.y;
          const currentMouseAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
          
          // Calculate rotation difference from initial angle
          const rotationDelta = currentMouseAngle - initialMouseAngle.current;
          const newRotation = initialRotation.current + rotationDelta;
          
          updateAsset(selectedAssetId, { rotation: newRotation });
        }
        return;
      }

      if (isScalingAsset.current && selectedAssetId && scaleHandleType.current) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
          
          // Use distance from asset center to mouse position for stable scaling
          const assetCenterX = asset.x;
          const assetCenterY = asset.y;
          
          // Calculate current distance from asset center to mouse position
          const currentDistance = Math.sqrt(
            Math.pow(mouseX - assetCenterX, 2) + Math.pow(mouseY - assetCenterY, 2)
          );
          
          // Calculate scale based on distance ratio
          const scaleRatio = currentDistance / initialDistance.current;
          const newScale = Math.max(0.1, Math.min(10, initialScale.current * scaleRatio));
          
          updateAsset(selectedAssetId, { scale: newScale });
        }
        return;
      }

      if (isAdjustingHeight.current && selectedAssetId && heightHandleType.current) {
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (asset) {
          const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
          const assetCenterY = asset.y;
          
          // Calculate height adjustment based on mouse distance from center
          const heightDelta = Math.abs(mouseY - assetCenterY);
          const heightRatio = heightDelta / initialDistance.current;
          const newHeight = Math.max(10, Math.min(500, initialHeight.current * heightRatio));
          
          updateAsset(selectedAssetId, { height: newHeight });
        }
        return;
      }
      
      if (isDrawing && (isPenMode || isWallMode)) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        currentDrawingPath.current = [...currentDrawingPath.current, { x, y }];
        setCurrentPath(currentDrawingPath.current);
        setTempPath([...currentDrawingPath.current]); // Create a new array to ensure re-render
        console.log('Drawing point:', { x, y }, 'Path length:', currentDrawingPath.current.length);
        return;
      }

      // Handle wall drawing mode mouse movement
      if (wallDrawingMode && currentWallStart) {
        // Check if mouse is over the canvas element
        const canvasElement = canvasRef.current;
        if (!canvasElement) return;
        
        const rect = canvasElement.getBoundingClientRect();
        const isOverCanvas = e.clientX >= rect.left && e.clientX <= rect.right && 
                            e.clientY >= rect.top && e.clientY <= rect.bottom;
        
        if (!isOverCanvas) return; // Don't update temp end if mouse is outside canvas
        
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        
        // Check if mouse is within canvas bounds
        if (canvas && (x >= 0 && y >= 0 && x <= canvas.width && y <= canvas.height)) {
          updateWallTempEnd({ x, y });
        }
        return;
      }

      if (draggingAssetRef.current) {
        const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
        updateAsset(draggingAssetRef.current, { x, y });
        return;
      }
      if (isMovingCanvas.current) {
        const dx = e.clientX - lastCanvasPointer.current.x;
        const dy = e.clientY - lastCanvasPointer.current.y;
        setCanvasPos((p) => ({ x: p.x + dx / workspaceZoom, y: p.y + dy / workspaceZoom }));
        lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
      }
    };

    const onUp = () => {
      if (isDrawing && (isPenMode || isWallMode)) {
        if (currentDrawingPath.current.length > 1) {
          // Straighten the path if it's close to a straight line
          const straightenedPath = straightenPath(currentDrawingPath.current);
          
          // Calculate center point and dimensions of the straightened path
          const startPoint = straightenedPath[0];
          const endPoint = straightenedPath[straightenedPath.length - 1];
          
          const centerX = (startPoint.x + endPoint.x) / 2;
          const centerY = (startPoint.y + endPoint.y) / 2;
          
          // Calculate length for the line
          const length = Math.sqrt(
            Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)
          );
          
          // Determine if the line is more horizontal or vertical
          const deltaX = Math.abs(endPoint.x - startPoint.x);
          const deltaY = Math.abs(endPoint.y - startPoint.y);
          const isHorizontal = deltaX > deltaY;
          
          let newAsset: AssetInstance;
          
          if (isWallMode) {
            // Create double line asset for wall mode
            const id = `double-line-${Date.now()}`;
            newAsset = {
              id,
              type: "double-line",
              x: centerX,
              y: centerY,
              scale: 1,
              rotation: 0, // Start with 0 rotation - user can rotate manually if needed
              width: isHorizontal ? length : 2, // Width: length for horizontal lines, thickness for vertical
              height: isHorizontal ? 2 : length, // Height: thickness for horizontal lines, length for vertical
              lineGap: 8, // Gap between the two lines
              lineColor: "#3B82F6", // Color of the lines
              backgroundColor: "transparent",
              isHorizontal: isHorizontal // Store the orientation
            };
          } else {
            // Create single line asset for pen mode (drawn-line type for path rendering)
            const id = `drawn-line-${Date.now()}`;
            
            // Convert path coordinates to be relative to the center point
            const relativePath = straightenedPath.map(point => ({
              x: point.x - centerX,
              y: point.y - centerY
            }));
            
            newAsset = {
              id,
              type: "drawn-line",
              x: centerX,
              y: centerY,
              scale: 1,
              rotation: 0, // Start with 0 rotation - user can rotate manually if needed
              strokeWidth: 2,
              strokeColor: "#3B82F6",
              backgroundColor: "transparent",
              path: relativePath // Store the relative path for rendering
            };
          }
          
          addAssetObject(newAsset);
          selectAsset(newAsset.id);
        }
        
        // Reset drawing state
        setIsDrawing(false);
        currentDrawingPath.current = [];
        clearPath();
        setPenMode(false);
        setWallMode(false);
      }

      // Handle wall drawing mode mouse up
      if (wallDrawingMode && currentWallStart && currentWallTempEnd) {
        // Check if mouse was over the canvas when released
        const canvasElement = canvasRef.current;
        if (canvasElement) {
          const rect = canvasElement.getBoundingClientRect();
          const isOverCanvas = lastMousePosition.current.x >= rect.left && lastMousePosition.current.x <= rect.right && 
                              lastMousePosition.current.y >= rect.top && lastMousePosition.current.y <= rect.bottom;
          
          if (isOverCanvas) {
            commitWallSegment();
          } else {
            console.log('Mouse released outside canvas, not committing wall segment');
          }
        }
      }

      draggingAssetRef.current = null;
      isMovingCanvas.current = false;
      isScalingAsset.current = false;
      isAdjustingHeight.current = false;
      isRotatingAsset.current = false;
      initialScale.current = 1;
      initialHeight.current = 1;
      initialDistance.current = 0;
      initialRotation.current = 0;
      initialMouseAngle.current = 0;
      scaleHandleType.current = null;
      heightHandleType.current = null;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [workspaceZoom, mmToPx, rotation, updateAsset, setCanvasPos, selectedAssetId, clientToCanvasMM, isDrawing, isPenMode, isWallMode, setCurrentPath, setTempPath, clearPath, setPenMode, setWallMode, straightenPath, wallDrawingMode, currentWallStart, currentWallTempEnd, updateWallTempEnd, commitWallSegment]);

  // Keyboard event handlers for copy/paste and wall drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle copy/paste if we're not in a text input or textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // Handle wall drawing mode
      if (wallDrawingMode && e.key === 'Escape') {
        e.preventDefault();
        if (currentWallSegments.length > 0) {
          finishWallDrawing();
        } else {
          cancelWallDrawing();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' && selectedAssetId) {
          e.preventDefault();
          copyAsset(selectedAssetId);
          // Show visual feedback
          setCopiedAssetId(selectedAssetId);
          setTimeout(() => setCopiedAssetId(null), 500);
        } else if (e.key === 'v' && clipboard) {
          e.preventDefault();
          pasteAsset();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedAssetId, clipboard, copyAsset, pasteAsset, wallDrawingMode, currentWallSegments, finishWallDrawing, cancelWallDrawing]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("assetType");
    if (!type || !canvasRef.current || !canvas) return;
    const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
    addAsset(type, x, y);
  };

  // When canvas is unknown (non A-series), we still render an empty layout with no paper background

  const rotateCW = () => setRotation((r) => (r + 90) % 360);
  const rotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  const onAssetMouseDown = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    let draggingId = asset.id;

    if (e.ctrlKey || e.metaKey) {
      const newAsset = {
        ...asset,
        id: crypto.randomUUID(),
        x: asset.x + 5,
        y: asset.y + 5,
      };
      addAssetObject(newAsset);
      draggingId = newAsset.id;
    }

    selectAsset(draggingId);
    draggingAssetRef.current = draggingId;
  };

  const onTextDoubleClick = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset || asset.type !== "text") return;
    
    setEditingTextId(assetId);
    setEditingText(asset.text ?? "");
  };

  const onTextEditKeyDown = (e: React.KeyboardEvent, assetId: string) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      if (e.key === "Enter") {
        updateAsset(assetId, { text: editingText });
      }
      setEditingTextId(null);
      setEditingText("");
    }
  };

  const onTextEditBlur = (assetId: string) => {
    updateAsset(assetId, { text: editingText });
    setEditingTextId(null);
    setEditingText("");
  };

  const onScaleHandleMouseDown = (e: React.MouseEvent, assetId: string, handleType: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
    
    // Use distance from asset center to mouse position for stable scaling
    const assetCenterX = asset.x;
    const assetCenterY = asset.y;
    
    // Calculate initial distance from asset center to mouse position
    initialDistance.current = Math.sqrt(
      Math.pow(mouseX - assetCenterX, 2) + Math.pow(mouseY - assetCenterY, 2)
    );
    
    initialScale.current = asset.scale;
    scaleHandleType.current = handleType;
    isScalingAsset.current = true;
  };

  const onHeightHandleMouseDown = (e: React.MouseEvent, assetId: string, handleType: 'top' | 'bottom') => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
    const assetCenterY = asset.y;
    
    // Calculate initial distance from asset center to mouse position
    initialDistance.current = Math.abs(mouseY - assetCenterY);
    
    initialHeight.current = asset.height ?? 50;
    heightHandleType.current = handleType;
    isAdjustingHeight.current = true;
  };

  const onRotationHandleMouseDown = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;

    const { x: mouseX, y: mouseY } = clientToCanvasMM(e.clientX, e.clientY);
    
    // Calculate initial angle from asset center to mouse position
    const deltaX = mouseX - asset.x;
    const deltaY = mouseY - asset.y;
    initialMouseAngle.current = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    
    initialRotation.current = asset.rotation;
    isRotatingAsset.current = true;
  };

  const getAssetCornerPosition = (asset: AssetInstance, handleType: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    const handleSize = 12;
    
    if (asset.type === "square" || asset.type === "circle") {
      const width = (asset.width ?? 50) * asset.scale;
      const height = (asset.height ?? 50) * asset.scale;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - width / 2 - 6, y: asset.y - height / 2 - 6 };
        case 'top-right':
          return { x: asset.x + width / 2 + 6, y: asset.y - height / 2 - 6 };
        case 'bottom-left':
          return { x: asset.x - width / 2 - 6, y: asset.y + height / 2 + 6 };
        case 'bottom-right':
          return { x: asset.x + width / 2 + 6, y: asset.y + height / 2 + 6 };
      }
    } else if (asset.type === "line") {
      const width = (asset.width ?? 100) * asset.scale;
      const height = (asset.strokeWidth ?? 2) * asset.scale;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - width / 2 - 6, y: asset.y - height / 2 - 6 };
        case 'top-right':
          return { x: asset.x + width / 2 + 6, y: asset.y - height / 2 - 6 };
        case 'bottom-left':
          return { x: asset.x - width / 2 - 6, y: asset.y + height / 2 + 6 };
        case 'bottom-right':
          return { x: asset.x + width / 2 + 6, y: asset.y + height / 2 + 6 };
      }
    } else if (asset.type === "double-line") {
      const lineGap = (asset.lineGap ?? 8) * asset.scale;
      const isHorizontal = asset.isHorizontal ?? true;
      const lineThickness = 2;
      
      const totalWidth = isHorizontal ? (asset.width ?? 100) * asset.scale : (lineThickness + lineGap);
      const totalHeight = isHorizontal ? (lineThickness + lineGap) : (asset.height ?? 100) * asset.scale;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - totalWidth / 2 - 6, y: asset.y - totalHeight / 2 - 6 };
        case 'top-right':
          return { x: asset.x + totalWidth / 2 + 6, y: asset.y - totalHeight / 2 - 6 };
        case 'bottom-left':
          return { x: asset.x - totalWidth / 2 - 6, y: asset.y + totalHeight / 2 + 6 };
        case 'bottom-right':
          return { x: asset.x + totalWidth / 2 + 6, y: asset.y + totalHeight / 2 + 6 };
      }
    } else if (asset.type === "wall-segments") {
      // For wall segments, use a fixed bounding box since segments can be any shape
      const boundingSize = 200 * asset.scale;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - boundingSize / 2 - 6, y: asset.y - boundingSize / 2 - 6 };
        case 'top-right':
          return { x: asset.x + boundingSize / 2 + 6, y: asset.y - boundingSize / 2 - 6 };
        case 'bottom-left':
          return { x: asset.x - boundingSize / 2 - 6, y: asset.y + boundingSize / 2 + 6 };
        case 'bottom-right':
          return { x: asset.x + boundingSize / 2 + 6, y: asset.y + boundingSize / 2 + 6 };
      }
    } else if (asset.type === "text") {
      // For text, estimate size based on text content and font size
      const fontSize = (asset.fontSize ?? 16) * asset.scale;
      const textLength = (asset.text ?? "Enter text").length;
      const estimatedWidth = Math.max(textLength * fontSize * 0.6, 50); // Rough estimation
      const estimatedHeight = fontSize * 1.2;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - estimatedWidth / 2 - handleSize / 2, y: asset.y - estimatedHeight / 2 - handleSize / 2 };
        case 'top-right':
          return { x: asset.x + estimatedWidth / 2 + handleSize / 2, y: asset.y - estimatedHeight / 2 - handleSize / 2 };
        case 'bottom-left':
          return { x: asset.x - estimatedWidth / 2 - handleSize / 2, y: asset.y + estimatedHeight / 2 + handleSize / 2 };
        case 'bottom-right':
          return { x: asset.x + estimatedWidth / 2 + handleSize / 2, y: asset.y + estimatedHeight / 2 + handleSize / 2 };
      }
    } else {
      // For all other assets (icons, custom SVGs), use width and height
      const width = (asset.width ?? 24) * asset.scale;
      const height = (asset.height ?? 24) * asset.scale;
      
      switch (handleType) {
        case 'top-left':
          return { x: asset.x - width / 2 - 6, y: asset.y - height / 2 - 6 };
        case 'top-right':
          return { x: asset.x + width / 2 + 6, y: asset.y - height / 2 - 6 };
        case 'bottom-left':
          return { x: asset.x - width / 2 - 6, y: asset.y + height / 2 + 6 };
        case 'bottom-right':
          return { x: asset.x + width / 2 + 6, y: asset.y + height / 2 + 6 };
      }
    }
    return { x: asset.x, y: asset.y };
  };

  const getRotationHandlePosition = (asset: AssetInstance) => {
    const handleOffset = 30; // Distance from asset edge
    
    if (asset.type === "square" || asset.type === "circle") {
      const height = (asset.height ?? 50) * asset.scale;
      return { 
        x: asset.x, 
        y: asset.y - height / 2 - handleOffset 
      };
    } else if (asset.type === "line") {
      const height = (asset.strokeWidth ?? 2) * asset.scale;
      return { 
        x: asset.x, 
        y: asset.y - height / 2 - handleOffset 
      };
    } else if (asset.type === "double-line") {
      const isHorizontal = asset.isHorizontal ?? true;
      const lineThickness = 2;
      const lineGap = (asset.lineGap ?? 8) * asset.scale;
      
      const totalHeight = isHorizontal ? (lineThickness + lineGap) : (asset.height ?? 100) * asset.scale;
      
      return { 
        x: asset.x, 
        y: asset.y - totalHeight / 2 - handleOffset 
      };
    } else if (asset.type === "wall-segments") {
      // For wall segments, use a fixed bounding box since segments can be any shape
      const boundingSize = 200 * asset.scale;
      
      return { 
        x: asset.x, 
        y: asset.y - boundingSize / 2 - handleOffset 
      };
    } else if (asset.type === "text") {
      const fontSize = (asset.fontSize ?? 16) * asset.scale;
      const estimatedHeight = fontSize * 1.2;
      return { 
        x: asset.x, 
        y: asset.y - estimatedHeight / 2 - handleOffset 
      };
    } else {
      // For icons and other assets
      const height = (asset.height ?? 24) * asset.scale;
      return { 
        x: asset.x, 
        y: asset.y - height / 2 - handleOffset 
      };
    }
  };

  const renderAssetHandles = (asset: AssetInstance, leftPx: number, topPx: number) => {
    const handleSize = 12;
    
    // Calculate handle positions directly in pixel coordinates relative to asset center
    const assetCenterPx = { x: leftPx, y: topPx };
    
    if (asset.type === "square" || asset.type === "circle") {
      const width = (asset.width ?? 50) * asset.scale;
      const height = (asset.height ?? 50) * asset.scale;
      
      const topLeftPx = { 
        x: assetCenterPx.x - width / 2 - 6, 
        y: assetCenterPx.y - height / 2 - 6 
      };
      const topRightPx = { 
        x: assetCenterPx.x + width / 2 + 6, 
        y: assetCenterPx.y - height / 2 - 6 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - width / 2 - 6, 
        y: assetCenterPx.y + height / 2 + 6 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + width / 2 + 6, 
        y: assetCenterPx.y + height / 2 + 6 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - height / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Height adjustment handles - hidden for double-line assets */}
          {/* 
          <div
            onMouseDown={(e) => onHeightHandleMouseDown(e, asset.id, 'top')}
            style={{
              position: "absolute",
              left: assetCenterPx.x - 10,
              top: topLeftPx.y,
              width: 8,
              height: handleSize,
              backgroundColor: "#10B981",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ns-resize",
              zIndex: 10,
            }}
            className="hover:bg-green-600 transition-colors"
            title="Adjust height"
          />
          <div
            onMouseDown={(e) => onHeightHandleMouseDown(e, asset.id, 'bottom')}
            style={{
              position: "absolute",
              left: assetCenterPx.x - 10,
              top: bottomLeftPx.y,
              width: 8,
              height: handleSize,
              backgroundColor: "#10B981",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ns-resize",
              zIndex: 10,
            }}
            className="hover:bg-green-600 transition-colors"
            title="Adjust height"
          />
          */}
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    } else if (asset.type === "line") {
      const width = (asset.width ?? 100) * asset.scale;
      const height = (asset.strokeWidth ?? 2) * asset.scale;
      
      const topLeftPx = { 
        x: assetCenterPx.x - width / 2 - 6, 
        y: assetCenterPx.y - height / 2 - 6 
      };
      const topRightPx = { 
        x: assetCenterPx.x + width / 2 + 6, 
        y: assetCenterPx.y - height / 2 - 6 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - width / 2 - 6, 
        y: assetCenterPx.y + height / 2 + 6 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + width / 2 + 6, 
        y: assetCenterPx.y + height / 2 + 6 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - height / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles for line */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    } else if (asset.type === "double-line") {
      const lineGap = (asset.lineGap ?? 8) * asset.scale;
      const isHorizontal = asset.isHorizontal ?? true;
      const lineThickness = 2;
      
      const totalWidth = isHorizontal ? (asset.width ?? 100) * asset.scale : (lineThickness + lineGap);
      const totalHeight = isHorizontal ? (lineThickness + lineGap) : (asset.height ?? 100) * asset.scale;
      
      const topLeftPx = { 
        x: assetCenterPx.x - totalWidth / 2 - 6, 
        y: assetCenterPx.y - totalHeight / 2 - 6 
      };
      const topRightPx = { 
        x: assetCenterPx.x + totalWidth / 2 + 6, 
        y: assetCenterPx.y - totalHeight / 2 - 6 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - totalWidth / 2 - 6, 
        y: assetCenterPx.y + totalHeight / 2 + 6 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + totalWidth / 2 + 6, 
        y: assetCenterPx.y + totalHeight / 2 + 6 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - totalHeight / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles for double-line */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Height adjustment handles - hidden for double-line assets */}
          {/* 
          <div
            onMouseDown={(e) => onHeightHandleMouseDown(e, asset.id, 'top')}
            style={{
              position: "absolute",
              left: assetCenterPx.x - 10,
              top: topLeftPx.y,
              width: 8,
              height: handleSize,
              backgroundColor: "#10B981",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ns-resize",
              zIndex: 10,
            }}
            className="hover:bg-green-600 transition-colors"
            title="Adjust height"
          />
          <div
            onMouseDown={(e) => onHeightHandleMouseDown(e, asset.id, 'bottom')}
            style={{
              position: "absolute",
              left: assetCenterPx.x - 10,
              top: bottomLeftPx.y,
              width: 8,
              height: handleSize,
              backgroundColor: "#10B981",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ns-resize",
              zIndex: 10,
            }}
            className="hover:bg-green-600 transition-colors"
            title="Adjust height"
          />
          */}
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    } else if (asset.type === "drawn-line") {
      // For drawn lines, use a fixed bounding box since the path can be any shape
      const boundingSize = 100 * asset.scale;
      
      const topLeftPx = { 
        x: assetCenterPx.x - boundingSize / 2 - 6, 
        y: assetCenterPx.y - boundingSize / 2 - 6 
      };
      const topRightPx = { 
        x: assetCenterPx.x + boundingSize / 2 + 6, 
        y: assetCenterPx.y - boundingSize / 2 - 6 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - boundingSize / 2 - 6, 
        y: assetCenterPx.y + boundingSize / 2 + 6 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + boundingSize / 2 + 6, 
        y: assetCenterPx.y + boundingSize / 2 + 6 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - boundingSize / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles for drawn-line */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    } else if (asset.type === "wall-segments") {
      // For wall segments, use a fixed bounding box since segments can be any shape
      const boundingSize = 200 * asset.scale;
      
      const topLeftPx = { 
        x: assetCenterPx.x - boundingSize / 2 - 6, 
        y: assetCenterPx.y - boundingSize / 2 - 6 
      };
      const topRightPx = { 
        x: assetCenterPx.x + boundingSize / 2 + 6, 
        y: assetCenterPx.y - boundingSize / 2 - 6 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - boundingSize / 2 - 6, 
        y: assetCenterPx.y + boundingSize / 2 + 6 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + boundingSize / 2 + 6, 
        y: assetCenterPx.y + boundingSize / 2 + 6 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - boundingSize / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles for wall-segments */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    } else if (asset.type === "text") {
      // For text, estimate size based on text content and font size
      const fontSize = (asset.fontSize ?? 16) * asset.scale;
      const textLength = (asset.text ?? "Enter text").length;
      const estimatedWidth = Math.max(textLength * fontSize * 0.6, 50); // Rough estimation
      const estimatedHeight = fontSize * 1.2;
      
      const topLeftPx = { 
        x: assetCenterPx.x - estimatedWidth / 2 - handleSize / 2, 
        y: assetCenterPx.y - estimatedHeight / 2 - handleSize / 2 
      };
      const topRightPx = { 
        x: assetCenterPx.x + estimatedWidth / 2 + handleSize / 2, 
        y: assetCenterPx.y - estimatedHeight / 2 - handleSize / 2 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - estimatedWidth / 2 - handleSize / 2, 
        y: assetCenterPx.y + estimatedHeight / 2 + handleSize / 2 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + estimatedWidth / 2 + handleSize / 2, 
        y: assetCenterPx.y + estimatedHeight / 2 + handleSize / 2 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - estimatedHeight / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles for text */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    } else if (asset.type === "text") {
      // For text assets, estimate size based on text content and font size
      const fontSize = (asset.fontSize ?? 16) * asset.scale;
      const textLength = (asset.text ?? "Enter text").length;
      const estimatedWidth = Math.max(textLength * fontSize * 0.6, 50); // Rough estimation
      const estimatedHeight = fontSize * 1.2;
      
      const topLeftPx = { 
        x: assetCenterPx.x - estimatedWidth / 2 - 6, 
        y: assetCenterPx.y - estimatedHeight / 2 - 6 
      };
      const topRightPx = { 
        x: assetCenterPx.x + estimatedWidth / 2 + 6, 
        y: assetCenterPx.y - estimatedHeight / 2 - 6 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - estimatedWidth / 2 - 6, 
        y: assetCenterPx.y + estimatedHeight / 2 + 6 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + estimatedWidth / 2 + 6, 
        y: assetCenterPx.y + estimatedHeight / 2 + 6 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - estimatedHeight / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles for text */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    } else {
      // For icons and other assets
      const width = (asset.width ?? 24) * asset.scale;
      const height = (asset.height ?? 24) * asset.scale;
      
      const topLeftPx = { 
        x: assetCenterPx.x - width / 2 - 6, 
        y: assetCenterPx.y - height / 2 - 6 
      };
      const topRightPx = { 
        x: assetCenterPx.x + width / 2 + 6, 
        y: assetCenterPx.y - height / 2 - 6 
      };
      const bottomLeftPx = { 
        x: assetCenterPx.x - width / 2 - 6, 
        y: assetCenterPx.y + height / 2 + 6 
      };
      const bottomRightPx = { 
        x: assetCenterPx.x + width / 2 + 6, 
        y: assetCenterPx.y + height / 2 + 6 
      };
      const rotationHandlePx = { 
        x: assetCenterPx.x, 
        y: assetCenterPx.y - height / 2 - 30 
      };

      return (
        <>
          {/* Corner scaling handles for icons */}
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-left')}
            style={{
              position: "absolute",
              left: topLeftPx.x,
              top: topLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "nw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'top-right')}
            style={{
              position: "absolute",
              left: topRightPx.x,
              top: topRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "ne-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-left')}
            style={{
              position: "absolute",
              left: bottomLeftPx.x,
              top: bottomLeftPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "sw-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          <div
            onMouseDown={(e) => onScaleHandleMouseDown(e, asset.id, 'bottom-right')}
            style={{
              position: "absolute",
              left: bottomRightPx.x,
              top: bottomRightPx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "2px",
              cursor: "se-resize",
              zIndex: 10,
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Scale"
          />
          
          {/* Rotation line and handle */}
          <div
            style={{
              position: "absolute",
              left: assetCenterPx.x,
              top: assetCenterPx.y,
              width: 2,
              height: 30,
              backgroundColor: "#3B82F6",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -50%)`,
              zIndex: 9,
            }}
          />
          <div
            onMouseDown={(e) => onRotationHandleMouseDown(e, asset.id)}
            style={{
              position: "absolute",
              left: rotationHandlePx.x,
              top: rotationHandlePx.y,
              width: handleSize,
              height: handleSize,
              backgroundColor: "#3B82F6",
              border: "2px solid white",
              borderRadius: "50%",
              cursor: "grab",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
            className="hover:bg-blue-600 transition-colors"
            title="Rotate"
          />
        </>
      );
    }




  };

  return (
    <div
      ref={canvasRef}
      className={`relative ${canvas ? 'bg-white border shadow-md' : 'bg-transparent'} ${(isPenMode || isWallMode || wallDrawingMode) ? 'cursor-crosshair' : ''}`}
      style={{ width: canvasPxW, height: canvasPxH, transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        if (e.target === canvasRef.current) {
          if (isPenMode || isWallMode) {
            e.stopPropagation();
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
            
            // Start drawing
            currentDrawingPath.current = [{ x, y }];
            setIsDrawing(true);
            setCurrentPath([{ x, y }]);
            setTempPath([{ x, y }]);
            console.log('Started drawing at:', { x, y });
            return; // Prevent canvas movement when in pen mode
          } else if (wallDrawingMode) {
            // Check if the click target is the canvas itself (not a child element like sidebar buttons)
            if (e.target !== canvasRef.current) {
              console.log('Click not on canvas element, ignoring wall drawing');
              return;
            }
            
            e.stopPropagation();
            const { x, y } = clientToCanvasMM(e.clientX, e.clientY);
            
            // Check if click is within canvas bounds
            if (canvas && (x < 0 || y < 0 || x > canvas.width || y > canvas.height)) {
              console.log('Click outside canvas bounds, ignoring');
              return; // Don't create wall segments outside canvas
            }
            
            if (!currentWallStart) {
              // Start new wall segment
              startWallSegment({ x, y });
              console.log('Started wall segment at:', { x, y });
            } else {
              // This will be handled by the mouse up event to commit the current segment
              console.log('Continuing wall segment at:', { x, y });
            }
            return; // Prevent canvas movement when in wall mode
          } else {
            selectAsset(null);
            e.stopPropagation();
            isMovingCanvas.current = true;
            lastCanvasPointer.current = { x: e.clientX, y: e.clientY };
          }
        }
      }}
    >
      {/* Grid Overlay */}
      {showGrid && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasPxW}
          height={canvasPxH}
          style={{ zIndex: 0 }}
        >
          <defs>
            <pattern
              id="grid-pattern"
              width={20 * mmToPx}
              height={20 * mmToPx}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${20 * mmToPx} 0 L 0 0 0 ${20 * mmToPx}`}
                fill="none"
                stroke="rgba(96, 165, 250, 0.4)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>
      )}

      {/* Temporary Drawing Path */}
      {isDrawing && tempPath.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasPxW}
          height={canvasPxH}
          style={{ zIndex: 5 }}
        >
          {tempPath.length === 1 ? (
            <circle
              cx={tempPath[0].x * mmToPx}
              cy={tempPath[0].y * mmToPx}
              r="2"
              fill="#3B82F6"
            />
          ) : (
            <path
              d={`M ${tempPath[0].x * mmToPx} ${tempPath[0].y * mmToPx} ${tempPath.slice(1).map(point => `L ${point.x * mmToPx} ${point.y * mmToPx}`).join(' ')}`}
              stroke="#3B82F6"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      {/* Wall Drawing Visual Feedback */}
      {wallDrawingMode && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasPxW}
          height={canvasPxH}
          style={{ zIndex: 5 }}
        >
          {/* Render completed wall segments */}
          {currentWallSegments.length > 0 && (() => {
            const wallThickness = 2;
            const wallGap = 8 * mmToPx; // 8mm gap
            
            // Create continuous path for entire wall structure
            const outerPath = '';
            const innerPath = '';
            
            // Build wall geometry with proper corner handling
            const wallPoints: Array<{
              start: { x: number; y: number };
              end: { x: number; y: number };
              perpX: number;
              perpY: number;
              angle: number;
              index: number;
            }> = [];
            
            currentWallSegments.forEach((segment, index) => {
              const dx = segment.end.x - segment.start.x;
              const dy = segment.end.y - segment.start.y;
              const length = Math.sqrt(dx * dx + dy * dy);
              
              if (length === 0) return;
              
              // Calculate angle and perpendicular (convert to pixels)
              const angle = Math.atan2(dy, dx);
              const perpX = Math.cos(angle + Math.PI / 2) * (wallGap / 2);
              const perpY = Math.sin(angle + Math.PI / 2) * (wallGap / 2);
              
              // Store wall geometry points
              wallPoints.push({
                start: { x: segment.start.x * mmToPx, y: segment.start.y * mmToPx },
                end: { x: segment.end.x * mmToPx, y: segment.end.y * mmToPx },
                perpX, perpY, angle, index
              });
            });
            
            // Render each wall segment as a simple rectangle
            const wallSegments = [];
            
            for (let i = 0; i < wallPoints.length; i++) {
              const current = wallPoints[i];
              
              // Calculate the four corners of the wall rectangle
              const outerStartX = current.start.x + current.perpX;
              const outerStartY = current.start.y + current.perpY;
              const outerEndX = current.end.x + current.perpX;
              const outerEndY = current.end.y + current.perpY;
              
              const innerStartX = current.start.x - current.perpX;
              const innerStartY = current.start.y - current.perpY;
              const innerEndX = current.end.x - current.perpX;
              const innerEndY = current.end.y - current.perpY;
              
              // Create rectangle path for this wall segment
              const wallRectPath = `M ${outerStartX} ${outerStartY} L ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} L ${innerStartX} ${innerStartY} Z`;
              
              wallSegments.push(
                <path
                  key={`wall-segment-${i}`}
                  d={wallRectPath}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth={wallThickness}
                />
              );
            }
            
            return (
              <g>
                {wallSegments}
              </g>
            );
          })()}
          
          {/* Render current wall segment being drawn */}
          {currentWallStart && currentWallTempEnd && (() => {
            const dx = currentWallTempEnd.x - currentWallStart.x;
            const dy = currentWallTempEnd.y - currentWallStart.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return null;
            
            // Calculate angle and perpendicular (convert to pixels)
            const angle = Math.atan2(dy, dx);
            const wallGap = 8 * mmToPx; // 8mm gap
            const perpX = Math.cos(angle + Math.PI / 2) * (wallGap / 2);
            const perpY = Math.sin(angle + Math.PI / 2) * (wallGap / 2);
            
            // Outer wall points (one side of the wall) - convert to pixels
            const outerStartX = currentWallStart.x * mmToPx + perpX;
            const outerStartY = currentWallStart.y * mmToPx + perpY;
            const outerEndX = currentWallTempEnd.x * mmToPx + perpX;
            const outerEndY = currentWallTempEnd.y * mmToPx + perpY;
            
            // Inner wall points (other side of the wall) - convert to pixels
            const innerStartX = currentWallStart.x * mmToPx - perpX;
            const innerStartY = currentWallStart.y * mmToPx - perpY;
            const innerEndX = currentWallTempEnd.x * mmToPx - perpX;
            const innerEndY = currentWallTempEnd.y * mmToPx - perpY;
            
            return (
              <g>
                {/* Outer wall line */}
                <line
                  x1={outerStartX}
                  y1={outerStartY}
                  x2={outerEndX}
                  y2={outerEndY}
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                  opacity="0.7"
                />
                {/* Inner wall line */}
                <line
                  x1={innerStartX}
                  y1={innerStartY}
                  x2={innerEndX}
                  y2={innerEndY}
                  stroke="#3B82F6"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="5,5"
                  opacity="0.7"
                />
              </g>
            );
          })()}
          
          {/* Render start point */}
          {currentWallStart && (
            <circle
              cx={currentWallStart.x * mmToPx}
              cy={currentWallStart.y * mmToPx}
              r="3"
              fill="#3B82F6"
              stroke="white"
              strokeWidth="1"
            />
          )}
        </svg>
      )}

      {/* Rotate Buttons */}
      {selectedAssetId === null && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-2 z-10 pointer-events-auto">
          <button onClick={(ev) => { ev.stopPropagation(); rotateCCW(); }} className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" title="Rotate CCW"><RotateCcw size={16} /></button>
          <button onClick={(ev) => { ev.stopPropagation(); rotateCW(); }} className="p-2 bg-gray-200 rounded-full shadow hover:bg-gray-300" title="Rotate CW"><RotateCw size={16} /></button>
        </div>
      )}

      {/* Render Assets */}
      {assets.map((asset) => {
        const def = ASSET_LIBRARY.find((a) => a.id === asset.type);
        const isSelected = asset.id === selectedAssetId;
        const isCopied = asset.id === copiedAssetId;
        const leftPx = asset.x * mmToPx;
        const topPx = asset.y * mmToPx;
        const totalRotation = asset.rotation;


        if (asset.type === "square" || asset.type === "circle") {
          return (
            <div key={asset.id} className="relative">
              {/* Background layer */}
              {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
                <div
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    width: (asset.width ?? 50) * asset.scale,
                    height: (asset.height ?? 50) * asset.scale,
                    backgroundColor: asset.backgroundColor,
                    borderRadius: asset.type === "circle" ? "50%" : "0%",
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                    zIndex: -1,
                  }}
                />
              )}
              
              {/* Main shape */}
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: (asset.width ?? 50) * asset.scale,
                  height: (asset.height ?? 50) * asset.scale,
                  backgroundColor: asset.fillColor,
                  borderRadius: asset.type === "circle" ? "50%" : "0%",
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  cursor: "move",
                  boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                  transition: isCopied ? "box-shadow 0.3s ease" : undefined,
                }}
                className={isSelected ? "" : ""}
              />
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }

        if (asset.type === "line") {
          return (
            <div key={asset.id} className="relative">
              {/* Background layer */}
              {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
                <div
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    width: (asset.width ?? 100) * asset.scale,
                    height: (asset.strokeWidth ?? 2) * asset.scale,
                    backgroundColor: asset.backgroundColor,
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                    zIndex: -1,
                  }}
                />
              )}
              
              {/* Main line */}
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: (asset.width ?? 100) * asset.scale,
                  height: (asset.strokeWidth ?? 2) * asset.scale,
                  backgroundColor: asset.strokeColor,
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  cursor: "move",
                  boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                  transition: isCopied ? "box-shadow 0.3s ease" : undefined,
                }}
                className={isSelected ? "" : ""}
              />
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }

        if (asset.type === "double-line") {
          const lineGap = (asset.lineGap ?? 8) * asset.scale;
          const isHorizontal = asset.isHorizontal ?? true;
          
          // Get the line thickness and length
          const lineThickness = 2; // Fixed thickness for now
          const lineLength = isHorizontal ? (asset.width ?? 100) : (asset.height ?? 100);
          
          const containerWidth = isHorizontal ? lineLength * asset.scale : (lineThickness + lineGap);
          const containerHeight = isHorizontal ? (lineThickness + lineGap) : lineLength * asset.scale;
          
          return (
            <div key={asset.id} className="relative">
              {/* Background layer */}
              {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
                <div
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    width: containerWidth,
                    height: containerHeight,
                    backgroundColor: asset.backgroundColor,
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                    zIndex: -1,
                  }}
                />
              )}
              
              {/* Main double-line container */}
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: containerWidth,
                  height: containerHeight,
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  cursor: "move",
                  boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                  transition: isCopied ? "box-shadow 0.3s ease" : undefined,
                }}
                className={isSelected ? "" : ""}
              >
                {isHorizontal ? (
                  <>
                    {/* First line - horizontal */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: lineThickness,
                        backgroundColor: asset.lineColor ?? "#3B82F6",
                      }}
                    />
                    {/* Second line - horizontal */}
                    <div
                      style={{
                        position: "absolute",
                        top: lineThickness + lineGap,
                        left: 0,
                        width: "100%",
                        height: lineThickness,
                        backgroundColor: asset.lineColor ?? "#3B82F6",
                      }}
                    />
                  </>
                ) : (
                  <>
                    {/* First line - vertical */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: lineThickness,
                        height: "100%",
                        backgroundColor: asset.lineColor ?? "#3B82F6",
                      }}
                    />
                    {/* Second line - vertical */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: lineThickness + lineGap,
                        width: lineThickness,
                        height: "100%",
                        backgroundColor: asset.lineColor ?? "#3B82F6",
                      }}
                    />
                  </>
                )}
              </div>
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }

        if (asset.type === "drawn-line") {
          return (
            <div key={asset.id} className="relative">
              {/* Background layer */}
              {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
                <div
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    width: 100,
                    height: 100,
                    backgroundColor: asset.backgroundColor,
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                    zIndex: -1,
                  }}
                />
              )}
              
              {/* Main drawn line */}
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  cursor: "move",
                  boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                  transition: isCopied ? "box-shadow 0.3s ease" : undefined,
                }}
                className={isSelected ? "" : ""}
              >
                <svg
                  width="200"
                  height="200"
                  viewBox="-100 -100 200 200"
                  style={{ overflow: "visible" }}
                >
                  {asset.path && asset.path.length > 1 && (
                    <path
                      d={`M ${asset.path[0].x} ${asset.path[0].y} ${asset.path.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ')}`}
                      stroke={asset.strokeColor ?? "#3B82F6"}
                      strokeWidth={(asset.strokeWidth ?? 2) * asset.scale}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </div>
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }

        if (asset.type === "wall-segments") {
          return (
            <div key={asset.id} className="relative">
              {/* Background layer */}
              {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
                <div
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    width: 200,
                    height: 200,
                    backgroundColor: asset.backgroundColor,
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                    zIndex: -1,
                  }}
                />
              )}
              
              {/* Main wall segments */}
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  cursor: "move",
                  boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                  transition: isCopied ? "box-shadow 0.3s ease" : undefined,
                }}
                className={isSelected ? "" : ""}
              >
                <svg
                  width="200"
                  height="200"
                  viewBox="-100 -100 200 200"
                  style={{ overflow: "visible" }}
                >
                  {asset.wallSegments && asset.wallSegments.length > 0 && (() => {
                    const wallThickness = (asset.wallThickness ?? 2) * asset.scale;
                    const wallGap = (asset.wallGap ?? 8) * asset.scale;
                    
                    // Create continuous path for entire wall structure
                    const outerPath = '';
                    const innerPath = '';
                    
                    // Build wall geometry with proper corner handling
                    const wallPoints: Array<{
                      start: { x: number; y: number };
                      end: { x: number; y: number };
                      perpX: number;
                      perpY: number;
                      angle: number;
                      index: number;
                    }> = [];
                    
                    asset.wallSegments.forEach((segment, index) => {
                      const dx = segment.end.x - segment.start.x;
                      const dy = segment.end.y - segment.start.y;
                      const length = Math.sqrt(dx * dx + dy * dy);
                      
                      if (length === 0) return;
                      
                      // Calculate angle and perpendicular
                      const angle = Math.atan2(dy, dx);
                      const perpX = Math.cos(angle + Math.PI / 2) * (wallGap / 2);
                      const perpY = Math.sin(angle + Math.PI / 2) * (wallGap / 2);
                      
                      // Store wall geometry points
                      wallPoints.push({
                        start: { x: segment.start.x, y: segment.start.y },
                        end: { x: segment.end.x, y: segment.end.y },
                        perpX, perpY, angle, index
                      });
                    });
                    
                    // Render each wall segment as a simple rectangle
                    const wallSegments = [];
                    
                    for (let i = 0; i < wallPoints.length; i++) {
                      const current = wallPoints[i];
                      
                      // Calculate the four corners of the wall rectangle
                      const outerStartX = current.start.x + current.perpX;
                      const outerStartY = current.start.y + current.perpY;
                      const outerEndX = current.end.x + current.perpX;
                      const outerEndY = current.end.y + current.perpY;
                      
                      const innerStartX = current.start.x - current.perpX;
                      const innerStartY = current.start.y - current.perpY;
                      const innerEndX = current.end.x - current.perpX;
                      const innerEndY = current.end.y - current.perpY;
                      
                      // Create rectangle path for this wall segment
                      const wallRectPath = `M ${outerStartX} ${outerStartY} L ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} L ${innerStartX} ${innerStartY} Z`;
                      
                      wallSegments.push(
                        <path
                          key={`wall-segment-${i}`}
                          d={wallRectPath}
                          fill="none"
                          stroke={asset.lineColor ?? "#3B82F6"}
                          strokeWidth={wallThickness}
                        />
                      );
                    }
                    
                    return (
                      <g>
                        {wallSegments}
                      </g>
                    );
                  })()}
                </svg>
              </div>
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }

        if (!def) return null;
        
        // Handle text assets
        if (asset.type === "text") {
          const isEditing = editingTextId === asset.id;
          
          return (
            <div key={asset.id} className="relative">
              {/* Background layer */}
              {asset.backgroundColor && asset.backgroundColor !== "transparent" && (
                <div
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
                    backgroundColor: asset.backgroundColor,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    zIndex: -1,
                  }}
                />
              )}
              
              {isEditing ? (
                <input
                  type="text"
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => onTextEditKeyDown(e, asset.id)}
                  onBlur={() => onTextEditBlur(asset.id)}
                  autoFocus
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
                    fontSize: `${asset.fontSize ?? 16}px`,
                    color: asset.textColor ?? "#000000",
                    fontFamily: asset.fontFamily ?? "Arial",
                    background: asset.backgroundColor && asset.backgroundColor !== "transparent" ? asset.backgroundColor : "transparent",
                    border: "none",
                    outline: "none",
                    padding: asset.backgroundColor && asset.backgroundColor !== "transparent" ? "4px 8px" : "0",
                    margin: 0,
                    minWidth: "100px",
                    borderRadius: "4px",
                  }}
                  className="text-center"
                />
              ) : (
                <div
                  onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                  onDoubleClick={(e) => onTextDoubleClick(e, asset.id)}
                  style={{
                    position: "absolute",
                    left: leftPx,
                    top: topPx,
                    transform: `translate(-50%, -50%) rotate(${totalRotation}deg) scale(${asset.scale})`,
                    fontSize: `${asset.fontSize ?? 16}px`,
                    color: asset.textColor ?? "#000000",
                    fontFamily: asset.fontFamily ?? "Arial",
                    backgroundColor: asset.backgroundColor && asset.backgroundColor !== "transparent" ? asset.backgroundColor : "transparent",
                    padding: asset.backgroundColor && asset.backgroundColor !== "transparent" ? "4px 8px" : "0",
                    borderRadius: "4px",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    cursor: "move",
                    boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                    transition: isCopied ? "box-shadow 0.3s ease" : undefined,
                  }}
                  className={isSelected ? "" : ""}
                >
                  {asset.text ?? "Enter text"}
                </div>
              )}
              
              {/* Handles */}
              {isSelected && !isEditing && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }
        
        // Handle custom SVG assets
        if (def.isCustom && def.path) {
          return (
            <div key={asset.id} className="relative">
              <div
                onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
                style={{
                  position: "absolute",
                  left: leftPx,
                  top: topPx,
                  width: (asset.width ?? 24) * asset.scale,
                  height: (asset.height ?? 24) * asset.scale,
                  transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                  boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                  transition: isCopied ? "box-shadow 0.3s ease" : undefined,
                }}
                className={isSelected ? "" : ""}
              >
                <img 
                  src={def.path} 
                  alt={def.label}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </div>
              
              {/* Handles */}
              {isSelected && renderAssetHandles(asset, leftPx, topPx)}
            </div>
          );
        }
        
        // Handle regular icon assets
        const Icon = def.icon;
        if (!Icon) return null;
        
        return (
          <div key={asset.id} className="relative">
            <div
              onMouseDown={(e) => onAssetMouseDown(e, asset.id)}
              style={{
                position: "absolute",
                left: leftPx,
                top: topPx,
                width: (asset.width ?? 24) * asset.scale,
                height: (asset.height ?? 24) * asset.scale,
                transform: `translate(-50%, -50%) rotate(${totalRotation}deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isCopied ? "0 0 10px rgba(34, 197, 94, 0.8)" : undefined,
                transition: isCopied ? "box-shadow 0.3s ease" : undefined,
              }}
              className={isSelected ? "text-[var(--accent)]" : "text-[var(--accent)]"}
            >
              <Icon size={Math.min((asset.width ?? 24) * asset.scale, (asset.height ?? 24) * asset.scale)} />
            </div>
            
            {/* Handles */}
            {isSelected && renderAssetHandles(asset, leftPx, topPx)}
          </div>
        );
      })}

      {canvas && (
        <span className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
          {canvas.size} ({canvas.width}×{canvas.height} mm)
        </span>
      )}
    </div>
  );
}

