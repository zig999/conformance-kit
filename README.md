# conformance-kit

Biblioteca TypeScript que dá aos módulos de vendas a mesma maneira de provar a conformidade com as APIs do TM Forum: compara o OAS gerado com o fixado, roda o CTK oficial contra o módulo, julga o resultado com os desvios registrados e grava o `conformance-report.json`.

**Estado:** esqueleto. Ainda não há interface pública nem versão publicada. O que a biblioteca fará e como está em `PLANO.md`; o padrão que ela implementa está em `../padrao-conformidade-tmforum.md`.

## O que ela não é

Não emite nem verifica token (isso é do `identity-kit`), não tem executável e não contém regra de negócio de nenhum módulo. Os limites completos estão em `CLAUDE.md`.

## Instalação

Quando houver tag, cada módulo a instala como dependência de desenvolvimento:

```
pnpm add -D github:zig999/conformance-kit#vX.Y.Z
```

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
```

`pnpm release X.Y.Z` cria o commit de release, com `dist` compilado, e a tag `vX.Y.Z`. Só roda a partir da `main`, com a árvore limpa, e nunca move uma tag existente.

## Versões

Nenhuma versão publicada. Ver `CHANGELOG.md`.
