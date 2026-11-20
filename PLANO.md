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

Orientação de desenho: um objeto declarativo por API e uma função que o executa. Uma execução serve a uma API: o módulo passa todas as suas APIs em `apis` e o código da escolhida em `apiCode`, que é o argumento do script (`conformance:<tmfNNN>`, CNF-07). Cada execução grava o relatório da sua API.

### Execução (camadas 1 a 4)

| Nome | O que é | Fonte que o justifica |
|---|---|---|
| `runConformance(run)` | Roda as camadas 1 a 4 da API que `run.apiCode` escolhe entre `run.apis`, grava o relatório dela e devolve o código de saída 0 a 5 | CNF-04, CNF-09, CNF-11; `productorder` `conformance-run.ts`, `inventory` `conformance-run.ts` |
| `IConformanceRun` | `environment` (o ambiente do processo, passado pelo módulo), `moduleDirectory` (o `backend/`, onde rodam os testes e se grava o relatório), `apis`, `apiCode?`, `log(message)` e `output?(chunk)` | CNF-04 (variáveis), CNF-07 (onde grava); os dois módulos usam a raiz do backend |
| `IApiConformance` | `IApiWithKit` (`api`, `openapiVersion`, `pinnedOas`, `generatedOas()`, `pinnedCopyTests`, `answerValidationTests`, `conformanceNode`, `specificationRoot`, `kit` com `tmforumDirectory` e `folder`, `module`) ou `IApiWithoutKit` (os mesmos sem `kit` e `module`, com `withoutKit: true`) | tabela de CNF-09; CR dos ajustes do padrão revisado, itens 1 e 2 |
| `IModuleUnderTest` | `IProcessModule` (`mode: 'process'`, `migration?`, `start`, `apiBasePath`, `environment(runtime)`, `standIns?`) ou `IComposeModule` (`mode: 'compose'`, `directory`, `service`, `kitHost`, `kitPort`, `apiBasePath`, `standIns?`) | CNF-13; `inventory` `module-process.ts`, `productorder` `conformance-commands.ts` (`api-kit`, perfil `kit`) |
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

### Validação do stand-in contra o OAS: não entra na biblioteca (decidido na Fase 6, 2026-11-20)

Critério do `CLAUDE.md` §4: tudo que o kit expõe tem uso em pelo menos dois módulos. A evidência lida:

- `productorder` valida as respostas dos seus stand-ins em testes próprios (`tests/functional/party-management-stand-in-answers.spec.ts`, `qualification-stand-in-answer-identity-and-items.spec.ts`), com um veredito escrito por ele (`customerAnswerVerdictOf`).
- `inventory` valida o stand-in do catálogo em `tests/contract/product-inventory/product-kit-creation-schema.test.ts`, com o leitor de esquema próprio (`findSchemaViolations`).

Os dois já são testes de camada 3: o módulo os lista em `answerValidationTests` e o kit os executa e registra em `results.answerValidation`. O que cada um valida (stand-in de qualificação e de party management num, de catálogo no outro) e o código que usa são diferentes, então não há código comum a extrair. E uma função genérica "validar corpo contra esquema do OAS" exigiria um validador de JSON Schema, que é dependência de runtime além de `zod` e `yaml`, vedada pelo `CLAUDE.md` §5. Sem uso comum e sem dependência permitida, a validação fica no módulo. Se um terceiro módulo mostrar o mesmo código, a decisão se reabre.

### Decisões de desenho dentro do que o padrão deixa em aberto

