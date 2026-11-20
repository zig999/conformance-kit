import { describe, expect, it } from 'vitest';
import { createRedactingSink, createRedactor, secretsOfAuthorization } from '../../src/shared/redaction.js';

const AUTHORIZATION = 'Bearer abc.def.ghi-1234567890';

describe('the secrets of an Authorization value', () => {
  it('are the whole value and the token without its scheme', () => {
    expect(secretsOfAuthorization(AUTHORIZATION)).toEqual([AUTHORIZATION, 'abc.def.ghi-1234567890']);
  });

  it('are the whole value when it has no scheme', () => {
    expect(secretsOfAuthorization('opaque-value')).toEqual(['opaque-value']);
  });
});

describe('the redactor', () => {
  const redact = createRedactor(secretsOfAuthorization(AUTHORIZATION));

  it('hides the whole value, the token alone, and every occurrence', () => {
    const text = `header ${AUTHORIZATION}; again abc.def.ghi-1234567890 and ${AUTHORIZATION}`;
    const hidden = redact(text);
    expect(hidden).not.toContain('abc.def');
    expect(hidden).toBe('header [redacted]; again [redacted] and [redacted]');
  });

  it('leaves a text without a secret as it is', () => {
    expect(redact('nothing to hide')).toBe('nothing to hide');
  });

  it('hides nothing, and breaks nothing, when there is no secret', () => {
    expect(createRedactor([])('anything')).toBe('anything');
    expect(createRedactor([''])('anything')).toBe('anything');
  });

  it('hides a secret that holds characters of a regular expression', () => {
    const hard = createRedactor(['a.b*c(d)[e]']);
    expect(hard('x a.b*c(d)[e] y aXb*c(d)[e]')).toBe('x [redacted] y aXb*c(d)[e]');
  });
});

describe('the redacting sink', () => {
  const run = (chunks: string[], secrets = secretsOfAuthorization(AUTHORIZATION)): string => {
    const received: string[] = [];
    const sink = createRedactingSink((text) => received.push(text), secrets);
    chunks.forEach((chunk) => sink.write(chunk));
    sink.flush();
    return received.join('');
  };

  it('passes the output through, in order, once flushed', () => {
    expect(run(['one ', 'two ', 'three'])).toBe('one two three');
  });

  it('hides a secret in one chunk', () => {
    expect(run([`before ${AUTHORIZATION} after`])).toBe('before [redacted] after');
  });

  it('hides a secret that is split across chunks, wherever it is split', () => {
    for (let at = 1; at < AUTHORIZATION.length; at += 1) {
      const output = run(['head ', AUTHORIZATION.slice(0, at), AUTHORIZATION.slice(at), ' tail']);
      expect(output).toBe('head [redacted] tail');
    }
  });

  it('hides the token alone when it is split across chunks', () => {
    const output = run(['a abc.def', '.ghi-1234567890 b']);
    expect(output).not.toContain('abc.def');
  });

  it('gives back what it held when it is flushed, so that no output is lost', () => {
    expect(run(['tail of the output'])).toBe('tail of the output');
  });

  it('never shows a secret before it is flushed, even in part of a chunk', () => {
    const received: string[] = [];
    const sink = createRedactingSink((text) => received.push(text), [AUTHORIZATION]);
    sink.write(`x ${AUTHORIZATION.slice(0, 10)}`);
    expect(received.join('')).not.toContain('Bearer abc');
  });
});
