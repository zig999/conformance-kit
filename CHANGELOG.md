# Changelog

Toda tag leva uma entrada. Tags são imutáveis e nunca movidas; mudança incompatível exige tag nova.

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

O padrão não foi editado e precisa ser revisado por quem o mantém. Detalhes em `PLANO.md` §9.

- **`config.json` da cópia do CTK com modo `0644`** (CNF-12, passo 4 diz `0600`). O CTK roda como o uid 10001 e não lê um `0600` do usuário do host. A pasta da cópia continua `0700` e os outros arquivos, `0600`.
- **Identificadores de item do CTK com o espaço em branco normalizado** nos dois lados (CNF-06 diz "exatamente como o CTK o relata"). Os títulos reais trazem quebras de linha e tabulações.
- **Porta do módulo em modo processo:** a de `CONFORMANCE_SERVICE_URL`, conferida como livre, e não uma sorteada: o endpoint, com a porta, faz parte do título de cada item do CTK.

### Verificado e não verificado

- O CTK real (TMF637) foi executado contra um servidor falso, em modo processo e em modo compose, e deu o resultado esperado: código 4 sem desvio e código 0 com um nó de desvio que cita os itens. Isso prova a mecânica (docker, cópia privada, `host-gateway`, rede do compose, relatório real, desligamento), **não a conformância de nenhum módulo**.
- O kit nunca rodou contra um módulo real, e a comparação do OAS não foi confrontada com um documento gerado por módulo real.

## Sem versão publicada

Esqueleto do projeto: configuração igual à do `identity-kit`, testes de arquitetura, `CLAUDE.md`, `PLANO.md` e `README.md`. Sem interface pública.