- **Erros.** `ConformanceError` é a base; `ConfigurationError` leva ao código 2 e `KitDidNotRunError` ao código 1.
- **Relatório e pasta do CTK de módulo com várias APIs.** Quando `apis` tem mais de uma, o relatório é `conformance-report.<api em minúsculas>.json` e a pasta do CTK vem de `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>` (CNF-04, CNF-07). Código ausente com várias APIs, ou desconhecido, recusa a execução com o código 2 e sem relatório, porque não se sabe qual API é.
- **API sem CTK.** `withoutKit: true` roda as camadas 1 a 3, grava `conformanceKit: "not-applicable"` (só nessa chave), não exige as variáveis do CTK nem usa docker, e termina com 0, ou 5 se o relatório não gravou. Configuração recusada continua `not-run`, não `not-applicable`.
- **`config.json` do CTK.** É lido e validado antes de qualquer camada rodar: ilegível ou sem `url` http(s), a execução é recusada com o código 2 (CR, item 4.5). O `.env` do CTK só é copiado quando existe.
- **Origem do CTK no modo processo.** O padrão diz que o `config.json` do CTK tem a origem trocada. O kit lê o nome de host que o `config.json` já usa (por exemplo `tmf637-ri`), mantém o caminho da API, aponta `extra_hosts` desse nome para `host-gateway` e usa a porta de `CONFORMANCE_SERVICE_URL`, a mesma em que o módulo escuta. No modo compose usa a origem de `CONFORMANCE_SERVICE_URL`.
- **Porta do módulo em modo processo (corrigida na execução real, 2026-11-20).** O módulo escuta em `0.0.0.0`, na porta de `CONFORMANCE_SERVICE_URL` (80 ou 443 quando a URL não traz porta), e o kit confere antes de tudo que ela está livre; se não estiver, a execução termina com o código 1 dizendo qual porta. A decisão anterior, uma porta livre sorteada a cada execução, estava errada: o `fullTitle` de cada item do CTK real embute o endpoint (`EndPoint: http://tmf637-ri:5599/...`), então uma porta que muda a cada execução mudaria o identificador de todos os itens e nenhum desvio casaria. É por isso que o `inventory` mantém a porta da URL fixa.
- **Modo da pasta `reports/` da cópia temporária.** A cópia é `0700`; seus arquivos são `0600`, menos a `config.json` (`0644`, ver §9, desvio do CNF-12); `reports/` é `0777`, porque o usuário do contêiner pode não ser o do host, e fica inalcançável a outros usuários pela pasta pai `0700` (como no `inventory`).
- **Modo compose: endereço do CTK.** O CTK usa `kitHost` e `kitPort` (o nome do serviço na rede `tmf` e a porta interna), como o padrão revisado diz; `CONFORMANCE_SERVICE_URL` serve só para o kit esperar o módulo ficar pronto. (Corrige a primeira versão, que usava a URL para os dois.)
- **Módulo em processo: saída.** O kit não repassa a saída do módulo nem a guarda; ao falhar, diz só o status ou o sinal com que ele terminou. A saída do módulo pode conter valores de variáveis.
- **Variáveis `CONFORMANCE_*`.** `withoutConformanceVariables` as tira do ambiente da migração, do módulo, do `docker compose` e dos testes, mesmo que o módulo as declare em `environment(runtime)`.

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
| 3 | Leitura dos nós de desvio e aplicação ao veredito. **Concluída em 2026-11-20.** Um `statement` em lista de bloco (`- item`) também é recusado, além de aspas, lista e mapa em linha; `readDeviationRegister` é público, o leitor com arquivos injetados é interno. | Nó válido com ponteiros entre aspas duplas e itens entre acentos graves; `statement` em escalar simples, `>` e `\|`; `statement` entre aspas ou em formato de lista (recusado); crase ou aspas que não fecham; par de acentos vazio; ausência de frontmatter; nó ausente; identificador fora do padrão; item falho coberto e não coberto; ponteiro coberto e não coberto |
| 4 | Relatório gravado com schema estrito, códigos de saída 0 a 5 e precedência. **Concluída em 2026-11-20.** Os casos "gravado também quando a configuração é recusada" e "não gravado vira 5" têm a peça aqui (`recordRun`, `exitCodeOf`) e o teste ponta a ponta na Fase 9. | Schema recusa chave desconhecida, resultado fora de `passed`/`failed`/`not-run` e desvio repetido; relatório de camada que não rodou fica `not-run`; cada código de saída; precedência 2, 1, 3, 4, 5; 3 vale sobre 0; relatório gravado também quando a configuração é recusada; relatório não gravado vira 5 |
| 5 | Leitura de OAS, SHA-256 (camada 1) e comparação de OAS gerado e fixado (camada 2). **Concluída em 2026-11-20.** A comparação é semântica nas cinco dimensões do CNF-02 (caminhos, operações, esquemas, estados, códigos de resposta), como a do `inventory`: metadados do documento e prosa ficam de fora, `allOf` e referências são achatados, estados são conjuntos. Não foi validada contra um documento gerado de módulo real (ver §9). | YAML e JSON; SHA-256 igual e diferente; diferença em caminho, operação, esquema, estado e código de resposta, cada uma como ponteiro JSON; diferença coberta por desvio e não coberta; OAS ilegível |
| 6 | Execução dos testes do módulo para as camadas 1 e 3, e registro dos resultados. Decidir, pelo uso real em dois módulos, se a validação do stand-in contra o OAS entra aqui. **Concluída em 2026-11-20.** Decisão do stand-in: não entra (§4). Cada arquivo listado precisa deixar resultado aprovado com ao menos uma asserção no relatório do vitest, porque o filtro do vitest é por trecho do caminho e um erro de digitação passaria despercebido; nome que começa com `-` é recusado. | Conjunto que passa; conjunto com falha; conjunto sem nenhum teste (conta como falha); relatório do vitest ausente; resultado mapeado para `pinnedCopyIdentity` e `answerValidation` |
| 7 | Execução do CTK em docker. O token vai na `config.json` da cópia temporária. **Concluída em 2026-11-20.** Os testes usam só executor de comandos e arquivos de mentira. A execução real foi feita à parte, uma vez, contra um servidor falso, e achou o que os testes não achavam (§9): a `config.json` `0600` não é legível pelo CTK, e o esvaziamento de `reports/` como root tinha um defeito de ordem, já corrigido. | Com executor de comandos de mentira: docker indisponível (código 1); `Authorization` só na `config.json` temporária, com modo `0600`, e apagada no desligamento; serviço de execução anterior ainda de pé (recusa); rede criada e removida só se criada; cópia temporária privada, diretório do CTK intocado; contêiner removido quando o CTK passa, falha e é interrompido; esvaziar `reports/` como root quando a remoção falha; desligamento em ordem inversa; passo do desligamento que falha vira 3; CTK sem relatório (1); `url` da `config.json` trocada pela do módulo; pasta do CTK diferente da esperada recusada |
| 8 | Módulo sob teste em modo processo e em modo compose, e espera de "pronto". **Concluída em 2026-11-20.** Só com processo, relógio, sonda HTTP e arquivos de mentira (ver §4 para o modo compose). | Migração aplicada antes de subir; porta livre, com o módulo escutando onde o CTK o alcança (não só em loopback); SIGTERM e, passada a tolerância (o valor de `CONFORMANCE_STEP_TIMEOUT_MS`), SIGKILL; módulo que termina antes de responder; módulo que responde 404 e 5xx (não pronto) e 200 e 4xx diferente de 404 (pronto); tempo de espera esgotado; `CONFORMANCE_*` nunca repassadas ao módulo; modo compose sobe o serviço do perfil `kit` e o derruba |
| 9 | Orquestração: o objeto declarativo e a função que roda as quatro camadas e o CTK, com suporte a mais de uma API. **Critério para a v0.1.0.** **Concluída em 2026-11-20.** Nomes confirmados em §4 (uma execução serve a uma API; `run.apis` e `run.apiCode` escolhem). Os testes das camadas 1 e 3 usam `CONFORMANCE_RUN_TIMEOUT_MS` como limite, que o padrão não define para elas. | Camadas 1 a 3 rodam antes do CTK e uma falha não impede as seguintes; a camada que não rodou fica `not-run`; um relatório por API; configuração inválida (código 2) com todas as camadas `not-run`; nenhum valor de `CONFORMANCE_ACCESS_TOKEN` em saída, log, erro ou relatório |
| 10 | Documentação de uso e `v0.1.0`. **Concluída em 2026-11-20.** README com o exemplo completo de `backend/scripts/conformance.ts` (compilado contra a interface pública por `tests/architecture/readme-example.test.ts`, que falha se o exemplo deixar de compilar) e entrada da v0.1.0 no `CHANGELOG.md`. A tag **não** foi criada. | O `README.md` traz um exemplo completo de `backend/scripts/conformance.ts`; a tag leva entrada no `CHANGELOG.md` e `dist` compilado |
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
- **Docker nos testes.** Nenhum teste do kit depende de docker. A execução real foi feita à parte, uma vez, em 2026-11-20 (abaixo).
- **Dependência `yaml`.** É a única dependência de runtime além de `zod`, e entra só pela leitura do OAS.
- **Linha de base desconhecida** de `productorder` e `productcatalog`: pode revelar falhas já existentes que o CTK, hoje, não expõe no `productcatalog` (o runner dele não lê o relatório). O padrão exige que cada falha vire desvio registrado ou correção.
- **CTKs sem relatório Mocha ou Newman.** O padrão só descreve esses dois formatos. Os CTKs de outras APIs em `../tmforum` (TMF629, TMF632, TMF645 e outros) não foram verificados.

