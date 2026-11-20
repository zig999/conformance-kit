# conformance-kit: análise e plano de desenvolvimento

Data: 2026-11-20. Este plano nasce da comparação dos runners de CTK de `productorder`, `inventory` e `productcatalog`, e do padrão `../padrao-conformidade-tmforum.md`. **Leia o padrão antes de implementar qualquer fase:** o formato do relatório, as variáveis, os códigos de saída, o formato dos desvios e as regras de execução do CTK vivem lá, e este plano não os repete.

## 1. Escopo

Uma biblioteca única, versionada por tag git, que concentra o que é igual nos runners de conformidade dos módulos:

- leitura e comparação de OAS e verificação do SHA-256 (camadas 1 e 2);
- execução dos testes de comportamento do módulo (camada 3) e registro do resultado;
- execução do CTK em docker (camada 4);
- veredito com os desvios da especificação;
- gravação do `conformance-report.json`;
- códigos de saída;
- suporte a módulos com mais de uma API.

Fora do escopo: emissão de token (é do `identity-kit`), regra de venda, escolha de onde roda. A matriz de conformidade da raiz é a última fase.

## 2. Origem do código

Três módulos já rodam o CTK, de três maneiras.

| Parte | `productorder/backend/scripts/` | `inventory/backend/src/conformance/` e `src/config/` | `productcatalog/backend/src/conformance/` |
|---|---|---|---|
| Processo filho | `conformance-node.ts`, `conformance-errors.ts` | `child-command.ts`, `failure-reason.ts` | `kit-process.ts` |
| Interrupção | dentro de `conformance.ts` | `interruption.ts` | não tem |
| CTK em docker | `conformance-commands.ts`, `conformance-ctk-configuration.ts` | `kit-run.ts`, `kit-service-address.ts` | chama o comando do próprio CTK (`kitCommand`), sem orquestração |
| Relatório do CTK | `conformance-report.ts`, `conformance-report-shapes.ts` | `config/kit-report.ts` | não lê |
| Veredito e desvios | `conformance-verdict.ts`, `deviation-*.ts` | `kit-verdict.ts`, `kit-excuses.ts`, `config/conformance-excludes.ts` | só o código de saída do CTK |
| Relatório gravado | `conformance-record.ts` | `conformance-report.ts`, `config/conformance-report-format.ts` | não grava |
| Camadas 1 a 3 | `conformance-layers.ts`, `conformance-layer-run.ts`, `conformance-document.ts`, `tests/support/yaml-subset.ts` | `layer-checks.ts`, `config/layer-check-reports.ts` | não tem |
| Módulo sob teste | compose (`api-kit`) | `module-process.ts`, `readiness.ts` | sonda de recursos obrigatórios (`readiness-probe.ts`, `mandatory-response-attributes.ts`) |
| Orquestração | `conformance-run.ts` | `conformance-run.ts` | `run-conformance-kit.ts` (163 linhas no total) |

Onde os runners divergem, o padrão decide: o formato do relatório é o do inventory, os códigos de saída são os do productorder, os desvios vêm dos nós da especificação, e o diretório do CTK não é alterado.

O `productcatalog` é o mais distante do padrão: usa `CONFORMANCE_API_URL` (e não `CONFORMANCE_SERVICE_URL`), repassa `process.env` inteiro ao CTK, não grava relatório e não aplica desvios.

## 3. Mudanças de comportamento em relação aos runners

- O `productorder` deixa de gravar `reports/` dentro do diretório do CTK e passa a trabalhar numa cópia temporária. Deixa também de passar a URL base com o caminho da API.
- O `inventory` passa a ler os desvios dos nós da especificação, em vez da lista `kitExcuses` no código, e a terminar com os códigos 0 a 5.
- O `productcatalog` passa a orquestrar o CTK pela biblioteca, em vez de chamar o comando do CTK; a gravar o relatório; e a aplicar desvios. Deixa de repassar `process.env` inteiro.
- Os três passam a gravar o relatório no mesmo formato, e a usar as mesmas variáveis.
- O leitor de YAML do `productorder` (`yaml-subset.ts`, parser próprio de subconjunto) é substituído pela dependência `yaml` na biblioteca.

## 4. Interface pública

Nomes definidos na Fase 1 (2026-11-20), a partir da leitura dos runners de `productorder` e `inventory`, e confirmados na Fase 9. O conteúdo que o módulo informa é o da tabela de CNF-09. A interface pública é só o que `src/index.ts` exporta; o resto é interno e os testes o alcançam por caminho relativo.

Orientação de desenho: um objeto declarativo por API e uma função que o executa. Um módulo com mais de uma API passa um objeto por API e a biblioteca grava um relatório por API.

### Execução (camadas 1 a 4)

