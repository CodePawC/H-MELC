#!/bin/sh
set -e
cd /app
python scripts/docker_bootstrap.py
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