### Execução real do CTK (2026-11-20)

Foi feita uma vez, com o CTK da TMF637 (`tmf637-v5.0.0-ctk-1.0.1`) e a imagem local `tmforumorg/tmf637-v5.0.0-ctk:1.0.1`, contra um servidor falso em `/tmp` que **não implementa a TMF637** (responde 401 e 404 e conta o que recebe), com um token de mentira. Ela prova a mecânica do kit; **não prova a conformância de módulo nenhum**, e o resultado esperado é o código 4. O que se viu:

- Camadas 1 a 3 rodaram com vitest de verdade (`passed`). O CTK alcançou o servidor pelo `host-gateway` e as 9 requisições dele chegaram com o `Authorization` esperado, só pela `config.json` da cópia. O leitor leu o relatório real (23 itens), os itens falhos foram listados, o relatório foi gravado e o código foi **4**. O contêiner do CTK, a cópia temporária e o módulo foram removidos, e a rede `tmf`, que o kit não criou, foi deixada.
- Porém **só depois de duas correções e de um patch temporário**, que não está no código (abaixo).

O que a execução real mostrou e que teste de mentira nenhum mostraria:

1. **A `config.json` com modo `0600` não era legível pelo CTK. Decidido em 2026-11-20 (o usuário autorizou decidir pelo recomendado): `0644` dentro da pasta `0700`.** O contêiner roda como `app` (uid 10001) e o arquivo pertence ao usuário do host (uid 1000): `cp: cannot open '/config/config.json' for reading: Permission denied`, e o kit terminava com o código 1. Rodar o contêiner com `--user` do host não resolve: o CTK grava em `/ctk/DO_NOT_CHANGE/...`, que é do `app`. Com `0644` dentro da pasta `0700` o fluxo funciona de ponta a ponta (execuções reais no fim desta seção). A pasta `0700` é o que impede outros usuários do host de alcançar o arquivo; a mais, só o `app` do contêiner o lê, que é o destinatário. **Desvio de projeto do CNF-12, passo 4** ("diretório e arquivos com modo `0600`/`0700`"): só a `config.json` é `0644`, os demais arquivos da cópia continuam `0600`. O padrão (`../padrao-conformidade-tmforum.md`) **não foi editado**; ele diz `0600` e precisa ser revisado por quem o mantém, com a seção 8 (situação dos módulos). A constante está em `src/shared/node-files.ts` (`READABLE_FILE_MODE`) e o uso, em `src/ctk/workspace.ts`.
2. **O identificador de cada item embute o endpoint**, com a porta (`EndPoint: http://tmf637-ri:9137/...`). Corrigido no kit: o módulo em modo processo escuta na porta de `CONFORMANCE_SERVICE_URL` (§4), para o identificador ser estável.
3. **Os identificadores reais trazem quebras de linha e tabulações** (o título do teste do CTK as tem). A regra do padrão, "o identificador exatamente como o CTK o relata, entre acentos graves", não é praticável num `statement` de frontmatter, cujas linhas o leitor apara. **Decidido em 2026-11-20 (mesma autorização): o espaço em branco é normalizado dos dois lados.** Cada sequência de espaço em branco (espaço, tabulação, quebra de linha) vira um espaço e as pontas são aparadas, tanto no identificador que o CTK relata quanto no item entre acentos graves do nó de desvio (`src/shared/identifier.ts`). Ponteiros JSON não são normalizados. Duas coisas que diferem só no espaço em branco passam a ser o mesmo item; um par de acentos só com espaço é recusado como vazio. **Desvio de projeto do CNF-06** ("exatamente como o CTK o relata"); o padrão não foi editado e precisa ser revisado. Provado com os 15 identificadores reais: um nó de desvio que os cita em uma linha cada fez a execução real sair com 0.
4. **O CTK sai com código 0 mesmo com itens falhos** (6 passaram e 17 falharam de 23). O veredito já não depende do código de saída quando há item falho; ganhou um teste.
5. **O relatório vem em dois `.json` com os mesmos itens** (`index.json` mesclado e `json/mochawesome.json`). O kit lê os dois e deduplica por identificador. Também os 23 itens têm só 20 identificadores distintos: três títulos se repetem.
6. **Os arquivos de `reports/` ficam com o dono `app` e a subpasta `json/` em `0755`**, que o usuário do host não consegue esvaziar. O esvaziamento como root é, portanto, necessário, e tinha um defeito: o `rm` da cópia inteira apagava antes o `docker-compose.yaml` de que o contêiner root precisa, e o desligamento terminava em 3. Corrigido (`reports/` primeiro, sozinho) com teste de regressão.

