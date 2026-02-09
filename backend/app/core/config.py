"""
Application Configuration
"""
from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Coach Platform API"
    APP_ENV: str = "production"
    DEBUG: bool = False
    API_VERSION: str = "v1"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    
    # Database
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    DATABASE_URL: str = ""
    ASYNC_DATABASE_URL: str = ""
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: str = "GET,POST,PUT,DELETE,PATCH,OPTIONS"
    CORS_ALLOW_HEADERS: str = "*"
    
    # Feature Flags
    FEATURE_AI_INTENT_ENABLED: bool = True
    FEATURE_WHATSAPP_ENABLED: bool = True
    FEATURE_COMMUNITY_ENABLED: bool = True
    FEATURE_REFERRALS_ENABLED: bool = True
    FEATURE_PAYMENTS_ENABLED: bool = True
    
    # File Upload
    MAX_FILE_SIZE_MB: int = 50
    MAX_SESSIONS_PER_DAY: int = 10
    
    # Timezone
    DEFAULT_TIMEZONE: str = "Asia/Kolkata"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Construct database URLs if not provided
        if not self.DATABASE_URL:
            self.DATABASE_URL = f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?sslmode=require"
        
        if not self.ASYNC_DATABASE_URL:
            self.ASYNC_DATABASE_URL = f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?ssl=require"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
