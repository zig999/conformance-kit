import { startComposeModule } from './module-compose.js';
import { startProcessModule } from './module-process.js';
/** Starts the module under test in the mode it declares and answers how the kit reaches it. */
export function startModule(ctx, module, kitHostName) {
    switch (module.mode) {
        case 'process':
            return startProcessModule(ctx, module, kitHostName);
        case 'compose':
            return startComposeModule(ctx, module);
    }
}
