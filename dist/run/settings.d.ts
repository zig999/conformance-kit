import { type IExpectedKit } from '../ctk/kit-directory.js';
import type { Environment } from '../shared/ports.js';
/** The timeouts of CNF-04. Every API has them, with a kit or without one. */
export interface ISettings {
    readonly startTimeoutMillis: number;
    readonly runTimeoutMillis: number;
    readonly stepTimeoutMillis: number;
}
/** The variables of the kit (CNF-04). `authorization` is a secret: it is never quoted, logged or recorded. */
export interface IKitSettings {
    readonly serviceUrl: string;
    readonly authorization: string;
    readonly kitDirectory: string;
}
/** CNF-04: the variable that names the folder of the kit; a module with several APIs has one per API. */
export declare function kitDirectoryVariableOf(apiCode: string, severalApis: boolean): string;
/** CNF-04: a timeout that is invalid refuses the run, naming the variable and never its value. */
export declare function readSettings(environment: Environment): ISettings;
/** CNF-04: a variable that is absent, empty or invalid refuses the run, naming the variable and never its value. */
export declare function readKitSettings(environment: Environment, kit: IExpectedKit, directoryVariable: string): IKitSettings;
