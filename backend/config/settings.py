import os
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "tanpit-django-secret")
DEBUG = True
ALLOWED_HOSTS = ["*"]
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "pits",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]
ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DB_ENGINES = {
    "postgres": "django.db.backends.postgresql",
    "postgresql": "django.db.backends.postgresql",
    "sqlite": "django.db.backends.sqlite3",
}

url = urlparse(os.environ.get("DATABASE_URL", "postgres://tanpit:tanpit@127.0.0.1:6170/tanpit"))
# 只去掉连接串分隔用的一个斜杠：postgres:///db -> db；sqlite:////tmp/t.db -> /tmp/t.db
db_name = url.path[1:] if url.path.startswith("/") else url.path
DATABASES = {
    "default": {
        "ENGINE": DB_ENGINES.get(url.scheme, "django.db.backends.postgresql"),
        "NAME": db_name,
        "USER": url.username or "",
        "PASSWORD": url.password or "",
        "HOST": url.hostname or "",
        "PORT": url.port or "",
    }
}
LANGUAGE_CODE = "zh-hans"
TIME_ZONE = "Asia/Shanghai"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
JWT_SECRET = os.environ.get("JWT_SECRET", "tanpit-dev-secret")
