import type { Preset } from "../types";

export const presets: Preset[] = [
  { id: "og-image", label: "OG Image (1200\u00d7630)", width: 1200, height: 630 },
  { id: "square", label: "Square (800\u00d7800)", width: 800, height: 800 },
  { id: "hero", label: "Hero Banner (1920\u00d71080)", width: 1920, height: 1080 },
  {
    id: "hero-tall",
    label: "Hero Tall (1920\u00d71280)",
    width: 1920,
    height: 1280,
  },
  {
    id: "twitter-header",
    label: "Twitter Header (1500\u00d7500)",
    width: 1500,
    height: 500,
  },
  { id: "ig-story", label: "IG Story (1080\u00d71920)", width: 1080, height: 1920 },
  { id: "favicon", label: "Favicon (512\u00d7512)", width: 512, height: 512 },
  { id: "custom", label: "Custom", width: 800, height: 600 },
];
