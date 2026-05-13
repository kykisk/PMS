#!/bin/bash
DIR="$(dirname "$0")"

echo "========== PMS 전체 재시작 =========="

echo ""
echo "[1/3] DB 시작..."
podman start pms_db_dev 2>/dev/null || echo "  (DB 이미 실행 중이거나 podman 미사용)"

echo ""
echo "[2/3] BE 재시작..."
bash "$DIR/restart-be.sh"

echo ""
echo "[3/3] FE 재시작..."
bash "$DIR/restart-fe.sh"

echo ""
echo "========== 완료 =========="
echo "  BE: http://localhost:3000"
echo "  FE: http://localhost:4173"
echo "  Swagger: http://localhost:3000/api/docs"
