import { z } from 'zod';

const decimalAmount = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'amount must be a positive decimal string')
  .refine((s) => Number(s) > 0, 'amount must be greater than zero');

export const AssetSchema = z.strictObject({
  symbol: z.string().min(1).max(20),
  blockchain: z.string().min(1).max(20),
});
export type Asset = z.infer<typeof AssetSchema>;

const destination = z.string().min(2).max(128);

export const SwapSpecSchema = z.strictObject({
  kind: z.literal('SWAP'),
  sell: AssetSchema,
  buy: AssetSchema,
  amount: decimalAmount,
  privacy: z.enum(['basic', 'advanced']),
  destination,
});

export const LimitSpecSchema = z.strictObject({
  kind: z.literal('LIMIT'),
  sell: AssetSchema,
  buy: AssetSchema,
  side: z.enum(['BUY', 'SELL']),
  quantity: decimalAmount,
  price: decimalAmount,
  deadline: z.iso.datetime().optional(),
  destination,
  privacy: z.literal('basic'),
});

export const LadderSpecSchema = z
  .strictObject({
    kind: z.literal('LADDER'),
    buy: AssetSchema,
    with: AssetSchema,
    tranches: z.number().int().min(2).max(5),
    priceHigh: decimalAmount,
    priceLow: decimalAmount,
    totalQuote: decimalAmount,
    destination,
  })
  .refine((l) => Number(l.priceLow) < Number(l.priceHigh), 'priceLow must be below priceHigh');

export const CancelSpecSchema = z.strictObject({
  kind: z.literal('CANCEL'),
  orderIds: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]),
});

export const OrderSpecSchema = z.discriminatedUnion('kind', [
  SwapSpecSchema,
  LimitSpecSchema,
  LadderSpecSchema,
  CancelSpecSchema,
]);

export type SwapSpec = z.infer<typeof SwapSpecSchema>;
export type LimitSpec = z.infer<typeof LimitSpecSchema>;
export type LadderSpec = z.infer<typeof LadderSpecSchema>;
export type CancelSpec = z.infer<typeof CancelSpecSchema>;
export type OrderSpec = z.infer<typeof OrderSpecSchema>;
