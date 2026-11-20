import { type JsonRecord } from './difference.js';
export declare const SCHEMAS_POINTER = "/components/schemas";
export interface IMemberFacets {
    readonly type: string | undefined;
    readonly format: string | undefined;
    readonly reference: string | undefined;
    readonly items: string | undefined;
    readonly states: string | undefined;
}
export interface IMemberView extends IMemberFacets {
    readonly pointer: string;
    readonly required: boolean;
}
export interface ISchemaView {
    readonly keywords: JsonRecord;
    readonly members: ReadonlyMap<string, IMemberView>;
}
/** The keywords of a named schema, and its members as the schema holds them itself, through allOf and through the schema it refers to. */
export declare function schemaViewOf(schemas: JsonRecord, name: string): ISchemaView;
