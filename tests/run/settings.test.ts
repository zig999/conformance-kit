import { describe, expect, it } from 'vitest';
import { readSettings } from '../../src/run/settings.js';
import { ConfigurationError } from '../../src/shared/errors.js';

const KIT = { tmforumDirectory: '/sales/tmforum', folder: 'tmf999-v1.0.0-ctk-1.0.0' };
const KIT_PATH = '/sales/tmforum/tmf999-v1.0.0-ctk-1.0.0';
const VALID = {
  CONFORMANCE_SERVICE_URL: 'http://localhost:9000',
  CONFORMANCE_ACCESS_TOKEN: 'Bearer abc.def.ghi',
  CONFORMANCE_KIT_DIRECTORY: KIT_PATH,
};

const refusing = (environment: Record<string, string | undefined>) => () => readSettings(environment, KIT);

describe('the settings of the run', () => {
  it('reads the three variables and the defaults of the three timeouts', () => {
    expect(readSettings(VALID, KIT)).toEqual({
      serviceUrl: 'http://localhost:9000',
      authorization: 'Bearer abc.def.ghi',
      kitDirectory: KIT_PATH,
      startTimeoutMillis: 120_000,
      runTimeoutMillis: 1_800_000,
      stepTimeoutMillis: 60_000,
    });
  });

  it('reads the timeouts when they are given', () => {
    const settings = readSettings(
      {
        ...VALID,
        CONFORMANCE_START_TIMEOUT_MS: '1000',
        CONFORMANCE_RUN_TIMEOUT_MS: '2000',
        CONFORMANCE_STEP_TIMEOUT_MS: '300',
      },
      KIT,
    );
    expect([settings.startTimeoutMillis, settings.runTimeoutMillis, settings.stepTimeoutMillis]).toEqual([
      1000, 2000, 300,
    ]);
  });

  it('keeps the default of a timeout that is given empty', () => {
    expect(readSettings({ ...VALID, CONFORMANCE_RUN_TIMEOUT_MS: '' }, KIT).runTimeoutMillis).toBe(1_800_000);
  });

  it('takes the origin of a service url that ends with a slash', () => {
    expect(readSettings({ ...VALID, CONFORMANCE_SERVICE_URL: 'https://module.example:8443/' }, KIT).serviceUrl).toBe(
      'https://module.example:8443',
    );
  });

  it.each(['CONFORMANCE_SERVICE_URL', 'CONFORMANCE_ACCESS_TOKEN', 'CONFORMANCE_KIT_DIRECTORY'])(
    'refuses the run when %s is absent, empty or blank, naming it',
    (name) => {
      for (const value of [undefined, '', '   ']) {
        expect(refusing({ ...VALID, [name]: value })).toThrow(ConfigurationError);
        expect(refusing({ ...VALID, [name]: value })).toThrow(name);
      }
    },
  );

  it('names every variable that is absent, at once', () => {
    expect(refusing({})).toThrow(/CONFORMANCE_SERVICE_URL, CONFORMANCE_ACCESS_TOKEN, CONFORMANCE_KIT_DIRECTORY/);
  });

  it.each([
    ['not a URL', 'localhost:9000'],
    ['not http or https', 'ftp://host:21'],
    ['holding a path', 'http://localhost:9000/api'],
    ['holding a query', 'http://localhost:9000/?a=1'],
    ['holding credentials', 'http://user:pass@localhost:9000'],
  ])('refuses a service url that is %s, without quoting it', (_name, value) => {
    const refuse = refusing({ ...VALID, CONFORMANCE_SERVICE_URL: value });
    expect(refuse).toThrow(ConfigurationError);
    expect(refuse).toThrow(/CONFORMANCE_SERVICE_URL/);
    expect(refuse).not.toThrow(/pass|ftp|api/);
  });

  it.each(['0', '-5', '1.5', 'abc', '1e3', '99999999999'])('refuses the timeout %s, naming the variable', (value) => {
    expect(refusing({ ...VALID, CONFORMANCE_STEP_TIMEOUT_MS: value })).toThrow(/CONFORMANCE_STEP_TIMEOUT_MS/);
  });

  it('refuses a kit folder other than the one held in the tmforum directory', () => {
    expect(refusing({ ...VALID, CONFORMANCE_KIT_DIRECTORY: '/tmp/copy/tmf999-v1.0.0-ctk-1.0.0' })).toThrow(
      /CONFORMANCE_KIT_DIRECTORY/,
    );
  });

  it('refuses an access token that holds a line break, without quoting it', () => {
    const refuse = refusing({ ...VALID, CONFORMANCE_ACCESS_TOKEN: 'Bearer abc\nInjected: header' });
    expect(refuse).toThrow(/CONFORMANCE_ACCESS_TOKEN/);
    expect(refuse).not.toThrow(/Injected/);
  });

  it('never quotes the value of the access token in any refusal', () => {
    for (const environment of [
      { ...VALID, CONFORMANCE_SERVICE_URL: 'nope' },
      { ...VALID, CONFORMANCE_RUN_TIMEOUT_MS: 'x' },
    ]) {
      expect(refusing(environment)).not.toThrow(/abc\.def\.ghi/);
    }
  });
});
