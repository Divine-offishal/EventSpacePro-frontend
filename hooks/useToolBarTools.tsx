import React from "react";
import {
  FaMousePointer,
  FaEdit,
  FaComment,
  FaMagnet,
  FaDownload,
  FaBox,
  FaPenNib,
} from "react-icons/fa";

export interface ToolOption {
  id: string;
  label: string;
}

export interface Tool {
  icon: React.ReactNode;
  label: string;
  options: ToolOption[];
}

export function useToolbarTools(): Tool[] {
  return [
    {
      icon: <FaMousePointer size={18} />,
      label: "Selection",
      options: [
        { id: "pointer-select", label: "Pointer" },
        { id: "rectangular-select", label: "Rectangular Selector" },
      ],
    },
    {
      icon: <FaBox size={18} />,
      label: "Assets",
      options: [
        { id: "open-assets", label: "Assets" },
      ],
    },
    {
      icon: <FaPenNib size={18} />,
      label: "Drawing",
      options: [
        { id: "draw-line", label: "Draw Line" }, 
        { id: "draw-wall", label: "Draw Wall" }, 
        { id: "add-text", label: "Add Text" }
      ],
    },
    {
      icon: <FaEdit size={18} />,
      label: "Modify",
      options: [
        { id: "trim", label: "Trim" },
        { id: "move", label: "Move" },
        { id: "copy", label: "Copy" },
        { id: "rotate", label: "Rotate" },
        { id: "group", label: "Group" },
        { id: "ungroup", label: "Ungroup" },
        { id: "align", label: "Align" },
        { id: "array", label: "Array" },
      ],
    },
    {
      icon: <FaComment size={18} />,
      label: "Annotations",
      options: [
        { id: "label-arrow", label: "Label with Arrow" },
        { id: "dimensions", label: "Dimensions" },
        { id: "text-annotation", label: "Text" },
      ],
    },
    {
      icon: <FaMagnet size={18} />,
      label: "Snapping",
      options: [
        { id: "snap-toggle", label: "Toggle Snapping" },
        { id: "snap-endpoint", label: "Snap to Endpoint" },
        { id: "snap-midpoint", label: "Snap to Midpoint" },
        { id: "snap-center", label: "Snap to Center" },
        { id: "snap-intersection", label: "Snap to Intersection" },
        { id: "snap-perpendicular", label: "Snap to Perpendicular" },
        { id: "snap-grid", label: "Snap to Grid" },
      ],
    },
    {
      icon: <FaDownload size={18} />,
      label: "Export",
      options: [{ id: "export-project", label: "Export Project" }],
    },
  ];
}

