import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import auth
from firebase_admin import storage
import datetime
from mutagen import File
from mutagen.mp3 import MP3
from mutagen.easyid3 import EasyID3
from mutagen.id3 import APIC
from supabase import create_client, Client
from io import BytesIO
import os
from .configs import SupabaseConfig
from uuid import uuid4
from PIL import Image
from urllib.parse import quote
import tempfile

cred = credentials.Certificate(r"models\certificate.json")
firebase_admin.initialize_app(cred,{
    'storageBucket': 'chat-room-ab9c5.appspot.com'
})
db = firestore.client()


class SongUrl:
    def __init__(self):
        self.bucket = storage.bucket()
                
    def uploadMusic(self,file,name,content:BytesIO):
        blob = self.bucket.blob(f"songs/{name}.mp3")
        blob.upload_from_file(content,content_type=file.content_type)
        blob.make_public()
        return blob.public_url
    
    
class SongMetaData:
    def __init__(self,content,name:str):        
        self.name = name
        with tempfile.NamedTemporaryFile(delete=False,suffix=".mp3") as tmp:
            tmp.write(bytes(content))
            self.tmp_path = tmp.name
            
        songPoster = MP3(self.tmp_path)

        for tag in songPoster.values():
            if isinstance(tag,APIC):
                self.poster = tag.data
                
        self.image = Image.open(BytesIO(self.poster))
        buffer = BytesIO()
        self.image.save(buffer,format="JPEG")
        buffer.seek(0)
        image_upload = ImageUpload(f"{self.name}.jpg")
        self.imageurl = image_upload.upload(buffer.read())
            
    def uploadImage(self):
        os.remove(self.tmp_path)
        return self.imageurl
        
class ImageUpload:
    def __init__(self,filename):
        self.config = SupabaseConfig()
        url: str = self.config.SUPABASE_URL
        key: str = self.config.SUPABASE_KEY
        self.supabase: Client = create_client(url,key)
        self.filename = f"{uuid4()}_{filename}"
        self.path = f"{self.config.PATH}/{self.filename}"
        
    def upload(self,image):
        self.supabase.storage.from_("Sonix").upload(self.path,image,{'content-type':'image/jpeg'})
        cover_image_url = f"{self.config.STORAGE_PATH}/{quote(self.path)}"
        return cover_image_url
        