# VM 관리 가이드라인

## 개발용 Git 저장소 설정

키오스크 서버 설치 후 개발용으로 전환:

```bash
# 1. Git 저장소 클론
git clone git@gitlab.imaginetoolbox.com:whitech-group/development/reimagine/imagine-online.git

# 2. .git 폴더를 설치된 폴더로 이동
mv imagine-online/.git Reimagine/

# 3. 설치된 폴더에서 Git 체크아웃
cd Reimagine
git checkout .
```

이제 설치된 키오스크 서버 폴더가 Git 저장소가 되어 개발 작업이 가능합니다.

## Docker 디스크 설정 (강력 권장)

**필수 권장**: Docker 이미지와 컨테이너들이 빠르게 디스크 공간을 소모하므로, 개발용으로 사용할 경우 Docker 디스크 확장을 강력히 권장합니다.

개발용으로 Docker 스토리지 공간을 늘리려면:

### 1. .env 파일 수정
```bash
# Windows 설치 폴더의 .env 파일에 추가 (/vagrant/.env)
DOCKER_DISK_SIZE_GB=45
```

### 2. 기존 Docker 데이터 정리
```bash
# 모든 컨테이너 중지
ssh reimagine "docker stop \$(docker ps -aq)"

# 모든 Docker 데이터 삭제 (이미지, 컨테이너, 볼륨, 네트워크)
ssh reimagine "docker system prune -af --volumes"
```

### 3. VM 재시작
```bash
vagrant reload
```

### 4. 디스크 확장 확인
```bash
ssh reimagine "df -h"  # 디스크 사용량 확인
ssh reimagine "docker system df"  # Docker 스토리지 확인
```

**주의**: 기존 Docker 데이터가 있다면 백업 후 진행하세요.

## 추가 데이터 디스크 마운트 (/mnt/sda1)

**권장사항**: VS Code 서버와 Kiro 등 개발 도구들이 대용량 캐시와 데이터를 생성하므로, 개발용으로 사용할 경우 추가 디스크 설정을 권장합니다.

개발용으로 더 많은 저장공간이 필요한 경우:

### 1. Vagrantfile 편집 (최초 1회)
```bash
# VM에서 Vagrantfile 편집
ssh reimagine "sudo nano /vagrant/Vagrantfile"

# 또는 Windows에서 직접 편집
# Reimagine 폴더의 Vagrantfile을 열어서
# 기존 docker_disk_size 코드 아래에 추가:
```

#### DATA_DISK_SIZE_GB 지원 코드 추가
```ruby
# 기존 docker_disk_size 코드 아래에 추가
data_disk_size = ENV['DATA_DISK_SIZE_GB']
data_disk_filename = (ENV['VMDISK_LOCATION'] || "") + "#{machine_name}.data.#{data_disk_size}.vdi"
if data_disk_size && !File.exist?(data_disk_filename)
  vb.customize ['createhd', '--filename', data_disk_filename, '--variant', 'Fixed', '--size', data_disk_size.to_i * 1024]
  vb.customize ['storageattach', :id,  '--storagectl', 'SATA Controller', '--port', 2, '--type', 'hdd', '--medium', data_disk_filename]
end
```

### 2. .env 파일 수정
```bash
# Windows 설치 폴더의 .env 파일에 추가 (/vagrant/.env)
# 추천 크기: 30-35GB (작은 파일들 + 여유 공간)
DATA_DISK_SIZE_GB=30
```

### 3. VM 재시작
```bash
vagrant reload
```

### 4. 디스크 포맷 및 마운트
```bash
ssh reimagine

# 디스크 파티션 생성
sudo fdisk /dev/sdc
# n (새 파티션) -> p (primary) -> 1 -> Enter -> Enter -> w (저장)

# 파일시스템 포맷 (작은 파일 최적화)
sudo mkfs.ext4 -i 8192 /dev/sdc1

# 마운트 포인트 생성 및 마운트
sudo mkdir -p /mnt/sda1
sudo mount /dev/sdc1 /mnt/sda1
sudo chown $USER:$USER /mnt/sda1
```

### 5. 자동 마운트 설정
```bash
# UUID 확인
sudo blkid /dev/sdc1

# UUID를 사용하여 /etc/fstab에 추가
UUID=$(sudo blkid -s UUID -o value /dev/sdc1)
echo "UUID=$UUID /mnt/sda1 ext4 defaults 0 2" | sudo tee -a /etc/fstab
```

### 6. 디스크 마운트 확인
```bash
df -h | grep /mnt/sda1  # 데이터 디스크 확인
ls -la /mnt/sda1        # 마운트 포인트 확인
```

### 7. 사용자 폴더 설정
```bash
# 사용자 폴더 생성
mkdir -p /mnt/sda1/$USER

# 개발용 추천 폴더 생성
mkdir -p /mnt/sda1/$USER/.cache          # 캐시 데이터
mkdir -p /mnt/sda1/$USER/.vscode-server  # VS Code 서버 데이터
mkdir -p /mnt/sda1/$USER/.npm            # npm 캐시
mkdir -p /mnt/sda1/$USER/.nvm            # Node.js 버전 관리
mkdir -p /mnt/sda1/$USER/.terraform.d    # Terraform 플러그인
mkdir -p /mnt/sda1/$USER/pnpm            # pnpm 데이터
mkdir -p /mnt/sda1/$USER/.kiro-server    # Kiro 서버 데이터

# 홈 디렉토리에 해당 폴더들 생성 (bind mount용)
mkdir -p ~/.cache ~/.vscode-server ~/.npm
```

### 8. bind mount 설정
```bash
# /etc/fstab에 bind mount 추가
echo "/mnt/sda1/$USER/.cache /home/$USER/.cache none bind 0 0" | sudo tee -a /etc/fstab
echo "/mnt/sda1/$USER/.vscode-server /home/$USER/.vscode-server none bind 0 0" | sudo tee -a /etc/fstab
echo "/mnt/sda1/$USER/.npm /home/$USER/.npm none bind 0 0" | sudo tee -a /etc/fstab

# bind mount 적용
sudo mount -a
```

## 기본 VM 조작

### VM 구조 이해
- `/vagrant/` 폴더: Windows의 Reimagine 키오스크 설치 폴더와 동기화
- `sudo` 명령: 비밀번호 없이 root 권한 획득 가능
- `.env` 파일: `/vagrant/.env` (Windows 설치 폴더의 .env 파일)

### VM 시작/중지
```bash
vagrant up      # VM 시작
vagrant halt    # VM 종료
vagrant reload  # VM 재시작
```

### SSH 접속
```bash
ssh reimagine   # VM 접속
```

## 상태 확인

### VM 상태 모니터링
```bash
./checkstatus.sh     # VM 상태 확인
./status-loop.sh     # 지속적 상태 모니터링
./configtest.sh      # 설정 테스트
```

## 업데이트 및 재시작

### 키오스크 서버 관리
```bash
./restart.ps1                   # 재시작 (Windows)
./launch-restart-reimagine.sh   # Reimagine 서비스 재시작
```

## 문제 해결

### VM 초기화
```bash
./destroy.sh    # VM 완전 삭제 후 재생성
vagrant up      # 새로 시작
```

### 디스크 공간 정리
```bash
ssh reimagine "docker system prune -a"  # 미사용 이미지/컨테이너 정리
ssh reimagine "docker volume prune"     # 미사용 볼륨 정리
```

## 백업 및 복구

### 네트워크 설정 확인
```bash
ssh reimagine "ip addr show"           # IP 주소 확인
ssh reimagine "docker network ls"      # Docker 네트워크
```