import re

from app.services.map_http import map_http_client
from app.services.media_lookup import MediaLookupService
from app.services.google_maps import google_maps_service


class PlaceSearchService:
    BASE_URL = "https://nominatim.openstreetmap.org/search"
    GENERIC_GOOGLE_TYPES = {
        "administrative_area_level_1",
        "administrative_area_level_2",
        "country",
        "locality",
        "postal_code",
    }

    def __init__(self):
        self.media_lookup = MediaLookupService()

    def search_places(
        self,
        query: str,
        destination: str,
        country: str = "Sri Lanka",
        limit: int = 5,
    ):
        search_text = f"{query}, {destination}, {country}"

        if google_maps_service.enabled("places"):
            try:
                google_results = google_maps_service.search_places(
                    search_text,
                    min(max(limit * 2, limit), 10),
                )
                verified_google_results = self._verified_google_results(
                    google_results, query, destination, limit
                )
                if verified_google_results:
                    return [
                        self._google_suggestion(item, query, destination)
                        for item in verified_google_results
                    ]
            except Exception:
                pass

        params = {
            "q": search_text,
            "format": "jsonv2",
            "addressdetails": 1,
            "extratags": 1,
            "namedetails": 1,
            "countrycodes": "lk",
            "limit": limit,
        }

        headers = {
            "User-Agent": "MagicTripPlanner/1.0"
        }

        results = map_http_client.get_json(
            self.BASE_URL,
            params=params,
            headers=headers,
            timeout=10,
            cache_key=f"place-search:{search_text}:{limit}",
            min_interval_seconds=1.1,
            context="Nominatim place search",
        )

        suggestions = []

        seen = set()
        for item in results:
            display_name = item.get("display_name") or query
            name = self._extract_name(item, query)
            if not self._name_matches_query(name, query):
                continue
            identity = self._identity(name, item.get("lat"), item.get("lon"))
            if identity in seen:
                continue
            seen.add(identity)
            media = self.media_lookup.lookup_media(display_name)
            extratags = item.get("extratags") or {}

            suggestions.append(
                {
                    "place_key": self._make_place_key(
                        display_name
                    ),
                    "name": name,
                    "display_name": display_name,
                    "category": self._map_category(item),
                    "source": "user_added",
                    "short_description": media.get("description") or f"User-added place near {destination}.",
                    "latitude": float(item["lat"]) if item.get("lat") else None,
                    "longitude": float(item["lon"]) if item.get("lon") else None,
                    "image_url": media.get("image_url"),
                    "opening_hours": extratags.get("opening_hours"),
                    "availability_warnings": [],
                    "osm_type": item.get("osm_type"),
                    "osm_id": item.get("osm_id"),
                    "search_query": display_name,
                }
            )

        return suggestions

    def _verified_google_results(
        self, results: list[dict], query: str, destination: str, limit: int
    ) -> list[dict]:
        verified = []
        seen = set()
        normalized_destination = self._normalize(destination)

        for item in results:
            name = (item.get("displayName") or {}).get("text") or ""
            location = item.get("location") or {}
            types = set(item.get("types") or [])
            if item.get("primaryType"):
                types.add(item["primaryType"])
            if not name or self._is_plus_code(name) or types & self.GENERIC_GOOGLE_TYPES:
                continue
            if self._normalize(name) == normalized_destination:
                continue
            if not self._name_matches_query(name, query):
                continue
            if location.get("latitude") is None or location.get("longitude") is None:
                continue
            identity = self._identity(name, location["latitude"], location["longitude"])
            if identity in seen:
                continue
            seen.add(identity)
            verified.append(item)
            if len(verified) >= limit:
                break

        return verified

    @staticmethod
    def _normalize(value: str) -> str:
        return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))

    @classmethod
    def _tokens(cls, value: str) -> set[str]:
        return {token for token in cls._normalize(value).split() if len(token) > 1}

    @classmethod
    def _name_matches_query(cls, name: str, query: str) -> bool:
        query_tokens = cls._tokens(query)
        if not query_tokens:
            return False
        name_tokens = cls._tokens(name)
        return query_tokens.issubset(name_tokens)

    @staticmethod
    def _is_plus_code(name: str) -> bool:
        return bool(re.match(r"^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b", name.upper()))

    @classmethod
    def _identity(cls, name: str, latitude, longitude) -> tuple:
        try:
            coordinates = (round(float(latitude), 5), round(float(longitude), 5))
        except (TypeError, ValueError):
            coordinates = (None, None)
        return cls._normalize(name), coordinates

    def _google_suggestion(self, item: dict, fallback: str, destination: str) -> dict:
        display_name = (item.get("displayName") or {}).get("text") or fallback
        address = item.get("formattedAddress") or display_name
        if self._is_plus_code(address):
            address = destination
        location = item.get("location") or {}
        return {
            "place_key": self._make_place_key(item.get("id") or display_name),
            "google_place_id": item.get("id"),
            "name": display_name,
            "display_name": f"{display_name}, {address}" if address != display_name else display_name,
            "category": self._map_google_category(item),
            "source": "user_added",
            "short_description": f"Google Places result near {destination}. Verify opening hours before visiting.",
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "image_url": None,
            "opening_hours": None,
            "availability_warnings": ["Opening hours and ticket availability are not yet verified."],
            "osm_type": None,
            "osm_id": None,
            "search_query": f"{display_name}, {address}",
        }

    def _map_google_category(self, item: dict) -> str:
        types = set(item.get("types") or [])
        primary_type = item.get("primaryType")
        if primary_type:
            types.add(primary_type)
        if types & {"restaurant", "cafe", "bakery", "meal_takeaway"}:
            return "food"
        if types & {"beach", "park", "national_park", "natural_feature"}:
            return "nature"
        if types & {"museum", "historical_landmark", "historical_place"}:
            return "historical"
        if types & {"hindu_temple", "mosque", "church", "place_of_worship", "buddhist_temple"}:
            return "religious"
        if types & {"shopping_mall", "market", "store"}:
            return "shopping"
        return "other"

    def _extract_name(self, item: dict, fallback: str) -> str:
        namedetails = item.get("namedetails") or {}
        name = namedetails.get("name:en") or namedetails.get("name") or item.get("name")
        if name:
            return name
        address = item.get("address") or {}

        for key in [
            "tourism",
            "amenity",
            "leisure",
            "shop",
            "historic",
            "natural",
            "road",
            "village",
            "town",
            "city",
        ]:
            if address.get(key):
                return address[key]

        display_name = item.get("display_name")

        if display_name:
            return display_name.split(",")[0].strip()

        return fallback.strip()

    def _map_category(self, item: dict) -> str:
        place_class = item.get("class")
        place_type = item.get("type")

        if place_class == "tourism":
            return "nature"

        if place_class == "amenity":
            if place_type in ["restaurant", "cafe", "fast_food"]:
                return "food"
            return "other"

        if place_class == "natural":
            return "nature"

        if place_class == "historic":
            return "historical"

        if place_class == "shop":
            return "shopping"

        if place_class == "leisure":
            return "adventure"

        return "other"

    def _make_place_key(self, text: str) -> str:
        import re

        key = text.lower().strip()
        key = re.sub(r"[^a-z0-9]+", "_", key)
        key = key.strip("_")

        if not key:
            return "custom_place"

        return key[:80]