| Nome | O que é | Fonte que o justifica |
|---|---|---|
| `runConformance(run)` | Roda as camadas 1 a 4 de cada API de `run.apis`, grava um relatório por API e devolve o código de saída 0 a 5 | CNF-04, CNF-09, CNF-11; `productorder` `conformance-run.ts`, `inventory` `conformance-run.ts` |
| `IConformanceRun` | `environment` (o ambiente do processo, passado pelo módulo), `moduleDirectory` (o `backend/`, onde rodam os testes e se grava o relatório), `apis`, `log(message)` e `output?(chunk)` | CNF-04 (variáveis), CNF-07 (onde grava); os dois módulos usam a raiz do backend |
| `IApiConformance` | Uma API: `api`, `openapiVersion`, `pinnedOas`, `generatedOas()`, `pinnedCopyTests`, `answerValidationTests`, `conformanceNode`, `specificationRoot`, `kit` (`tmforumDirectory`, `folder`), `module`, `severalApisInModule?` | tabela de CNF-09 |
| `IModuleUnderTest` | `IProcessModule` (`mode: 'process'`, `migration?`, `start`, `apiBasePath`, `environment(runtime)`, `standIns?`) ou `IComposeModule` (`mode: 'compose'`, `directory`, `service`, `apiBasePath`, `standIns?`) | CNF-13; `inventory` `module-process.ts`, `productorder` `conformance-commands.ts` (`api-kit`, perfil `kit`) |
| `IModuleCommand` | `program`, `args`, `cwd` de um comando do módulo (migração e partida) | `inventory` `applyMigrations` e `startModule` |
| `IModuleRuntime` | O que o kit entrega ao módulo para montar o ambiente: `listenAddress`, `port`, `publicUrl`, `standIns` (variáveis que os stand-ins publicam) | CNF-13 ("o runner define endereço de escuta, porta, URL pública e endereços dos stand-ins") |
| `IStandIn` e `IStandInHandle` | `start()` devolve `environment` (variáveis para o módulo) e `close()` | CNF-13; `inventory` `catalog-stand-in.ts` |
| `EXIT_*` | Os seis códigos de CNF-11 | CNF-11 |

O nome de cada variável de ambiente do módulo (porta, endereço de escuta, URL pública) é do módulo: o kit só entrega os valores por `IModuleRuntime`.

### OAS (camadas 1 e 2)

Usados pelos testes de contrato de todo módulo (CNF-01 e CNF-02), além de pelo próprio runner.

| Nome | O que é |
|---|---|
| `readOasFile(path)` | Lê um OAS em YAML ou JSON e devolve o documento |
| `sha256OfFile(path)` | Resumo SHA-256 do arquivo, para o teste de igualdade da cópia fixada (CNF-01) |
| `compareOas(pinned, generated)` | Devolve as diferenças como lista de `IOasDifference` (`pointer`, `kind`) (CNF-02) |
| `readDeviationRegister(specificationRoot, conformanceNode)` | Lê o nó de conformidade e os nós de desvio e devolve `IDeviationRegister` (`entries`, `isCovered`, `isExcluded`), para o teste do CNF-02 saber que ponteiro está coberto |

### Decisões de desenho dentro do que o padrão deixa em aberto

- **Erros.** `ConformanceError` é a base; `ConfigurationError` leva ao código 2 e `KitDidNotRunError` ao código 1.
- **Relatório de módulo com várias APIs.** `severalApisInModule: true` troca `conformance-report.json` por `conformance-report.<api em minúsculas>.json`, como CNF-07.
- **Código de saída com várias APIs.** Vale o primeiro da ordem 2, 1, 3, 4, 5 entre todas as APIs, e 0 se nenhuma tem código.
- **Origem do CTK no modo processo.** O padrão diz que o `config.json` do CTK tem a origem trocada. O kit lê o nome de host que o `config.json` já usa (por exemplo `tmf637-ri`), mantém o caminho da API, aponta `extra_hosts` desse nome para `host-gateway` e usa a porta em que o módulo escuta. No modo compose usa a origem de `CONFORMANCE_SERVICE_URL`.
- **Porta do módulo em modo processo.** O kit pede ao sistema uma porta livre e a usa; a porta de `CONFORMANCE_SERVICE_URL` vale só no modo compose. O módulo escuta em `0.0.0.0` e o kit sonda `protocolo//host de CONFORMANCE_SERVICE_URL:porta livre`.
- **Modo da pasta `reports/` da cópia temporária.** A cópia é `0700` e seus arquivos `0600`; só `reports/` é `0777`, porque o usuário do contêiner pode não ser o do host, e fica inalcançável a outros usuários pela pasta pai `0700` (como no `inventory`).

## 5. Stack

