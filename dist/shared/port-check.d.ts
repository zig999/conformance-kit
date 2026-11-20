export interface IPortServer {
    once(event: 'error', listener: (error: Error) => void): unknown;
    listen(port: number, host: string, ready: () => void): unknown;
    close(done: () => void): unknown;
}
/**
 * Whether a port is free on all addresses, because the module must listen where the kit, in docker, reaches it.
 * A failure that says nothing about the port (too many open files, for example) is not hidden.
 */
export declare function createPortChecker(newServer?: () => IPortServer): (port: number) => Promise<boolean>;
