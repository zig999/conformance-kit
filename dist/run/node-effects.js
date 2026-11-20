import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { createHttpProbe } from '../shared/http-probe.js';
import { createNodeFiles } from '../shared/node-files.js';
import { createPortChecker } from '../shared/port-check.js';
import { createProcessRunner, nodeSpawn } from '../shared/process-runner.js';
import { createRedactingSink, secretsOfAuthorization } from '../shared/redaction.js';
const ID_BYTES = 6;
const ACCESS_TOKEN_VARIABLE = 'CONFORMANCE_ACCESS_TOKEN';
export const nodeSignals = {
    on: (name, handler) => void process.on(name, handler),
    off: (name, handler) => void process.off(name, handler),
};
/** The real effects: the process runner, the disk, the clock, the network. The output goes through a redacting sink. */
export function createNodeEffects(run, signal) {
    const secrets = secretsOfAuthorization(run.environment[ACCESS_TOKEN_VARIABLE] ?? '');
    const sink = createRedactingSink(run.output ?? (() => undefined), secrets);
    return {
        effects: {
            runner: createProcessRunner({ signal, onOutput: (chunk) => sink.write(chunk) }),
            files: createNodeFiles(),
            clock: {
                now: () => Date.now(),
                sleep: (millis, aborter) => sleep(millis, undefined, aborter ? { signal: aborter } : {}),
            },
            log: run.log,
            randomId: () => randomBytes(ID_BYTES).toString('hex'),
            temporaryDirectory: tmpdir(),
            spawn: nodeSpawn,
            portIsFree: createPortChecker(),
            probe: createHttpProbe(),
        },
        finish: () => sink.flush(),
    };
}