Igual à do `identity-kit`, com `yaml` além de `zod` para ler o OAS: Node 24, pnpm, TypeScript estrito, Vitest (projetos `behaviour` e `architecture`), oxlint, prettier, secretlint e jscpd.

## 6. Distribuição por tag git

Igual à do `identity-kit`: `pnpm release X.Y.Z` cria o commit com `dist` compilado e a tag `vX.Y.Z`, só a partir da `main` e sem mover tag existente. Os módulos instalam como dependência de desenvolvimento por `github:zig999/conformance-kit#vX.Y.Z`.

## 7. Plano em fases

Cada fase começa pelos testes. A coluna "casos" lista o que os testes provam.

| Fase | Entrega | Casos de teste |
|---|---|---|
| 0 | Esqueleto do projeto, configuração, testes de arquitetura e documentos. **Concluída.** | `typecheck`, `lint`, `format`, `test`, `duplication`, `build` e `secrets` passam |
| 1 | Tipos de erro, executor de processo filho, sistema de arquivos privado e interrupção, todos injetáveis. Nomes da interface pública. **Concluída em 2026-11-20.** Nomes da interface em §4. Executor de processo recebe `spawn` injetável, sem docker nem processo real nos testes. | Processo que termina com código 0 e diferente de zero; processo que não existe (código 127); processo morto por sinal (130); interrupção por SIGINT e SIGTERM aborta só o que é interrompível; arquivo privado criado com `0600` e diretório com `0700`; remoção de árvore; nenhum teste chama processo ou docker de verdade |
| 2 | Leitura do relatório do CTK (Mocha e Newman) e veredito por item. **Concluída em 2026-11-20.** Relatório sem a chave `response`, `requestError` ou `error` (Newman) é lido, não recusado: o Zod 4 exige a chave em `z.unknown()`, então cada uma é `.optional()`. | Mocha: item `passed`, `failed`, `pending`, `skipped` e gancho ignorado, suítes aninhadas; Newman: com resposta, sem resposta, com erro de requisição, asserção pulada e falha; identificador do item como o CTK o relata; pasta sem relatório; relatório sem item; JSON inválido; vários arquivos juntos |
| 3 | Leitura dos nós de desvio e aplicação ao veredito. | Nó válido com ponteiros entre aspas duplas e itens entre acentos graves; `statement` em escalar simples, `>` e `\|`; `statement` entre aspas ou em formato de lista (recusado); crase ou aspas que não fecham; par de acentos vazio; ausência de frontmatter; nó ausente; identificador fora do padrão; item falho coberto e não coberto; ponteiro coberto e não coberto |
| 4 | Relatório gravado com schema estrito, códigos de saída 0 a 5 e precedência. | Schema recusa chave desconhecida, resultado fora de `passed`/`failed`/`not-run` e desvio repetido; relatório de camada que não rodou fica `not-run`; cada código de saída; precedência 2, 1, 3, 4, 5; 3 vale sobre 0; relatório gravado também quando a configuração é recusada; relatório não gravado vira 5 |
| 5 | Leitura de OAS, SHA-256 (camada 1) e comparação de OAS gerado e fixado (camada 2). | YAML e JSON; SHA-256 igual e diferente; diferença em caminho, operação, esquema, estado e código de resposta, cada uma como ponteiro JSON; diferença coberta por desvio e não coberta; OAS ilegível |
| 6 | Execução dos testes do módulo para as camadas 1 e 3, e registro dos resultados. Decidir, pelo uso real em dois módulos, se a validação do stand-in contra o OAS entra aqui. | Conjunto que passa; conjunto com falha; conjunto sem nenhum teste (conta como falha); relatório do vitest ausente; resultado mapeado para `pinnedCopyIdentity` e `answerValidation` |
| 7 | Execução do CTK em docker. O token vai na `config.json` da cópia temporária. | Com executor de comandos de mentira: docker indisponível (código 1); `Authorization` só na `config.json` temporária, com modo `0600`, e apagada no desligamento; serviço de execução anterior ainda de pé (recusa); rede criada e removida só se criada; cópia temporária privada, diretório do CTK intocado; contêiner removido quando o CTK passa, falha e é interrompido; esvaziar `reports/` como root quando a remoção falha; desligamento em ordem inversa; passo do desligamento que falha vira 3; CTK sem relatório (1); `url` da `config.json` trocada pela do módulo; pasta do CTK diferente da esperada recusada |
| 8 | Módulo sob teste em modo processo e em modo compose, e espera de "pronto". | Migração aplicada antes de subir; porta livre, com o módulo escutando onde o CTK o alcança (não só em loopback); SIGTERM e, passada a tolerância (o valor de `CONFORMANCE_STEP_TIMEOUT_MS`), SIGKILL; módulo que termina antes de responder; módulo que responde 404 e 5xx (não pronto) e 200 e 4xx diferente de 404 (pronto); tempo de espera esgotado; `CONFORMANCE_*` nunca repassadas ao módulo; modo compose sobe o serviço do perfil `kit` e o derruba |
| 9 | Orquestração: o objeto declarativo e a função que roda as quatro camadas e o CTK, com suporte a mais de uma API. **Critério para a v0.1.0.** | Camadas 1 a 3 rodam antes do CTK e uma falha não impede as seguintes; a camada que não rodou fica `not-run`; um relatório por API; configuração inválida (código 2) com todas as camadas `not-run`; nenhum valor de `CONFORMANCE_ACCESS_TOKEN` em saída, log, erro ou relatório |
| 10 | Documentação de uso e `v0.1.0`. | O `README.md` traz um exemplo completo de `backend/scripts/conformance.ts`; a tag leva entrada no `CHANGELOG.md` e `dist` compilado |
| 11 | Migração dos módulos, um por vez, cada uma com autorização do usuário e começando pela captura da linha de base (seção 8). Ordem: `inventory`, `productorder`, `productcatalog`, `partymgmt`, `configurator`. | Para cada módulo: o resultado do CTK não piora em relação à linha de base; o relatório sai no formato do padrão; a suíte do módulo passa; o código do runner próprio é removido |
| 12 | Matriz de conformidade da raiz, como script do repositório do kit (`scripts/`, fora do pacote publicado). | Matriz gerada dos `conformance-report*.json` encontrados; módulo sem relatório aparece como não executado; nenhuma linha escrita à mão |

