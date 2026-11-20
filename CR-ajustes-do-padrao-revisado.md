# Change request: ajustes do conformance-kit ao padrão revisado em 2026-11-20

Pedido de: coordenação dos módulos de vendas (`~/projects/sales`), a partir da revisão de `../padrao-conformidade-tmforum.md` feita em 2026-11-20, depois de a sessão do kit ter começado.
Data: 2026-11-20.
Destino: o conformance-kit, para tratamento em sessão própria neste projeto. Este documento não altera nada no kit.

## Resumo

A revisão do padrão tirou ambiguidades e acrescentou quatro regras que o kit ainda não cobre. Há uma consequência direta: o schema do relatório (Fase 4, concluída) aceita só `passed`, `failed` e `not-run`, e o padrão agora também exige `not-applicable` em `results.conformanceKit`. O desenho (nomes, assinaturas) fica para a sessão do kit; abaixo estão só os requisitos observáveis, com a regra do padrão que os origina.

Leia primeiro, no padrão, a seção "Convenções e termos" e as regras CNF-04, CNF-07, CNF-09, CNF-11, CNF-12 e CNF-13.

## O que se pede

### 1. `not-applicable` no relatório (CNF-04, CNF-07)

1. O schema do relatório aceita `not-applicable` em `results.conformanceKit`, e **só nele**. Nas outras três chaves de `results`, o valor continua `passed`, `failed` ou `not-run`.
2. Uma API que o módulo declara sem CTK em `../tmforum`:
   - roda as camadas 1 a 3 normalmente;
   - **não** roda a camada 4, **não** exige `CONFORMANCE_SERVICE_URL`, `CONFORMANCE_ACCESS_TOKEN` nem `CONFORMANCE_KIT_DIRECTORY` (nem `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>`), não usa docker e não sobe o módulo para o CTK;
   - grava o relatório com `conformanceKit: "not-applicable"`;
   - termina com o código 0 quando o relatório foi gravado, e com o 5 quando não foi.
3. `not-applicable` é diferente de `not-run`: `not-run` é uma camada que devia ter rodado e não rodou (por exemplo configuração recusada); `not-applicable` é uma camada que a API não tem.
4. O módulo informa à biblioteca, num campo do objeto declarativo, que a API não tem CTK.

### 2. Campos novos que o módulo informa (CNF-09)

A tabela de CNF-09 ganhou estes campos, além dos que a Fase 1 já definiu:

| Informação | Conteúdo |
|---|---|
| Ambiente do módulo na execução | Uma função que recebe a porta, a URL pública e os endereços dos stand-ins e devolve as variáveis de ambiente que o módulo precisa. A biblioteca nunca repassa ao módulo as variáveis `CONFORMANCE_*` |
| Endereço para o CTK, no modo compose | O nome do serviço do módulo no compose e a porta interna dele |
| API sem CTK | Que a API não tem CTK (item 1) |

**Não é pedido** nenhum campo de token. A biblioteca não emite nem monta token: ela recebe o valor de `CONFORMANCE_ACCESS_TOKEN` pelo ambiente e o escreve na `config.json` temporária. Os recursos ou papéis que o token concede são assunto do emissor do módulo.

### 3. Código da API como argumento e módulo com mais de uma API (CNF-04, CNF-07, CNF-09)

1. O ponto de entrada que o módulo chama (`backend/scripts/conformance.ts`) recebe o código da API como argumento (por exemplo `tmf632`), e `pnpm conformance:<tmfNNN>` o chama com o código correspondente. Um módulo com uma só API usa `pnpm conformance` sem argumento.
2. A biblioteca grava **um relatório por API**: `conformance-report.json` para o módulo com uma só API, e `conformance-report.<tmfNNN>.json` (código em minúsculas) para o módulo com mais de uma.
3. Num módulo com mais de uma API, a pasta do CTK vem de `CONFORMANCE_KIT_DIRECTORY_<TMFNNN>` (código em maiúsculas, por exemplo `CONFORMANCE_KIT_DIRECTORY_TMF632`), e não de `CONFORMANCE_KIT_DIRECTORY`. As demais variáveis valem para todos os comandos, que rodam um por vez.
4. A validação da pasta continua: só é aceita a pasta do CTK que o módulo informou em `../tmforum`, e qualquer outra, inclusive uma cópia com o mesmo nome, é recusada com o código 2.

