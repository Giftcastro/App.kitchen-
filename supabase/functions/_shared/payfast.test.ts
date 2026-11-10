import { createHash } from 'node:crypto';
import { buildQuery, parseForm, pfEncode, signPairs, verifySignature, Pair } from './payfast';

const fields: Pair[] = [
  ['merchant_id', '10000100'],
  ['amount_gross', '180.00'],
  ['item_name', "Chef's Lunch & More"],
];

describe('PayFast signature helpers', () => {
  it('encodes the way PHP urlencode does', () => {
    expect(pfEncode("a b'c~d(e)")).toBe('a+b%27c%7Ed%28e%29');
  });

  it('signs fields in sent order with the passphrase appended', () => {
    const expected = createHash('md5')
      .update('merchant_id=10000100&amount_gross=180.00&item_name=Chef%27s+Lunch+%26+More&passphrase=my+secret')
      .digest('hex');
    expect(signPairs(fields, 'my secret')).toBe(expected);
  });

  it('accepts a correctly signed notification after a form round trip', () => {
    const raw = `${buildQuery(fields)}&signature=${signPairs(fields, 'pw')}`;
    expect(verifySignature(parseForm(raw), 'pw')).toBe(true);
  });

  it('rejects a changed amount', () => {
    const raw = `${buildQuery(fields)}&signature=${signPairs(fields, 'pw')}`;
    const tampered = raw.replace('180.00', '1.00');
    expect(verifySignature(parseForm(tampered), 'pw')).toBe(false);
  });

  it('rejects the wrong passphrase and a missing signature', () => {
    const raw = `${buildQuery(fields)}&signature=${signPairs(fields, 'pw')}`;
    expect(verifySignature(parseForm(raw), 'other')).toBe(false);
    expect(verifySignature(fields, 'pw')).toBe(false);
  });
});