Execuções reais com o código final (2026-11-20, mesmo CTK e servidor falso; nenhuma prova conformância de módulo):

- **Modo processo:** código 4, 15 identificadores falhos distintos, `config.json` com `0644`, 9 requisições do CTK chegaram ao servidor com o `Authorization` esperado, nenhum contêiner nem cópia temporária ficou.
- **Modo processo com um nó de desvio que cita os 15 identificadores:** código 0, `conformanceKit: passed`, `deviationsApplied` com o nó.
- **Modo compose** (um serviço do perfil `kit` do compose, na rede `tmf`, com `kitHost` e `kitPort`): o CTK alcançou o serviço pelo nome, 9 requisições com o `Authorization` esperado; código 4 (o desvio de teste cita o endpoint do modo processo, que é outro); o serviço foi derrubado e a rede `tmf`, que o kit não criou, foi deixada.

## 10. Decisões pendentes


Decidida na Fase 6 (2026-11-20), pelo critério do `CLAUDE.md`:

- **Validação do stand-in contra o OAS:** não entra na biblioteca (§4).
- **Modo da `config.json`** (`0644` na pasta `0700`) e **normalização do espaço em branco dos identificadores** de item do CTK: §9, por autorização do usuário para decidir pelo recomendado. São desvios de projeto do padrão, que precisa ser revisado.
- **Nomes dos campos da interface pública:** §4.

Decididas em 2026-11-20 pelo usuário:

- **Token no CTK:** `config.json` temporária, sem encaminhador. Modo `0600` na decisão original; passou a `0644` dentro da pasta `0700` em 2026-11-20 (§9).
- **Nome e repositório:** `conformance-kit`, em `github:zig999/conformance-kit`.
- **Leitura de YAML:** dependência `yaml`.
- **Matriz de conformidade:** script do repositório do kit (Fase 12), fora do pacote publicado.

Tratado em 2026-11-20 (CR dos ajustes do padrão revisado, já aplicado e removido): `not-applicable` no relatório e API sem CTK; código da API como argumento e `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>`; endereço do CTK no modo compose por `kitHost` e `kitPort`; recusa com o código 2 da `config.json` do CTK sem origem; `.env` do CTK opcional. Os nomes dos campos novos, o enum de `conformanceKit` com `not-applicable` só nessa chave e o código 2 da recusa foram decisão do kit, registrada em §4.
