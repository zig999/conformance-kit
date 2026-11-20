import { z } from 'zod';
import { KitDidNotRunError } from '../shared/errors.js';
import type { KitReach } from './context.js';

const AUTHORIZATION_HEADER = 'Authorization';
const JSON_INDENT = 2;
const HTTP_PROTOCOLS: readonly string[] = ['http:', 'https:'];
const UNREADABLE = 'the config.json of the kit cannot be read: it needs a url that is an http or https URL';

const KitConfigurationSchema = z.looseObject({
  url: z.string(),
  headers: z.record(z.string(), z.string()).default({}),
});

export interface IKitConfiguration {
  readonly text: string;
  /** The host name the config.json of the kit uses for the module. */
  readonly hostName: string;
}

function parsedUrl(text: string): URL {
  if (!URL.canParse(text)) {
    throw new KitDidNotRunError(UNREADABLE);
  }
  const url = new URL(text);
  if (!HTTP_PROTOCOLS.includes(url.protocol)) {
    throw new KitDidNotRunError(UNREADABLE);
  }
  return url;
}

function parsedConfiguration(text: string): z.output<typeof KitConfigurationSchema> {
  const result = KitConfigurationSchema.safeParse(safeJson(text));
  if (!result.success) {
    throw new KitDidNotRunError(UNREADABLE);
  }
  return result.data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function urlFor(kitUrl: URL, reach: KitReach): string {
  const path = `${kitUrl.pathname}${kitUrl.search}`;
  if (reach.kind === 'compose') {
    return `${new URL(reach.origin).origin}${path}`;
  }
  return `${kitUrl.protocol}//${kitUrl.hostname}:${String(reach.port)}${path}`;
}

/**
 * CNF-12, steps 4 and 6: the url of the kit points at the module and the Authorization header is written to the
 * config.json of the private copy, the only place the token goes. The path of the API stays as the kit has it.
 */
export function kitConfigurationFor(kitText: string, reach: KitReach, authorization: string): IKitConfiguration {
  const kit = parsedConfiguration(kitText);
  const kitUrl = parsedUrl(kit.url);
  const kept = Object.entries(kit.headers).filter(
    ([name]) => name.toLowerCase() !== AUTHORIZATION_HEADER.toLowerCase(),
  );
  const headers = { ...Object.fromEntries(kept), [AUTHORIZATION_HEADER]: authorization };
  const text = JSON.stringify({ ...kit, url: urlFor(kitUrl, reach), headers }, null, JSON_INDENT);
  return { text, hostName: kitUrl.hostname };
}
