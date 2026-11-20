import type { IFiles } from '../shared/ports.js';
export declare function readFrontmatter(files: IFiles, specificationRoot: string, node: string): Promise<string[]>;
/** The statement as a plain scalar or a block scalar (> or |); anything else is refused. */
export declare function statementOf(frontmatter: readonly string[], node: string): string;
export declare function excludedNodesOf(frontmatter: readonly string[]): string[];
