from telethon.sync import TelegramClient
from telethon.sessions import StringSession
api_id = 24173242
api_hash = "e374a639670673451152516f5278b294"

with TelegramClient(StringSession(), api_id, api_hash) as client:
    print(client.session.save())