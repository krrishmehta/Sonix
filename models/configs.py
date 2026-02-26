import os
from dotenv import load_dotenv, find_dotenv

class DatabaseConfig:
    url = os.getenv("url")
    
class AuthConfig:
    SECRET_KEY = os.getenv("SECRET_KEY")
    ACCESS_TOKEN_EXP_TIME_HOUR = os.getenv("ACCESS_TOKEN_EXP_TIME_HOUR")
    
class SupabaseConfig:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    PATH = os.getenv("PATH")
    STORAGE_PATH = os.getenv("STORAGE_PATH")