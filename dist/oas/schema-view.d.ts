import { type JsonRecord } from './difference.js';
export declare const SCHEMAS_POINTER = "/components/schemas";
export interface IMemberView {
    readonly pointer: string;
    /** The pointer of the first `required` list that names the member, or nothing where no list does. */
    readonly requiredAt: string | undefined;
    /** The whole schema of the property, with every `$ref` read as the name of what it refers to. */
    readonly schema: JsonRecord;
}
export interface ISchemaView {
    readonly keywords: JsonRecord;
    readonly members: ReadonlyMap<string, IMemberView>;
    /** The pointer of every `required` list the schema holds, through allOf and through the schema it refers to. */
    readonly requiredLists: ReadonlySet<string>;
}
/** The keywords of a named schema, and its members as the schema holds them itself, through allOf and through the schema it refers to. */
export declare function schemaViewOf(schemas: JsonRecord, name: string): ISchemaView;
