#!/bin/bash

# ============================================================
# 脚本名称: api.cgi
# 版本: 1.0.0
# 描述: Memos 二进制升级管理 API
#       提供版本检查和二进制升级接口
# ============================================================

BIN_DIR="/var/apps/fn-memos/target/bin"
MEMOS_BIN="${BIN_DIR}/memos"
TEMP_DIR="/var/apps/fn-memos/tmp"
TEMP_DIR_FALLBACK="${TEMP_DIR}/fn-memos-upgrade"
LOG_FILE="/var/apps/fn-memos/var/upgrade.log"

export PATH="/usr/local/bin:/usr/bin:/bin"

# 全局 stderr 重定向到 /dev/null，避免任何错误输出污染 CGI 响应
exec 2>/dev/null

log() {
    mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE" 2>/dev/null
}

output_json() {
    echo "Content-Type: application/json; charset=utf-8"
    echo ""
    echo "$1"
}

get_current_version() {
    if [ -f "$MEMOS_BIN" ] && [ -x "$MEMOS_BIN" ]; then
        "$MEMOS_BIN" version || echo ""
    else
        log "memos binary not found at $MEMOS_BIN"
        echo ""
    fi
}

get_latest_version() {
    curl -fsSL --connect-timeout 5 --max-time 10 \
        "https://github.com/usememos/memos/releases/latest" \
        | grep -oP '/releases/tag/v\K[0-9]+\.[0-9]+\.[0-9]+' \
        | head -1
}

check_update() {
    log "check_update called"
    local current latest has_update="false"

    current=$(get_current_version)
    latest=$(get_latest_version)

    log "current=$current latest=$latest"

    if [ -n "$current" ] && [ -n "$latest" ]; then
        local higher
        higher=$(printf '%s\n%s\n' "$current" "$latest" | sort -V | tail -n1)
        if [ "$higher" = "$latest" ] && [ "$current" != "$latest" ]; then
            has_update="true"
        fi
    fi

    output_json "{\"current_version\":\"${current}\",\"latest_version\":\"${latest}\",\"has_update\":${has_update}}"
}

do_upgrade() {
    log "do_upgrade called"

    # 优先使用应用 tmp 目录，无权限时回退到 /tmp
    if ! mkdir -p "$TEMP_DIR" 2>/dev/null; then
        log "cannot write to $TEMP_DIR, trying fallback"
        TEMP_DIR="$TEMP_DIR_FALLBACK"
        if ! mkdir -p "$TEMP_DIR" 2>/dev/null; then
            log "failed to create any temp dir"
            output_json '{"success":false,"message":"无法创建临时目录。"}'
            return
        fi
    fi

    local latest
    latest=$(get_latest_version)

    if [ -z "$latest" ]; then
        output_json '{"success":false,"message":"无法获取最新版本，请检查网络连接。"}'
        return
    fi

    local current
    current=$(get_current_version)

    if [ -n "$current" ]; then
        local higher
        higher=$(printf '%s\n%s\n' "$current" "$latest" | sort -V | tail -n1)
        if [ "$higher" = "$current" ] || [ "$current" = "$latest" ]; then
            output_json "{\"success\":false,\"message\":\"当前版本 ${current} 已是最新版本（${latest}），无需升级。\"}"
            return
        fi
    fi

    local memos_url="https://github.com/usememos/memos/releases/latest/download/memos_${latest}_linux_amd64.tar.gz"
    local tmp_bin="${TEMP_DIR}/memos"

    rm -f "$tmp_bin"

    log "downloading from $memos_url"

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --connect-timeout 5 --max-time 120 "$memos_url" | tar -xz -C "$TEMP_DIR" memos
    elif command -v wget >/dev/null 2>&1; then
        wget -q --timeout=120 -O - "$memos_url" | tar -xz -C "$TEMP_DIR" memos
    else
        output_json '{"success":false,"message":"系统未安装 curl 或 wget，无法下载。"}'
        return
    fi

    if [ -x "$tmp_bin" ]; then
        log "replacing memos binary, new version: $latest"
        mv "$tmp_bin" "$MEMOS_BIN"
        chmod +x "$MEMOS_BIN"
        rm -rf "$TEMP_DIR"

        # 升级后重启应用
        restart_app "Memos 已成功升级至 ${latest} 版本。"
    else
        log "downloaded binary not executable"
        rm -rf "$TEMP_DIR"
        output_json '{"success":false,"message":"下载的文件无效，升级失败。当前版本保持不变。"}'
    fi
}

restart_app() {
    local version_msg="${1:-}"
    local PID_FILE="/var/apps/fn-memos/var/app.pid"
    local MEMOS_BIN="/var/apps/fn-memos/target/bin/memos"
    local MEMOS_PORT="5230"
    local DATA_DIR="/var/apps/fn-memos/var/data"
    local INFO_LOG="/var/apps/fn-memos/var/info.log"

    # --- Stop: 参考 cmd/main stop_process ---
    log "stopping memos process"

    if [ -r "$PID_FILE" ]; then
        local pid
        pid=$(head -n 1 "$PID_FILE" | tr -d '[:space:]')
        log "pid from file: $pid"

        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            log "send TERM to PID:${pid}"
            kill -TERM "$pid" 2>/dev/null

            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
                log "waiting process terminal... (${count}s/10s)"
            done

            if kill -0 "$pid" 2>/dev/null; then
                log "send KILL to PID:${pid}"
                kill -KILL "$pid" 2>/dev/null
                sleep 1
            fi
        fi

        rm -f "$PID_FILE"
        log "pid file removed"
    else
        log "pid file not found"
    fi

    sleep 1

    # --- Start: 参考 cmd/main start_process ---
    log "starting memos process"

    local CMD="${MEMOS_BIN} --port ${MEMOS_PORT} --data ${DATA_DIR}"

    bash -c "${CMD}" >> "${INFO_LOG}" 2>&1 &
    local new_pid=$!
    printf "%s" "$new_pid" > "$PID_FILE"
    log "memos started with pid $new_pid"

    sleep 3

    # --- Verify ---
    if kill -0 "$new_pid" 2>/dev/null; then
        if [ -n "$version_msg" ]; then
            output_json "{\"success\":true,\"message\":\"$version_msg\\nMemos 服务已重启（PID: $new_pid）。\"}"
        else
            output_json "{\"success\":true,\"message\":\"Memos 服务已重启（PID: $new_pid）。\"}"
        fi
    else
        output_json '{"success":false,"message":"Memos 启动失败，请查看日志。"}'
    fi
}

REQUEST_METHOD="${REQUEST_METHOD:-GET}"
ACTION=""

if [ "$REQUEST_METHOD" = "POST" ]; then
    CONTENT_LEN="${CONTENT_LENGTH:-0}"
    if [ "$CONTENT_LEN" -gt 0 ] 2>/dev/null; then
        POST_DATA=$(dd bs=1 count=$CONTENT_LEN 2>/dev/null)
        ACTION=$(echo "$POST_DATA" | sed -n 's/.*action=\([^&]*\).*/\1/p')
    fi
fi

if [ -z "$ACTION" ]; then
    ACTION=$(echo "${QUERY_STRING}" | sed -n 's/.*action=\([^&]*\).*/\1/p')
fi

log "request: method=$REQUEST_METHOD action=$ACTION"

case "$ACTION" in
    check)
        check_update
        ;;
    upgrade)
        do_upgrade
        ;;
    restart)
        restart_app
        ;;
    *)
        output_json '{"error":"unknown action"}'
        ;;
esac

exit 0