A decisão do token está tomada (seção 10), e nenhuma fase está bloqueada por ela. Como o token vai na `config.json` temporária e não por um encaminhador, o módulo em modo processo escuta onde o CTK o alcança.

## 8. Linhas de base das migrações

Lidos em 2026-11-20. A linha de base é o resultado que a migração não pode piorar.

| Módulo | API | Último resultado conhecido | Fonte |
|---|---|---|---|
| `inventory` | TMF637 v5.0.0 | As quatro camadas `passed`, com 4 desvios aplicados: `tmf637-client-listener-operations-are-not-supported`, `tmf637-product-status-with-a-trailing-space-is-not-supported`, `tmf637-additional-response-codes-are-declared`, `product-batch-event-is-not-published`. Registrado como 23 de 23 itens do CTK em 2026-11-20 | `inventory/backend/conformance-report.json` (gravado em 2026-11-20 11:12 UTC) e o goal `conformance-issuer` |
| `productorder` | TMF622 v5.0.0 | **Desconhecido.** Não há `conformance-report.json` no disco, e os registros de entrega que li não trazem o resultado dos itens do CTK | Nenhuma |
| `productcatalog` | TMF620 v5.0.0 (e TMF671 e TMF679 no padrão) | **Desconhecido.** O runner atual não grava relatório, e os registros de entrega que li não trazem o resultado dos itens do CTK | Nenhuma |
| `partymgmt`, `configurator` | — | Não têm `pnpm conformance` | — |

Para os módulos com linha de base desconhecida, o primeiro passo da migração é rodar o runner atual do módulo e registrar o resultado (itens aprovados, itens falhos, desvios) no próprio módulo, antes de qualquer mudança. Sem isso, "não piora" não é verificável.

## 9. Riscos

- **Divergência entre os runners.** Onde o código não é equivalente, a extração pode mudar o comportamento de um módulo. Cada migração roda o CTK real e compara com a linha de base.
- **Docker nos testes.** Nenhum teste do kit depende de docker; só a execução real da Fase 7 e as migrações.
- **Dependência `yaml`.** É a única dependência de runtime além de `zod`, e entra só pela leitura do OAS.
- **Linha de base desconhecida** de `productorder` e `productcatalog`: pode revelar falhas já existentes que o CTK, hoje, não expõe no `productcatalog` (o runner dele não lê o relatório). O padrão exige que cada falha vire desvio registrado ou correção.
- **CTKs sem relatório Mocha ou Newman.** O padrão só descreve esses dois formatos. Os CTKs de outras APIs em `../tmforum` (TMF629, TMF632, TMF645 e outros) não foram verificados.

## 10. Decisões pendentes

- Se a validação do stand-in contra o OAS entra na biblioteca (Fase 6), a decidir pelo uso em dois módulos.
- Nomes dos campos da interface pública (Fase 1).
- Criar o repositório remoto `github:zig999/conformance-kit`, antes da primeira tag.

Decididas em 2026-11-20 pelo usuário:

- **Token no CTK:** `config.json` temporária `0600`, sem encaminhador.
- **Nome e repositório:** `conformance-kit`, em `github:zig999/conformance-kit`.
- **Leitura de YAML:** dependência `yaml`.
- **Matriz de conformidade:** script do repositório do kit (Fase 12), fora do pacote publicado.
