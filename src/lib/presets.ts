import type { Preset } from "../types";

export const presets: Preset[] = [
  { id: "square-large", label: "Square Large (1600\u00d71600)", width: 1600, height: 1600 },
  { id: "square-medium", label: "Square Medium (1000\u00d71000)", width: 1000, height: 1000 },
  { id: "square-small", label: "Square Small (600\u00d7600)", width: 600, height: 600 },

  { id: "rect-tall", label: "Rectangle Tall (1920\u00d71280)", width: 1920, height: 1280 },
  { id: "rect-medium", label: "Rectangle Medium (1920\u00d71080)", width: 1920, height: 1080 },
  { id: "rect-short", label: "Rectangle Short (1920\u00d7800)", width: 1920, height: 800 },

  { id: "vert-wide", label: "Vertical Wide (1280\u00d71920)", width: 1280, height: 1920 },
  { id: "vert-medium", label: "Vertical Medium (1080\u00d71920)", width: 1080, height: 1920 },
  { id: "vert-narrow", label: "Vertical Narrow (800\u00d71920)", width: 800, height: 1920 },

  { id: "custom", label: "Custom", width: 800, height: 600 },
];
