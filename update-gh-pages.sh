#!/bin/bash
# Updates the 'gh-pages' branch.

set -o errexit -o nounset


PREV_BRANCH="$(git symbolic-ref --short -q HEAD)" || {
  >&2 echo 'Script must be started while on a branch.'
  exit 1
}

if [ -n "$(git status --porcelain)" ]; then
  >&2 echo 'Stash or commit changes before running this script.'
  exit 1
fi


# Checkout gh-pages branch into temporary ./gh-pages/
mkdir gh-pages || { >&2 echo './gh-pages already exists. Operation cancelled.'; exit 1; }
git --work-tree=./gh-pages checkout gh-pages 1>/dev/null # suppress spurious diff
function restore() { rm -r ./gh-pages; git checkout -f "$PREV_BRANCH"; }
trap restore EXIT

# Generate and copy over
npm run prod
cp index.html CNAME gh-pages/
cp -r build gh-pages/

# Commit
echo Press enter to begin commit.; read
git --work-tree=./gh-pages add .
git --work-tree=./gh-pages commit -v -m 'Update gh-pages' --edit
