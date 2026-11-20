import { describe, expect, it } from 'vitest';
import { createProcessControl } from '../../src/shared/process-control.js';
import { FakeChild } from '../support/fake-spawn.js';

const withPid = (pid: number): FakeChild => Object.assign(new FakeChild(), { pid });

const recorder = (fail?: string) => {
  const calls: [number, NodeJS.Signals | 0][] = [];
  const kill = (pid: number, signal: NodeJS.Signals | 0): void => {
    calls.push([pid, signal]);
    if (fail !== undefined) {
      throw Object.assign(new Error('kill failed'), { code: fail });
    }
  };
  return { calls, kill };
};

describe('the process control', () => {
  it('signals the whole group of a child that has a pid, by the negative pid', () => {
    const { calls, kill } = recorder();
    createProcessControl(kill).signal(withPid(4242), 'SIGTERM');
    expect(calls).toEqual([[-4242, 'SIGTERM']]);
  });

  it('signals the child itself when it has no pid', () => {
    const { calls, kill } = recorder();
    const child = new FakeChild();
    createProcessControl(kill).signal(child, 'SIGTERM');
    expect(calls).toEqual([]);
    expect(child.signals).toEqual(['SIGTERM']);
  });

  it('is not troubled by a group that is already gone', () => {
    const { kill } = recorder('ESRCH');
    expect(() => createProcessControl(kill).signal(withPid(1), 'SIGKILL')).not.toThrow();
  });

  it('does not hide any other failure', () => {
    const { kill } = recorder('EINVAL');
    expect(() => createProcessControl(kill).signal(withPid(1), 'SIGKILL')).toThrow('kill failed');
  });

  it('asks whether the group is alive with signal 0, which delivers nothing', () => {
    const { calls, kill } = recorder();
    expect(createProcessControl(kill).isAlive(withPid(4242))).toBe(true);
    expect(calls).toEqual([[-4242, 0]]);
  });

  it('says a group is not alive when there is none', () => {
    expect(createProcessControl(recorder('ESRCH').kill).isAlive(withPid(4242))).toBe(false);
  });

  it('says a group is alive when it exists but may not be signalled', () => {
    expect(createProcessControl(recorder('EPERM').kill).isAlive(withPid(4242))).toBe(true);
  });

  it('says a child with no pid is not alive: it never started', () => {
    expect(createProcessControl(recorder().kill).isAlive(new FakeChild())).toBe(false);
  });
});
