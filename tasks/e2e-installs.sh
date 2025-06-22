#!/bin/bash
# Copyright (c) 2015-present, Facebook, Inc.
# Licensed under the MIT license found in the LICENSE file.

set -euo pipefail
IFS=$'\n\t'
//
# ========== Initialization ==========
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
readonly TEMP_APP_PATH="$(mktemp -d 2>/dev/null || mktemp -d -t 'temp_app_path')"

cd "$SCRIPT_DIR"
source local-registry.sh

function cleanup() {
  echo "🧹 Cleaning up..."
  rm -rf "$TEMP_APP_PATH"
  stopLocalRegistry
}

function on_exit() {
  cleanup
  echo "🚪 Exiting."
}
trap on_exit EXIT SIGINT SIGTERM ERR

function exists() {
  for file in "$@"; do
    test -e "$file"
  done
}

function checkDependencies() {
  awk '/"dependencies": {/{y=1;next}/},/{y=0; next}y' package.json |
  grep -Ev '^\s*"(@testing-library\/.+|web-vitals|react(-dom|-scripts)?)"' >/dev/null
}

function checkTypeScriptDependencies() {
  awk '/"dependencies": {/{y=1;next}/},/{y=0; next}y' package.json |
  grep -Ev '^\s*"(@testing-library\/.+|web-vitals|(@types\/.+)|typescript|react(-dom|-scripts)?)"' >/dev/null
}

function createReactAppTest() {
  local test_name=$1
  local args=$2

  echo "🚀 Running test: $test_name"
  local app_path="$TEMP_APP_PATH/$test_name"
  cd "$TEMP_APP_PATH"
  npx create-react-app "$test_name" $args || true
  cd "$app_path"
}

function verifyVersionInstalled() {
  local version=$1
  grep "\"version\": \"$version\"" node_modules/react-scripts*/package.json
}

function runSmokeTests() {
  npm start -- --smoke-test
  npm run build
  CI=true npm test
}

# ========== Publish Local Registry ==========
cd "$ROOT_DIR"
startLocalRegistry "$SCRIPT_DIR/verdaccio.yaml"
publishToLocalRegistry

echo "✅ Using Create React App version:"
npx create-react-app --version

# ========== Tests ==========

# Test: Distribution tag
createReactAppTest test-app-dist-tag "--scripts-version=@latest"
exists node_modules/react-scripts src/index.js
! exists node_modules/typescript src/index.tsx yarn.lock
checkDependencies

# Test: Version number
createReactAppTest test-app-version-number "--scripts-version=1.0.17"
verifyVersionInstalled 1.0.17
checkDependencies

# Test: Yarn create
createReactAppTest test-use-yarn-create "--scripts-version=1.0.17"
exists yarn.lock
verifyVersionInstalled 1.0.17
checkDependencies

# Test: TypeScript template
createReactAppTest test-app-typescript "--template typescript"
exists node_modules/typescript src/index.tsx tsconfig.json src/react-app-env.d.ts
checkTypeScriptDependencies
runSmokeTests
echo yes | npm run eject
exists src/react-app-env.d.ts
runSmokeTests

# Test: Tarball URL
createReactAppTest test-app-tarball-url "--scripts-version=https://registry.npmjs.org/react-scripts/-/react-scripts-1.0.17.tgz"
verifyVersionInstalled 1.0.17
checkDependencies

# Test: Custom fork
createReactAppTest test-app-fork "--scripts-version=react-scripts-fork"
exists node_modules/react-scripts-fork

# Test: Failing install deletes project folder
cd "$TEMP_APP_PATH"
npx create-react-app test-app-should-not-exist --scripts-version=$(date +%s) || true
! test -e test-app-should-not-exist/package.json
! test -d test-app-should-not-exist/node_modules

# Test: Preserve existing folder on failure
mkdir test-app-should-remain
echo '## Hello' > test-app-should-remain/README.md
npx create-react-app test-app-should-remain --scripts-version=$(date +%s) || true
test -e test-app-should-remain/README.md
[ "$(ls -1 test-app-should-remain | wc -l)" -eq 1 ]

# Test: Scoped fork TGZ
cd "$TEMP_APP_PATH"
curl -sSL "https://registry.npmjs.org/@enoah_netzach/react-scripts/-/react-scripts-0.9.0.tgz" -o enoah-scripts-0.9.0.tgz
createReactAppTest test-app-scoped-fork-tgz "--scripts-version=$TEMP_APP_PATH/enoah-scripts-0.9.0.tgz"
exists node_modules/@enoah_netzach/react-scripts

# Test: Nested project folder paths
createReactAppTest test-app-nested-paths-t1/aa/bb/cc/dd ""
runSmokeTests
createReactAppTest test-app-nested-paths-t2/aa/bb/cc/dd ""
runSmokeTests
mkdir -p "$TEMP_APP_PATH/test-app-nested-paths-t3/aa"
createReactAppTest test-app-nested-paths-t3/aa/bb/cc/dd ""
runSmokeTests

# Test: Yarn PnP
createReactAppTest test-app-pnp "--use-pnp"
! exists node_modules
exists .pnp.js

# TODO: Enable these once PnP supports full smoke testing
# npm start -- --smoke-test
# npm run build

echo "✅ All tests completed."

