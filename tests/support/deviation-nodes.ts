import { MemoryFiles } from './memory-files.js';

export const SPECIFICATION_ROOT = '/spec';
export const CONFORMANCE_NODE = 'constraints/tmf999-conformance';

export const nodeText = (frontmatter: string, body = 'The body is not read.'): string =>
  `---\n${frontmatter}\n---\n${body}\n`;

export const conformanceNodeText = (...excluded: string[]): string =>
  nodeText(
    ['statement: The module adheres to the API.', 'excludes:', ...excluded.map((node) => `  - node: ${node}`)].join(
      '\n',
    ),
  );

export const specification = (nodes: Readonly<Record<string, string>>): MemoryFiles => {
  const files = new MemoryFiles();
  Object.entries(nodes).forEach(([node, text]) => files.seed(`${SPECIFICATION_ROOT}/${node}.md`, text));
  return files;
};

export const specificationWith = (deviationNodes: Readonly<Record<string, string>>): MemoryFiles =>
  specification({
    [CONFORMANCE_NODE]: conformanceNodeText(...Object.keys(deviationNodes)),
    ...deviationNodes,
  });
