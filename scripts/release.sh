#!/bin/sh
# Uso: pnpm release X.Y.Z
# Cria o commit de release (com dist compilado) e a tag vX.Y.Z. Nunca move uma tag existente.
# Recusa a versao que o CHANGELOG.md nao traz, e, se falhar depois de sair da main, volta a ela sem deixar alteracao.
set -eu
version="${1:?informe a versao, por exemplo 0.1.0}"
tag="v$version"
branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || { echo "release so a partir da main" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "a arvore de trabalho tem mudancas" >&2; exit 1; }
git rev-parse -q --verify "refs/tags/$tag" >/dev/null && { echo "a tag $tag ja existe" >&2; exit 1; }
grep -Fxq "## $tag" CHANGELOG.md || grep -Fq "## $tag " CHANGELOG.md ||
  { echo "o CHANGELOG.md nao tem a entrada '## $tag' (toda tag leva uma entrada)" >&2; exit 1; }

# Cada verificacao para a release: numa lista com && o set -e nao pararia no meio dela.
for check in typecheck lint format test duplication; do
  pnpm "$check" || { echo "pnpm $check falhou; nada foi alterado" >&2; exit 1; }
done
pnpm build

detached=""
back_to_branch() {
  status=$?
  if [ -n "$detached" ]; then
    git reset -q || true
    git checkout -q -- package.json || true
    git checkout -q "$branch" || true
    [ "$status" -eq 0 ] || echo "release interrompida: de volta a $branch, sem alteracoes" >&2
  fi
  exit "$status"
}
trap back_to_branch EXIT

git checkout --detach
detached=1
npm pkg set version="$version"
git add -f dist package.json
git commit -m "release $tag"
git tag "$tag"
git checkout "$branch"
detached=""
echo "tag $tag criada. Envie com: git push origin $tag"
