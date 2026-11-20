# Changelog

Toda tag leva uma entrada. Tags são imutáveis e nunca movidas; mudança incompatível exige tag nova.

## Não publicado (correções do review, para a v0.1.1)

- **Listagens julgadas só pelo stdout.** `ICommandResult` ganhou `stdout`. `docker compose ps -q` e `docker ps -a -q` com um aviso no stderr (`variable is not set`) faziam o kit recusar partir com "serviços já rodando" ou tentar remover um contêiner que não existe (código 3).
- **Modo compose:** a recusa de serviço de execução anterior roda depois que os stand-ins sobem e com o ambiente do `up`, porque o arquivo do compose pode precisar das variáveis que eles publicam.
- **A espera entre SIGTERM e SIGKILL é cancelada** quando o módulo sai. Antes, o timer solto segurava o processo da execução por até `CONFORMANCE_STEP_TIMEOUT_MS` (60 s por padrão) depois do resultado.
- **O relatório do CTK é conferido contra os totais que ele mesmo declara.** O kit não pode depender de saber onde cada falha está no JSON. O mochawesome traz `stats` (`tests`, `passes`, `failures`, `testsRegistered`) e o Newman traz `run.stats` (`requests.total`, `assertions.total`, `assertions.failed`). Se os itens que o kit contou não batem com eles, ou se `testsRegistered` é maior do que os testes que rodaram (o que um gancho que falha deixa para trás), o resultado é "o CTK não rodou até o fim" (código 1). Um relatório sem totais também é recusado. Conferido contra um relatório real da TMF637 (23 testes, `stats` batendo) e contra cópias adulteradas dele: teste removido, `testsRegistered` maior, `stats` removido, `failures` subdeclarado e gancho falho são todos recusados.
- **Um `.json` que não é Mocha nem Newman na pasta de relatórios recusa a execução** (antes era ignorado, desde que sobrasse algum item).
- **Gancho do Mocha que falhou** (em `beforeHooks`, `afterHooks` ou entre os testes com `isHook`) é "o CTK não rodou até o fim" (código 1); antes era ignorado. **`run.failures` do Newman** produz itens falhos. Desvio do CNF-15 ("ganchos não contam"): só o gancho que falhou conta.
- **Timeout do CTK deixa de parecer término.** O limite de tempo agora é do próprio runner de processos, e o resultado do comando traz `timedOut`. Um CTK morto por `CONFORMANCE_RUN_TIMEOUT_MS` é código 1 e o relatório parcial que ficou na pasta não é lido (antes virava código 130, igual a uma interrupção, e o relatório parcial era julgado).
- **O módulo é parado com tudo o que ele subiu.** O módulo é lançado como líder do próprio grupo de processos e o desligamento sinaliza o grupo (SIGTERM e, depois do limite, SIGKILL). Antes só o processo lançado era sinalizado: com `pnpm start` ou `sh -c`, o invólucro morria e o servidor ficava com a porta fixa, e a execução seguinte falhava com "port is not free". Um grupo que sobrevive ao SIGKILL agora é desligamento que falhou (código 3). Verificado com processos reais: sinalizar só o invólucro deixa o servidor vivo; sinalizar o grupo derruba os dois. O mecanismo antigo de espera (e o timer que segurava o processo) foi substituído por uma sondagem do grupo no relógio da execução.
- **A camada 2 compara mais.** Cada propriedade é comparada inteira (restrições, `items`, propriedades em linha, composições), e cada operação compara os `parameters`, os `headers` das respostas e o `required` do corpo. Antes só `type`, `format`, `$ref`, `items` raso e `enum` entravam, e um documento sem `maxLength` ou sem o parâmetro `limit` passava. As 18 OAS de `../tmforum` comparadas com elas mesmas não dão diferença; remoções feitas à mão num documento real são pegas.

## v0.1.0 (2026-11-20)

Primeira versão com interface pública. Instala-se por `pnpm add -D github:zig999/conformance-kit#v0.1.0`.

### Interface pública

