#!/bin/bash

# ============================================================
# 脚本名称: api.cgi
# 版本: 1.0.0
# 描述: Memos 二进制升级管理 API
#       提供版本检查和二进制升级接口
# ============================================================

BIN_DIR="${TRIM_APPDEST}/bin"
MEMOS_BIN="${BIN_DIR}/memos"
TEMP_DIR="${TRIM_PKGTMP:-/tmp/fn-memos-upgrade}"

export PATH="/usr/local/bin:/usr/bin:/bin"

output_json() {
    echo "Content-Type: application/json; charset=utf-8"
    echo ""
    echo "$1"
}

get_current_version() {
    if [ -x "$MEMOS_BIN" ]; then
        "$MEMOS_BIN" version 2>/dev/null || echo ""
    else
        echo ""
    fi
}

get_latest_version() {
    curl -fsSL --connect-timeout 5 --max-time 10 \
        "https://github.com/usememos/memos/releases/latest" \
        2>/dev/null \
        | grep -oP '/releases/tag/v\K[0-9]+\.[0-9]+\.[0-9]+' \
        | head -1
}

check_update() {
    local current latest has_update="false"

    current=$(get_current_version)
    latest=$(get_latest_version)

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
    mkdir -p "$TEMP_DIR"

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

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL --connect-timeout 5 --max-time 120 "$memos_url" 2>/dev/null | tar -xz -C "$TEMP_DIR" memos
    elif command -v wget >/dev/null 2>&1; then
        wget -q --timeout=120 -O - "$memos_url" 2>/dev/null | tar -xz -C "$TEMP_DIR" memos
    else
        output_json '{"success":false,"message":"系统未安装 curl 或 wget，无法下载。"}'
        return
    fi

    if [ -x "$tmp_bin" ]; then
        mv "$tmp_bin" "$MEMOS_BIN"
        chmod +x "$MEMOS_BIN"
        rm -rf "$TEMP_DIR"
        output_json "{\"success\":true,\"message\":\"Memos 已成功升级至 ${latest} 版本。\"}"
    else
        rm -rf "$TEMP_DIR"
        output_json '{"success":false,"message":"下载的文件无效，升级失败。当前版本保持不变。"}'
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

case "$ACTION" in
    check)
        check_update
        ;;
    upgrade)
        do_upgrade
        ;;
    *)
        output_json '{"error":"unknown action"}'
        ;;
esac

exit 0
