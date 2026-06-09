# PMS 설치 가이드

## 시스템 요구사항

- Windows 10/11 (64bit)
- RAM 8GB 이상 권장
- Docker Desktop for Windows

---

## 1단계 — Docker Desktop 설치

1. https://www.docker.com/products/docker-desktop/ 접속
2. **Download for Windows** 클릭 후 설치
3. 설치 후 PC 재시작
4. Docker Desktop 실행 → 트레이 아이콘에 고래 🐋 표시 확인

---

## 2단계 — PMS 파일 준비

USB 또는 공유 폴더에서 PMS 폴더를 원하는 위치에 복사합니다.

```
C:\PMS\          ← 예시 경로
├── backend\
├── frontend\
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 3단계 — 환경 설정

PMS 폴더에서 `.env.example` 파일을 복사해 `.env` 파일을 만듭니다.

**방법 1 — 파일 탐색기:**
`.env.example` 파일을 복사 → 붙여넣기 → 이름을 `.env` 로 변경

**방법 2 — PowerShell:**
```powershell
cd C:\PMS
copy .env.example .env
```

`.env` 파일을 메모장으로 열어 비밀번호를 수정합니다:
```
DB_PASSWORD=원하는_DB_비밀번호
JWT_SECRET=충분히_긴_랜덤_문자열_입력
```

---

## 4단계 — 실행

PowerShell 또는 명령 프롬프트를 **관리자 권한**으로 열고:

```powershell
cd C:\PMS
docker compose up -d --build
```

최초 실행 시 이미지 빌드로 5~10분 소요됩니다.

---

## 5단계 — 접속 확인

브라우저에서 접속:
- **본인 PC:** http://localhost
- **팀원 접속:** http://[이 PC의 IP 주소]

> IP 주소 확인: PowerShell에서 `ipconfig` 입력 → IPv4 주소 확인

**초기 관리자 계정:**
- 이메일: `admin@pms.com`
- 비밀번호: `Admin1234!`

> 로그인 후 비밀번호를 변경하세요.

---

## 팀원 접속 설정 (Windows 방화벽)

팀원이 접속하려면 Windows 방화벽에서 포트를 열어야 합니다.

PowerShell (관리자 권한):
```powershell
netsh advfirewall firewall add rule name="PMS-HTTP" dir=in action=allow protocol=TCP localport=80
```

---

## 자주 쓰는 명령어

```powershell
# 시작
docker compose up -d

# 중지
docker compose down

# 로그 확인
docker compose logs -f

# 재시작
docker compose restart
```

---

## 데이터 백업

DB 데이터는 Docker 볼륨에 저장됩니다. 백업:

```powershell
docker exec pms_db pg_dump -U pms_user pms_db > backup.sql
```

복원:
```powershell
cat backup.sql | docker exec -i pms_db psql -U pms_user pms_db
```

---

## 문제 해결

**포트 80이 이미 사용 중인 경우**
`docker-compose.yml`에서 `"80:80"` → `"8080:80"` 으로 변경 후 `http://localhost:8080` 으로 접속

**Docker Desktop이 시작 안 되는 경우**
- Windows 기능에서 WSL2, Hyper-V 활성화 확인
- BIOS에서 가상화(Virtualization) 활성화 확인
