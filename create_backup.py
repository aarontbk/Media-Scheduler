import datetime
import paramiko

def run_backup():
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    print(f"=== Starting Docker Backup on Server: timestamp={timestamp} ===")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect("media", username="aaron", password="Gabinou1")

    backup_dir = "/home/aaron/backups"
    scheduler_archive = f"{backup_dir}/media-scheduler-backup_{timestamp}.tar.gz"
    server_archive = f"{backup_dir}/media-server-backup_{timestamp}.tar.gz"

    bash_script = f"""
set -e
mkdir -p "{backup_dir}"

echo "1. Archiving media-scheduler..."
sudo tar -czf "{scheduler_archive}" \
    --exclude="*.pyc" \
    --exclude="__pycache__" \
    --exclude=".git" \
    -C /home/aaron media-scheduler

echo "2. Archiving media-server..."
sudo tar -czf "{server_archive}" \
    --exclude="*.tar.gz" \
    -C /home/aaron media-server

sudo chown -R aaron:aaron "{backup_dir}"
sudo chmod -R 664 "{backup_dir}"/*
sudo chmod 775 "{backup_dir}"

echo "=== Backup Files ==="
ls -lh "{backup_dir}"/*{timestamp}*

echo "=== Verification (Scheduler Archive) ==="
tar -ztvf "{scheduler_archive}" | head -n 15

echo "=== Verification (Media Server Archive) ==="
tar -ztvf "{server_archive}" | head -n 15
"""

    stdin, stdout, stderr = ssh.exec_command(f"echo Gabinou1 | sudo -S bash -c '{bash_script}'")
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")

    print("--- STDOUT ---")
    print(out)
    if err and "password for aaron" not in err:
        print("--- STDERR ---")
        print(err)

    ssh.close()
    print("=== Backup Process Completed Successfully ===")

if __name__ == "__main__":
    run_backup()
