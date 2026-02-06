/**
 * AT Protocol XRPC client
 *
 * Direct HTTP calls to Bluesky PDS — no @atproto/api dependency.
 * This avoids Workers fetch incompatibility issues.
 */

import { AT_PDS_URL } from '../config';

/** AT Protocol session */
export interface ATSession {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

/** AT Protocol record reference */
export interface ATRecordRef {
  uri: string;
  cid: string;
}

/** AT Protocol blob reference */
export interface ATBlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

/** AT Protocol error response */
interface ATError {
  error: string;
  message: string;
}

/**
 * Create a session with Bluesky using identifier + app password
 */
export async function createSession(
  identifier: string,
  password: string,
  pdsUrl = AT_PDS_URL,
): Promise<ATSession> {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  if (!res.ok) {
    const err = (await res.json()) as ATError;
    throw new Error(`AT createSession failed: ${err.error} - ${err.message}`);
  }

  return res.json() as Promise<ATSession>;
}

/**
 * Refresh an existing session
 */
export async function refreshSession(
  refreshJwt: string,
  pdsUrl = AT_PDS_URL,
): Promise<ATSession> {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${refreshJwt}`,
    },
  });

  if (!res.ok) {
    const err = (await res.json()) as ATError;
    throw new Error(`AT refreshSession failed: ${err.error} - ${err.message}`);
  }

  return res.json() as Promise<ATSession>;
}

/**
 * Create a record in a repository
 */
export async function createRecord(
  session: ATSession,
  collection: string,
  record: Record<string, unknown>,
  rkey?: string,
  pdsUrl = AT_PDS_URL,
): Promise<ATRecordRef> {
  const body: Record<string, unknown> = {
    repo: session.did,
    collection,
    record,
  };
  if (rkey) body.rkey = rkey;

  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json()) as ATError;
    throw new Error(`AT createRecord failed: ${err.error} - ${err.message}`);
  }

  return res.json() as Promise<ATRecordRef>;
}

/**
 * Delete a record from a repository
 */
export async function deleteRecord(
  session: ATSession,
  collection: string,
  rkey: string,
  pdsUrl = AT_PDS_URL,
): Promise<void> {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection,
      rkey,
    }),
  });

  if (!res.ok) {
    const err = (await res.json()) as ATError;
    throw new Error(`AT deleteRecord failed: ${err.error} - ${err.message}`);
  }
}

/**
 * Upload a blob (image, etc.)
 */
export async function uploadBlob(
  session: ATSession,
  data: ArrayBuffer,
  mimeType: string,
  pdsUrl = AT_PDS_URL,
): Promise<ATBlobRef> {
  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: data,
  });

  if (!res.ok) {
    const err = (await res.json()) as ATError;
    throw new Error(`AT uploadBlob failed: ${err.error} - ${err.message}`);
  }

  const result = (await res.json()) as { blob: ATBlobRef };
  return result.blob;
}
