# conformance-kit: limites e escopo

Este arquivo limita o que o conformance-kit é, possui e faz. Quando um pedido conflitar com ele, aponte o conflito antes de implementar qualquer coisa.

Regras gerais dos módulos de vendas: `../CLAUDE.md`. O padrão que esta biblioteca implementa é `../padrao-conformidade-tmforum.md`: leia-o antes de mexer em qualquer comportamento, porque ele define o formato do relatório, as variáveis, os códigos de saída e o formato dos desvios. Este arquivo vale só para o conformance-kit. As decisões de projeto e o que nunca foi verificado estão na seção 11; os fatos da execução real do CTK, em `CHANGELOG.md`.

## 1. Propósito

O conformance-kit é uma **biblioteca** TypeScript, não um serviço nem um executável. Não tem API HTTP, banco, `bin` nem regra de negócio de venda. Ela dá a todos os módulos de vendas a mesma maneira de provar a conformidade com as APIs do TM Forum, em duas capacidades:

- **Contrato (camadas 1 e 2):** ler o OAS fixado e o OAS gerado, e comparar os dois.
- **Runner do CTK (camada 4):** rodar o CTK oficial contra o módulo, julgar o resultado com os desvios registrados e gravar o relatório.

> **Regra central:** a biblioteca verifica, o módulo declara. A biblioteca sabe como rodar o CTK, ler o relatório dele e aplicar os desvios. Qual API, quais testes, como o módulo sobe e quais stand-ins ele precisa é decisão do módulo.

O kit não usa Siegard. A prova do que ele faz está nos testes, que são escritos antes do código.

## 2. Regra de decisão

Uma funcionalidade pertence ao conformance-kit só quando a sua responsabilidade principal é responder a uma destas perguntas:

- **OAS:** Este OAS gerado difere do fixado? Em quais ponteiros JSON?
- **Execução do CTK:** Como subir, rodar e remover o CTK e o que o módulo precisa para ser alcançado por ele?
- **Veredito:** Este item do CTK falhou? Algum desvio registrado o cobre?
- **Registro:** Qual é o conteúdo do `conformance-report.json` e qual é o código de saída?

Se a funcionalidade responde principalmente a uma pergunta abaixo, ela **não** pertence a este kit:

| Pergunta | Onde mora |
|---|---|
| Quem é o chamador, como o token é verificado ou emitido? | O `identity-kit` |
| Quais recursos, estados e regras tem a API? | A especificação de cada módulo |
| Como o módulo sobe, quais são os stand-ins e os dados que o CTK precisa? | O módulo |
| Quais desvios o módulo tem, e por quê? | Os nós de desvio da especificação do módulo |
| Onde a verificação roda (integração contínua, máquina local)? | A pessoa que opera |

Na dúvida, não pertence. Pare e pergunte.

## 3. O kit é responsável por

- Ler o OAS (YAML ou JSON), calcular o SHA-256 e comparar caminhos, operações, esquemas, estados e códigos de resposta, entregando as diferenças como ponteiros JSON.
- Rodar o CTK em docker: conferir o daemon, criar e remover só a rede que criou, trabalhar numa cópia temporária privada do CTK, sem alterar o diretório do CTK, rodar o contêiner com nome único e removê-lo sempre.
- Subir o módulo sob teste em um de dois modos (processo ou compose), esperar que responda e desligar só o que subiu.
- Ler os relatórios do CTK (Mocha e Newman) e decidir quais itens falharam.
- Ler os nós de desvio da especificação (frontmatter com `statement` e bloco `excludes:`) e aplicá-los ao veredito.
- Gravar o `conformance-report.json` no formato único e validado por schema estrito.
- Terminar com os códigos de saída 0 a 5 do padrão.
- Interromper por SIGINT e SIGTERM, desligando tudo o que subiu.
- Entregar o token ao CTK escrevendo o `Authorization` na `config.json` da cópia temporária privada.
- Gerar a matriz de conformidade da raiz (`../matriz-conformidade.md`) a partir dos `conformance-report*.json`, por um script em `scripts/` do repositório, fora do pacote publicado.

