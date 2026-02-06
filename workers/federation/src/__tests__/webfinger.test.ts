/**
 * WebFinger response tests
 */

import { describe, it, expect } from 'vitest';
import { generateWebFingerResponse } from '../identity/webfinger';
import testVectors from '../../../../protocol/test-vectors/federation/webfinger.json';

describe('generateWebFingerResponse', () => {
  it('generates correct WebFinger response matching test vector', () => {
    const vector = testVectors.vectors[0];
    const response = generateWebFingerResponse('alice', 'buildit.network');

    expect(response.subject).toBe(vector.expected!.subject);
    expect(response.aliases).toEqual(vector.expected!.aliases);
    expect(response.links).toEqual(vector.expected!.links);
  });

  it('includes self link with activity+json type', () => {
    const response = generateWebFingerResponse('bob', 'buildit.network');

    const selfLink = response.links.find((l) => l.rel === 'self');
    expect(selfLink).toBeDefined();
    expect(selfLink!.type).toBe('application/activity+json');
    expect(selfLink!.href).toBe('https://buildit.network/ap/users/bob');
  });

  it('includes profile page link', () => {
    const response = generateWebFingerResponse('carol', 'buildit.network');

    const profileLink = response.links.find(
      (l) => l.rel === 'http://webfinger.net/rel/profile-page',
    );
    expect(profileLink).toBeDefined();
    expect(profileLink!.type).toBe('text/html');
    expect(profileLink!.href).toBe('https://buildit.network/@carol');
  });

  it('uses correct domain in all URLs', () => {
    const response = generateWebFingerResponse('user', 'custom.domain');

    expect(response.subject).toContain('custom.domain');
    expect(response.aliases[0]).toContain('custom.domain');
    expect(response.links[0].href).toContain('custom.domain');
  });
});
