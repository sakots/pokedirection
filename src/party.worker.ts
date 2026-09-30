import { selectParty } from './party';
import type { Pokemon } from './pokemon';

export type PartyRequest = { catalog: Pokemon[]; selections: Pokemon[] };
export type PartyResponse = { type: 'ready'; party: Pokemon[] } | { type: 'error' };

self.onmessage = (event: MessageEvent<PartyRequest>) => {
  let response: PartyResponse;
  try {
    response = { type: 'ready', party: selectParty(event.data.catalog, event.data.selections) };
  } catch {
    response = { type: 'error' };
  }
  self.postMessage(response);
};
