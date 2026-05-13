#!/bin/bash
cd "$(dirname "$0")/frontend"

echo ">> FE 빌드 중..."
npm run build

echo ">> 기존 FE 프로세스 종료..."
pkill -f "vite" 2>/dev/null

echo ">> FE 시작 (preview)..."
npm run preview &

echo ">> FE 실행 완료 (http://localhost:4173)"
