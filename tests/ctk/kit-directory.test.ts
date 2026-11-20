import { describe, expect, it } from 'vitest';
import { assertExpectedKitDirectory } from '../../src/ctk/kit-directory.js';
import { ConfigurationError } from '../../src/shared/errors.js';

const expected = { tmforumDirectory: '/home/me/sales/tmforum', folder: 'tmf999-v1.0.0-ctk-1.0.0' };

describe('the folder of the kit', () => {
  it('accepts the folder held in the tmforum directory', () => {
    expect(assertExpectedKitDirectory('/home/me/sales/tmforum/tmf999-v1.0.0-ctk-1.0.0', expected)).toBe(
      '/home/me/sales/tmforum/tmf999-v1.0.0-ctk-1.0.0',
    );
  });

  it('accepts the same folder written with a trailing separator or with dots', () => {
    const written = '/home/me/sales/tmforum/../tmforum/tmf999-v1.0.0-ctk-1.0.0/';
    expect(assertExpectedKitDirectory(written, expected)).toBe('/home/me/sales/tmforum/tmf999-v1.0.0-ctk-1.0.0');
  });

  it.each([
    ['a copy with the same name elsewhere', '/tmp/copy/tmf999-v1.0.0-ctk-1.0.0'],
    ['another version of the kit', '/home/me/sales/tmforum/tmf999-v1.0.0-ctk-1.0.1'],
    ['the tmforum directory itself', '/home/me/sales/tmforum'],
    ['a folder inside the kit folder', '/home/me/sales/tmforum/tmf999-v1.0.0-ctk-1.0.0/reports'],
  ])('refuses %s', (_name, directory) => {
    expect(() => assertExpectedKitDirectory(directory, expected)).toThrow(ConfigurationError);
  });

  it('names the variable and the folder expected, never the folder given', () => {
    const refusing = () => assertExpectedKitDirectory('/tmp/secret-place/x', expected);
    expect(refusing).toThrow(/CONFORMANCE_KIT_DIRECTORY/);
    expect(refusing).toThrow(expected.folder);
    expect(refusing).not.toThrow(/secret-place/);
  });
});