- `runConformance(run)` roda as quatro camadas de uma API, escolhida por `run.apiCode` entre `run.apis` (testes do módulo, comparação do OAS publicado com o fixado, CTK em docker), julga o CTK com os desvios dos nós da especificação, grava `conformance-report.json` e devolve o código de saída 0 a 5 do padrão. Interrompe por SIGINT e SIGTERM e desliga tudo o que subiu, em ordem inversa.
- Módulo sob teste em modo `process` (porta de `CONFORMANCE_SERVICE_URL` conferida como livre, migração, escuta em todos os endereços, SIGTERM e SIGKILL) ou `compose` (serviço do perfil `kit`), com stand-ins do módulo e espera de "pronto".
- API sem CTK em `../tmforum` (`IApiWithoutKit`, `withoutKit: true`): roda as camadas 1 a 3, grava `conformanceKit: "not-applicable"` (só nessa chave do schema), não usa docker nem exige as variáveis do CTK, e termina com 0 (ou 5 se o relatório não gravou).
- Módulo com mais de uma API: o código da API é o argumento, o relatório é `conformance-report.<tmfNNN>.json` e a pasta do CTK vem de `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>`; a pasta de outra API é recusada com o código 2.
- Modo compose: o CTK usa `kitHost` e `kitPort` (nome do serviço e porta interna); `CONFORMANCE_SERVICE_URL` serve só para esperar o módulo ficar pronto.
- `config.json` do CTK ilegível ou sem `url` http(s) recusa a execução com o código 2 antes de qualquer camada; o `.env` do CTK só é copiado quando existe.
- `compareOas`, `readOasFile`, `sha256OfFile` e `readDeviationRegister` para os testes de contrato de cada módulo.
- `EXIT_*`, os erros `ConformanceError`, `ConfigurationError` e `KitDidNotRunError`, e os tipos de `IApiConformance`, `IConformanceRun`, `IProcessModule`, `IComposeModule` e `IStandIn`.

### Comportamento

- O token vai só na `config.json` da cópia temporária privada do CTK (`0644`, dentro da pasta `0700`, removida no desligamento) e é escondido de toda mensagem e de toda saída, mesmo quando um pedaço dele cai no fim de um bloco de saída e o resto no começo do seguinte.
- O diretório do CTK nunca é alterado; só a pasta de `../tmforum` é aceita.
- Nenhuma variável `CONFORMANCE_*` chega à migração, ao módulo, ao `docker compose` nem aos testes.
- A comparação do OAS é semântica nas cinco dimensões do padrão (caminhos, operações, esquemas, estados, códigos de resposta).
- Dependências de runtime: só `zod` e `yaml`.

### Desvios do padrão, por decisão de projeto

O padrão não foi editado e precisa ser revisado por quem o mantém. Os fatos que os motivam estão em "Execução real do CTK", abaixo.

- **`config.json` da cópia do CTK com modo `0644`** (CNF-12, passo 4 diz `0600`). O CTK roda como o uid 10001 e não lê um `0600` do usuário do host. A pasta da cópia continua `0700` e os outros arquivos, `0600`.
- **Identificadores de item do CTK com o espaço em branco normalizado** nos dois lados (CNF-06 diz "exatamente como o CTK o relata"). Os títulos reais trazem quebras de linha e tabulações.
- **Porta do módulo em modo processo:** a de `CONFORMANCE_SERVICE_URL`, conferida como livre, e não uma sorteada: o endpoint, com a porta, faz parte do título de cada item do CTK.

### Execução real do CTK (2026-11-20)

Feita com o CTK da TMF637 (`tmf637-v5.0.0-ctk-1.0.1`, imagem `tmforumorg/tmf637-v5.0.0-ctk:1.0.1`) contra um servidor falso que não implementa a TMF637, com um token de mentira. Prova a mecânica (docker, cópia privada, `host-gateway`, rede do compose, relatório real, desligamento), **não a conformância de nenhum módulo**. Resultados: modo processo sem desvio, código 4, com 15 identificadores falhos distintos e as 9 requisições do CTK chegando com o `Authorization` esperado; modo processo com um nó de desvio que cita os 15 identificadores, código 0, `conformanceKit: passed` e o nó em `deviationsApplied`; modo compose (serviço do perfil `kit`, por `kitHost` e `kitPort`), o CTK alcançou o serviço pelo nome e o serviço foi derrubado, com a rede `tmf`, que o kit não criou, deixada. Seis achados que teste de mentira nenhum mostraria:

