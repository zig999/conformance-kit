import { assertExpectedKitDirectory } from '../ctk/kit-directory.js';
import { ConfigurationError } from '../shared/errors.js';
const SERVICE_URL = 'CONFORMANCE_SERVICE_URL';
const ACCESS_TOKEN = 'CONFORMANCE_ACCESS_TOKEN';
const KIT_DIRECTORY = 'CONFORMANCE_KIT_DIRECTORY';
const START_TIMEOUT = 'CONFORMANCE_START_TIMEOUT_MS';
const RUN_TIMEOUT = 'CONFORMANCE_RUN_TIMEOUT_MS';
const STEP_TIMEOUT = 'CONFORMANCE_STEP_TIMEOUT_MS';
const DEFAULT_START_TIMEOUT_MS = 120_000;
const DEFAULT_RUN_TIMEOUT_MS = 1_800_000;
const DEFAULT_STEP_TIMEOUT_MS = 60_000;
const LARGEST_TIMEOUT_MS = 2_147_483_647;
const HTTP_PROTOCOLS = ['http:', 'https:'];
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const DIGITS = /^[0-9]+$/;
function suppliedText(environment, name) {
    return (environment[name] ?? '').trim();
}
function refuse(variable, why) {
    throw new ConfigurationError(`${variable} ${why}`, { variable });
}
function originOf(text) {
    if (!URL.canParse(text)) {
        return refuse(SERVICE_URL, 'must be an http or https origin');
    }
    const url = new URL(text);
    const plain = url.pathname === '/' && url.search === '' && url.hash === '' && url.username === '' && url.password === '';
    return HTTP_PROTOCOLS.includes(url.protocol) && plain
        ? url.origin
        : refuse(SERVICE_URL, 'must be an http or https origin, with no path');
}
function timeoutOf(environment, name, fallback) {
    const text = suppliedText(environment, name);
    if (text === '') {
        return fallback;
    }
    const value = Number(text);
    if (!DIGITS.test(text) || value < 1 || value > LARGEST_TIMEOUT_MS) {
        return refuse(name, 'must be a whole number of milliseconds above zero');
    }
    return value;
}
function authorizationOf(environment) {
    const value = environment[ACCESS_TOKEN] ?? '';
    return CONTROL_CHARACTER.test(value) ? refuse(ACCESS_TOKEN, 'must be the value of a header, on one line') : value;
}
/** CNF-04: the variable that names the folder of the kit; a module with several APIs has one per API. */
export function kitDirectoryVariableOf(apiCode, severalApis) {
    return severalApis ? `${KIT_DIRECTORY}_${apiCode.toUpperCase()}` : KIT_DIRECTORY;
}
/** CNF-04: a timeout that is invalid refuses the run, naming the variable and never its value. */
export function readSettings(environment) {
    return {
        startTimeoutMillis: timeoutOf(environment, START_TIMEOUT, DEFAULT_START_TIMEOUT_MS),
        runTimeoutMillis: timeoutOf(environment, RUN_TIMEOUT, DEFAULT_RUN_TIMEOUT_MS),
        stepTimeoutMillis: timeoutOf(environment, STEP_TIMEOUT, DEFAULT_STEP_TIMEOUT_MS),
    };
}
/** CNF-04: a variable that is absent, empty or invalid refuses the run, naming the variable and never its value. */
export function readKitSettings(environment, kit, directoryVariable) {
    const absent = [SERVICE_URL, ACCESS_TOKEN, directoryVariable].filter((name) => suppliedText(environment, name) === '');
    if (absent.length > 0) {
        throw new ConfigurationError(`these environment variables are absent or empty: ${absent.join(', ')}`, {
            variable: absent.join(','),
        });
    }
    return {
        serviceUrl: originOf(suppliedText(environment, SERVICE_URL)),
        authorization: authorizationOf(environment),
        kitDirectory: assertExpectedKitDirectory(suppliedText(environment, directoryVariable), kit, directoryVariable),
    };
}
