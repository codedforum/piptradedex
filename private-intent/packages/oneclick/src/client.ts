import createClient from 'openapi-fetch';
import type { components, paths } from './schema.js';

export type Schemas = components['schemas'];
export type QuoteRequest = Schemas['QuoteRequest'];
/** Quote fields the caller supplies. depositMode, quoteWaitingTimeMs and insured default when omitted. */
export type QuoteInput = Omit<QuoteRequest, 'depositMode' | 'quoteWaitingTimeMs' | 'insured'> &
  Partial<Pick<QuoteRequest, 'depositMode' | 'quoteWaitingTimeMs' | 'insured'>>;
export type QuoteResponse = Schemas['QuoteResponse'];
export type ExecutionStatus = Schemas['GetExecutionStatusResponse'];
export type Token = Schemas['TokenResponse'];
export type Confidentiality = Schemas['ConfidentialityLevelEnum'];
export type OrderRequest = paths['/v0/orders']['post']['requestBody']['content']['application/json'];
export type OrderAttributes = OrderRequest['data']['attributes'];

export const DEFAULT_BASE_URL = 'https://1click.chaindefuser.com';

export interface ClientOptions {
  /** Partner JWT from partners.near-intents.org. Sent as X-API-Key when present. */
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
}

export class OneClickError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly path: string,
  ) {
    super(`1Click ${path} returned ${status}: ${messageOf(body)}`);
    this.name = 'OneClickError';
  }
}

function messageOf(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    return Array.isArray(m) ? m.join('; ') : String(m);
  }
  return typeof body === 'string' ? body : JSON.stringify(body);
}

export function createOneClick(options: ClientOptions = {}) {
  const headers: Record<string, string> = {};
  if (options.apiKey) headers['X-API-Key'] = options.apiKey;
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    headers,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

  function unwrap<T>(path: string, res: { data?: T; error?: unknown; response: Response }): T {
    if (res.error !== undefined || !res.response.ok) {
      throw new OneClickError(res.response.status, res.error, path);
    }
    return res.data as T;
  }

  return {
    hasApiKey: Boolean(options.apiKey),

    async tokens(): Promise<Token[]> {
      return unwrap('/v0/tokens', await client.GET('/v0/tokens'));
    },

    async quote(input: QuoteInput): Promise<QuoteResponse> {
      const body: QuoteRequest = {
        depositMode: 'SIMPLE',
        quoteWaitingTimeMs: 0,
        insured: false,
        ...input,
      };
      return unwrap('/v0/quote', await client.POST('/v0/quote', { body }));
    },

    async status(depositAddress: string, depositMemo?: string): Promise<ExecutionStatus> {
      const query = depositMemo ? { depositAddress, depositMemo } : { depositAddress };
      return unwrap('/v0/status', await client.GET('/v0/status', { params: { query } }));
    },

    async submitDeposit(txHash: string, depositAddress: string, depositMemo?: string) {
      const body = depositMemo ? { txHash, depositAddress, depositMemo } : { txHash, depositAddress };
      return unwrap('/v0/deposit/submit', await client.POST('/v0/deposit/submit', { body }));
    },

    async createOrder(attributes: OrderAttributes) {
      const body: OrderRequest = { data: { type: 'orders', attributes } };
      return unwrap('/v0/orders', await client.POST('/v0/orders', { body }));
    },

    async getOrder(orderId: string) {
      return unwrap(
        '/v0/orders/{orderId}',
        await client.GET('/v0/orders/{orderId}', { params: { path: { orderId } } }),
      );
    },

    async cancelOrder(orderId: string) {
      return unwrap(
        '/v0/orders/{orderId}/cancel',
        await client.POST('/v0/orders/{orderId}/cancel', { params: { path: { orderId } } }),
      );
    },
  };
}

export type OneClick = ReturnType<typeof createOneClick>;
