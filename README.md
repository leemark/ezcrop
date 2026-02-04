# EZCrop

A fast, lightweight image cropper and resizer that runs entirely in your browser. No server uploads, no installation required—just open it and start cropping.

**Live app:** https://leemark.github.io/ezcrop/

## Features

- **Drag-and-drop upload** — Drop an image anywhere or click to browse
- **Interactive crop editor** — Pan and zoom to frame your shot
- **Preset dimensions** — Quick buttons for OG Image, Square, Hero Banner, Hero Tall, Twitter Header, IG Story, Favicon, or custom size
- **Multiple formats** — Export as WebP, JPEG, or AVIF
- **Quality control** — Adjust compression from 60–100%
- **File size preview** — See estimated output size before exporting
- **Privacy-first** — All processing happens in your browser; nothing is uploaded
- **Dark mode** — Automatically respects your system preference
- **Responsive** — Works on mobile and desktop

## How to Use

### 1. Upload an Image
Open the app and either:
- Click the upload zone to open your file browser
- Drag and drop an image onto the screen

Supported formats: JPEG, PNG, WebP, AVIF, GIF, BMP, TIFF

### 2. Crop Your Image
The cropper will display your image with a crop box overlay:
- **Move crop** — Click and drag the crop box to reposition it
- **Zoom** — Use the zoom slider at the bottom to zoom in and out
- **Resize crop** — Drag the edges or corners of the crop box to resize it

The aspect ratio will lock to your selected preset (e.g., 16:9 for hero banners).

### 3. Choose a Preset (or Custom Size)
In the sidebar on the right, click a preset button to snap the crop to that aspect ratio:
- **OG Image** — 1200×630 (Facebook/Twitter cards)
- **Square** — 800×800
- **Hero Banner** — 1920×1080
- **Hero Tall** — 1920×1280
- **Twitter Header** — 1500×500
- **IG Story** — 1080×1920
- **Favicon** — 512×512
- **Custom** — Enter your own width and height

### 4. Select Format & Quality
- **Format** — Choose WebP (smallest), JPEG (best compatibility), or AVIF (smallest + newer)
- **Quality** — Drag the slider from 60% (smallest file) to 100% (highest quality)

The estimated file size updates as you adjust these settings.

### 5. Export
Click the **Export** button to download your cropped and resized image. The filename will be `{original-name}_{width}x{height}.{format}`.

For example: `photo_1200x630.webp`

## Tips

- **If the export hangs on a zoomed crop** — You're upscaling a very small cropped region to a large output size. The app will still complete, just takes a moment. For best results, crop at least ~25% of the original image.
- **WebP vs AVIF** — WebP works in most modern browsers and produces files 20–30% smaller than JPEG. AVIF is even smaller but less compatible. Use WebP for maximum compatibility, AVIF for absolute smallest file size.
- **Quality slider** — Start at 80–85 for most use cases. Drop to 70 if file size is critical; go to 95+ only if quality is paramount.
- **Rotating images** — If your image is rotated (common with phone photos), the app automatically corrects it on upload.

## Privacy

All image processing (cropping, resizing, encoding) happens entirely in your browser. Your image is never sent to any server. This app works 100% offline after it loads.

## Browser Support

Works on all modern browsers:
- Chrome/Edge 90+
- Firefox 88+
- Safari 15+
- Mobile browsers (iOS Safari, Chrome Mobile)

Older browsers may work but with reduced performance.

## Credits

Built with:
- [React](https://react.dev)
- [react-image-crop](https://github.com/DominicTobias/react-image-crop) — Crop UI with resize handles
- [pica](https://github.com/nodeca/pica) — High-quality image resizing
- [exifr](https://github.com/MikeKovarik/exifr) — EXIF metadata reading
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [@jsquash/avif](https://github.com/jamsinclair/jSquash) — AVIF encoding

## License

MIT
