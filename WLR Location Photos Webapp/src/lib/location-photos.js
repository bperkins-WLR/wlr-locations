/* Build-time index of the bundled location photos (src/assets/locations/
   loc-NN/01.jpg exterior, 02.jpg interior), shared by the photo manifest, the
   legacy /images/… URLs and the Open Graph cards. Server-side only. */

const files = import.meta.glob('../assets/locations/loc-*/0[12].jpg', {
  eager: true, import: 'default',
});

/** 'loc-05/01' → ImageMetadata, in location order. */
export const PHOTOS = Object.fromEntries(
  Object.entries(files)
    .map(([path, meta]) => [/(loc-\d+\/0[12])\.jpg$/.exec(path)[1], meta])
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
);

/** The ImageMetadata for location `num`'s photo `file` ('01' | '02'), if any. */
export const photoFor = (num, file = '01') =>
  PHOTOS[`loc-${String(num).padStart(2, '0')}/${file}`];
