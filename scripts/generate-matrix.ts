import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMatrix, parseArguments } from './matrix/generate.js';

const FIRST_USER_ARGUMENT = 2;

const options = parseArguments(process.argv.slice(FIRST_USER_ARGUMENT), dirname(fileURLToPath(import.meta.url)));
const rows = await generateMatrix(options);
process.stdout.write(`${options.output}: ${String(rows.length)} linha(s)\n`);
