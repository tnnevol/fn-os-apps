#!/bin/bash

set -euo pipefail

NODE_BIN="${NODE_BIN:-/var/apps/nodejs_v24/target/bin}"
NPM_BIN="${NPM_BIN:-${NODE_BIN}/npm}"
PACKAGE_MANAGER="${PACKAGE_MANAGER:-npm}"
PACKAGE_MANAGER_BIN="${PACKAGE_MANAGER_BIN:-${NPM_BIN}}"
DSH_HOME="${DSH_HOME:?DSH_HOME is required}"
DSH_NATIVE_BUNDLE="${DSH_NATIVE_BUNDLE:?DSH_NATIVE_BUNDLE is required}"
NODE_PTY_VERSIONS_FILE="${NODE_PTY_VERSIONS_FILE:?NODE_PTY_VERSIONS_FILE is required}"
DSH_PACKAGE_DIR="${DSH_PACKAGE_DIR:?DSH_PACKAGE_DIR is required}"
NPM_GLOBAL_ROOT="${NPM_GLOBAL_ROOT:?NPM_GLOBAL_ROOT is required}"

case "${PACKAGE_MANAGER}" in
npm)
    ;;
*)
    printf '[%s] [install-node-pty] [ERROR] Unsupported package manager: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${PACKAGE_MANAGER}" >&2
    exit 1
    ;;
esac
[ -x "${PACKAGE_MANAGER_BIN}" ] ||
    {
        printf '[%s] [install-node-pty] [ERROR] Package manager is not executable: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${PACKAGE_MANAGER_BIN}" >&2
        exit 1
    }

log_message() {
    local level="$1"
    shift
    printf '[%s] [install-node-pty] [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${level}" "$*"
}

log_info() {
    log_message INFO "$@"
}

log_error() {
    log_message ERROR "$@" >&2
}

fail() {
    log_error "$*"
    exit 1
}

read_package_version() {
    local package_json="$1"
    [ -f "${package_json}" ] || return 0
    "${NODE_BIN}/node" -e '
const fs = require("node:fs")
try {
    const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version
    if (typeof value === "string") process.stdout.write(value)
} catch {}
' "${package_json}" 2>/dev/null || true
}

read_version_list() {
    [ -f "${NODE_PTY_VERSIONS_FILE}" ] || return 0
    awk 'NF { gsub(/[[:space:]]/, "", $0); print }' "${NODE_PTY_VERSIONS_FILE}"
}

version_in_list() {
    local needle="$1"
    local list="$2"
    local value
    while IFS= read -r value; do
        [ "${value}" = "${needle}" ] && return 0
    done <<<"${list}"
    return 1
}

validate_versions() {
    local version
    while IFS= read -r version; do
        [ -n "${version}" ] || continue
        case "${version}" in
        *[![:alnum:]_.+-]*) fail "invalid packaged node-pty version: ${version}" ;;
        esac
    done <<<"${NODE_PTY_VERSIONS}"
}

node_pty_packages() {
    find "${DSH_PACKAGE_DIR}" "${NPM_GLOBAL_ROOT}" \
        -type f \
        -path '*/node_modules/node-pty/package.json' \
        -print0 2>/dev/null
}

has_compiler() {
    command -v g++ >/dev/null 2>&1
}

has_seen_package() {
    local candidate="$1"
    local package_json
    if [ "${#node_pty_package_files[@]}" -gt 0 ]; then
        for package_json in "${node_pty_package_files[@]}"; do
            [ "${package_json}" = "${candidate}" ] && return 0
        done
    fi
    return 1
}

restore_node_pty_scripts() {
    local map_file="$1"
    local original_path original_backup
    while IFS= read -r -d '' original_path && IFS= read -r -d '' original_backup; do
        cp -a "${original_backup}" "${original_path}" || return 1
    done <"${map_file}"
}