## 4. O kit NÃO é responsável por

- **Emitir ou verificar token.** O token do CTK vem do `identity-kit/testing`. O kit recebe o valor do `Authorization` por parâmetro, não importa o `identity-kit` e nunca o imprime nem o grava fora do arquivo temporário privado da execução.
- **Ler `process.env`.** O módulo passa o ambiente por parâmetro.
- **Log próprio.** O kit não escreve em console nem em arquivo de log. Ele entrega o fato por callback.
- **Regra de venda.** Catálogo, pedido, cliente, cotação, inventário e os demais domínios não aparecem em nome, tipo ou teste.
- **Importar qualquer módulo de vendas.** A dependência vai só dos módulos para o kit.
- **Escolher onde roda.** Não conhece integração contínua.

### Como aplicar esta fronteira

- Tudo que o kit expõe tem uso em pelo menos dois módulos. Código usado por um só módulo fica nele.
- O kit não conhece o nome de nenhuma API nem de nenhum recurso. Cada módulo informa os seus.
- Os nomes dos campos da interface pública são definidos nas fases do plano, não antes.

## 5. Fronteiras internas

1. A parte do OAS não depende do runner do CTK, e o runner não depende da parte do OAS.
2. **Nenhuma dependência de runtime além de `zod` e `yaml`** e dos módulos nativos do Node. Qualquer outra pede decisão registrada.
3. **Todo caminho de falha do runner tem um teste:** docker indisponível, módulo que não responde, CTK sem relatório, relatório sem itens, item falho sem desvio, item falho com desvio, nó de desvio ilegível, falha no desligamento, interrupção por sinal, relatório não gravado.
4. O relógio, o processo filho e o sistema de arquivos são injetados. Nenhum teste espera um tempo fixo nem chama docker de verdade.
5. Erros do kit têm tipo próprio. O kit não lança erro de nenhum módulo.
6. A interface pública é a lista de `exports` do `package.json`. Nenhum consumidor importa arquivo interno.
7. O token e qualquer valor de variável de ambiente do módulo nunca aparecem em mensagem de erro, em log nem no relatório.

## 6. Regras de implementação

- **Teste antes do código.** Nenhuma mudança entra sem um teste que a prove. A primeira entrega porta os testes dos runners de `../productorder/backend/scripts/` e de `../inventory/backend/src/conformance/`, e só depois o código.
- **Segurança em primeiro lugar.** Em caso de dúvida, falhe. Um CTK que passa por engano é um defeito grave; um que falha por engano é um defeito de disponibilidade. O kit prefere o segundo.
- **Stack** igual à do `identity-kit`: Node 24 (`engines.node >=24`), pnpm, TypeScript estrito, Vitest, oxlint, prettier, secretlint e jscpd. Coloque `~/.nvm/versions/node/v24.22.1/bin` no PATH antes de rodar qualquer comando.
- Regras de código: sem `console`, sem ciclo de import, sem `any`, sem asserção de tipo, sem `process.env`, função com até 30 linhas, até 3 parâmetros, sem número mágico, arquivos em kebab-case. Valem também para `scripts/`.
- **Versão e distribuição:** os módulos instalam o kit por tag git (`github:zig999/conformance-kit#vX.Y.Z`), como dependência de desenvolvimento. A tag aponta para um commit que traz `dist` compilado. Tags são imutáveis e nunca movidas. Toda tag leva uma entrada no `CHANGELOG.md`. Mudança incompatível exige tag nova.
- Antes de criar função, tipo ou opção pública, cite a regra do padrão ou o uso real em dois módulos que a justifica. Sem fonte, não cria.
- Mudar o formato do relatório, as variáveis, os códigos de saída ou o formato dos desvios é mudar o padrão, e isso é decisão do usuário.

## 7. Decisões em aberto (confirmar antes de implementar a parte relacionada)

