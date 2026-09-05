"""Resolve a property's photo on demand; persist only its signed Place ID."""
import hashlib
import hmac
import re
from urllib.parse import urlparse

from app.core.config import settings
from app.services.google_maps import google_maps_service
from app.services.google_quota import google_quota_guard
from app.services.map_http import map_http_client


def hotel_photo_reference(place_id: str) -> str:
    signature = hmac.new(settings.SECRET_KEY.encode(), place_id.encode(), hashlib.sha256).hexdigest()
    return f"/hotels/google-photo/{place_id}/{signature}"


def get_hotel_photo(place_id: str, signature: str) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,255}", place_id):
        raise ValueError("Invalid Place ID")
    expected = hotel_photo_reference(place_id).rsplit("/", 1)[1]
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid photo signature")
    if not google_maps_service.enabled("hotels"):
        return {"photo_url": None, "authors": []}

    # Reserve both before sending anything. Failures/no-photo results deliberately
    # consume allowance. No retries, photo-name cache, or persistent image cache.
    google_quota_guard.reserve("places_photos")
    google_quota_guard.reserve("places_details")
    details = map_http_client.get_json(
        f"https://places.googleapis.com/v1/places/{place_id}",
        headers={"X-Goog-Api-Key": settings.GOOGLE_API_KEY, "X-Goog-FieldMask": "photos"},
        context="Hotel photo details", timeout=10,
    )
    photos = details.get("photos") or []
    if not photos:
        return {"photo_url": None, "authors": []}
    photo = photos[0]
    name = photo.get("name", "")
    if not re.fullmatch(rf"places/{re.escape(place_id)}/photos/[A-Za-z0-9_-]+", name):
        raise ValueError("Invalid photo resource")
    data = map_http_client.get_json(
        f"https://places.googleapis.com/v1/{name}/media",
        headers={"X-Goog-Api-Key": settings.GOOGLE_API_KEY},
        params={"maxWidthPx": 640, "skipHttpRedirect": "true"},
        context="Hotel photo", timeout=10,
    )
    uri = data.get("photoUri") or ""
    parsed = urlparse(uri)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".googleusercontent.com"):
        raise ValueError("Invalid photo URI")
    return {
        "photo_url": uri,
        "authors": [{"name": author.get("displayName", "Photo contributor"),
                     "url": author.get("uri")} for author in photo.get("authorAttributions", [])],
        "maps_url": photo.get("googleMapsUri") or f"https://www.google.com/maps/search/?api=1&query=Hotel&query_place_id={place_id}",
    }
