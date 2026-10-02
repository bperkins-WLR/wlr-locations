// @ts-check
import { defineConfig } from 'astro/config';
import legacyPhotoVariants from './src/integrations/legacy-photo-variants.js';

export default defineConfig({
  site: 'https://wlr-locations.vercel.app',
  // Emit index.html, admin.html, l/05.html … rather than folders, so every URL
  // already shared or saved to a home screen keeps working unchanged.
  build: { format: 'file' },
  trailingSlash: 'never',
  // Pre-Astro photo variant URLs for phones still on the old build (transitional).
  integrations: [legacyPhotoVariants()],
});
