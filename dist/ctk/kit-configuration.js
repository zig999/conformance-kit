import { z } from 'zod';
import { ConfigurationError } from '../shared/errors.js';
const AUTHORIZATION_HEADER = 'Authorization';
const JSON_INDENT = 2;
const HTTP_PROTOCOLS = ['http:', 'https:'];
const UNREADABLE = 'the config.json of the kit is not usable: it needs a url that is an http or https URL';
const KitConfigurationSchema = z.looseObject({
    url: z.string(),
    headers: z.record(z.string(), z.string()).default({}),
});
function parsedUrl(text) {
    if (!URL.canParse(text)) {
        throw new ConfigurationError(UNREADABLE);
    }
    const url = new URL(text);
    if (!HTTP_PROTOCOLS.includes(url.protocol)) {
        throw new ConfigurationError(UNREADABLE);
    }
    return url;
}
function parsedConfiguration(text) {
    const result = KitConfigurationSchema.safeParse(safeJson(text));
    if (!result.success) {
        throw new ConfigurationError(UNREADABLE);
    }
    return result.data;
}
function safeJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return undefined;
    }
}
function urlFor(kitUrl, reach) {
    const path = `${kitUrl.pathname}${kitUrl.search}`;
    const host = reach.kind === 'compose' ? reach.host : kitUrl.hostname;
    return `${kitUrl.protocol}//${host}:${String(reach.port)}${path}`;
}
/**
 * CNF-12, steps 4 and 6: the url of the kit points at the module and the Authorization header is written to the
 * config.json of the private copy, the only place the token goes. The path of the API stays as the kit has it.
 */
export function kitConfigurationFor(kitText, reach, authorization) {
    const kit = parsedConfiguration(kitText);
    const kitUrl = parsedUrl(kit.url);
    const kept = Object.entries(kit.headers).filter(([name]) => name.toLowerCase() !== AUTHORIZATION_HEADER.toLowerCase());
    const headers = { ...Object.fromEntries(kept), [AUTHORIZATION_HEADER]: authorization };
    const text = JSON.stringify({ ...kit, url: urlFor(kitUrl, reach), headers }, null, JSON_INDENT);
    return { text, hostName: kitUrl.hostname };
}
/** The host name the config.json of the kit uses for the module, read before the module starts. */
export function kitHostNameOf(kitText) {
    return parsedUrl(parsedConfiguration(kitText).url).hostname;
}
