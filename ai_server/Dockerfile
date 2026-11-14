# syntax=docker/dockerfile:1
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 NUMBA_NUM_THREADS=1 \
    NUMBA_CACHE_DIR=/tmp/gha-numba
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt \
    && python -m pip install --no-cache-dir --no-deps basic-pitch==0.4.0

COPY main.py transcription.py auth.py ./ai_server/
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/healthz', timeout=3).close()"
CMD ["sh", "-c", "exec python -m uvicorn ai_server.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --workers 1"]
