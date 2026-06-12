#!/bin/bash

# ============================================================
# 脚本名称: api.cgi
# 描述: OpenList 管理面板后端 API
# ============================================================

BIN_DIR="/var/apps/fn-openlist-pro/target/bin"
OPENLIST_BIN="${BIN_DIR}/openlist"
DATA_DIR="/var/apps/fn-openlist-pro/var"
OPENLIST_DATA_DIR="${DATA_DIR}/data"
PID_FILE="${DATA_DIR}/app.pid"
LOG_FILE="${OPENLIST_DATA_DIR}/log/log.log"
PROGRESS_FILE="${DATA_DIR}/install_progress.json"
CONFIG_FILE="${OPENLIST_DATA_DIR}/config.json"
TEMP_DIR="/var/apps/fn-openlist-pro/tmp"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
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

get_port() {
    if [ -f "$CONFIG_FILE" ]; then
        local port
        port=$(grep -o '"http_port":[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')
        echo "${port:-}"
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

    # Start background install
    write_progress '{"step":"download","percent":0,"step_text":"准备中...","done":false,"error":""}'
    ( background_install "$version" "$mirror" ) &

    output_json '{"success":true,"message":"安装已开始"}'
}

write_progress() {
    echo "$1" > "$PROGRESS_FILE" 2>/dev/null
}

background_install() {
    local version="$1"
    local mirror="$2"

    local mirror_list
    if [ -n "$mirror" ]; then
        mirror_list="$mirror"
    else
        mirror_list="https://gh-proxy.com/ https://ghproxy.net/"
    fi

    local arch="amd64"
    case "$(uname -m)" in
        aarch64|arm64) arch="arm64" ;;
    esac

    local target="linux-musl-${arch}"

    # Resolve version
    if [ -z "$version" ] || [ "$version" = "latest" ]; then
        write_progress '{"step":"download","percent":5,"step_text":"获取最新版本...","done":false,"error":""}'
        version=$(curl -sL --max-time 15 \
            -H "Accept: application/vnd.github.v3+json" \
            "https://api.github.com/repos/OpenListTeam/OpenList/releases/latest" \
            | grep '"tag_name"' | head -1 | sed 's/.*"v\([0-9.]*\)".*/\1/')
        log "resolved latest version: $version"
    fi

    if [ -z "$version" ]; then
        write_progress '{"step":"error","percent":0,"step_text":"获取版本失败","done":false,"error":"无法获取版本号"}'
        return
    fi

    mkdir -p "$TEMP_DIR" 2>/dev/null
    local tar_path="${TEMP_DIR}/openlist.tar.gz"
    local downloaded=false

    for m in $mirror_list; do
        local url
        url="${m}https://github.com/OpenListTeam/OpenList/releases/download/v${version}/openlist-${target}.tar.gz"
        log "trying: $url"

        write_progress "{\"step\":\"download\",\"percent\":10,\"step_text\":\"下载中...\",\"done\":false,\"error\":\"\"}"

        if curl -fSL --connect-timeout 30 --max-time 300 -o "$tar_path" "$url" 2>/dev/null; then
            downloaded=true
            break
        fi
    done

    if [ "$downloaded" != "true" ]; then
        write_progress '{"step":"error","percent":0,"step_text":"下载失败","done":false,"error":"所有镜像均不可用"}'
        return
    fi

    write_progress '{"step":"download","percent":100,"step_text":"下载完成","done":false,"error":""}'

    # Validate
    local file_size
    file_size=$(stat -c%s "$tar_path" 2>/dev/null || stat -f%z "$tar_path" 2>/dev/null)
    if [ "${file_size:-0}" -lt 102400 ]; then
        write_progress '{"step":"error","percent":0,"step_text":"验证失败","done":false,"error":"下载文件太小"}'
        rm -f "$tar_path"
        return
    fi

    # Extract
    write_progress '{"step":"extract","percent":0,"step_text":"解压中...","done":false,"error":""}'
    tar xzf "$tar_path" -C "$TEMP_DIR" openlist 2>/dev/null
    if [ $? -ne 0 ]; then
        write_progress '{"step":"error","percent":0,"step_text":"解压失败","done":false,"error":"解压文件失败"}'
        rm -f "$tar_path"
        return
    fi
    write_progress '{"step":"extract","percent":100,"step_text":"解压完成","done":false,"error":""}'

    # Stop existing
    if [ -f "$PID_FILE" ]; then
        local pid
        pid=$(head -n 1 "$PID_FILE" | tr -d '[:space:]')
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill -TERM "$pid" 2>/dev/null
            sleep 3
        fi
        rm -f "$PID_FILE" 2>/dev/null
    fi

    # Replace binary
    write_progress '{"step":"install","percent":50,"step_text":"安装中...","done":false,"error":""}'
    mkdir -p "$BIN_DIR" 2>/dev/null
    mv "${TEMP_DIR}/openlist" "$OPENLIST_BIN" 2>/dev/null
    chmod +x "$OPENLIST_BIN" 2>/dev/null
    rm -f "$tar_path" 2>/dev/null

    # Restart
    "$OPENLIST_BIN" server --data "$OPENLIST_DATA_DIR" >/dev/null 2>&1 &
    local new_pid=$!
    printf "%s" "$new_pid" > "$PID_FILE"

    sleep 2

    local new_ver
    new_ver=$(get_version)

    write_progress "{\"step\":\"done\",\"percent\":100,\"step_text\":\"安装完成\",\"done\":true,\"error\":\"\",\"version\":\"${new_ver}\"}"
    log "install complete: version=$new_ver pid=$new_pid"
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
