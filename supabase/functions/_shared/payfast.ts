import { createHash } from 'node:crypto';

export type Pair = [string, string];

/** Encodes like PHP urlencode, which PayFast's signature is defined against. */
export function pfEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

export function buildQuery(pairs: Pair[]): string {
  return pairs
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${pfEncode(v.trim())}`)
    .join('&');
}

/** PayFast signs fields in the order they are sent, not alphabetically. */
export function signPairs(pairs: Pair[], passphrase: string): string {
  const base = buildQuery(pairs.filter(([k]) => k !== 'signature'));
  const salted = passphrase ? `${base}&passphrase=${pfEncode(passphrase.trim())}` : base;
  return createHash('md5').update(salted).digest('hex');
}

export function parseForm(raw: string): Pair[] {
  return raw
    .split('&')
    .filter(Boolean)
    .map((segment) => {
      const idx = segment.indexOf('=');
      const key = idx === -1 ? segment : segment.slice(0, idx);
      const value = idx === -1 ? '' : segment.slice(idx + 1);
      return [decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' '))] as Pair;
    });
}

export function verifySignature(pairs: Pair[], passphrase: string): boolean {
  const received = pairs.find(([k]) => k === 'signature')?.[1];
  if (!received) return false;
  const expected = signPairs(pairs, passphrase);
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  }
  return diff === 0;
}

export function payfastHost(sandbox: boolean): string {
  return sandbox ? 'sandbox.payfast.co.za' : 'www.payfast.co.za';
}
