/**
 * Queue message routing
 *
 * Routes queue messages to the appropriate protocol-specific handler.
 * AP handlers receive the Federation instance for signed activity delivery.
 */

import type { Federation } from '@fedify/fedify';
import type { Env, QueueMessage } from '../types';
import { publishToAP, deleteFromAP, updateAPProfile } from './apPublish';
import { publishToAT, deleteFromAT } from './atPublish';

export async function handleQueueMessage(
  message: QueueMessage,
  env: Env,
  federation: Federation<Env>,
): Promise<void> {
  switch (message.type) {
    case 'ap_publish':
      await publishToAP(message, env, federation);
      break;
    case 'at_publish':
      await publishToAT(message, env);
      break;
    case 'ap_delete':
      await deleteFromAP(message, env, federation);
      break;
    case 'at_delete':
      await deleteFromAT(message, env);
      break;
    case 'ap_profile_update':
      await updateAPProfile(message, env, federation);
      break;
    default:
      console.warn('Unknown queue message type:', (message as { type: string }).type);
  }
}
