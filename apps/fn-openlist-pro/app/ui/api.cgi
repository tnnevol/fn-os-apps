#!/bin/bash

# ============================================================
# 脚本名称: api.cgi
# 描述: OpenList 管理面板后端 API
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="/var/apps/fn-openlist-pro/var/data/config.json"

source "${SCRIPT_DIR}/common.sh"
exec 2>/dev/null

output_json() {
    echo "Content-Type: application/json; charset=utf-8"
    echo ""
    echo "$1"
}

do_stop() {
    if [ ! -f "$PID_FILE" ]; then
        output_json '{"success":false,"message":"OpenList 未在运行"}'
        return
    fi

    local pid
    pid=$(head -n 1 "$PID_FILE" | tr -d '[:space:]')

    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        rm -f "$PID_FILE" 2>/dev/null
        output_json '{"success":false,"message":"OpenList 未在运行"}'
        return
    fi

    kill -TERM "$pid" 2>/dev/null
    local count=0
    while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
        sleep 1
        count=$((count + 1))
    done

    if kill -0 "$pid" 2>/dev/null; then
        kill -KILL "$pid" 2>/dev/null
        sleep 1
    fi

    rm -f "$PID_FILE" 2>/dev/null
    output_json '{"success":true,"message":"OpenList 已停止"}'
}

do_start() {
    if is_running; then
        output_json '{"success":false,"message":"OpenList 已在运行中"}'
        return
    fi

    mkdir -p "$OPENLIST_DATA_DIR" 2>/dev/null

    "$OPENLIST_BIN" server --data "$OPENLIST_DATA_DIR" >/dev/null 2>&1 &
    local new_pid=$!
    printf "%s" "$new_pid" > "$PID_FILE"

    sleep 2

    if kill -0 "$new_pid" 2>/dev/null; then
        output_json "{\"success\":true,\"message\":\"OpenList 已启动\",\"pid\":${new_pid}}"
    else
        rm -f "$PID_FILE" 2>/dev/null
        output_json '{"success":false,"message":"OpenList 启动失败"}'
    fi
}

do_restart() {
    # Stop if running
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(head -n 1 "$PID_FILE" | tr -d '[:space:]')
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null
            local count=0
            while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done
            if kill -0 "$pid" 2>/dev/null; then
                kill -KILL "$pid" 2>/dev/null
                sleep 1
            fi
        fi
        rm -f "$PID_FILE" 2>/dev/null
    fi

    sleep 1

    # Start
    mkdir -p "$OPENLIST_DATA_DIR" 2>/dev/null
    "$OPENLIST_BIN" server --data "$OPENLIST_DATA_DIR" >/dev/null 2>&1 &
    local new_pid=$!
    printf "%s" "$new_pid" > "$PID_FILE"

    sleep 2

    if kill -0 "$new_pid" 2>/dev/null; then
        output_json "{\"success\":true,\"message\":\"OpenList 已重启\",\"pid\":${new_pid}}"
    else
        rm -f "$PID_FILE" 2>/dev/null
        output_json '{"success":false,"message":"OpenList 重启失败"}'
    fi
}

do_versions() {
    local versions
    versions=$(curl -sL --connect-timeout 5 --max-time 15 \
        "https://github.com/OpenListTeam/OpenList/releases" \
        | grep -oE 'tag/v[0-9]+\.[0-9]+\.[0-9]+' \
        | sed 's/tag\///' \
        | sort -uVr \
        | head -10)

    local json_arr="["
    local first=true
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        if [ "$first" = true ]; then
            json_arr="${json_arr}\"${line}\""
            first=false
        else
            json_arr="${json_arr},\"${line}\""
        fi
    done <<< "$versions"
    json_arr="${json_arr}]"

    output_json "{\"versions\":${json_arr}}"
}

do_install() {
    local version=""
    local mirror=""

    # Parse POST body
    if [ "$REQUEST_METHOD" = "POST" ]; then
        local content_len="${CONTENT_LENGTH:-0}"
        if [ "$content_len" -gt 0 ] 2>/dev/null; then
            local post_data
            post_data=$(dd bs=1 count=$content_len 2>/dev/null)
            version=$(echo "$post_data" | sed -n 's/.*version=\([^&]*\).*/\1/p' | sed 's/%20/ /g;s/+/ /g')
            mirror=$(echo "$post_data" | sed -n 's/.*mirror=\([^&]*\).*/\1/p' | sed 's/%20/ /g;s/+/ /g')
        fi
    fi

    version=$(echo "$version" | sed 's/^v//')

    log "install requested: version=${version:-latest} mirror=${mirror:-default}"

    # Launch install worker as a fully detached process
    write_progress '{"step":"download","percent":0,"step_text":"准备中...","done":false,"error":""}'
    nohup bash "${SCRIPT_DIR}/install_worker.sh" "$version" "$mirror" </dev/null >/dev/null 2>&1 &

    output_json '{"success":true,"message":"安装已开始"}'
}

