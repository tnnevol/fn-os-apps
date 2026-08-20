#!/usr/bin/env bash

set -euo pipefail

APP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_PACKAGE="@deepseek-ai/dsh"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org/}"
NODE_BIN="${NODE_BIN:-node}"
NPM_BIN="${NPM_BIN:-npm}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fn-deepseek-harness-dsh.XXXXXX")"

cleanup() {
    rm -rf "${WORK_DIR}"
}
trap cleanup EXIT

fail() {
    echo "prepare-dsh-native: $*" >&2
    exit 1
}

command -v "${NODE_BIN}" >/dev/null 2>&1 || fail "node is not installed"
command -v "${NPM_BIN}" >/dev/null 2>&1 || fail "npm is not installed"
command -v g++ >/dev/null 2>&1 || fail "g++ is required on the build runner"
command -v make >/dev/null 2>&1 || fail "make is required on the build runner"
command -v python3 >/dev/null 2>&1 || fail "python3 is required by node-gyp"
NODE_BIN_PATH="$(command -v "${NODE_BIN}")"
NODE_BIN_DIR="$(cd -- "$(dirname -- "${NODE_BIN_PATH}")" && pwd)"
export PATH="${NODE_BIN_DIR}:${PATH}"
NODE_MAJOR="$("${NODE_BIN}" -p 'process.versions.node.split(".")[0]')"
[ "${NODE_MAJOR}" = "24" ] || fail "Node.js 24 is required; found ${NODE_MAJOR}"

version_is_newer() {
    "${NODE_BIN}" -e '
const [candidate, current] = process.argv.slice(1)
const parse = value => {
    const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?$/.exec(value || "")
    if (!match) return null
    return {
        core: match.slice(1, 4).map(Number),
        prerelease: match[4] === undefined ? [] : match[4].split("."),
    }
}
const compareIdentifier = (left, right) => {
    const leftNumeric = /^\d+$/.test(left)
    const rightNumeric = /^\d+$/.test(right)
    if (leftNumeric && rightNumeric) {
        const leftNumber = BigInt(left)
        const rightNumber = BigInt(right)
        return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0
    }
    if (leftNumeric) return -1
    if (rightNumeric) return 1
    return left < right ? -1 : left > right ? 1 : 0
}
const compare = (left, right) => {
    for (let index = 0; index < left.core.length; index += 1) {
        if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index] ? 1 : -1
    }
    if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1
    if (left.prerelease.length > 0 && right.prerelease.length === 0) return -1
    for (let index = 0; index < Math.min(left.prerelease.length, right.prerelease.length); index += 1) {
        const result = compareIdentifier(left.prerelease[index], right.prerelease[index])
        if (result !== 0) return result
    }
    return left.prerelease.length === right.prerelease.length
        ? 0
        : left.prerelease.length > right.prerelease.length ? 1 : -1
}
const candidateVersion = parse(candidate)
const currentVersion = parse(current)
process.exit(candidateVersion && currentVersion && compare(candidateVersion, currentVersion) > 0 ? 0 : 1)
' "${1:-}" "${2:-}" >/dev/null 2>&1
}

read_registry_version() {
    local tag="$1"
    "${NPM_BIN}" view "${DSH_PACKAGE}@${tag}" version --registry="${NPM_REGISTRY}" 2>/dev/null \
        | tr -d '[:space:]' || true
}

resolve_latest_dsh_version() {
    local latest_version next_version
    latest_version="$(read_registry_version latest)"
    next_version="$(read_registry_version next)"

    if [ -n "${next_version}" ] && { [ -z "${latest_version}" ] || version_is_newer "${next_version}" "${latest_version}"; }; then
        printf '%s\n' "${next_version}"
    else
        printf '%s\n' "${latest_version}"
    fi
}

DSH_VERSION="${DSH_VERSION:-$(resolve_latest_dsh_version)}"
[ -n "${DSH_VERSION}" ] || fail "unable to resolve the latest ${DSH_PACKAGE} version"

RESOLVE_DIR="${WORK_DIR}/resolve"
mkdir -p "${RESOLVE_DIR}"
(
    cd "${RESOLVE_DIR}"
    "${NPM_BIN}" init --yes >/dev/null 2>&1
    "${NPM_BIN}" install \
        --package-lock-only \
        --ignore-scripts \
        --no-audit \
        --no-fund \
        --no-progress \
        --registry="${NPM_REGISTRY}" \
        "${DSH_PACKAGE}@${DSH_VERSION}"
)

