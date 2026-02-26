from fastapi import WebSocket,WebSocketDisconnect,WebSocketException, Depends
from fastapi import UploadFile, Form
from fastapi.routing import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.background import BackgroundTasks
from .codes import Codes
from .datamodels import *
from .auth import LoginAuth,SignupAuth,ManageConnection,InsertData
from .database import get_session, Session, get_songs, user_ishost
from typing import Union
from .firebase import SongMetaData, SongUrl
from io import BytesIO
from time import strftime,gmtime

router = APIRouter()
template = Jinja2Templates("templates")
code = Codes()
manager = ManageConnection()
login_obj = LoginAuth()
signup_obj = SignupAuth()


@router.get("/",response_class=HTMLResponse)
async def index(request:Request):
    return template.TemplateResponse("index.html",{"request":request})

@router.get("/home",response_class=HTMLResponse)
async def home(request:Request, current_user = Depends(login_obj.current_user)):
    return template.TemplateResponse("home.html",{"request":request})

@router.post("/login")
async def login(data:LoginModel, session:Session = Depends(get_session)):
    return login_obj.authenticate_user(data.username,data.password,session)
    
@router.post("/signup")
async def signup(data:SignupModel, session:Session = Depends(get_session)):
    return signup_obj.create_user(data.email,data.username,data.password,session)
    
@router.post("/sonix/code",response_model=CodeModel)
async def get_codes(request:Request):
    data = await request.json()
    return {"code":code.get_code(data["type"])}

@router.post("/sonix/create")
async def create(data: CreateRoom,current_user = Depends(login_obj.current_user),session:Session = Depends(get_session)):
    if data.password:
        room_id = manager.get_room_code()
        created = manager.create(room_id,data.password,current_user,session)
        if created:
            return {"room":room_id,"password":data.password,"host":True}
        return False
    return False

@router.post("/sonix/isHost/{room_id}")
async def ishost(room_id:str,current_user = Depends(login_obj.current_user),session:Session = Depends(get_session)):
    return user_ishost(current_user,room_id,session)

@router.post("/admin/upload/metadata")
async def upload(file: UploadFile,
           song: str = Form(...),
           artist: str = Form(...),
           storage:str = Form(...),
           duration: int = Form(...),
           session:Session = Depends(get_session)):
    
    content = await file.read()
    url = SongUrl().uploadMusic(file,song,BytesIO(content))
    imgurl = SongMetaData(content,song).uploadImage()
    output = InsertData().insert(song,artist,storage,duration,url,imgurl,session)
    if output:
        return JSONResponse({
            "filename": file.filename,
            "success": True
        })
    else: 
        return JSONResponse({
            "filename": file.filename,
            "success": False
        })
   
@router.get("/admin/upload")
async def admin_upload(request: Request):
    return template.TemplateResponse("adminpage.html",{"request":request})

@router.get("/sonix/sync",response_class=HTMLResponse)
async def sync(request: Request, current_user = Depends(login_obj.current_user),session:Session = Depends(get_session)):
    songs = get_songs(session)
    return template.TemplateResponse("sync-playing.html",{"request":request,"songs":songs})

@router.websocket("/ws/sync/{room_id}")
async def websocket_endpoint(websocket:WebSocket, room_id:str, host: bool = False,session:Session = Depends(get_session)):
    password = websocket.scope["subprotocols"][0]
    await manager.connect(websocket,room_id,password,host,session)
    try:
        while True:
            message:dict = await websocket.receive_json()
            if message and message.get("action",None) == "ping":    
                await websocket.send_json({"action":"pong"})
            else:
                await manager.broadcast(websocket,room_id,password,message)
    except WebSocketDisconnect as e:
        await manager.disconnect(websocket,room_id,password,session)
        print(f"Disconnect {e}")