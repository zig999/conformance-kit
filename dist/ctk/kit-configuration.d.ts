import type { KitReach } from './context.js';
export interface IKitConfiguration {
    readonly text: string;
    /** The host name the config.json of the kit uses for the module. */
    readonly hostName: string;
}
/**
 * CNF-12, steps 4 and 6: the url of the kit points at the module and the Authorization header is written to the
 * config.json of the private copy, the only place the token goes. The path of the API stays as the kit has it.
 */
export declare function kitConfigurationFor(kitText: string, reach: KitReach, authorization: string): IKitConfiguration;
/** The host name the config.json of the kit uses for the module, read before the module starts. */
export declare function kitHostNameOf(kitText: string): string;