do_install_progress() {
    if [ -f "$PROGRESS_FILE" ]; then
        local content
        content=$(cat "$PROGRESS_FILE" 2>/dev/null)
        echo "Content-Type: application/json; charset=utf-8"
        echo ""
        echo "${content:-{\"step\":\"\",\"percent\":0,\"done\":false,\"error\":\"\"}}"
    else
        output_json '{"step":"","percent":0,"done":false,"error":""}'
    fi
}

do_password() {
    local action=""
    local password=""

    if [ "$REQUEST_METHOD" = "POST" ]; then
        local content_len="${CONTENT_LENGTH:-0}"
        if [ "$content_len" -gt 0 ] 2>/dev/null; then
            local post_data
            post_data=$(dd bs=1 count=$content_len 2>/dev/null)
            action=$(echo "$post_data" | sed -n 's/.*action=\([^&]*\).*/\1/p')
            password=$(echo "$post_data" | sed -n 's/.*password=\([^&]*\).*/\1/p' | sed 's/%2B/+/g;s/%21/!/g;s/%40/@/g;s/%23/#/g;s/%24/\$/g;s/%25/%/g;s/%5E/^/g;s/%26/\&/g;s/%2A/*/g')
        fi
    fi

    case "$action" in
        set)
            if [ -z "$password" ]; then
                output_json '{"success":false,"message":"密码不能为空"}'
                return
            fi
            log "setting password"
            "$OPENLIST_BIN" admin set "$password" --data "$OPENLIST_DATA_DIR" >/dev/null 2>&1
            if [ $? -eq 0 ]; then
                output_json '{"success":true,"message":"密码已设置"}'
            else
                output_json '{"success":false,"message":"设置密码失败"}'
            fi
            ;;
        random)
            local pwd
            pwd=$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9!@#$%' | head -c 14)
            output_json "{\"password\":\"${pwd}\"}"
            ;;
        *)
            output_json '{"success":false,"message":"无效操作"}'
            ;;
    esac
}

do_backup() {
    if [ ! -d "$OPENLIST_DATA_DIR" ]; then
        echo "Content-Type: application/json; charset=utf-8"
        echo "Status: 400 Bad Request"
        echo ""
        echo '{"success":false,"message":"数据目录不存在"}'
        return
    fi

    local timestamp
    timestamp=$(date '+%Y%m%d-%H%M%S')
    local zip_name="openlist-backup-${timestamp}.zip"
    local zip_path="${TEMP_DIR}/${zip_name}"

    mkdir -p "$TEMP_DIR" 2>/dev/null

    cd "$(dirname "$OPENLIST_DATA_DIR")" && zip -r "$zip_path" "data" >/dev/null 2>&1

    if [ ! -f "$zip_path" ]; then
        echo "Content-Type: application/json; charset=utf-8"
        echo "Status: 500 Internal Server Error"
        echo ""
        echo '{"success":false,"message":"打包失败"}'
        return
    fi

    local file_size
    file_size=$(stat -c%s "$zip_path" 2>/dev/null || stat -f%z "$zip_path" 2>/dev/null)

    echo "Content-Type: application/zip"
    echo "Content-Disposition: attachment; filename=\"${zip_name}\""
    echo "Content-Length: ${file_size}"
    echo ""
    cat "$zip_path"

    rm -f "$zip_path" 2>/dev/null
}

do_logs() {
    if [ ! -f "$LOG_FILE" ]; then
        output_json '{"lines":[]}'
        return
    fi

    local lines
    lines=$(tail -n 200 "$LOG_FILE" 2>/dev/null)

    # Build JSON array
    local json="["
    local first=true
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        # Escape special JSON characters
        line=$(echo "$line" | sed 's/\\/\\\\/g;s/"/\\"/g;s/\t/\\t/g')
        if [ "$first" = true ]; then
            json="${json}\"${line}\""
            first=false
        else
            json="${json},\"${line}\""
        fi
    done <<< "$lines"
    json="${json}]"

    output_json "{\"lines\":${json}}"
}

# ===== Route =====

REQUEST_METHOD="${REQUEST_METHOD:-GET}"
ACTION=""

# Try query string first
ACTION=$(echo "${QUERY_STRING}" | sed -n 's/.*action=\([^&]*\).*/\1/p')

log "request: method=$REQUEST_METHOD action=$ACTION"

case "$ACTION" in
    status)
        local_running="false"
        is_running && local_running="true"
        local_ver=$(get_version)
        local_port=$(get_port)
        output_json "{\"version\":\"${local_ver}\",\"running\":${local_running},\"port\":${local_port:-null}}"
        ;;
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_restart
        ;;
    versions)
        do_versions
        ;;
    install)
        do_install
        ;;
    install_progress)
        do_install_progress
        ;;
    password)
        do_password
        ;;
    backup)
        do_backup
        ;;
    logs)
        do_logs
        ;;
    *)
        output_json '{"error":"unknown action"}'
        ;;
esac

exit 0
