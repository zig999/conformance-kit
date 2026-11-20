# conformance-kit

Biblioteca TypeScript que dá aos módulos de vendas a mesma maneira de provar a conformidade com as APIs do TM Forum: compara o OAS gerado com o fixado, roda os testes de contrato do módulo, roda o CTK oficial contra o módulo, julga o resultado com os desvios registrados e grava o `conformance-report.json`.

**Estado:** `v0.1.0` desenvolvida e verificada em testes com executor de comandos e sistema de arquivos de mentira, e com o CTK real da TMF637 contra um servidor falso (modo processo e modo compose): isso prova a mecânica, não a conformância de um módulo. Nenhum módulo a usa ainda (as migrações são a Fase 11 do plano). Há três desvios de projeto do padrão (modo `0644` da `config.json` da cópia, espaço em branco normalizado nos identificadores de item, porta do módulo em modo processo); ver `CHANGELOG.md` e a seção 9 de `PLANO.md`.

O que ela implementa é `../padrao-conformidade-tmforum.md`. O formato do relatório, as variáveis, os códigos de saída e o formato dos desvios vivem lá, e este arquivo não os repete: leia o padrão antes de adotar a biblioteca.

## O que ela não é

Não emite nem verifica token (isso é do `identity-kit`), não tem executável e não contém regra de negócio de nenhum módulo. Não lê `process.env`, não escreve em console nem em arquivo de log: o módulo passa o ambiente e recebe os fatos por callback. Os limites completos estão em `CLAUDE.md`.

## Instalação

Cada módulo a instala como dependência de desenvolvimento, por tag:

```
pnpm add -D github:zig999/conformance-kit#v0.1.0
```

## Uso

O módulo declara cada API num objeto e chama `runConformance` em `backend/scripts/conformance.ts`, fora de `src/`. O código da API chega como argumento do script (`pnpm conformance:tmf637` chama o script com `tmf637`; um módulo com uma só API usa `pnpm conformance`, sem argumento). O script atribui o código de saída que a biblioteca devolve a `process.exitCode`.

```ts compiled backend/scripts/conformance.ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runConformance, type IApiConformance, type IStandIn } from 'conformance-kit';
// Código do próprio módulo: a função que monta o app sem banco e devolve o OAS que ele publica,
// e o stand-in do catálogo, em tests/support/ (CNF-13).
import { generatedDocument } from '../src/conformance/generated-document.js';
import { startCatalogStandIn } from '../tests/support/catalog-stand-in.js';

const backend = fileURLToPath(new URL('..', import.meta.url));
const tmforum = resolve(backend, '..', '..', 'tmforum');

// O stand-in sobe antes do módulo, publica o endereço dele e é fechado no fim da execução.
const catalogStandIn: IStandIn = {
  start: async () => {
    const catalog = await startCatalogStandIn();
    return { environment: { PRODUCT_CATALOG_BASE_URL: catalog.baseUrl }, close: () => catalog.close() };
  },
};

const api: IApiConformance = {
  api: 'TMF637',
  openapiVersion: '5.0.0',
  pinnedOas: resolve(backend, 'contracts', 'TMF637-ProductInventory-v5.0.0.oas.yaml'),
  generatedOas: generatedDocument,
  // Camada 1 (CNF-01) e camada 3 (CNF-03): arquivos de teste, não filtros.
  pinnedCopyTests: ['tests/contract/pinned-copy.test.ts'],
  answerValidationTests: ['tests/contract/product-schemas.test.ts', 'tests/contract/hub-schemas.test.ts'],
  conformanceNode: 'constraints/tmf637-conformance',
  specificationRoot: resolve(backend, '..', 'siegard', 'specification'),
  kit: { tmforumDirectory: tmforum, folder: 'tmf637-v5.0.0-ctk-1.0.1' },
  module: {
    mode: 'process',
    migration: { program: process.execPath, args: ['--import', 'tsx', 'src/migrate.ts'], cwd: backend },
    start: { program: process.execPath, args: ['--import', 'tsx', 'src/main.ts'], cwd: backend },
    apiBasePath: '/tmf-api/productInventory/v5',
    // Os nomes das variáveis são do módulo; a biblioteca entrega os valores.
    environment: (runtime) => ({
      PORT: String(runtime.port),
      LISTEN_ADDRESS: runtime.listenAddress,
      PUBLIC_BASE_URL: runtime.publicUrl,
      ...runtime.standIns,
    }),
    standIns: [catalogStandIn],
  },
};

process.exitCode = await runConformance({
  environment: process.env,
  moduleDirectory: backend,
  apis: [api],
  apiCode: process.argv[2],
  log: (message) => process.stderr.write(`${message}\n`),
  output: (chunk) => process.stdout.write(chunk),
});
```

