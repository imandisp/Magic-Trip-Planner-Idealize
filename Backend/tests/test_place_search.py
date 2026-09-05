from app.services.google_maps import google_maps_service
from app.services.map_http import map_http_client
from app.services.place_search import PlaceSearchService
from app.schemas.selected_place import SelectPlacesRequest


def _google_place(place_id, name, latitude=6.87, longitude=81.05, types=None):
    return {
        "id": place_id,
        "displayName": {"text": name},
        "formattedAddress": f"{name}, Ella, Sri Lanka",
        "location": {"latitude": latitude, "longitude": longitude},
        "primaryType": (types or ["tourist_attraction"])[0],
        "types": types or ["tourist_attraction", "point_of_interest"],
    }


def test_google_place_search_keeps_exact_attraction_and_place_id(monkeypatch):
    monkeypatch.setattr(google_maps_service, "enabled", lambda feature: feature == "places")
    monkeypatch.setattr(
        google_maps_service,
        "search_places",
        lambda *args, **kwargs: [
            _google_place("locality-ella", "Ella", types=["locality"]),
            _google_place("plus-code", "V368+2H, Ella"),
            _google_place("little-adams-peak", "Little Adam's Peak"),
            _google_place("duplicate", "Little Adam's Peak", 6.87, 81.05),
        ],
    )

    results = PlaceSearchService().search_places("little adam's", "Ella", limit=5)

    assert len(results) == 1
    assert results[0]["name"] == "Little Adam's Peak"
    assert results[0]["google_place_id"] == "little-adams-peak"
    assert results[0]["latitude"] == 6.87
    assert "Ella" in results[0]["display_name"]
    selected = SelectPlacesRequest(selected_places=results)
    assert selected.selected_places[0].google_place_id == "little-adams-peak"


def test_irrelevant_google_results_fall_back_to_named_osm_place(monkeypatch):
    monkeypatch.setattr(google_maps_service, "enabled", lambda feature: feature == "places")
    monkeypatch.setattr(
        google_maps_service,
        "search_places",
        lambda *args, **kwargs: [_google_place("locality-ella", "Ella", types=["locality"])],
    )
    monkeypatch.setattr(
        map_http_client,
        "get_json",
        lambda *args, **kwargs: [
            {
                "osm_type": "node",
                "osm_id": 12,
                "display_name": "Little Adam's Peak, Ella, Sri Lanka",
                "namedetails": {"name:en": "Little Adam's Peak"},
                "lat": "6.8667",
                "lon": "81.0466",
                "class": "tourism",
                "type": "viewpoint",
                "extratags": {},
            }
        ],
    )
    service = PlaceSearchService()
    monkeypatch.setattr(
        service.media_lookup,
        "lookup_media",
        lambda query: {"image_url": None, "description": None},
    )
    results = service.search_places("Little Adam's Peak", "Ella", limit=5)

    assert [item["name"] for item in results] == ["Little Adam's Peak"]
    assert results[0]["osm_id"] == 12
    assert results[0].get("google_place_id") is None
