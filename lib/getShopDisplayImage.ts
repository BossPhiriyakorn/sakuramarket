/**
 * Helper function to get the display image for a shop in the market
 * Priority: marketDisplayUrl > logoUrl > fallback
 */
export function getShopDisplayImage(
  marketDisplayUrl: string | null | undefined,
  logoUrl: string | null | undefined,
  fallback: string = ''
): string {
  return marketDisplayUrl || logoUrl || fallback;
}
