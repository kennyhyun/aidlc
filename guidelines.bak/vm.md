# VM Management Guidelines

## Development Git Repository Setup

Convert kiosk server installation to development environment:

```bash
# 1. Clone Git repository
git clone git@gitlab.imaginetoolbox.com:whitech-group/development/reimagine/imagine-online.git

# 2. Move .git folder to installed folder
mv imagine-online/.git Reimagine/

# 3. Checkout in installed folder
cd Reimagine
git checkout .
```

Now the installed kiosk server folder becomes a Git repository for development work.

## Docker Disk Configuration (Strongly Recommended)

**Essential Recommendation**: Docker images and containers consume disk space rapidly, so Docker disk expansion is strongly recommended for development use.

To increase Docker storage space for development:

### 1. Edit .env file
```bash
# Add to Windows installation folder's .env file (/vagrant/.env)
DOCKER_DISK_SIZE_GB=45
```

### 2. Clean existing Docker data
```bash
# Stop all containers
ssh reimagine "docker stop \$(docker ps -aq)"

# Delete all Docker data (images, containers, volumes, networks)
ssh reimagine "docker system prune -af --volumes"
```

### 3. Restart VM
```bash
vagrant reload
```

### 4. Verify disk expansion
```bash
ssh reimagine "df -h"  # Check disk usage
ssh reimagine "docker system df"  # Check Docker storage
```

**Note**: Backup existing Docker data before proceeding if needed.

## Additional Data Disk Mount (/mnt/sda1)

**Recommendation**: VS Code server and Kiro development tools generate large caches and data, so additional disk setup is recommended for development use.

For development requiring more storage space:

### 1. Edit Vagrantfile (one-time setup)
```bash
# Edit Vagrantfile in VM
ssh reimagine "sudo nano /vagrant/Vagrantfile"

# Or edit directly in Windows
# Open Vagrantfile in Reimagine folder
# Add below existing docker_disk_size code:
```

#### Add DATA_DISK_SIZE_GB support code
```ruby
# Add below existing docker_disk_size code
data_disk_size = ENV['DATA_DISK_SIZE_GB']
data_disk_filename = (ENV['VMDISK_LOCATION'] || "") + "#{machine_name}.data.#{data_disk_size}.vdi"
if data_disk_size && !File.exist?(data_disk_filename)
  vb.customize ['createhd', '--filename', data_disk_filename, '--variant', 'Fixed', '--size', data_disk_size.to_i * 1024]
  vb.customize ['storageattach', :id,  '--storagectl', 'SATA Controller', '--port', 2, '--type', 'hdd', '--medium', data_disk_filename]
end
```

### 2. Edit .env file
```bash
# Add to Windows installation folder's .env file (/vagrant/.env)
# Recommended size: 30-35GB (small files + buffer space)
DATA_DISK_SIZE_GB=30
```

### 3. Restart VM
```bash
vagrant reload
```

### 4. Format and mount disk
```bash
ssh reimagine

# Create disk partition
sudo fdisk /dev/sdc
# n (new partition) -> p (primary) -> 1 -> Enter -> Enter -> w (write)

# Format filesystem (optimized for small files)
sudo mkfs.ext4 -i 8192 /dev/sdc1

# Create mount point and mount
sudo mkdir -p /mnt/sda1
sudo mount /dev/sdc1 /mnt/sda1
sudo chown $USER:$USER /mnt/sda1
```

### 5. Configure auto-mount
```bash
# Check UUID
sudo blkid /dev/sdc1

# Add to /etc/fstab using UUID
UUID=$(sudo blkid -s UUID -o value /dev/sdc1)
echo "UUID=$UUID /mnt/sda1 ext4 defaults 0 2" | sudo tee -a /etc/fstab
```

### 6. Verify disk mount
```bash
df -h | grep /mnt/sda1  # Check data disk
ls -la /mnt/sda1        # Check mount point
```

### 7. Setup user folders
```bash
# Create user folder
mkdir -p /mnt/sda1/$USER

# Create recommended development folders
mkdir -p /mnt/sda1/$USER/.cache          # Cache data
mkdir -p /mnt/sda1/$USER/.vscode-server  # VS Code server data
mkdir -p /mnt/sda1/$USER/.npm            # npm cache
mkdir -p /mnt/sda1/$USER/.nvm            # Node.js version management
mkdir -p /mnt/sda1/$USER/.terraform.d    # Terraform plugins
mkdir -p /mnt/sda1/$USER/pnpm            # pnpm data
mkdir -p /mnt/sda1/$USER/.kiro-server    # Kiro server data

# Create corresponding folders in home directory (for bind mount)
mkdir -p ~/.cache ~/.vscode-server ~/.npm
```

### 8. Configure bind mounts
```bash
# Add bind mounts to /etc/fstab
echo "/mnt/sda1/$USER/.cache /home/$USER/.cache none bind 0 0" | sudo tee -a /etc/fstab
echo "/mnt/sda1/$USER/.vscode-server /home/$USER/.vscode-server none bind 0 0" | sudo tee -a /etc/fstab
echo "/mnt/sda1/$USER/.npm /home/$USER/.npm none bind 0 0" | sudo tee -a /etc/fstab

# Apply bind mounts
sudo mount -a
```

## Basic VM Operations

### VM Structure Understanding
- `/vagrant/` folder: Synced with Windows Reimagine kiosk installation folder
- `sudo` command: Root access without password
- `.env` file: `/vagrant/.env` (Windows installation folder's .env file)

### VM Start/Stop
```bash
vagrant up      # Start VM
vagrant halt    # Stop VM
vagrant reload  # Restart VM
```

### SSH Access
```bash
ssh reimagine   # Connect to VM
```

## Status Monitoring

### VM Status Monitoring
```bash
./checkstatus.sh     # Check VM status
./status-loop.sh     # Continuous status monitoring
./configtest.sh      # Configuration test
```

## Updates and Restarts

### Kiosk Server Management
```bash
./restart.ps1                   # Restart (Windows)
./launch-restart-reimagine.sh   # Restart Reimagine service
```

## Troubleshooting

### VM Reset
```bash
./destroy.sh    # Complete VM deletion and recreation
vagrant up      # Fresh start
```

### Disk Space Cleanup
```bash
ssh reimagine "docker system prune -a"  # Clean unused images/containers
ssh reimagine "docker volume prune"     # Clean unused volumes
```

## Backup and Recovery

### Network Configuration Check
```bash
ssh reimagine "ip addr show"           # Check IP address
ssh reimagine "docker network ls"      # Check Docker networks
```