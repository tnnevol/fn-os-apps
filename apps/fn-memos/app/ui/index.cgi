#!/bin/bash

echo "Content-Type: text/html; charset=utf-8"
echo ""

exec 2>/dev/null

HTML_PATH="/var/apps/fn-memos/target/www/index.html"

if [ ! -f "$HTML_PATH" ]; then
    echo "<h1>错误：index.html 不存在</h1>"
    echo "<p>路径: $HTML_PATH</p>"
    exit 1
fi

cat "$HTML_PATH"
