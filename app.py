from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from models import routes

app = FastAPI()
app.mount("/statics",StaticFiles(directory="statics"),name="statics")
app.include_router(routes.router)