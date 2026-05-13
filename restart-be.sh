#!/bin/bash
cd "$(dirname "$0")/backend"

echo ">> BE 빌드 중..."
npm run build

echo ">> 기존 BE 프로세스 종료..."
pkill -f "node dist/src/main" 2>/dev/null

for i in $(seq 1 10); do
  if ! ss -tlnp 2>/dev/null | grep -q ':3000'; then
    break
  fi
  echo "   포트 3000 해제 대기 중... ($i)"
  sleep 1
done

echo ">> BE 시작..."
DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" \
JWT_SECRET="pms-jwt-secret-change-in-production" \
JWT_EXPIRES_IN="7d" \
PORT=3000 \
node dist/src/main.js &

echo ">> BE 실행 완료 (PID: $!)"
