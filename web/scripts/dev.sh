#!/usr/bin/env bash
set -euo pipefail

PORT=3028

echo ""
echo "✨  Starting dev server on port ${PORT}"
echo ""

# 只显示非 loopback、非 Docker 网桥、非 IPv6 的局域网 IPv4 地址
while IFS= read -r line; do
  IP=$(echo "$line" | awk '{print $2}' | cut -d/ -f1)
  # 跳过 loopback、Docker 网段(172.16-31.x)、Tailscale(100.x)、IPv6
  case "$IP" in
    127.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|100.*|*:*) continue ;;
  esac
  echo "   🌐  http://${IP}:${PORT}"
done < <(ip -4 addr show 2>/dev/null | grep 'inet ')
echo "   💻  http://localhost:${PORT}"
echo ""

# 显式加载 .env 并 export，确保 .env 值优先级高于 Shell 已有变量
# （Next.js 默认行为：.env 不覆盖已存在的环境变量）
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

export WATCHPACK_POLLING=true
exec next dev --webpack --hostname 0.0.0.0 -p "$PORT"
