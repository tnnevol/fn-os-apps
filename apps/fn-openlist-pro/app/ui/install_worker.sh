#!/bin/bash
# 独立安装脚本 — 由 api.cgi 通过 nohup 启动，与 CGI 进程完全隔离
# 用法: install_worker.sh <version> <mirror>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/common.sh"

version="$1"
mirror="$2"

mirror_list=""
if [ -n "$mirror" ]; then
    mirror_list="$mirror"
else
    mirror_list="https://gh-proxy.com/ https://ghproxy.net/"
fi

arch="amd64"
case "$(uname -m)" in
    aarch64|arm64) arch="arm64" ;;
esac

target="linux-musl-${arch}"

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
    exit 1
fi

mkdir -p "$TEMP_DIR" 2>/dev/null
tar_path="${TEMP_DIR}/openlist.tar.gz"
downloaded=false

for m in $mirror_list; do
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
    exit 1
fi

write_progress '{"step":"download","percent":100,"step_text":"下载完成","done":false,"error":""}'

# Validate
file_size=$(stat -c%s "$tar_path" 2>/dev/null || stat -f%z "$tar_path" 2>/dev/null)
if [ "${file_size:-0}" -lt 102400 ]; then
    write_progress '{"step":"error","percent":0,"step_text":"验证失败","done":false,"error":"下载文件太小"}'
    rm -f "$tar_path"
    exit 1
fi

# Extract
write_progress '{"step":"extract","percent":0,"step_text":"解压中...","done":false,"error":""}'
tar xzf "$tar_path" -C "$TEMP_DIR" openlist 2>/dev/null
if [ $? -ne 0 ]; then
    write_progress '{"step":"error","percent":0,"step_text":"解压失败","done":false,"error":"解压文件失败"}'
    rm -f "$tar_path"
    exit 1
fi
write_progress '{"step":"extract","percent":100,"step_text":"解压完成","done":false,"error":""}'

# Stop existing
if [ -f "$PID_FILE" ]; then
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
new_pid=$!
printf "%s" "$new_pid" > "$PID_FILE"

sleep 2

new_ver=$(get_version)

write_progress "{\"step\":\"done\",\"percent\":100,\"step_text\":\"安装完成\",\"done\":true,\"error\":\"\",\"version\":\"${new_ver}\"}"
log "install complete: version=$new_ver pid=$new_pid"