### 4. Como o CTK alcança o módulo (CNF-12, item 6; Fase 7)

A regra anterior do padrão, trocar a origem do `config.json` pela de `CONFORMANCE_SERVICE_URL`, estava errada: dentro do docker o CTK usa um nome de host (por exemplo `tmf637-ri`) que o `host-gateway` aponta para a máquina. A regra correta:

1. **Módulo em processo no host.** A cópia do `config.json` mantém o nome de host do `config.json` original e troca só a porta pela de `CONFORMANCE_SERVICE_URL`. O serviço do CTK recebe `extra_hosts` apontando esse nome para `host-gateway`.
2. **Módulo em serviço do compose.** A cópia do `config.json` usa o host e a porta do serviço do módulo na rede `tmf`, os que o módulo informou (item 2).
3. Nos dois modos, o caminho da API continua o do `config.json` original.
4. `CONFORMANCE_SERVICE_URL` é o endereço pelo qual o **runner**, e não o CTK, alcança o módulo. Ela serve só para esperar o módulo ficar pronto.
5. Se o `config.json` original não contiver a origem esperada, o runner recusa com o código 2, em vez de gravar uma configuração sem efeito.

### 5. Pequenos ajustes do padrão que o kit deve conferir

Cada um já pode estar certo no kit; confira e ajuste se não estiver.

- **CNF-04:** as camadas 1 a 3 rodam antes do CTK; uma camada que falha não impede as seguintes; cada resultado vai ao relatório; o resultado delas não muda o código de saída.
- **CNF-12, item 2:** a recusa de partir com um serviço de execução anterior ainda de pé vale só no modo compose.
- **CNF-12, item 4:** a cópia temporária leva o `docker-compose.yaml` do CTK e o `.env` apenas quando ele existe.
- **CNF-02:** a camada 2 passa quando toda diferença está coberta por um desvio; o ponteiro é o da RFC 6901 (`~0` e `~1`).
- **CNF-11:** o código 0 vale também para a API sem CTK com o relatório gravado.

## O que este pedido não inclui

Não inclui token, emissor nem importação do `identity-kit` (o kit continua sem importá-lo), nem a matriz de conformidade, nem a migração dos módulos. Não muda o formato dos desvios, as variáveis `CONFORMANCE_SERVICE_URL`, `CONFORMANCE_ACCESS_TOKEN`, `CONFORMANCE_KIT_DIRECTORY` e os três tempos limite, nem os códigos de saída 1 a 5.

## Pontos para a sessão do kit decidir

- Nomes dos campos novos do objeto declarativo e da função que recebe o código da API.
- Se o schema do relatório usa um tipo à parte para `conformanceKit` ou um enum que admite `not-applicable` só nessa chave.
- Onde a recusa do item 4.5 aparece nos códigos de saída (o padrão diz 2).

## Critério de aceite

- O relatório de uma API sem CTK tem `results.conformanceKit` igual a `not-applicable`, e o schema recusa `not-applicable` em qualquer outra chave de `results`.
- Uma API sem CTK roda sem docker e sem as três variáveis do CTK, grava o relatório e termina com 0; se o relatório não puder ser gravado, termina com 5.
- Um módulo com duas APIs grava dois relatórios, `conformance-report.<a>.json` e `conformance-report.<b>.json`, cada um com a sua pasta de CTK, e uma pasta de CTK trocada entre as duas APIs é recusada com o código 2.
- No modo processo, a cópia do `config.json` mantém o nome de host do original e troca só a porta; o serviço do CTK ganha `extra_hosts` para `host-gateway`. No modo compose, ela usa o host e a porta do serviço informados pelo módulo. O caminho da API é o do original nos dois.
- Um `config.json` original sem a origem esperada é recusado com o código 2.
- Nenhum valor de `CONFORMANCE_ACCESS_TOKEN` aparece em saída, log, erro ou relatório, e o `config.json` com o token é apagado no desligamento.
- Os testes existentes do kit continuam passando, e as verificações (`typecheck`, `lint`, `format`, `test`, `duplication`, `build`, `secrets`) passam em Node 24.
