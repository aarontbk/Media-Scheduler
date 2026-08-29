FROM python:3.12-slim

# Install ADB
RUN apt-get update && \
    apt-get install -y --no-install-recommends android-tools-adb && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY app/ ./app/
COPY frontend/ ./frontend/

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 8081

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8081"]
