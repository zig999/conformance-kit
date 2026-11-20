import { describe, expect, it } from 'vitest';
import { ConfigurationError, ConformanceError, KitDidNotRunError, describeError } from '../../src/shared/errors.js';

describe('the errors of the kit', () => {
  it('carry a name, a context and a cause', () => {
    const cause = new Error('the disk is full');
    const error = new ConformanceError('the record could not be written', { path: 'a.json' }, { cause });
    expect(error.name).toBe('ConformanceError');
    expect(error.context).toEqual({ path: 'a.json' });
    expect(error.cause).toBe(cause);
  });

  it('have one type for a refused configuration and one for a kit that did not run', () => {
    const refused = new ConfigurationError('a variable is absent');
    const stopped = new KitDidNotRunError('docker does not answer');
    expect(refused).toBeInstanceOf(ConformanceError);
    expect(stopped).toBeInstanceOf(ConformanceError);
    expect(refused.name).toBe('ConfigurationError');
    expect(stopped.name).toBe('KitDidNotRunError');
    expect(refused).not.toBeInstanceOf(KitDidNotRunError);
  });

  it('are described by the messages of the whole chain of causes', () => {
    const error = new ConformanceError('outer', {}, { cause: new Error('inner') });
    expect(describeError(error)).toBe('outer: inner');
  });

  it('describe a value that is not an error as text', () => {
    expect(describeError('plain')).toBe('plain');
  });
});