1. **Modo da `config.json`.** O contêiner roda como `app` (uid 10001) e o arquivo da cópia pertence ao usuário do host (uid 1000). Com `0600`: `cp: cannot open '/config/config.json' for reading: Permission denied`, o CTK não grava relatório e o kit sai com 1. Rodar o contêiner com `--user` do host também falha (`cp: cannot create regular file '/ctk/DO_NOT_CHANGE/cypress/fixtures/config.json': Permission denied`), porque o CTK grava em pastas do `app`. Com `0644` dentro da pasta `0700` o fluxo funciona. Daí o desvio do CNF-12, passo 4.
2. **O identificador de cada item embute o endpoint, com a porta** (`EndPoint: http://tmf637-ri:9137/tmf-api/productInventoryManagement/v5`). Uma porta sorteada a cada execução mudaria o identificador de todos os itens e nenhum desvio casaria. Daí o módulo em modo processo escutar na porta de `CONFORMANCE_SERVICE_URL`.
3. **Os títulos reais trazem quebras de linha e tabulações** (`...Tests status \n\n\t\t\t\tEndPoint: ...`), que um `statement` de uma linha não escreve (o leitor apara cada linha). Daí normalizar o espaço em branco dos dois lados. Os 23 itens do CTK têm só 20 identificadores distintos: três títulos se repetem.
4. **O CTK sai com código 0 mesmo com itens falhos** (6 passaram e 17 falharam de 23). O veredito não depende do código de saída quando há item falho.
5. **O relatório vem em dois `.json` com os mesmos itens:** `index.json` (mesclado) e `json/mochawesome.json`. O kit lê os dois (46 itens lidos de 23) e deduplica por identificador.
6. **Os arquivos de `reports/` ficam com o dono `app` (uid 10001) e a subpasta `json/` em `0755`**, que o usuário do host não consegue esvaziar. O esvaziamento como root (`find /reports -mindepth 1 -delete` num contêiner com `--user 0`) é necessário, e tinha um defeito de ordem: o `rm` da cópia inteira apagava antes o `docker-compose.yaml` de que o contêiner root precisa, e o desligamento saía com 3. Agora `reports/` é removida sozinha e primeiro.

### Verificado e não verificado

- Verificado por testes (executor de comandos, relógio, sonda HTTP e arquivos de mentira) e pela execução real acima, só com um servidor falso.
- **Não verificado:** o kit nunca rodou contra um módulo real; a comparação do OAS não foi confrontada com um documento gerado por módulo real; o leitor de relatório do tipo Newman nunca foi exercitado com um relatório real (só o Mocha do CTK da TMF637); os CTKs de outras APIs em `../tmforum` não foram verificados quanto ao formato do relatório.

### Fora do pacote publicado

- `scripts/generate-matrix.ts` (`pnpm matrix`, sob `tsx`, dependência só de desenvolvimento) gera `../matriz-conformidade.md` a partir dos `conformance-report*.json` (CNF-07, CNF-08). Valida cada relatório com o schema estrito do kit, mostra o inválido como `inválido`, a API sem CTK como `não se aplica`, a camada que não rodou como `não rodou` e o módulo sem relatório como `sem relatório`. Não conhece nome de módulo: um módulo é uma pasta da raiz com `backend/package.json`, e o operador exclui por `--exclude <pasta>` o que não é módulo do padrão. Lê só arquivos `conformance-report*.json`. Não é publicado (sem `bin`, `files` só com `dist`).

## Sem versão publicada

Esqueleto do projeto: configuração igual à do `identity-kit`, testes de arquitetura, `CLAUDE.md` e `README.md`. Sem interface pública.
