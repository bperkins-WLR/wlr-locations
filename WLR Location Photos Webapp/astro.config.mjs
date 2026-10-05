// @ts-check
import { defineConfig } from 'astro/config';
import legacyPhotoVariants from './src/integrations/legacy-photo-variants.js';
import { validateAll, formatReport } from './src/data/validate.js';

/* Check the data files (src/data/) before anything is built. Errors stop the
   build — so a broken edit fails on Vercel and the live site keeps the last
   good version — and warnings are listed in the log. `npm run check-data`
   runs the same check on its own. */
const dataCheck = {
  name: 'wlr-data-check',
  hooks: {
    /** @param {{ command: string, logger: import('astro').AstroIntegrationLogger }} opts */
    'astro:config:setup': ({ command, logger }) => {
      const result = validateAll();
      const report = formatReport(result);
      if (result.errors.length && command === 'build') {
        // Throwing a bare message (no stack) keeps the log readable.
        const e = new Error(`\n\n${report}\n\nThe build was stopped, so nothing was deployed. Fix the file(s) named above and push again.\n`);
        e.stack = e.message;
        throw e;
      }
      if (result.errors.length) logger.error(report);
      else if (result.warnings.length) logger.warn(report);
      else logger.info(report);
    },
  },
};

export default defineConfig({
  site: 'https://wlr-locations.vercel.app',
  // Emit index.html, admin.html, l/05.html … rather than folders, so every URL
  // already shared or saved to a home screen keeps working unchanged.
  build: { format: 'file' },
  trailingSlash: 'never',
  // dataCheck runs first; legacyPhotoVariants keeps pre-Astro photo variant
  // URLs working for phones still on the old build (transitional).
  integrations: [dataCheck, legacyPhotoVariants()],
  // Tell the CSS minifier which browsers to keep working. Without it, a rule
  // carrying both backdrop-filter and -webkit-backdrop-filter lost one of them
  // (desktop Chrome lost the footer blur); iPhones before iOS 18 need the
  // -webkit- form, which these targets keep.
  vite: { build: { cssTarget: ['safari15', 'chrome107', 'firefox104'] } },
});
