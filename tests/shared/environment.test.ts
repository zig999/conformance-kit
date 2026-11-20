import { describe, expect, it } from 'vitest';
import { withoutConformanceVariables } from '../../src/shared/environment.js';

describe('the environment handed to what the run starts', () => {
  it('drops every CONFORMANCE_ variable and keeps the others', () => {
    const environment = withoutConformanceVariables({
      PATH: '/bin',
      CONFORMANCE_ACCESS_TOKEN: 'secret',
      CONFORMANCE_SERVICE_URL: 'http://x',
      CONFORMANCE_FUTURE_ONE: 'y',
      NOT_CONFORMANCE_X: 'kept',
      AUTH_ISSUER: 'https://issuer',
    });
    expect(environment).toEqual({ PATH: '/bin', NOT_CONFORMANCE_X: 'kept', AUTH_ISSUER: 'https://issuer' });
  });

  it('drops a variable that has no value', () => {
    expect(withoutConformanceVariables({ A: undefined, B: 'b' })).toEqual({ B: 'b' });
  });
});
