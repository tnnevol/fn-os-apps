#!/usr/bin/env bash

set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_DIR="${APP_DIR:-${REPO_DIR}/apps/fn-deepseek-harness}"
DSH_PACKAGE="@deepseek-ai/dsh"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
NODE_BIN="${NODE_BIN:-node}"
NPM_BIN="${NPM_BIN:-npm}"
NPM_COMMAND_TIMEOUT_SECONDS="${NPM_COMMAND_TIMEOUT_SECONDS:-900}"
NODE_GYP_TIMEOUT_SECONDS="${NODE_GYP_TIMEOUT_SECONDS:-900}"
NPM_FETCH_TIMEOUT_MS="${NPM_FETCH_TIMEOUT_MS:-120000}"
NPM_FETCH_RETRIES="${NPM_FETCH_RETRIES:-2}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fn-deepseek-harness-dsh.XXXXXX")"

cleanup() {
    rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

log() {
    printf '[%s] [prepare-dsh-native] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

fail() {
    log "ERROR: $*" >&2
    exit 1
}

run_command() {
    local label="$1"
    local timeout_seconds="$2"
    local started_at status finished_at elapsed
    shift 2

    started_at="$(date +%s)"
    log "START: ${label} (timeout=${timeout_seconds}s)"
    if command -v timeout >/dev/null 2>&1; then
        if timeout --signal=TERM --kill-after=30s "${timeout_seconds}s" "$@"; then
            status=0
        else
            status=$?
        fi
    elif "$@"; then
        status=0
    else
        status=$?
    fi

    finished_at="$(date +%s)"
    elapsed="$((finished_at - started_at))"
    if [ "${status}" -eq 0 ]; then
        log "DONE: ${label} (${elapsed}s)"
    elif [ "${status}" -eq 124 ] || [ "${status}" -eq 137 ]; then
        log "TIMEOUT: ${label} after ${elapsed}s"
    else
        log "FAILED: ${label} (exit=${status}, elapsed=${elapsed}s)"
    fi
    return "${status}"
}

command -v "${NODE_BIN}" >/dev/null 2>&1 || fail "node is not installed"
command -v "${NPM_BIN}" >/dev/null 2>&1 || fail "npm is not installed"
[ -d "${APP_DIR}" ] || fail "application directory not found: ${APP_DIR}"
command -v g++ >/dev/null 2>&1 || fail "g++ is required on the build runner"
command -v make >/dev/null 2>&1 || fail "make is required on the build runner"
command -v python3 >/dev/null 2>&1 || fail "python3 is required by node-gyp"
command -v timeout >/dev/null 2>&1 || log "WARN: timeout command is unavailable; npm/node-gyp command timeouts are disabled"
NODE_BIN_PATH="$(command -v "${NODE_BIN}")"
NODE_BIN_DIR="$(cd -- "$(dirname -- "${NODE_BIN_PATH}")" && pwd)"
export PATH="${NODE_BIN_DIR}:${PATH}"
NODE_MAJOR="$("${NODE_BIN}" -p 'process.versions.node.split(".")[0]')"
[ "${NODE_MAJOR}" = "24" ] || fail "Node.js 24 is required; found ${NODE_MAJOR}"

DSH_VERSION="0.1.0-rc.8"
log "Node.js ${NODE_MAJOR}; npm=$(${NPM_BIN} --version); registry=${NPM_REGISTRY}"
log "Command timeouts: npm=${NPM_COMMAND_TIMEOUT_SECONDS}s, node-gyp=${NODE_GYP_TIMEOUT_SECONDS}s; fetch timeout=${NPM_FETCH_TIMEOUT_MS}ms, retries=${NPM_FETCH_RETRIES}"

DSH_INSTALL_DIR="${WORK_DIR}/dsh"
mkdir -p "${DSH_INSTALL_DIR}"
(
    cd "${DSH_INSTALL_DIR}"
    run_command "initialize DSH dependency tree" "${NPM_COMMAND_TIMEOUT_SECONDS}" \
        "${NPM_BIN}" init --yes || exit $?
    run_command "install ${DSH_PACKAGE}@${DSH_VERSION} dependency tree" "${NPM_COMMAND_TIMEOUT_SECONDS}" \
        "${NPM_BIN}" install \
        --ignore-scripts \
        --no-package-lock \
        --no-audit \
        --no-fund \
        --no-progress \
        --timing \
        --fetch-timeout="${NPM_FETCH_TIMEOUT_MS}" \
        --fetch-retries="${NPM_FETCH_RETRIES}" \
        --fetch-retry-mintimeout=1000 \
        --fetch-retry-maxtimeout=10000 \
        --registry="${NPM_REGISTRY}" \
        "${DSH_PACKAGE}@${DSH_VERSION}" || exit $?
) || fail "unable to install ${DSH_PACKAGE}@${DSH_VERSION} dependency tree"
log "Installed ${DSH_PACKAGE}@${DSH_VERSION} dependency tree in ${DSH_INSTALL_DIR}"

NODE_PTY_PACKAGE_FILES=()
while IFS= read -r -d '' NODE_PTY_PACKAGE_JSON; do
    NODE_PTY_PACKAGE_FILES+=("${NODE_PTY_PACKAGE_JSON}")
done < <(find "${DSH_INSTALL_DIR}" -type f -path '*/node_modules/node-pty/package.json' -print0)
[ "${#NODE_PTY_PACKAGE_FILES[@]}" -gt 0 ] \
    || fail "no node-pty dependency was found in the installed DSH dependency tree"

NODE_PTY_VERSIONS="$("${NODE_BIN}" - "${NODE_PTY_PACKAGE_FILES[@]}" <<'NODE'
const fs = require('node:fs')

const versions = [...new Set(
  process.argv.slice(2).map((file) => JSON.parse(fs.readFileSync(file, 'utf8')).version),
)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

if (versions.length === 0) {
  console.error('no node-pty dependency was found in the installed DSH dependency tree')
  process.exit(1)
}

process.stdout.write(versions.join('\n'))
NODE
)" || fail "unable to resolve node-pty dependencies from ${DSH_PACKAGE}@${DSH_VERSION}"

NODE_PTY_VERSIONS_COUNT="$(
    printf '%s\n' "${NODE_PTY_VERSIONS}" |
        awk 'NF { count++ } END { print count + 0 }'
)"
[ "${NODE_PTY_VERSIONS_COUNT}" -gt 0 ] || fail "resolved node-pty version list is empty"
log "Resolved ${NODE_PTY_VERSIONS_COUNT} node-pty version(s): ${NODE_PTY_VERSIONS//$'\n'/, }"

BUILD_TOOLS_DIR="${WORK_DIR}/build-tools"
mkdir -p "${BUILD_TOOLS_DIR}"
(
    cd "${BUILD_TOOLS_DIR}"
    run_command "initialize node-gyp build tool directory" "${NPM_COMMAND_TIMEOUT_SECONDS}" \
        "${NPM_BIN}" init --yes || exit $?
    run_command "install node-gyp@^11" "${NPM_COMMAND_TIMEOUT_SECONDS}" \
        "${NPM_BIN}" install \
        --ignore-scripts \
        --no-package-lock \
        --no-audit \
        --no-fund \
        --no-progress \
        --timing \
        --fetch-timeout="${NPM_FETCH_TIMEOUT_MS}" \
        --fetch-retries="${NPM_FETCH_RETRIES}" \
        --fetch-retry-mintimeout=1000 \
        --fetch-retry-maxtimeout=10000 \
        --registry="${NPM_REGISTRY}" \
        "node-gyp@^11" || exit $?
) || fail "unable to install node-gyp@^11"

NODE_GYP_BIN="${BUILD_TOOLS_DIR}/node_modules/.bin/node-gyp"
[ -x "${NODE_GYP_BIN}" ] || fail "node-gyp was not installed"
log "Using node-gyp at ${NODE_GYP_BIN}"

BUNDLE_DIR="${APP_DIR}/app/native/node-pty"
rm -rf "${BUNDLE_DIR}"
mkdir -p "${BUNDLE_DIR}"

while IFS= read -r NODE_PTY_VERSION; do
    [ -n "${NODE_PTY_VERSION}" ] || continue
    NODE_PTY_PACKAGE_JSON=""
    for CANDIDATE_PACKAGE_JSON in "${NODE_PTY_PACKAGE_FILES[@]}"; do
        CANDIDATE_VERSION="$("${NODE_BIN}" -e '
const fs = require("node:fs")
process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version)
' "${CANDIDATE_PACKAGE_JSON}")" \
            || fail "unable to read node-pty version from ${CANDIDATE_PACKAGE_JSON}"
        if [ "${CANDIDATE_VERSION}" = "${NODE_PTY_VERSION}" ]; then
            NODE_PTY_PACKAGE_JSON="${CANDIDATE_PACKAGE_JSON}"
            break
        fi
    done
    [ -n "${NODE_PTY_PACKAGE_JSON}" ] \
        || fail "unable to locate node-pty@${NODE_PTY_VERSION} source directory"
    NODE_PTY_DIR="$(dirname -- "${NODE_PTY_PACKAGE_JSON}")"
    [ -f "${NODE_PTY_DIR}/binding.gyp" ] || fail "node-pty ${NODE_PTY_VERSION} source was not installed"
    log "Compiling node-pty@${NODE_PTY_VERSION} from ${NODE_PTY_DIR}"

    (
        cd "${NODE_PTY_DIR}"
        run_command "node-gyp rebuild node-pty@${NODE_PTY_VERSION}" "${NODE_GYP_TIMEOUT_SECONDS}" \
            "${NODE_GYP_BIN}" rebuild --release || exit $?
    ) || fail "unable to compile node-pty@${NODE_PTY_VERSION}"

    NATIVE_BUILD_DIR="${NODE_PTY_DIR}/build/Release"
    [ -f "${NATIVE_BUILD_DIR}/pty.node" ] || fail "node-pty ${NODE_PTY_VERSION} did not produce build/Release/pty.node"

    BUNDLE_VERSION_DIR="${BUNDLE_DIR}/${NODE_PTY_VERSION}"
    mkdir -p "${BUNDLE_VERSION_DIR}"
    cp -a "${NATIVE_BUILD_DIR}/pty.node" "${BUNDLE_VERSION_DIR}/pty.node"
    if [ -f "${NATIVE_BUILD_DIR}/spawn-helper" ]; then
        cp -a "${NATIVE_BUILD_DIR}/spawn-helper" "${BUNDLE_VERSION_DIR}/spawn-helper"
        chmod +x "${BUNDLE_VERSION_DIR}/spawn-helper"
    fi
    log "Built node-pty@${NODE_PTY_VERSION}; native files copied to ${BUNDLE_VERSION_DIR}"
done <<< "${NODE_PTY_VERSIONS}"

printf '%s\n' "${DSH_VERSION}" > "${APP_DIR}/app/dsh-version"
printf '%s\n' "${NODE_PTY_VERSIONS}" > "${APP_DIR}/app/node-pty-versions"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
    NODE_PTY_VERSIONS_CSV="${NODE_PTY_VERSIONS//$'\n'/,}"
    {
        echo "dsh_version=${DSH_VERSION}"
        echo "node_pty_versions=${NODE_PTY_VERSIONS_CSV}"
    } >> "${GITHUB_OUTPUT}"
fi

log "Resolved ${DSH_PACKAGE}@${DSH_VERSION} -> node-pty versions: ${NODE_PTY_VERSIONS//$'\n'/ }"
log "Bundled node-pty native files in ${BUNDLE_DIR}"
