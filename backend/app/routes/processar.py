import os
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from celery.result import AsyncResult

from celery_worker import celery_app
from app.tasks.video_tasks import processar_video_task


router = APIRouter(prefix="/processar", tags=["processamento"])

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/video")
async def processar_video_endpoint(
    video: UploadFile = File(...),
    imagem_overlay: UploadFile = File(...),
):
    if not video.filename or not video.filename.lower().endswith((".mp4", ".mov", ".avi", ".mkv")):
        raise HTTPException(status_code=400, detail="Formato de vídeo inválido. Use MP4, MOV, AVI ou MKV.")

    if not imagem_overlay.filename:
        raise HTTPException(status_code=400, detail="Imagem de overlay é obrigatória.")

    task_id = str(uuid.uuid4())
    nome_base = task_id
    ext_video = Path(video.filename).suffix
    ext_img = Path(imagem_overlay.filename).suffix

    caminho_video = UPLOAD_DIR / f"{nome_base}_video{ext_video}"
    caminho_img = UPLOAD_DIR / f"{nome_base}_overlay{ext_img}"
    nome_saida = f"{nome_base}_final{ext_video}"

    conteudo_video = await video.read()
    conteudo_img = await imagem_overlay.read()

    caminho_video.write_bytes(conteudo_video)
    caminho_img.write_bytes(conteudo_img)

    resultado = processar_video_task.apply_async(
        kwargs={
            "caminho_video": str(caminho_video),
            "caminho_img": str(caminho_img),
            "nome_arquivo_saida": nome_saida,
        },
        task_id=task_id,
    )

    return {
        "task_id": resultado.id,
        "mensagem": "Vídeo enviado para processamento em segundo plano.",
    }
