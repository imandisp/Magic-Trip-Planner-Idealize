from typing import Any

from app.schemas.hotel import HotelAgentResponse, HotelSuggestRequest
from app.services.hotel_search import HotelSearchService


class HotelAgent:
    """Recommend provider-returned accommodation, never generated property names."""

    def suggest_hotels(self, trip: Any, selected_places: list[Any],
                       request: HotelSuggestRequest, preference: Any = None) -> HotelAgentResponse:
        hotel_type = request.hotel_type
        if hotel_type == "any" and preference:
            hotel_type = getattr(preference, "preferred_hotel_type", None) or "any"
        query = "hotel" if hotel_type == "any" else hotel_type.replace("_", " ")
        if request.hotel_preference:
            query = f"{query} {request.hotel_preference}"
        hotels = HotelSearchService().search_hotels(query, trip.destination, limit=request.max_results)
        if hotel_type != "any":
            hotels = [hotel for hotel in hotels if hotel["hotel_type"] == hotel_type]
        nights = max(1, (trip.end_date - trip.start_date).days)
        for hotel in hotels:
            hotel.update(nights=nights, rooms=request.rooms)
        return HotelAgentResponse(
            trip_id=trip.id, destination=trip.destination, nights=nights, rooms=request.rooms,
            summary=("Accommodation found by location. Confirm prices and availability with the property."
                     if hotels else "No verified accommodation found. Try another search or area."),
            recommended_hotels=hotels,
        )
