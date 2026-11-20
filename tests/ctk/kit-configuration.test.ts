import { describe, expect, it } from 'vitest';
import { kitConfigurationFor } from '../../src/ctk/kit-configuration.js';
import { ConfigurationError } from '../../src/shared/errors.js';
import { AUTHORIZATION, CTK_HOST, CTK_PATH, KIT_CONFIGURATION } from '../support/ctk-world.js';

const parsed = (text: string): { url: string; headers: Record<string, string>; payloads: unknown } => JSON.parse(text);

describe('the configuration of the kit', () => {
  it('keeps the name the kit uses and the path of the API, and takes the port of the module, in process mode', () => {
    const result = kitConfigurationFor(KIT_CONFIGURATION, { kind: 'process', port: 4321 }, AUTHORIZATION);
    expect(parsed(result.text).url).toBe(`http://${CTK_HOST}:4321${CTK_PATH}`);
    expect(result.hostName).toBe(CTK_HOST);
  });

  it('takes the service and the internal port the module gave, and keeps the path of the API, in compose mode', () => {
    const reach = { kind: 'compose', host: 'api-kit', port: 3000 } as const;
    expect(parsed(kitConfigurationFor(KIT_CONFIGURATION, reach, AUTHORIZATION).text).url).toBe(
      `http://api-kit:3000${CTK_PATH}`,
    );
  });

  it('adds the Authorization header, keeps the other headers and the rest of the document', () => {
    const result = parsed(kitConfigurationFor(KIT_CONFIGURATION, { kind: 'process', port: 1 }, AUTHORIZATION).text);
    expect(result.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: AUTHORIZATION,
    });
    expect(result.payloads).toEqual(parsed(KIT_CONFIGURATION).payloads);
  });

  it('replaces an Authorization header the kit already carries, whatever its case', () => {
    const text = JSON.stringify({ url: 'http://x:1/api', headers: { authorization: 'Bearer old', Accept: 'a' } });
    const { headers } = parsed(kitConfigurationFor(text, { kind: 'process', port: 1 }, AUTHORIZATION).text);
    expect(headers).toEqual({ Accept: 'a', Authorization: AUTHORIZATION });
  });

  it('adds the header when the kit carries no headers at all', () => {
    const text = JSON.stringify({ url: 'http://x:1/api' });
    expect(parsed(kitConfigurationFor(text, { kind: 'process', port: 1 }, AUTHORIZATION).text).headers).toEqual({
      Authorization: AUTHORIZATION,
    });
  });

  it.each([
    ['not JSON', 'not json'],
    ['without a url', '{"headers": {}}'],
    ['with a url that is not a URL', '{"url": "bad-value-xyz"}'],
    ['with a url that is not http', '{"url": "ftp://bad-host-xyz/api"}'],
  ])('refuses a configuration %s, as a kit that cannot run, without quoting it', (_name, text) => {
    const refusing = () => kitConfigurationFor(text, { kind: 'process', port: 1 }, AUTHORIZATION);
    expect(refusing).toThrow(ConfigurationError);
    expect(refusing).not.toThrow(/xyz/);
  });
});
