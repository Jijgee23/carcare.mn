#!/usr/bin/env bash
# Прод серверт (Ubuntu, /home/ubuntu/carcare.mn) шинэчлэлт гаргах нэг команд.
# Ашиглах: cd /home/ubuntu/carcare.mn && bash scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> git pull"
BEFORE=$(git rev-parse HEAD)
git pull --ff-only
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "==> Шинэ commit алга ($AFTER) — зогсож байна."
  exit 0
fi

CHANGED=$(git diff --name-only "$BEFORE" "$AFTER")
echo "==> Өөрчлөгдсөн файл:"
echo "$CHANGED"

if echo "$CHANGED" | grep -qE '^(package\.json|package-lock\.json)$'; then
  echo "==> package.json/lock өөрчлөгдсөн → npm ci (энэ postinstall-аар prisma generate-г ч дуудна)"
  npm ci
elif echo "$CHANGED" | grep -q '^prisma/schema\.prisma$'; then
  echo "==> schema.prisma өөрчлөгдсөн (dependency өөрчлөгдөөгүй) → prisma generate"
  npx prisma generate
else
  echo "==> npm install/prisma generate шаардлагагүй (dependency/schema өөрчлөгдөөгүй)"
fi

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> npm run build"
npm run build

echo "==> pm2 restart carcare (.env-ийн шинэ утгыг эндээс дахин уншина)"
pm2 restart carcare

echo "==> Дууслаа: $BEFORE → $AFTER"
