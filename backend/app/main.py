import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from celery.result import AsyncResult

from celery_worker import celery_app
from app.routes.processar import router as processar_router


UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "videos_processados"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOAD_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    yield


app = FastAPI(title="Fábrica de Reels - API", lifespan=lifespan)

app.include_router(processar_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/status/{task_id}")
def task_status(task_id: str):
    resultado = AsyncResult(task_id, app=celery_app)

    if resultado.state == "PENDING":
        return {"task_id": task_id, "status": "PENDING", "progress": 0}

    if resultado.state == "PROCESSING":
        meta = resultado.info or {}
        progress = meta.get("progress", 50)
        return {"task_id": task_id, "status": "PROCESSING", "progress": progress}

    if resultado.state == "SUCCESS":
        dados = resultado.result
        arquivo = Path(dados.get("arquivo_saida", ""))
        if arquivo.exists():
            return {
                "task_id": task_id,
                "status": "SUCCESS",
                "progress": 100,
                "download_url": f"/download/{arquivo.name}",
            }
        return {
            "task_id": task_id,
            "status": "SUCCESS",
            "progress": 100,
            "download_url": None,
        }

    if resultado.state == "FAILURE":
        return {
            "task_id": task_id,
            "status": "FAILURE",
            "progress": 0,
            "error": str(resultado.info),
        }

    return {"task_id": task_id, "status": resultado.state}


@app.get("/download/{filename}")
def download_file(filename: str):
    arquivo = OUTPUT_DIR / filename
    if not arquivo.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(
        path=str(arquivo),
        filename=filename,
        media_type="video/mp4",
    )



