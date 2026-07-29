import subprocess
import os

FFMPEG_PATH = os.getenv("FFMPEG_PATH", "ffmpeg")

def montar_video(caminho_video: str, caminho_img: str, nome_arquivo_saida: str) -> str:
    saida_dir = os.getenv("OUTPUT_DIR", os.path.join(os.getcwd(), "videos_processados"))
    os.makedirs(saida_dir, exist_ok=True)
    saida_path = os.path.join(saida_dir, nome_arquivo_saida)

    cmd = [
        FFMPEG_PATH,
        "-i", caminho_video,
        "-i", caminho_img,
        "-filter_complex",
        "[0:v][1:v]overlay=W-w-10:H-h-10",
        "-c:a", "copy",
        "-y",
        saida_path,
    ]

    resultado = subprocess.run(cmd, capture_output=True, text=True)
    if resultado.returncode != 0:
        raise RuntimeError(f"FFmpeg erro: {resultado.stderr}")

    return saida_path