run_dsh_dependency_scripts() {
    local backup_dir map_file package_json backup_file rebuild_status
    local use_compiler=0
    local -a node_pty_package_files=()

    while IFS= read -r -d '' package_json; do
        if ! has_seen_package "${package_json}"; then
            node_pty_package_files+=("${package_json}")
        fi
    done < <(node_pty_packages)

    [ "${#node_pty_package_files[@]}" -gt 0 ] ||
        fail "Unable to locate any node-pty package before running dependency scripts"

    backup_dir="$(mktemp -d "${DSH_HOME}/.node-pty-scripts.XXXXXX")" ||
        fail "Unable to create a temporary node-pty script backup directory"
    map_file="${backup_dir}/paths"
    : >"${map_file}" || fail "Unable to create the node-pty script backup index"

    if has_compiler; then
        use_compiler=1
        log_info "g++ detected; running node-pty lifecycle scripts without the native compilation patch."
    else
        for package_json in "${node_pty_package_files[@]}"; do
            backup_file="${backup_dir}/$(printf '%s' "${#package_json}").${RANDOM}.json"
            while [ -e "${backup_file}" ]; do
                backup_file="${backup_dir}/$(printf '%s' "${#package_json}").${RANDOM}.json"
            done
            cp -a "${package_json}" "${backup_file}" || {
                restore_node_pty_scripts "${map_file}" >/dev/null 2>&1 || true
                rm -rf "${backup_dir}"
                fail "Unable to back up node-pty package metadata"
            }
            printf '%s\0%s\0' "${package_json}" "${backup_file}" >>"${map_file}" || {
                restore_node_pty_scripts "${map_file}" >/dev/null 2>&1 || true
                rm -rf "${backup_dir}"
                fail "Unable to record the node-pty package metadata backup"
            }
            "${NODE_BIN}/node" -e '
const fs = require("node:fs")
const file = process.argv[1]
const packageJson = JSON.parse(fs.readFileSync(file, "utf8"))
// Keep every other dependency lifecycle script enabled; only node-pty install is bypassed.
packageJson.scripts = {
  ...(packageJson.scripts ?? {}),
  install: "node -e \"process.exit(0)\"",
}
fs.writeFileSync(file, `${JSON.stringify(packageJson, null, 2)}\n`)
' "${package_json}" || {
                restore_node_pty_scripts "${map_file}" >/dev/null 2>&1 || true
                rm -rf "${backup_dir}"
                fail "Unable to disable node-pty native lifecycle scripts"
            }
        done
    fi

    if [ "${use_compiler}" -eq 1 ]; then
        log_info "Running DSH dependency lifecycle scripts with node-pty native compilation enabled."
    else
        log_info "Temporarily disabling lifecycle scripts for ${#node_pty_package_files[@]} node-pty package(s); other DSH dependency scripts remain enabled."
        log_info "Running DSH dependency lifecycle scripts with node-pty native compilation disabled."
    fi
    local started_at finished_at elapsed importer_dir importer_count=0
    started_at="$(date +%s)"
    log_info "START: npm rebuild --global --foreground-scripts"
    if "${NPM_BIN}" rebuild --global --ignore-scripts=false --foreground-scripts; then
        rebuild_status=0
    else
        rebuild_status=$?
    fi
    finished_at="$(date +%s)"
    elapsed="$((finished_at - started_at))"
    if [ "${rebuild_status}" -eq 0 ]; then
        log_info "DONE: npm rebuild --global --foreground-scripts (${elapsed}s)"
    else
        log_error "FAILED: npm rebuild --global --foreground-scripts (exit=${rebuild_status}, elapsed=${elapsed}s)"
    fi

    if [ "${use_compiler}" -eq 0 ]; then
        if ! restore_node_pty_scripts "${map_file}"; then
            rm -rf "${backup_dir}"
            fail "Unable to restore node-pty package metadata"
        fi
    fi
    rm -rf "${backup_dir}"

    [ "${rebuild_status}" -eq 0 ] || fail "Failed to run DSH dependency lifecycle scripts"
    log_info "DSH dependency lifecycle scripts completed."
}

install_bundled_node_pty() {
    local package_json candidate_version bundle_dir
    local found_versions=""
    local package_count=0

    while IFS= read -r -d '' package_json; do
        candidate_version="$(read_package_version "${package_json}")"
        [ -n "${candidate_version}" ] || continue
        version_in_list "${candidate_version}" "${NODE_PTY_VERSIONS}" ||
            fail "Installed node-pty ${candidate_version} is not present in the FPK dependency set"

        bundle_dir="${DSH_NATIVE_BUNDLE}/${candidate_version}"
        [ -f "${bundle_dir}/pty.node" ] ||
            fail "The FPK does not contain node-pty ${candidate_version} native files"

        local node_pty_dir
        node_pty_dir="$(dirname -- "${package_json}")"
        mkdir -p "${node_pty_dir}/build/Release"
        cp -a "${bundle_dir}/." "${node_pty_dir}/build/Release/"
        chmod +x "${node_pty_dir}/build/Release/spawn-helper" 2>/dev/null || true
        package_count=$((package_count + 1))
        if ! version_in_list "${candidate_version}" "${found_versions}"; then
            found_versions="${found_versions:+${found_versions}$'\n'}${candidate_version}"
        fi
    done < <(node_pty_packages)

    [ "${package_count}" -gt 0 ] ||
        fail "Unable to locate any node-pty package in the installed dsh dependency tree"

    local expected_version
    while IFS= read -r expected_version; do
        [ -n "${expected_version}" ] || continue
        version_in_list "${expected_version}" "${found_versions}" ||
            fail "Installed dsh dependency tree is missing node-pty ${expected_version}"
    done <<<"${NODE_PTY_VERSIONS}"

    log_info "Installed bundled node-pty versions: ${found_versions//$'\n'/,}."
}

NODE_PTY_VERSIONS="$(read_version_list)"
NODE_PTY_VERSION_COUNT="$(printf '%s\n' "${NODE_PTY_VERSIONS}" | awk 'NF { count++ } END { print count + 0 }')"
HAS_BUNDLED_NODE_PTY=0
log_info "Checking bundled node-pty files for ${NODE_PTY_VERSION_COUNT} packaged version(s)."
if [ "${NODE_PTY_VERSION_COUNT}" -gt 0 ] && [ -d "${DSH_NATIVE_BUNDLE}" ]; then
    HAS_BUNDLED_NODE_PTY=1
    validate_versions
fi

if [ "${HAS_BUNDLED_NODE_PTY}" -eq 0 ] && ! has_compiler; then
    fail "The FPK has no bundled node-pty native files and g++ is not available on this NAS"
fi

if [ "${DSH_RUN_DEPENDENCY_SCRIPTS:-0}" = "1" ]; then
    run_dsh_dependency_scripts
fi

if [ "${HAS_BUNDLED_NODE_PTY}" -eq 1 ]; then
    if ! has_compiler || [ "${DSH_RUN_DEPENDENCY_SCRIPTS:-0}" != "1" ]; then
        install_bundled_node_pty
    else
        log_info "g++ detected; using the node-pty native build from the NAS environment."
    fi
else
    log_info "Using the node-pty native build from the NAS environment."
fi

log_info "node-pty preparation completed."
