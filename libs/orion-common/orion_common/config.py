from pydantic_settings import BaseSettings


class CommonSettings(BaseSettings):
    app_env: str = "development"
    postgres_user: str = "orion"
    postgres_password: str = "orion_dev"
    postgres_db: str = "orion"
    redis_url: str = "redis://localhost:6379"
    milvus_host: str = "localhost"
    milvus_port: int = 19530
    ollama_host: str = "http://localhost:11434"
    comfyui_host: str = "http://localhost:8188"

    class Config:
        env_file = ".env"
