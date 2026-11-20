import { describe, expect, it } from 'vitest';
import * as publicInterface from '../../src/index.js';

describe('the public interface', () => {
  it('is the list of exports of src/index.ts, and nothing else', () => {
    expect(Object.keys(publicInterface).toSorted()).toEqual([
      'ConfigurationError',
      'ConformanceError',
      'EXIT_CONFIGURATION_REFUSED',
      'EXIT_KIT_COMPLETED',
      'EXIT_KIT_DID_NOT_RUN',
      'EXIT_KIT_ITEM_FAILED',
      'EXIT_RECORD_NOT_WRITTEN',
      'EXIT_TEARDOWN_FAILED',
      'KitDidNotRunError',
      'compareOas',
      'readDeviationRegister',
      'readOasFile',
      'runConformance',
      'sha256OfFile',
    ]);
  });

  it('has the exit codes of the standard', () => {
    expect([
      publicInterface.EXIT_KIT_COMPLETED,
      publicInterface.EXIT_KIT_DID_NOT_RUN,
      publicInterface.EXIT_CONFIGURATION_REFUSED,
      publicInterface.EXIT_TEARDOWN_FAILED,
      publicInterface.EXIT_KIT_ITEM_FAILED,
      publicInterface.EXIT_RECORD_NOT_WRITTEN,
    ]).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
