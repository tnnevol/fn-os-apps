#!/bin/bash
# 共享变量与函数 — 由 api.cgi 和 install_worker.sh source

BIN_DIR="/var/apps/fn-openlist-pro/target/bin"
OPENLIST_BIN="${BIN_DIR}/openlist"
DATA_DIR="/var/apps/fn-openlist-pro/var"
OPENLIST_DATA_DIR="${DATA_DIR}/data"
PID_FILE="${DATA_DIR}/app.pid"
LOG_FILE="${OPENLIST_DATA_DIR}/log/log.log"
PROGRESS_FILE="${DATA_DIR}/install_progress.json"
TEMP_DIR="/var/apps/fn-openlist-pro/tmp"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

log() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null
}

write_progress() {
    echo "$1" > "$PROGRESS_FILE" 2>/dev/null
}

get_version() {
    if [ -f "$OPENLIST_BIN" ] && [ -x "$OPENLIST_BIN" ]; then
        local raw
        raw=$("$OPENLIST_BIN" version 2>/dev/null)
        local ver
        ver=$(echo "$raw" | grep "^Version:" | sed 's/Version:[[:space:]]*//')
        echo "${ver:-unknown}"
    else
        echo "unknown"
    fi
}

is_running() {
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(head -n 1 "$PID_FILE" | tr -d '[:space:]')
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        rm -f "$PID_FILE" 2>/dev/null
    fi
    return 1
}

get_port() {
    if [ -f "$CONFIG_FILE" ]; then
        local port
        port=$(grep -o '"http_port":[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')
        echo "${port:-}"
    fi
}
