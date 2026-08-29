import paramiko

host = 'media'
user = 'aaron'
password = 'Gabinou1'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(host, username=user, password=password)

test_code = """
import asyncio
from app.jellyfin_client import JellyfinClient
from app.config import get_active_settings
from app.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as session:
        cfg = await get_active_settings(session)
        print('Active config:', cfg)
        
    jf = JellyfinClient(
        base_url=cfg['jellyfin_url'],
        api_key=cfg['jellyfin_api_key'],
        user_id=cfg['jellyfin_user_id'],
        tv_device_name=cfg['tv_device_name']
    )
    
    sessions = await jf.get_sessions()
    print('All Jellyfin sessions count:', len(sessions))
    for s in sessions:
        print('SESSION:', s)
        
    tv_s = await jf.find_tv_session()
    print('FIND TV SESSION RESULT:', tv_s)

asyncio.run(main())
"""
stdin, stdout, stderr = ssh.exec_command(f'docker exec media-scheduler python -c "{test_code}"')
print('JELLYFIN SESSIONS CHECK:\n', stdout.read().decode() + stderr.read().decode())

ssh.close()
