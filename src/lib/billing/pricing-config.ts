// Single source of truth for subscription pricing. Reused both for the live
// client-side price preview and (in the payment submission flow) recomputed
// server-side — the submitted amount is never trusted from the client.
export const PRICING_CONFIG = {
  pricePerModulePerUserPerMonth: 400, // INR
  minimumUsers: 5,
  volumeDiscountThreshold: 20,
  volumeDiscountRate: 0.15,
} as const;

export type PriceBreakdown = {
  numUsers: number;
  numModules: number;
  pricePerModulePerUserPerMonth: number;
  basePrice: number;
  discountRate: number;
  discountAmount: number;
  finalPrice: number;
  pricePerUserPerMonth: number;
};

export function calculatePrice(numUsers: number, modules: string[]): PriceBreakdown {
  const numModules = modules.length;
  const basePrice = numUsers * numModules * PRICING_CONFIG.pricePerModulePerUserPerMonth;
  const discountRate = numUsers >= PRICING_CONFIG.volumeDiscountThreshold
    ? PRICING_CONFIG.volumeDiscountRate
    : 0;
  const discountAmount = Math.round(basePrice * discountRate);
  const finalPrice = basePrice - discountAmount;

  return {
    numUsers,
    numModules,
    pricePerModulePerUserPerMonth: PRICING_CONFIG.pricePerModulePerUserPerMonth,
    basePrice,
    discountRate,
    discountAmount,
    finalPrice,
    pricePerUserPerMonth: numUsers > 0 ? Math.round(finalPrice / numUsers) : 0,
  };
}
