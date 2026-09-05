from concurrent.futures import ThreadPoolExecutor

import pytest

from app.core.config import settings
from app.services import hotel_photos
from app.services.google_quota import GoogleQuotaExceeded, GoogleQuotaGuard
from app.services.google_maps import GoogleMapsService
from app.services.map_http import MapHttpClient, map_http_client


def test_concurrent_photo_reservations_never_exceed_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_PLACES_PHOTOS_MONTHLY_LIMIT", 3)
    path = tmp_path / "quota.db"
    def reserve(_):
        try:
            GoogleQuotaGuard(path).reserve("places_photos")
            return True
        except GoogleQuotaExceeded:
            return False
    with ThreadPoolExecutor(max_workers=8) as executor:
        assert sum(executor.map(reserve, range(20))) == 3
    with pytest.raises(GoogleQuotaExceeded):
        GoogleQuotaGuard(path).reserve("places_photos")


def test_photo_uses_same_place_and_returns_attribution_without_key(monkeypatch):
    calls, reservations = [], []
    monkeypatch.setattr(hotel_photos.google_maps_service, "enabled", lambda _: True)
    monkeypatch.setattr(hotel_photos.google_quota_guard, "reserve", reservations.append)
    def get(url, **kwargs):
        calls.append((url, kwargs))
        if url.endswith("/media"):
            return {"photoUri": "https://lh3.googleusercontent.com/property-photo"}
        return {"photos": [{"name": "places/property-1/photos/photo-1",
                             "authorAttributions": [{"displayName": "Owner", "uri": "https://maps.google.com/owner"}]}]}
    monkeypatch.setattr(map_http_client, "get_json", get)
    signature = hotel_photos.hotel_photo_reference("property-1").rsplit("/", 1)[1]
    result = hotel_photos.get_hotel_photo("property-1", signature)
    assert reservations == ["places_photos", "places_details"]
    assert len(calls) == 2
    assert calls[0][1]["headers"]["X-Goog-FieldMask"] == "photos"
    assert result["authors"][0]["name"] == "Owner"
    assert "key=" not in result["photo_url"]
    assert all(not kwargs.get("cache_key") for _, kwargs in calls)


def test_exhausted_photo_quota_sends_no_http_request(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_PLACES_PHOTOS_MONTHLY_LIMIT", 0)
    monkeypatch.setattr(hotel_photos.google_maps_service, "enabled", lambda _: True)
    monkeypatch.setattr(hotel_photos, "google_quota_guard", GoogleQuotaGuard(tmp_path / "quota.db"))
    def unexpected(*args, **kwargs):
        pytest.fail("HTTP must not run after quota exhaustion")
    monkeypatch.setattr(map_http_client, "get_json", unexpected)
    signature = hotel_photos.hotel_photo_reference("property-1").rsplit("/", 1)[1]
    with pytest.raises(GoogleQuotaExceeded):
        hotel_photos.get_hotel_photo("property-1", signature)
    with pytest.raises(ValueError):
        hotel_photos.get_hotel_photo("property-1", "tampered")


def test_google_transport_has_no_unmetered_retries():
    client = MapHttpClient()
    assert client._session.get_adapter("https://places.googleapis.com/v1/places").max_retries.total == 0


def test_hotel_search_is_bounded_and_uses_only_pro_fields(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GOOGLE_HOTELS_ENABLED", True)
    calls = []
    monkeypatch.setattr(map_http_client, "post_json", lambda *args, **kw: calls.append(kw) or {"places": []})
    GoogleMapsService().search_places("hotel", for_hotels=True, latitude=7.2, longitude=80.6, radius_km=10)
    assert "locationRestriction" in calls[0]["json_body"]
    mask = calls[0]["headers"]["X-Goog-FieldMask"]
    assert "rating" not in mask and "price" not in mask and "*" not in mask
    assert calls[0]["cache_key"] is None
