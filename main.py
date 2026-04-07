from io import BytesIO
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from PIL import features

app = FastAPI(title="PixelMorph API", description="API de conversao de imagens de alta performance")
MAX_FILE_SIZE = 10 * 1024 * 1024
port = int(os.environ.get('PORT', 8000))

app.add_middleware(
	CORSMiddleware,
	allow_origins=["*"],
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/")
async def healthcheck() -> dict[str, str]:
	return {"status": "online"}


@app.post("/convert")
async def convert_image(file: UploadFile = File(...), format: str = Query(default="jpg")) -> StreamingResponse:
	if not file.filename:
		raise HTTPException(status_code=400, detail="Nenhum arquivo foi enviado.")

	requested_format = format.lower()
	if requested_format not in ("png", "jpg", "jpeg", "webp"):
		raise HTTPException(status_code=400, detail="Formato invalido. Use png, jpg, jpeg ou webp.")

	try:
		file_bytes = await file.read()
		if not file_bytes:
			raise HTTPException(status_code=400, detail="O arquivo enviado esta vazio.")

		if len(file_bytes) > MAX_FILE_SIZE:
			raise HTTPException(status_code=413, detail="Arquivo muito grande. O limite e 10MB.")

		try:
			image = Image.open(BytesIO(file_bytes))
			image.load()
		except (UnidentifiedImageError, OSError) as exc:
			raise HTTPException(status_code=400, detail="O arquivo enviado nao e uma imagem valida ou esta corrompido.") from exc

		with image:
			img_byte_arr = BytesIO()
			if requested_format == "webp":
				if not features.check("webp"):
					print("Erro: suporte a WebP nao esta disponivel na instalacao atual do Pillow.")
					raise HTTPException(status_code=500, detail="Conversao para WebP indisponivel neste servidor.")

				print(f"Salvando como: {format}")
				image.save(img_byte_arr, format='WEBP', lossless=False, quality=80)
				media_type = "image/webp"
				extension = "webp"
			elif requested_format == "png":
				image.save(img_byte_arr, format='PNG')
				media_type = "image/png"
				extension = "png"
			else:
				image = image.convert("RGB")
				print(f"Convertendo para: {image.mode}")
				image.save(img_byte_arr, format='JPEG', quality=95)
				media_type = "image/jpeg"
				extension = "jpg"

			img_byte_arr.seek(0)

		output_name = f"{Path(file.filename).stem or 'convertida'}.{extension}"
		headers = {"Content-Disposition": f'attachment; filename="{output_name}"'}
		return StreamingResponse(img_byte_arr, media_type=media_type, headers=headers)
	except UnidentifiedImageError as exc:
		raise HTTPException(status_code=400, detail="O arquivo enviado nao e uma imagem valida.") from exc
	except HTTPException:
		raise
	except Exception as exc:
		raise HTTPException(status_code=500, detail="Erro ao converter a imagem.") from exc
	finally:
		await file.close()


if __name__ == "__main__":
	import uvicorn

	uvicorn.run("main:app", host="0.0.0.0", port=port)
