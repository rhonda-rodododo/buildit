/**
 * WebFinger resolution
 *
 * Handles acct:user@buildit.network lookups.
 * This is mostly handled by Fedify automatically, but we provide
 * a custom WebFinger resource resolver for our identity mapping.
 */

import type { Env } from '../types';
import { getIdentityByUsername } from '../db';

export interface WebFingerResponse {
  subject: string;
  aliases: string[];
  links: WebFingerLink[];
}

interface WebFingerLink {
  rel: string;
  type?: string;
  href?: string;
  template?: string;
}

/**
 * Generate a WebFinger response for a BuildIt user
 */
export function generateWebFingerResponse(
  username: string,
  domain: string,
): WebFingerResponse {
  const actorUrl = `https://${domain}/ap/users/${username}`;

  return {
    subject: `acct:${username}@${domain}`,
    aliases: [
      actorUrl,
      `https://${domain}/@${username}`,
    ],
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: actorUrl,
      },
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: `https://${domain}/@${username}`,
      },
    ],
  };
}

/**
 * Handle a WebFinger request directly (used by SSR proxy)
 */
export async function handleWebFinger(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');

  if (!resource) {
    return new Response(JSON.stringify({ error: 'Missing resource parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse acct: URI
  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!match) {
    return new Response(JSON.stringify({ error: 'Invalid resource format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const [, username, domain] = match;
  if (domain !== env.FEDERATION_DOMAIN) {
    return new Response(JSON.stringify({ error: 'Unknown domain' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const identity = await getIdentityByUsername(env.FEDERATION_DB, username);
  if (!identity || !identity.ap_enabled) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const response = generateWebFingerResponse(username, domain);
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/jrd+json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=3600',
    },
  });
}