Notas sobre o exemplo:

- **Uma execução serve a uma API.** `apis` traz todas as APIs do módulo e `apiCode` escolhe uma, em qualquer caixa; com mais de uma API o código é obrigatório. Cada API grava o seu relatório: `conformance-report.json` para o módulo com uma só API e `conformance-report.<tmfNNN>.json` (código em minúsculas) para o módulo com mais de uma. Com mais de uma API, a pasta do CTK de cada uma vem de `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>`, e não de `CONFORMANCE_KIT_DIRECTORY`; a pasta do CTK de outra API é recusada com o código 2.
- **Modo processo.** O kit confere que a porta de `CONFORMANCE_SERVICE_URL` está livre, aplica a migração, sobe o módulo escutando nela em todos os endereços (o CTK roda em docker) e o desliga com SIGTERM e, passada a tolerância, SIGKILL. A porta é a da URL, e não uma sorteada, porque os itens do CTK trazem o endpoint no título e a porta tem de ser estável para um desvio poder citá-los. Nenhuma variável `CONFORMANCE_*` chega ao módulo.
- **Modo compose.** O módulo declara o serviço do perfil `kit` do compose dele, o nome do serviço na rede `tmf` e a porta interna, que são o endereço que o CTK usa. `CONFORMANCE_SERVICE_URL` serve só para o kit esperar o módulo ficar pronto:

```ts compiled backend/scripts/conformance-compose.ts
import { fileURLToPath } from 'node:url';
import type { IComposeModule } from 'conformance-kit';

const backend = fileURLToPath(new URL('..', import.meta.url));

export const composeModule: IComposeModule = {
  mode: 'compose',
  directory: backend,
  service: 'api-kit',
  kitHost: 'api-kit',
  kitPort: 3000,
  apiBasePath: '/tmf-api/productOrdering/v5',
};
```

- **API sem CTK em `../tmforum`.** Roda as camadas 1 a 3, não roda a camada 4, não usa docker, não exige nenhuma variável do CTK e grava `conformanceKit: "not-applicable"`. O código de saída é 0 quando o relatório foi gravado e 5 quando não foi:

```ts compiled backend/scripts/conformance-without-kit.ts
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IApiWithoutKit } from 'conformance-kit';
import { generatedDocument } from '../src/conformance/generated-document.js';

const backend = fileURLToPath(new URL('..', import.meta.url));

export const apiWithoutKit: IApiWithoutKit = {
  withoutKit: true,
  api: 'TMF648',
  openapiVersion: '4.0.0',
  pinnedOas: resolve(backend, 'contracts', 'TMF648-Quote-v4.0.0.oas.yaml'),
  generatedOas: generatedDocument,
  pinnedCopyTests: ['tests/contract/pinned-copy.test.ts'],
  answerValidationTests: ['tests/contract/quote-schemas.test.ts'],
  conformanceNode: 'constraints/tmf648-conformance',
  specificationRoot: resolve(backend, '..', 'siegard', 'specification'),
};
```

- **Mudou `src/`? Não.** O script de conformância e os stand-ins moram em `backend/scripts/` e `backend/tests/support/`, nunca em `src/` (CNF-09, CNF-13).

## Os testes de contrato do módulo

A biblioteca também dá as peças dos testes das camadas 1 e 2 que todo módulo escreve (CNF-01, CNF-02). O runner executa esses testes e o `compareOas` por conta própria; os testes do módulo as usam para falhar em `pnpm test`.

```ts compiled backend/tests/contract/pinned-copy.test.ts
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256OfFile } from 'conformance-kit';

describe('a cópia fixada do OAS da TMF637', () => {
  it('é idêntica, byte a byte, ao arquivo de ../tmforum', async () => {
    const pinned = resolve(import.meta.dirname, '../../contracts/TMF637-ProductInventory-v5.0.0.oas.yaml');
    const original = resolve(import.meta.dirname, '../../../../tmforum/TMF637-ProductInventory-v5.0.0.oas.yaml');
    expect(await sha256OfFile(pinned)).toBe(await sha256OfFile(original));
  });
});
```

