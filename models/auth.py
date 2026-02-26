from fastapi import WebSocket,WebSocketDisconnect,HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
from typing import Dict, List
from passlib.context import CryptContext
from jose import JWTError,jwt
from datetime import timedelta,datetime
from .configs import AuthConfig
from typing import Optional
from .database import get_user_by_username, users, add_data, Session, metadata, Room, get_room_details
from dotenv import load_dotenv, find_dotenv
import string
import random
import redis
from asyncio import Lock
from uuid import uuid4
import os

load_dotenv(find_dotenv())
pwd_context = CryptContext(schemes=["bcrypt"])
oauth2 = OAuth2PasswordBearer(tokenUrl="login")
connected_users: Dict[str, WebSocket] = dict()
host_list: Dict[str,WebSocket] = dict()
REDIS_URL = os.getenv("REDIS_URL")

# Connect using from_url (handles SSL automatically)
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

def get_user_from_token(websocket: WebSocket):
    config = AuthConfig()
    token = websocket.cookies.get("access_token")
    payload = jwt.decode(token,config.SECRET_KEY,config.ALGORITHM)
    username = payload.get("sub")
    return username 


class ManageConnection:
    def __init__(self):
        self.lock = Lock()    

    async def add(self,socket_id:str, websocket:WebSocket):
        async with self.lock:
            connected_users[socket_id] = websocket
            
    async def remove(self,socket_id:str):
        async with self.lock:
            connected_users.pop(socket_id)
        
    async def connect(self,websocket:WebSocket,room_id:str,password:str,host:bool,session:Session) -> dict:
        await websocket.accept(subprotocol=password)
        room = get_room_details(room_id, session)
        
        if not host and room_id not in host_list.keys():
            await websocket.send_json({"error":f"{room_id} is not live. Please tell admin to host.."})
            
        if not room or room.password != password:
            await websocket.send_json({"error":"No room found or Password is wrong..."})
        else:
            username:str = get_user_from_token(websocket)
            users_key = f"room:{room_id}:users"
            info_key = f"room:{room_id}:info"
            socket_id:str = f"{uuid4()}"
            
            #Adding username map with socket_id into redis for 300 seconds...
            r.hset(users_key,username,socket_id)
            r.expire(users_key,300)
            
            #Adding socket_id mapping with websocket in local server RAM...
            await self.add(socket_id,websocket)
            print(connected_users)
            #It is use to send connected users in room...
            await self.get_users_connected(room_id,password)
        if host:
            host_list[room_id] = websocket
    
    async def disconnect(self, websocket: WebSocket, room_id: str, password: str, session: Session):
        users_key = f"room:{room_id}:users"
        room = get_room_details(room_id, session)
        if not room or room.password != password:
            return

        username = get_user_from_token(websocket)
        socket_id = r.hget(users_key, username)

        if not socket_id:
            return  # user already removed or invalid

        # Remove from Redis and local storage RAM...
        r.hdel(users_key, username)
        if websocket in host_list.values():
            host_list.pop(room_id)
            
        if socket_id in connected_users:
            await self.remove(socket_id)

        # Broadcast updated user list
        await self.get_users_connected(room_id, password)
    
    async def broadcast(self,websocket:WebSocket,room_id:str,password:str,message:dict):
        users_key = f"room:{room_id}:users"
        active_connection:Dict[str,str] = r.hgetall(users_key)  
        for socket_id in active_connection.values():
            if websocket != connected_users.get(socket_id):
                await connected_users[socket_id].send_json(message)
            
    def create(self,room_id:str,password:str,admin:str,session:Session) -> bool:
        room = Room(room_id=room_id,password=password,admin=admin)
        add_data(room,session)
        return True
    
    def get_room_code(self):
        chars = list(string.ascii_letters+string.digits)
        room_id = ''.join(random.sample(chars,7))
        return room_id
    
    async def get_users_connected(self, room_id: str, password: str):
        users_key = f"room:{room_id}:users"
        active_connection: Dict[str, str] = r.hgetall(users_key)
        user_list = list(active_connection.keys())
        
        for socket_id in active_connection.values():
            if socket_id in connected_users:
                try:
                    await connected_users[socket_id].send_json({"user_list": user_list})
                except Exception as e:
                    print(f"Failed to send to {socket_id}: {e}")

        
        
class JWTTokenAuth(AuthConfig):
    def verify_password(self,plain_password:str,hashed_password:str):
        return pwd_context.verify(plain_password,hashed_password)
        
    def get_password_hash(self,password:str):
        return pwd_context.hash(password)

    def create_access_token(self,data:dict,expires_delta:Optional[timedelta]=None):
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=30))
        to_encode.update({"exp":expire})
        return jwt.encode(to_encode,self.SECRET_KEY,self.ALGORITHM)
    
    def current_user(self, request: Request):
        token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

        try:
            payload = jwt.decode(token, self.SECRET_KEY, algorithms=[self.ALGORITHM])
            username: str = payload.get("sub")
            if username is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
            return username
        except JWTError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")         
    

class LoginAuth(JWTTokenAuth):
    def authenticate_user(self,username:str,password:str,session):
        user = get_user_by_username(username,session)
        if not user or not self.verify_password(password,user.password):
            raise HTTPException(status_code=400, detail="Invalid credentials")
        access_token = self.create_access_token({"sub":user.username},timedelta(hours=self.ACCESS_TOKEN_EXP_TIME_HOUR))
        response =  RedirectResponse(f"/home?u={username}",303)
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax"
        )
        return response
        

class SignupAuth(JWTTokenAuth):
    def create_user(self,email:str,username:str,password:str,session):
        user:users = get_user_by_username(username,session)
        if user:
            raise HTTPException(400,"Username already registered.")
        hashed_password = self.get_password_hash(password)
        new_user = users(email=email,username=username,password=hashed_password)
        add_data(new_user,session)

        access_token = self.create_access_token({"sub":new_user.username},timedelta(hours=self.ACCESS_TOKEN_EXP_TIME_HOUR))
        response =  RedirectResponse(f"/home?u={username}",303)
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax"
        )
        return response          

class InsertData:
    def insert(self,track,artist,storage,duration,url,imgurl,session):
        data = metadata(name=track,artist=artist,url=url,img_url=imgurl,storage=storage,duration=duration)
        add_data(data,session)
        return True