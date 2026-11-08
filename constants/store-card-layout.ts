import { insetRadius } from '@/utils/border-radius';
import { moderateScale } from '@/utils/scale';

const radius = moderateScale(24);
const padding = moderateScale(10);
const borderWidth = 2;

/** Keep the preview and full-width action corners concentric with the card. */
export const StoreCardLayout = {
  radius,
  padding,
  borderWidth,
  innerRadius: insetRadius(radius, padding + borderWidth),
} as const;
