from celery import Task
from celery_worker import celery_app
from app.video_processor import montar_video


class VideoTask(Task):
    abstract = True

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        print(f"[Task {task_id}] Falha: {exc}")


@celery_app.task(
    base=VideoTask,
    bind=True,
    name="processar_video_task",
    max_retries=2,
    default_retry_delay=10,
)
def processar_video_task(self, caminho_video: str, caminho_img: str, nome_arquivo_saida: str) -> dict:
    try:
        saida = montar_video(caminho_video, caminho_img, nome_arquivo_saida)
        return {
            "status": "SUCCESS",
            "arquivo_saida": saida,
            "task_id": self.request.id,
        }
    except Exception as exc:
        raise self.retry(exc=exc)