- **Nomes dos campos da interface pública.** Decididos e publicados na `v0.1.0`; estão no `README.md` (tabela da interface pública) e em `src/index.ts`.
- **Repositório remoto.** Criado pelo usuário em `github:zig999/conformance-kit`. A `main` e a tag `v0.1.0` foram enviadas em 2026-11-20; tags novas só quando o usuário pedir.

Decididas em 2026-11-20 pelo usuário, conforme o padrão:

- **Token no CTK:** o kit escreve o `Authorization` na `config.json` da cópia temporária privada (modo `0644` dentro de uma pasta `0700`: o CTK roda como outro usuário e não lê `0600`; decidido em 2026-11-20, desvio de projeto do padrão, ver a seção 11 e `CHANGELOG.md`), que é removida no desligamento. Não há encaminhador. Por isso o módulo em modo processo escuta onde o CTK o alcança, e não só em loopback.
- **Leitura de YAML:** a dependência `yaml` é a leitora de OAS do kit. Ela substitui o parser de subconjunto de YAML que o `productorder` mantém.
- **Matriz de conformidade da raiz:** o gerador é um script em `scripts/` deste repositório, que não entra no pacote publicado (sem `bin`, e `files` só tem `dist`). Está implementado: `pnpm matrix`, sob `tsx` (dependência só de desenvolvimento).

## 8. Dependências entre módulos

- O kit é consumido por todos os módulos de vendas com API do TM Forum. Nenhum módulo é consumido pelo kit.
- A adoção segue a ordem do padrão: extrair a biblioteca dos runners de `productorder` e `inventory`, migrar os dois, e então os demais módulos.
- Enquanto o kit não tem uma tag, cada módulo mantém o seu runner. A troca de cada um é uma mudança do próprio módulo, com a suíte dele passando e com autorização do usuário.

## 9. Documentos de referência

- **`../padrao-conformidade-tmforum.md`:** o padrão que o kit implementa.
- **Código de origem**, nos módulos irmãos:
  - `../productorder/backend/scripts/`: runner da TMF622, leitura dos desvios nos nós da especificação, códigos de saída;
  - `../inventory/backend/src/conformance/` e `src/config/`: runner da TMF637, cópia temporária do CTK, relatório com schema estrito.
- **`../tmforum`:** os OAS e os CTKs oficiais.

## 10. Checklist antes de entregar uma mudança

