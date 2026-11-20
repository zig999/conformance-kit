# Changelog

Toda tag leva uma entrada. Tags são imutáveis e nunca movidas; mudança incompatível exige tag nova.

## v0.1.0 (a criar)

Primeira versão com interface pública. A tag ainda **não** foi criada e o repositório remoto ainda não existe: depende de quem opera (`pnpm release 0.1.0`).

### Interface pública

- `runConformance(run)` roda as quatro camadas de uma API (testes do módulo, comparação do OAS publicado com o fixado, CTK em docker), julga o CTK com os desvios dos nós da especificação, grava `conformance-report.json` e devolve o código de saída 0 a 5 do padrão. Interrompe por SIGINT e SIGTERM e desliga tudo o que subiu, em ordem inversa.
- Módulo sob teste em modo `process` (porta de `CONFORMANCE_SERVICE_URL` conferida como livre, migração, escuta em todos os endereços, SIGTERM e SIGKILL) ou `compose` (serviço do perfil `kit`), com stand-ins do módulo e espera de "pronto".
- `compareOas`, `readOasFile`, `sha256OfFile` e `readDeviationRegister` para os testes de contrato de cada módulo.
- `EXIT_*`, os erros `ConformanceError`, `ConfigurationError` e `KitDidNotRunError`, e os tipos de `IApiConformance`, `IConformanceRun`, `IProcessModule`, `IComposeModule` e `IStandIn`.

### Comportamento

- O token vai só na `config.json` da cópia temporária privada do CTK (`0600`, removida no desligamento) e é escondido de toda mensagem e de toda saída, mesmo quando um pedaço dele cai no fim de um bloco de saída e o resto no começo do seguinte.
- O diretório do CTK nunca é alterado; só a pasta de `../tmforum` é aceita.
- Nenhuma variável `CONFORMANCE_*` chega à migração, ao módulo, ao `docker compose` nem aos testes.
- A comparação do OAS é semântica nas cinco dimensões do padrão (caminhos, operações, esquemas, estados, códigos de resposta).
- Dependências de runtime: só `zod` e `yaml`.

### Não verificado, e o que a execução real mostrou

- O CTK real foi executado **uma vez**, contra um servidor falso, não contra um módulo. Isso provou a mecânica (docker, cópia privada, `host-gateway`, relatório real, desligamento), não a conformância de ninguém.
- **A `config.json` da cópia, com modo `0600`, não é legível pelo CTK** (ele roda como o uid 10001). Com `0644` dentro da pasta `0700` o fluxo funciona. O código mantém `0600`, como o padrão manda, e por isso **não roda o CTK real** até o usuário decidir. Ver `PLANO.md` §9.
- Os identificadores reais dos itens do CTK trazem quebras de linha e o endpoint com a porta: a citação "exatamente como o CTK relata" num desvio precisa de uma decisão (`PLANO.md` §9).
- A comparação do OAS não foi confrontada com um documento gerado por módulo real.

## Sem versão publicada

Esqueleto do projeto: configuração igual à do `identity-kit`, testes de arquitetura, `CLAUDE.md`, `PLANO.md` e `README.md`. Sem interface pública.
