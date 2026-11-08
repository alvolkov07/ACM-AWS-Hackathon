# Build context is the repository root (see docker-compose.yml), so this image
# can copy both backend/ and frontend/.
FROM python:3.12-slim
WORKDIR /code
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app app
COPY frontend frontend
ENV FRONTEND_DIR=/code/frontend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
