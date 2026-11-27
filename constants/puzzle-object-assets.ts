import { Quantity } from '@/constants/puzzle-theme';

/** Matte pigments shared by the entire puzzle object set. */
export const objectMaterials = {
  ...Quantity,
  terracotta: { fill: '#E79671', edge: '#763D2A', light: '#F8CCAA' },
  sage: { fill: '#8CBE87', edge: '#365C39', light: '#D2E9B8' },
  coral: { fill: '#EE8A80', edge: '#7E3938', light: '#FFD1B6' },
};
