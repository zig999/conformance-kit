import { createServer } from 'node:net';
const ALL_ADDRESSES = '0.0.0.0';
const PORT_REFUSALS = ['EADDRINUSE', 'EACCES'];
function refusesThePort(error) {
    return 'code' in error && PORT_REFUSALS.includes(error.code);
}
/**
 * Whether a port is free on all addresses, because the module must listen where the kit, in docker, reaches it.
 * A failure that says nothing about the port (too many open files, for example) is not hidden.
 */
export function createPortChecker(newServer = createServer) {
    return (port) => new Promise((resolve, reject) => {
        const probe = newServer();
        probe.once('error', (error) => (refusesThePort(error) ? resolve(false) : reject(error)));
        probe.listen(port, ALL_ADDRESSES, () => probe.close(() => resolve(true)));
    });
}
