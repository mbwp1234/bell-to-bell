#!/bin/sh
# Installs the privacy gate as git hooks. Hooks live in .git/hooks, which git never
# commits, so run this once in every clone before the first commit.
set -e
cd "$(dirname "$0")/.."
git config user.name mbwp1234
git config user.email 143548329+mbwp1234@users.noreply.github.com
for h in pre-commit commit-msg pre-push; do
  case $h in
    pre-commit) cmd='node tools/privacy-check.mjs --staged' ;;
    commit-msg) cmd='node tools/privacy-check.mjs --msg "$1"' ;;
    pre-push)   cmd='node tools/privacy-check.mjs --push' ;;
  esac
  printf '#!/bin/sh\n# installed by tools/install-hooks.sh\nexec %s\n' "$cmd" > .git/hooks/$h
  chmod +x .git/hooks/$h
done
echo "privacy hooks installed"
