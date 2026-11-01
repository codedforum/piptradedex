// Validate a NEAR HACKATHON submission payload against the published contract. Never sends it.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/validate-payload.mjs <payload.json>');
  process.exit(2);
}
const p = JSON.parse(readFileSync(file, 'utf8'));
const errors = [];
const allowed = ['requestId', 'projectName', 'leadName', 'email', 'size', 'tracks', 'nearAddress', 'projectUrl', 'demoUrl', 'idea', 'consent'];
for (const k of Object.keys(p)) if (!allowed.includes(k)) errors.push(`unexpected field ${k}`);
for (const k of allowed) if (!(k in p)) errors.push(`missing field ${k}`);
const len = (s) => (typeof s === 'string' ? [...s].length : -1);
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(p.requestId ?? '')) errors.push('requestId is not a lowercase uuid');
if (len(p.projectName) < 2 || len(p.projectName) > 80) errors.push('projectName must be 2 to 80 characters');
if (len(p.leadName) < 2 || len(p.leadName) > 80) errors.push('leadName must be 2 to 80 characters');
if (len(p.email) > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email ?? '')) errors.push('email invalid or over 160 characters');
if (!['1', '2 - 4', '4 - 6', '6 - 8', '8+'].includes(p.size)) errors.push('size must be one of the five listed values, exactly as written');
const trackIds = ['defi', 'thesis', 'privacy', 'business', 'swarms', 'security', 'agents', 'realworld', 'games', 'nfts', 'memecoins', 'social', 'open'];
if (!Array.isArray(p.tracks) || p.tracks.length === 0) errors.push('tracks must be a non empty array');
else {
  for (const t of p.tracks) if (!trackIds.includes(t)) errors.push(`unknown track ${t}`);
  if (new Set(p.tracks).size !== p.tracks.length) errors.push('tracks repeat');
}
if (!/^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(p.nearAddress ?? '') || len(p.nearAddress) < 2 || len(p.nearAddress) > 64) errors.push('nearAddress fails the account regex or length');
for (const k of ['projectUrl', 'demoUrl']) if (!/^https?:\/\//.test(p[k] ?? '') || len(p[k]) > 300) errors.push(`${k} must be an http(s) URL of at most 300 characters`);
if (len(p.idea) < 20 || len(p.idea) > 2000) errors.push('idea must be 20 to 2000 characters');
if (p.consent !== true) errors.push('consent must be boolean true');
if ('website' in p) errors.push('website must never be present');
const bytes = Buffer.byteLength(JSON.stringify(p));
if (bytes > 12000) errors.push(`body is ${bytes} bytes, over 12000`);
for (const k of ['projectName', 'idea']) if (/[—·]/.test(p[k] ?? '')) errors.push(`${k} contains an em dash or middot`);
if (errors.length) {
  console.error('INVALID');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log(`VALID, ${bytes} bytes. Print and read to the operator before sending.`);
