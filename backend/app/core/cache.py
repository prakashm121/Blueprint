import json
import redis
import urllib.parse
from app.core.config import settings
from typing import Any

# Initialize Redis Client safely
redis_client = None
if settings.REDIS_URL:
    try:
        # Some Upstash/Redis URLs might have parameters that redis-py doesn't like, so we parse it
        kwargs = {"decode_responses": True}
        if settings.REDIS_URL.startswith("rediss://"):
            kwargs["ssl_cert_reqs"] = "none"
            
        redis_client = redis.Redis.from_url(settings.REDIS_URL, **kwargs)
        # Test connection silently
        redis_client.ping()
    except Exception as e:
        print(f"Warning: Redis connection failed: {e}")
        redis_client = None

def get_cache(key: str) -> Any:
    if not redis_client:
        return None
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None

def set_cache(key: str, value: Any, ttl_seconds: int = 300):
    if not redis_client:
        return
    try:
        if isinstance(value, (dict, list)):
            value = json.dumps(value)
        redis_client.setex(key, ttl_seconds, value)
    except Exception:
        pass

def delete_cache(key: str):
    if not redis_client:
        return
    try:
        redis_client.delete(key)
    except Exception:
        pass
