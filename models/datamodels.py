from pydantic import BaseModel,EmailStr
from sqlmodel import SQLModel

class LoginModel(BaseModel):
    username:str
    password:str
    
class SignupModel(BaseModel):
    email:EmailStr
    username:str
    password:str
    
class CodeModel(BaseModel):
    code: str
    
class UserCreate(SQLModel):
    email: str
    username: str
    password: str
    
class Token(SQLModel):
    access_token: str
    token_type: str
    
class Error(SQLModel):
    error: bool
    
class CreateRoom(BaseModel):
    password: str
    
class JoinModel(BaseModel):
    data: str
    
