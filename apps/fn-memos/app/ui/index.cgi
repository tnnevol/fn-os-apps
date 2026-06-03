#!/bin/bash

# ============================================================
# 脚本名称: index.cgi
# 描述: 提供静态资源服务和 HTML 页面渲染
# ============================================================

exec 2>/dev/null

BASE="/var/apps/fn-memos/target/www"

# 从 REQUEST_URI 提取 index.cgi 后面的路径
URI_NO_QUERY="${REQUEST_URI%%\?*}"
REL_PATH="/"
case "$URI_NO_QUERY" in
  *index.cgi*)
    REL_PATH="${URI_NO_QUERY#*index.cgi}"
    ;;
esac

# 缺省 index.html
if [ -z "$REL_PATH" ] || [ "$REL_PATH" = "/" ]; then
  REL_PATH="/index.html"
fi

# 防 .. 越级
case "$REL_PATH" in
  *..*) 
    echo "Status: 400 Bad Request"
    echo "Content-Type: text/plain"
    echo ""
    echo "Bad Request"
    exit 0
    ;;
esac

FILE="${BASE}${REL_PATH}"

if [ ! -f "$FILE" ]; then
  echo "Status: 404 Not Found"
  echo "Content-Type: text/plain"
  echo ""
  echo "404 Not Found"
  exit 0
fi

# MIME type
case "${FILE##*.}" in
  html|htm) mime="text/html; charset=utf-8" ;;
  css)      mime="text/css; charset=utf-8" ;;
  js)       mime="application/javascript; charset=utf-8" ;;
  png)      mime="image/png" ;;
  jpg|jpeg) mime="image/jpeg" ;;
  svg)      mime="image/svg+xml" ;;
  *)        mime="application/octet-stream" ;;
esac

echo "Content-Type: $mime"
echo ""
cat "$FILE"

exit 0