- [ ] Responde a uma pergunta de OAS, execução do CTK, veredito ou registro da regra de decisão (seção 2)?
- [ ] Nada de token, `process.env`, log próprio ou regra de venda entrou no kit?
- [ ] Tem uso em pelo menos dois módulos, ou uma regra do padrão que a justifique?
- [ ] O teste foi escrito antes do código, e cada caminho de falha novo tem o seu?
- [ ] Nenhum valor secreto aparece em erro, log nem relatório?
- [ ] A dependência de runtime continua sendo só `zod` e `yaml`?
- [ ] O kit não importa nenhum módulo de vendas nem o `identity-kit`?
- [ ] O formato do relatório, as variáveis e os códigos de saída continuam os do padrão?
- [ ] A interface pública mudou? Então `CHANGELOG.md`, a tag e o plano de atualização dos consumidores estão prontos?
- [ ] Nenhuma decisão em aberto da seção 7 foi tomada em silêncio?
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm test` e `pnpm exec jscpd src` passam em Node 24?

## 11. Decisões de projeto e o que nunca foi verificado

**Desvios do padrão** (o padrão não foi editado e precisa ser revisado por quem o mantém; cada um tem o seu fato em `CHANGELOG.md`, "Execução real do CTK"):

- `config.json` da cópia do CTK com modo `0644` dentro da pasta `0700` (CNF-12, passo 4 diz `0600`). Os outros arquivos da cópia continuam `0600`. A constante é `READABLE_FILE_MODE` em `src/shared/node-files.ts`.
- **O kit falha por padrão: só passa o que consegue provar.** Ele não depende de saber onde cada falha está no JSON do CTK. O relatório é conferido contra os totais que ele declara: `stats` do mochawesome (`tests`, `passes`, `failures`, `testsRegistered`) e `run.stats` do Newman (`requests.total`, `assertions.total`, `assertions.failed`); divergência, `testsRegistered` maior que os testes que rodaram, ou ausência dos totais é "o CTK não rodou até o fim" (código 1). Um `.json` que não é Mocha nem Newman na pasta também é. Gancho do Mocha que falhou (em `beforeHooks`/`afterHooks` ou entre os testes com `isHook`) idem, porque os testes depois dele não rodaram e o CTK sai com 0 do mesmo jeito (CNF-15 diz que ganchos não contam: só o que falhou conta). Falha de `run.failures` do Newman é um item falho. CTK morto pelo limite de tempo (`timedOut`) é código 1, e o relatório parcial não é lido. Se um CTK novo gravar relatório de outro formato, o kit o recusa até alguém ensiná-lo: preferimos esse defeito de disponibilidade a um CTK que passa por engano.
- Identificador de item do CTK com o espaço em branco normalizado nos dois lados, no relatório e no nó de desvio (CNF-06 diz "exatamente como o CTK o relata"). Ponteiros JSON não são normalizados. Está em `src/shared/identifier.ts`.
- Módulo em modo processo escuta em `0.0.0.0`, na porta de `CONFORMANCE_SERVICE_URL`, conferida como livre antes de tudo; o endpoint com a porta faz parte do título de cada item do CTK.

**Decisões que o padrão deixa em aberto:**

- Uma execução serve a uma API: `run.apis` traz todas e `run.apiCode` escolhe uma, em qualquer caixa. Com mais de uma API, o código é obrigatório, o relatório é `conformance-report.<tmfNNN>.json` e a pasta do CTK vem de `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>`. Código ausente ou desconhecido recusa com o código 2 e sem relatório.
- `IApiWithoutKit` (`withoutKit: true`): camadas 1 a 3, `conformanceKit: "not-applicable"` (só nessa chave do schema), sem docker nem variáveis do CTK, código 0 (ou 5 se o relatório não gravou). Configuração recusada continua `not-run`.
- Endereço do CTK: no modo processo, o nome de host que o `config.json` do CTK já usa mais a porta de `CONFORMANCE_SERVICE_URL`, com `extra_hosts` para `host-gateway`; no modo compose, `kitHost` e `kitPort`. `CONFORMANCE_SERVICE_URL` serve ao runner para esperar o módulo ficar pronto.
- O `config.json` do CTK é validado antes de qualquer camada rodar (ilegível ou sem `url` http(s): código 2). O `.env` do CTK só é copiado quando existe.
- `withoutConformanceVariables` tira as `CONFORMANCE_*` do ambiente da migração, do módulo, do `docker compose` e dos testes, mesmo que o módulo as declare.
- O kit não repassa nem guarda a saída do módulo; ao falhar, diz só o status ou o sinal. A saída do CTK e dos testes vai ao callback `output`, por um filtro que esconde o token mesmo quando dois blocos o partem.
- `ICommandResult` traz `stdout` à parte de `output` (stdout e stderr juntos): uma listagem (`docker compose ps -q`, `docker ps -a -q`) é julgada só pelo `stdout`, porque o compose avisa no stderr. No modo compose, a recusa de serviço de execução anterior roda depois que os stand-ins sobem e com o ambiente que o `up` recebe (o arquivo do compose pode precisar das variáveis que os stand-ins publicam).
- O módulo é lançado como líder do próprio grupo de processos (`detached`) e o desligamento sinaliza o grupo (`process.kill(-pid, sinal)`), porque ele costuma subir por um invólucro (`pnpm start`, `sh -c`) que termina e deixa o servidor com a porta. SIGTERM ao grupo, SIGKILL depois de `CONFORMANCE_STEP_TIMEOUT_MS`; o que se espera é o grupo sumir (sondado com o sinal 0, no relógio da execução, sem timer solto que segure o processo da execução), e um grupo que sobrevive ao SIGKILL é desligamento que falhou (código 3). Só há suporte a Linux e macOS (grupo por pid negativo).
- Desligamento em ordem inversa; a cópia temporária remove `reports/` sozinha e primeiro, e esvazia como root quando preciso, porque o contêiner precisa do `docker-compose.yaml` da cópia.
- Os testes das camadas 1 e 3 usam `CONFORMANCE_RUN_TIMEOUT_MS` como limite, que o padrão não define para eles. Cada arquivo listado precisa deixar resultado aprovado com ao menos uma asserção no relatório do vitest, porque o filtro do vitest é por trecho do caminho; nome que começa com `-` é recusado.
- A comparação do OAS é semântica nas cinco dimensões do CNF-02 (caminhos, operações, esquemas, estados, códigos de resposta), como a do `inventory`, e vai além do tipo: cada propriedade é comparada inteira (restrições como `maxLength`, `pattern`, `minimum`, `nullable`, `readOnly`, `items`, propriedades em linha, `oneOf`/`anyOf`/`allOf`, `additionalProperties`), cada operação compara os `parameters` (por lugar e nome, os do caminho valem para todas as operações e a operação os sobrepõe, `$ref` resolvido, qualquer ordem), os `headers` de cada resposta e o `required` do corpo. Metadados do documento e prosa (`description`, `summary`, `example`, `examples`) ficam de fora, `allOf` e referências são achatados, estados e listas são conjuntos. Isto é mais estrito que a primeira versão: um módulo cujo documento gerado difere em restrição ou parâmetro passa a ter a camada 2 reprovada (ou um desvio que cita o ponteiro).
- A validação do stand-in contra o OAS **não** entra na biblioteca: `productorder` e `inventory` a fazem em testes próprios (camada 3), com código e stand-ins diferentes, e uma função genérica exigiria um validador de JSON Schema, dependência vedada. Se um terceiro módulo mostrar o mesmo código, a decisão se reabre.
- A matriz (`scripts/generate-matrix.ts`) deriva `Resultado` das camadas (`reprovada`, `incompleta`, `aprovada`), porque o relatório não guarda o código de saída, e mostra `Desvios` como `deviationsApplied` da última execução. Ela fica fora do pacote.

**O que nunca foi verificado:**

- O kit nunca rodou contra um módulo real: só contra executor de comandos de mentira e, uma vez, contra um servidor falso com o CTK real da TMF637.
- A comparação do OAS nunca foi confrontada com um documento gerado por módulo real (só com as OAS de `../tmforum` contra elas mesmas, sem diferença, e com remoções feitas à mão). Ser mais estrita pode dar diferença onde o gerador do módulo escreve a mesma coisa de outro jeito (por exemplo `nullable` e `anyOf` com `null`); nenhuma OAS real de `../tmforum` traz `headers` de resposta, então essa parte só tem teste unitário.
- A conferência dos totais só foi confrontada com um relatório real do mochawesome (TMF637). Os campos de `run.stats` do Newman são os da documentação e nunca foram vistos num relatório real; o leitor de relatório Newman nunca foi exercitado com um relatório real, e os CTKs de outras APIs de `../tmforum` não foram verificados quanto ao formato do relatório (o padrão só descreve Mocha e Newman).
- O modo compose só foi exercitado com um serviço falso.

**Ao migrar um módulo (Fase 11, de cada projeto, com a autorização do usuário para aquele projeto):** o `inventory` passa a ler os desvios dos nós da especificação (o `kitExcuses` sai) e a terminar com os códigos 0 a 5; o `productorder` deixa de gravar `reports/` no diretório do CTK e de passar a URL base com o caminho da API; o `productcatalog` passa a orquestrar o CTK pela biblioteca, a gravar o relatório e a aplicar desvios, e deixa de repassar `process.env` inteiro; os três passam a gravar o relatório no mesmo formato e a usar as mesmas variáveis; o leitor de YAML do `productorder` é substituído pela dependência `yaml`. A linha de base de cada módulo está na seção 8 do padrão. O módulo que cita um item do CTK num desvio usa o identificador com o espaço em branco normalizado.

