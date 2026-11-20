export interface IExpectedKit {
    /** The `tmforum` directory that holds the official kits. */
    readonly tmforumDirectory: string;
    /** The name of the folder of the kit in it, such as `tmf637-v5.0.0-ctk-1.0.1`. */
    readonly folder: string;
}
/** CNF-04: only the folder held in the tmforum directory is accepted, never a copy with the same name. */
export declare function assertExpectedKitDirectory(kitDirectory: string, expected: IExpectedKit, variable: string): string;
