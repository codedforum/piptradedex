import { describe, expect, it } from 'vitest';
import quoteFixture from './fixtures/quote-public-dry.json' with { type: 'json' };
import { OneClickError, createOneClick, type QuoteInput } from './client.js';

const dryRequest: QuoteInput = {
  dry: true,
  swapType: 'EXACT_INPUT',
  slippageTolerance: 100,
  originAsset: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near',
  depositType: 'ORIGIN_CHAIN',
  destinationAsset: 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1',
  amount: '5000000',
  refundTo: '0x1111111111111111111111111111111111111111',
  refundType: 'ORIGIN_CHAIN',
  recipient: 'intents.near',
  recipientType: 'DESTINATION_CHAIN',
  deadline: '2026-11-02T21:00:00.000Z',
  confidentiality: 'public',
};

function fakeFetch(handler: (req: Request) => Response | Promise<Response>): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(new Request(input, init))) as typeof fetch;
}

describe('createOneClick', () => {
  it('sends the partner key as X-API-Key and parses a dry quote', async () => {
    let seen: Request | undefined;
    const client = createOneClick({
      apiKey: 'test-key',
      fetch: fakeFetch(async (req) => {
        seen = req;
        return Response.json(quoteFixture);
      }),
    });
    const res = await client.quote(dryRequest);
    expect(seen?.url).toBe('https://1click.chaindefuser.com/v0/quote');
    expect(seen?.headers.get('x-api-key')).toBe('test-key');
    expect(JSON.parse(await seen!.text())).toMatchObject({ dry: true, confidentiality: 'public', depositMode: 'SIMPLE', insured: false });
    expect(res.quote.amountOutFormatted).toBe(quoteFixture.quote.amountOutFormatted);
    expect(res.quoteRequest.confidentiality).toBe('public');
  });

  it('omits the header without a key', async () => {
    let seen: Request | undefined;
    const client = createOneClick({
      fetch: fakeFetch(async (req) => {
        seen = req;
        return Response.json(quoteFixture);
      }),
    });
    expect(client.hasApiKey).toBe(false);
    await client.quote(dryRequest);
    expect(seen?.headers.has('x-api-key')).toBe(false);
  });

  it('surfaces the API error body on a 401', async () => {
    const client = createOneClick({
      fetch: fakeFetch(async () =>
        Response.json(
          { message: 'User authentication is required for confidential intent quotes', statusCode: 401 },
          { status: 401 },
        ),
      ),
    });
    await expect(client.quote({ ...dryRequest, confidentiality: 'basic' })).rejects.toMatchObject({
      name: 'OneClickError',
      status: 401,
      message: expect.stringContaining('User authentication is required'),
    });
  });

  it('queries status by deposit address', async () => {
    let seen: Request | undefined;
    const client = createOneClick({
      fetch: fakeFetch(async (req) => {
        seen = req;
        return Response.json({ status: 'PENDING_DEPOSIT', correlationId: 'x', quoteResponse: quoteFixture });
      }),
    });
    const s = await client.status('0xabc');
    expect(seen?.url).toBe('https://1click.chaindefuser.com/v0/status?depositAddress=0xabc');
    expect(s.status).toBe('PENDING_DEPOSIT');
  });

  it('exposes OneClickError fields', () => {
    const e = new OneClickError(400, { message: ['a', 'b'] }, '/v0/quote');
    expect(e.message).toContain('a; b');
  });
});
