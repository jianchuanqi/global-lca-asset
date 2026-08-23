FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY src ./src
COPY data/seed ./data/seed
RUN pip install --no-cache-dir .

EXPOSE 8000
CMD ["uvicorn", "global_lca_asset.api:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
