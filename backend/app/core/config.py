"""Central application configuration, loaded from environment variables.

Keeping all settings in one Pydantic model means every other module reads
config the same way and secrets never get hardcoded in source.
"""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR}/data/app.db"

    # Security
    SECRET_KEY: str = "dev-only-insecure-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # AI Provider
    AI_PROVIDER: str = "ollama"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"

    # Uploads
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    MAX_UPLOAD_SIZE_MB: int = 20

    # Agent safety
    AGENT_MAX_ITERATIONS: int = 8
    AGENT_TIMEOUT_SECONDS: int = 60

    # Browser automation tool (Playwright). Empty path lets Playwright
    # resolve its own managed browser install; set it to pin a specific
    # Chromium binary (e.g. in a container that pre-installs one).
    BROWSER_EXECUTABLE_PATH: str = ""
    BROWSER_HEADLESS: bool = True
    BROWSER_NAV_TIMEOUT_SECONDS: int = 20
    BROWSER_IDLE_CLOSE_SECONDS: int = 600

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