```ts compiled backend/tests/contract/published-document.test.ts
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compareOas, readDeviationRegister, readOasFile } from 'conformance-kit';
import { generatedDocument } from '../../src/conformance/generated-document.js';

describe('o documento publicado pela TMF637', () => {
  it('só difere do fixado onde um desvio registrado cobre o ponteiro', async () => {
    const pinned = await readOasFile(resolve(import.meta.dirname, '../../contracts/TMF637-ProductInventory-v5.0.0.oas.yaml'));
    const register = await readDeviationRegister(
      resolve(import.meta.dirname, '../../../siegard/specification'),
      'constraints/tmf637-conformance',
    );
    const differences = compareOas(pinned, await generatedDocument());
    expect(differences.filter(({ pointer }) => !register.isCovered(pointer))).toEqual([]);
  });
});
```

## Variáveis de ambiente

As do padrão (CNF-04), lidas do `environment` que o módulo passa: `CONFORMANCE_SERVICE_URL`, `CONFORMANCE_ACCESS_TOKEN`, `CONFORMANCE_KIT_DIRECTORY` ou `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>` (obrigatórias para uma API com CTK; nenhuma delas vale para uma API sem CTK) e `CONFORMANCE_START_TIMEOUT_MS`, `CONFORMANCE_RUN_TIMEOUT_MS`, `CONFORMANCE_STEP_TIMEOUT_MS` (opcionais). Variável ausente ou inválida termina com o código 2, nomeando a variável e nunca o valor. `CONFORMANCE_ACCESS_TOKEN` é o valor completo do cabeçalho `Authorization`, com o esquema: o kit o escreve só na `config.json` da cópia temporária do CTK (modo `0644` dentro de uma pasta `0700`, porque o CTK roda como outro usuário) e o esconde de toda mensagem e de toda saída.

## Códigos de saída e relatório

`runConformance` devolve o código de CNF-11 (0 a 5, exportados como `EXIT_*`) e grava `conformance-report.json` no formato de CNF-07, validado por schema estrito, também quando a configuração é recusada ou o CTK não roda (as camadas que não rodaram ficam `not-run`). O script do módulo só atribui o valor a `process.exitCode`.

## Interface pública

O que `src/index.ts` exporta, e só isso (`exports` do `package.json`):

| Nome | Para quê |
|---|---|
| `runConformance`, `IConformanceRun`, `IApiConformance`, `IApiWithKit`, `IApiWithoutKit` | Rodar as camadas 1 a 4 de uma API (ou 1 a 3, quando ela não tem CTK) |
| `IProcessModule`, `IComposeModule`, `IModuleUnderTest`, `IModuleCommand`, `IModuleRuntime` | Como o módulo sobe |
| `IStandIn`, `IStandInHandle` | Stand-ins que o módulo mantém |
| `IExpectedKit` | A pasta do CTK em `../tmforum` |
| `EXIT_*` | Os seis códigos de saída |
| `compareOas`, `IOasDifference` | Comparar o OAS gerado com o fixado, por ponteiro JSON |
| `readOasFile`, `sha256OfFile` | Ler um OAS (YAML ou JSON) e o SHA-256 do arquivo |
| `readDeviationRegister`, `IDeviationRegister` | Ler os nós de desvio da especificação |
| `ConformanceError`, `ConfigurationError`, `KitDidNotRunError` | Erros do kit |

## Desenvolvimento

Requer Node 24 (`engines.node >=24`).

```
pnpm install
pnpm typecheck
pnpm lint
pnpm format
pnpm test
pnpm duplication
pnpm build
pnpm secrets
```

Os exemplos acima são compilados por `pnpm test` contra a interface pública (`tests/architecture/readme-example.test.ts`): um exemplo que deixa de compilar quebra o teste.

`pnpm release X.Y.Z` cria o commit de release, com `dist` compilado, e a tag `vX.Y.Z`. Só roda a partir da `main`, com a árvore limpa, e nunca move uma tag existente. Tag e envio ao remoto são decisão de quem opera, nunca de um agente.

## Versões

Ver `CHANGELOG.md`.