LOCKFILE="${RESOLVE_DIR}/package-lock.json"
[ -f "${LOCKFILE}" ] || fail "npm did not create a lockfile for ${DSH_PACKAGE}@${DSH_VERSION}"

NODE_PTY_VERSIONS="$("${NODE_BIN}" - "${LOCKFILE}" <<'NODE'
const fs = require('node:fs')

const lockfile = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const versions = [...new Set(
  Object.entries(lockfile.packages || {})
    .filter(([name, value]) => /(?:^|\/)node_modules\/node-pty$/.test(name) && value?.version)
    .map(([, value]) => value.version),
)].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

if (versions.length === 0) {
  console.error('no node-pty dependency was found in the resolved DSH dependency tree')
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

BUILD_TOOLS_DIR="${WORK_DIR}/build-tools"
mkdir -p "${BUILD_TOOLS_DIR}"
(
    cd "${BUILD_TOOLS_DIR}"
    "${NPM_BIN}" init --yes >/dev/null 2>&1
    "${NPM_BIN}" install \
        --ignore-scripts \
        --no-package-lock \
        --no-audit \
        --no-fund \
        --no-progress \
        --registry="${NPM_REGISTRY}" \
        "node-gyp@^11"
)

NODE_GYP_BIN="${BUILD_TOOLS_DIR}/node_modules/.bin/node-gyp"
[ -x "${NODE_GYP_BIN}" ] || fail "node-gyp was not installed"

BUNDLE_DIR="${APP_DIR}/app/native/node-pty"
rm -rf "${BUNDLE_DIR}"
mkdir -p "${BUNDLE_DIR}"

NODE_PTY_INDEX=0
while IFS= read -r NODE_PTY_VERSION; do
    [ -n "${NODE_PTY_VERSION}" ] || continue
    NODE_PTY_INDEX="$((NODE_PTY_INDEX + 1))"
    VERSION_BUILD_DIR="${WORK_DIR}/node-pty-build-${NODE_PTY_INDEX}"
    mkdir -p "${VERSION_BUILD_DIR}"
    (
        cd "${VERSION_BUILD_DIR}"
        "${NPM_BIN}" init --yes >/dev/null 2>&1
        "${NPM_BIN}" install \
            --ignore-scripts \
            --no-package-lock \
            --no-audit \
            --no-fund \
            --no-progress \
            --registry="${NPM_REGISTRY}" \
            "node-pty@${NODE_PTY_VERSION}"
    )

    NODE_PTY_DIR="${VERSION_BUILD_DIR}/node_modules/node-pty"
    [ -f "${NODE_PTY_DIR}/binding.gyp" ] || fail "node-pty ${NODE_PTY_VERSION} source was not installed"

    (
        cd "${NODE_PTY_DIR}"
        "${NODE_GYP_BIN}" rebuild --release
    )

    NATIVE_BUILD_DIR="${NODE_PTY_DIR}/build/Release"
    [ -f "${NATIVE_BUILD_DIR}/pty.node" ] || fail "node-pty ${NODE_PTY_VERSION} did not produce build/Release/pty.node"

    BUNDLE_VERSION_DIR="${BUNDLE_DIR}/${NODE_PTY_VERSION}"
    mkdir -p "${BUNDLE_VERSION_DIR}"
    cp -a "${NATIVE_BUILD_DIR}/pty.node" "${BUNDLE_VERSION_DIR}/pty.node"
    if [ -f "${NATIVE_BUILD_DIR}/spawn-helper" ]; then
        cp -a "${NATIVE_BUILD_DIR}/spawn-helper" "${BUNDLE_VERSION_DIR}/spawn-helper"
        chmod +x "${BUNDLE_VERSION_DIR}/spawn-helper"
    fi
    echo "Built node-pty@${NODE_PTY_VERSION}."
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

echo "Resolved ${DSH_PACKAGE}@${DSH_VERSION} -> node-pty versions: ${NODE_PTY_VERSIONS//$'\n'/ }."
echo "Bundled node-pty native files in ${BUNDLE_DIR}."
