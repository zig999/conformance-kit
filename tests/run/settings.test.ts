import { describe, expect, it } from 'vitest';
import { kitDirectoryVariableOf, readKitSettings, readSettings } from '../../src/run/settings.js';
import { ConfigurationError } from '../../src/shared/errors.js';

const KIT = { tmforumDirectory: '/sales/tmforum', folder: 'tmf999-v1.0.0-ctk-1.0.0' };
const KIT_PATH = '/sales/tmforum/tmf999-v1.0.0-ctk-1.0.0';
const VARIABLE = 'CONFORMANCE_KIT_DIRECTORY';
const VALID = {
  CONFORMANCE_SERVICE_URL: 'http://localhost:9000',
  CONFORMANCE_ACCESS_TOKEN: 'Bearer abc.def.ghi',
  CONFORMANCE_KIT_DIRECTORY: KIT_PATH,
};

type Env = Record<string, string | undefined>;
const refusing =
  (environment: Env, variable = VARIABLE) =>
  () =>
    readKitSettings(environment, KIT, variable);

describe('the timeouts of the run', () => {
  it('have the defaults of the standard', () => {
    expect(readSettings({})).toEqual({
      startTimeoutMillis: 120_000,
      runTimeoutMillis: 1_800_000,
      stepTimeoutMillis: 60_000,
    });
  });

  it('are read when they are given', () => {
    const settings = readSettings({
      CONFORMANCE_START_TIMEOUT_MS: '1000',
      CONFORMANCE_RUN_TIMEOUT_MS: '2000',
      CONFORMANCE_STEP_TIMEOUT_MS: '300',
    });
    expect([settings.startTimeoutMillis, settings.runTimeoutMillis, settings.stepTimeoutMillis]).toEqual([
      1000, 2000, 300,
    ]);
  });

  it('keep the default when a timeout is given empty', () => {
    expect(readSettings({ CONFORMANCE_RUN_TIMEOUT_MS: '' }).runTimeoutMillis).toBe(1_800_000);
  });

  it.each(['0', '-5', '1.5', 'abc', '1e3', '99999999999'])('refuse the timeout %s, naming the variable', (value) => {
    expect(() => readSettings({ CONFORMANCE_STEP_TIMEOUT_MS: value })).toThrow(ConfigurationError);
    expect(() => readSettings({ CONFORMANCE_STEP_TIMEOUT_MS: value })).toThrow(/CONFORMANCE_STEP_TIMEOUT_MS/);
  });
});

describe('the variables of the kit', () => {
  it('are read: the origin of the service, the whole Authorization value and the folder of the kit', () => {
    expect(readKitSettings(VALID, KIT, VARIABLE)).toEqual({
      serviceUrl: 'http://localhost:9000',
      authorization: 'Bearer abc.def.ghi',
      kitDirectory: KIT_PATH,
    });
  });

  it('take the origin of a service url that ends with a slash', () => {
    expect(
      readKitSettings({ ...VALID, CONFORMANCE_SERVICE_URL: 'https://module.example:8443/' }, KIT, VARIABLE).serviceUrl,
    ).toBe('https://module.example:8443');
  });

  it.each(['CONFORMANCE_SERVICE_URL', 'CONFORMANCE_ACCESS_TOKEN', 'CONFORMANCE_KIT_DIRECTORY'])(
    'refuse the run when %s is absent, empty or blank, naming it',
    (name) => {
      for (const value of [undefined, '', '   ']) {
        expect(refusing({ ...VALID, [name]: value })).toThrow(ConfigurationError);
        expect(refusing({ ...VALID, [name]: value })).toThrow(name);
      }
    },
  );

  it('name every variable that is absent, at once', () => {
    expect(refusing({})).toThrow(/CONFORMANCE_SERVICE_URL, CONFORMANCE_ACCESS_TOKEN, CONFORMANCE_KIT_DIRECTORY/);
  });

  it.each([
    ['not a URL', 'localhost:9000'],
    ['not http or https', 'ftp://host:21'],
    ['holding a path', 'http://localhost:9000/api'],
    ['holding a query', 'http://localhost:9000/?a=1'],
    ['holding credentials', 'http://user:pass@localhost:9000'],
  ])('refuse a service url that is %s, without quoting it', (_name, value) => {
    const refuse = refusing({ ...VALID, CONFORMANCE_SERVICE_URL: value });
    expect(refuse).toThrow(ConfigurationError);
    expect(refuse).toThrow(/CONFORMANCE_SERVICE_URL/);
    expect(refuse).not.toThrow(/pass|ftp|api/);
  });

  it('refuse a kit folder other than the one held in the tmforum directory', () => {
    expect(refusing({ ...VALID, CONFORMANCE_KIT_DIRECTORY: '/tmp/copy/tmf999-v1.0.0-ctk-1.0.0' })).toThrow(
      /CONFORMANCE_KIT_DIRECTORY/,
    );
  });

  it('refuse an access token that holds a line break, without quoting it', () => {
    const refuse = refusing({ ...VALID, CONFORMANCE_ACCESS_TOKEN: 'Bearer abc\nInjected: header' });
    expect(refuse).toThrow(/CONFORMANCE_ACCESS_TOKEN/);
    expect(refuse).not.toThrow(/Injected/);
  });

  it('never quote the value of the access token in any refusal', () => {
    expect(refusing({ ...VALID, CONFORMANCE_SERVICE_URL: 'nope' })).not.toThrow(/abc\.def\.ghi/);
  });

  it('read the folder of the kit from the variable of the API when the module has several', () => {
    const environment = { ...VALID, CONFORMANCE_KIT_DIRECTORY: undefined, CONFORMANCE_KIT_DIRECTORY_TMF999: KIT_PATH };
    expect(readKitSettings(environment, KIT, 'CONFORMANCE_KIT_DIRECTORY_TMF999').kitDirectory).toBe(KIT_PATH);
  });

  it('ignore the single variable, and name the one of the API, when the module has several', () => {
    const refuse = refusing(VALID, 'CONFORMANCE_KIT_DIRECTORY_TMF999');
    expect(refuse).toThrow(/CONFORMANCE_KIT_DIRECTORY_TMF999/);
  });

  it('refuse the folder of another API in the variable of this one', () => {
    const environment = {
      ...VALID,
      CONFORMANCE_KIT_DIRECTORY_TMF999: '/sales/tmforum/tmf998-v1.0.0-ctk-1.0.0',
    };
    const refuse = refusing(environment, 'CONFORMANCE_KIT_DIRECTORY_TMF999');
    expect(refuse).toThrow(ConfigurationError);
    expect(refuse).toThrow(/CONFORMANCE_KIT_DIRECTORY_TMF999/);
  });
});

describe('the variable that names the folder of the kit', () => {
  it('is CONFORMANCE_KIT_DIRECTORY for a module with one API', () => {
    expect(kitDirectoryVariableOf('TMF632', false)).toBe('CONFORMANCE_KIT_DIRECTORY');
  });

  it('is CONFORMANCE_KIT_DIRECTORY_<TMFNNN>, in upper case, for a module with several', () => {
    expect(kitDirectoryVariableOf('tmf632', true)).toBe('CONFORMANCE_KIT_DIRECTORY_TMF632');
  });
});
