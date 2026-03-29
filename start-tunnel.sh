#!/bin/bash
# 启动 trail 本地服务 + cloudflare tunnel
cd /Users/wangrunji/Codes/trail

# 杀掉旧的
pkill -f "npx serve.*3000" 2>/dev/null
pkill -f "cloudflared tunnel" 2>/dev/null
pkill -f "save-server.js" 2>/dev/null
sleep 1

# 启动 save-server（关卡保存接口，端口 3001）
nohup node /Users/wangrunji/Codes/trail/save-server.js > /tmp/save-server.log 2>&1 &
echo "save-server PID: $!"

# 启动 serve
nohup npx serve . -p 3000 > /tmp/trail-serve.log 2>&1 &
echo "serve PID: $!"

sleep 2

# 启动 cloudflared
nohup bash -c 'https_proxy=http://127.0.0.1:7890 cloudflared tunnel --url http://localhost:3000 >> /tmp/cloudflared.log 2>&1' &
echo "cloudflared PID: $!"

sleep 8

URL=$(grep -o 'https://[^[:space:]]*trycloudflare.com' /tmp/cloudflared.log | tail -1)
echo "URL: $URL"
