from sqlmodel import Field, Session, create_engine, select, SQLModel, Relationship
from typing import Optional, List
from .configs import DatabaseConfig
from time import strftime, gmtime

config = DatabaseConfig()

class users(SQLModel, table=True):
    id: Optional[int] = Field(default=None,primary_key=True)
    email: str = Field(index=True,unique=True)
    username: str = Field(index=True,unique=True)
    password: str
    playlists: List["Playlist"] = Relationship(back_populates="user")
    
class metadata(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True,unique=True)
    artist: str
    url: str
    img_url: str
    storage: str
    duration: Optional[int]
    playlists: List["PlaylistSong"] = Relationship(back_populates="song")
    
class Playlist(SQLModel,table=True):
    id: Optional[int] = Field(default=None,primary_key=True)
    name: str
    user_id: str = Field(foreign_key='users.username')
    user: List["users"] = Relationship(back_populates="playlists")
    songs: List["PlaylistSong"] = Relationship(back_populates="playlist")
    
class admin(SQLModel, table=True):
    id: Optional[int] = Field(default=None,primary_key=True)
    email: str = Field(index=True,unique=True)
    username: str = Field(index=True,unique=True)
    password: str
    
class PlaylistSong(SQLModel, table=True):
    playlist_id:int = Field(foreign_key="playlist.id",primary_key=True)
    song_id:int = Field(foreign_key="metadata.id", primary_key=True)
    playlist: "Playlist" = Relationship(back_populates="songs")
    song: "metadata" = Relationship(back_populates="playlists")
    
class Room(SQLModel, table=True):
    room_id:str = Field(primary_key=True,default=None)
    password:str
    admin: str
    
engine = create_engine(config.url)
SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
        
def get_user_by_username(username:str,session:Session):
    statement = select(users).where(users.username==username)
    return session.exec(statement).first()

def add_data(data:object,session:Session):
    session.add(data)
    session.commit()
    session.refresh(data)
    
def format_time(seconds:int) -> str:
    formatted_time = strftime('%M:%S',gmtime(seconds))
    return formatted_time
    
def get_songs(session:Session):
    statement = select(metadata)
    songs = session.exec(statement).all()
    for song in songs:
        song.duration = format_time(song.duration)
    return songs

def get_room_details(room_id,session:Session):
    statement = select(Room).where(Room.room_id==room_id)
    return session.exec(statement).first()

def user_ishost(username:str,room_id:str,session:Session):
    statement = select(Room).where(Room.room_id==room_id)
    user = session.exec(statement).first()
    if user.admin == username:
        return {"ishost": True}
    return {"ishost": True}