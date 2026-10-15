# Flutter: Google Places address suggestions

Implement address search in the Flutter customer app to match the existing web frontend. The backend autocomplete and details endpoints described below are implemented. Flutter code is maintained separately; reverse geocoding remains proposed.

## Backend activation

Set `GOOGLE_PLACES_API_KEY` in the backend environment to a server key for a billing-enabled Google Cloud project with **Places API (New)** enabled, then restart/redeploy the backend. Do not use the browser-restricted frontend key. This change does not configure Google Cloud or deploy the server.

Implemented authenticated endpoints:

- `POST /api/places/autocomplete`: body `{ "input": "Main Street", "sessionToken": "<uuid-v4>" }`.
- `POST /api/places/details`: body `{ "placeId": "<selected-place-id>", "sessionToken": "<same-uuid-v4>" }`.

Both require `Authorization: Bearer <login-token>` and `Content-Type: application/json`. They return the normalized contracts shown below. Requests are limited to 120 per minute per authenticated user across both endpoints, and upstream requests time out after 10 seconds. Missing configuration returns HTTP 503; invalid input returns 400; throttling returns 429. No extra dependency is needed; the implementation uses Node's built-in `fetch` (Node 18+).

The implemented autocomplete accepts `input` and `sessionToken`; optional language/country/location filtering below describes future extensions. It does not currently forward those options. Because Google may otherwise bias results toward the proxy server's IP, add validated device/service-area location bias if search relevance requires it.

Backend files: `backend/src/routes/placesRoutes.js`, `backend/src/services/googlePlaces.js`, and route registration in `backend/src/server.js`. Run focused verification with `node --test backend/tests/googlePlaces.test.js` from the repository root. These tests mock Google; a configured deployment still needs a live autocomplete/selection check.

## Existing frontend reference

- `frontend/src/components/LocationPicker.jsx`: search suggestions, Google Map, draggable marker, current location, and structured address parsing.
- `frontend/src/pages/Profile.jsx`: add/edit saved addresses and fill fields after selecting a location.
- `frontend/src/pages/Checkout.jsx`: choose a saved address or enter a new one, optionally save it, and submit its coordinates with the booking.
- `backend/src/models/User.js`: saved address schema.
- `backend/src/controllers/authController.js`: existing address persistence in `updateMe`.

The web component uses the JavaScript Places widget. For Flutter, use **Places API (New)** through authenticated backend endpoints, with a custom suggestions list. Do not copy the browser SDK initialization into Flutter.

## Expected screen and behavior

1. Show a **Use current location** button and a search field with placeholder **Search address on map…**.
2. After at least three trimmed characters, debounce input for about 300 ms and show Google place suggestions below the field. This threshold is an app choice.
3. Show each suggestion's main text and secondary address. Include loading, empty, retry, and error states.
4. On selection, fetch Place Details, dismiss the keyboard/list, populate the address fields, and center the map at the returned coordinates with zoom around 16.
5. Keep address line, city, state, and ZIP/postal code editable. Keep building/floor and optional street as separate user-entered fields, matching the frontend. Google cannot reliably supply apartment/floor information.
6. Allow dragging the marker and reverse-geocode its new position. Current location should also reverse-geocode the device coordinates.
7. Show label choices such as Home, Office, Work, Other; default-address control; and Save. At checkout show saved-address selection and an optional **Save this address to my profile** control.

When a new place is selected, replace location-derived fields, including clearing missing city/state/postal values. Do not retain a previous place's postal code. Preserve user-entered building/floor and label. If the user changes the search query after selection, invalidate the old selected coordinates until a new place is selected. Changes to apartment/floor alone do not invalidate the location.

## Google Cloud and Flutter setup

1. Configure a Google Cloud project with billing and enable **Places API (New)**.
2. Enable **Geocoding API** for reverse geocoding. Enable **Maps SDK for Android** and/or **Maps SDK for iOS** for the map preview.
3. Store the Places/Geocoding server key in a backend secret such as `GOOGLE_PLACES_API_KEY`. Restrict it to the required APIs and backend egress IPs where supported. Do not put this server key in Dart, app assets, or a Flutter `--dart-define`.
4. Configure separate mobile map keys with Android package/signing-certificate restrictions and iOS bundle-ID restrictions. Restrict these keys to their respective Maps SDKs; keep them separate from the web frontend key.
5. Add Flutter dependencies using `flutter pub add http uuid google_maps_flutter geolocator`. Use the versions compatible with the Flutter project's SDK and follow each package's platform setup. Reuse the app's existing HTTP/location packages if appropriate.
6. Configure Android network access and Android/iOS foreground location permission descriptions for **Use current location**. Request permission when the button is tapped. Address typing does not require location permission or background location access.

A backend proxy keeps the Places web-service key off the mobile device. Authenticate requests, rate-limit per user, validate input, set upstream timeouts, and avoid logging keys or complete search text. See [Google's API security guidance](https://developers.google.com/maps/api-security-best-practices).

## Backend endpoint contracts

Use the backend base URL ending in `/api`. Autocomplete and details are implemented; the reverse-geocode endpoint is a proposal. All require the existing bearer authentication middleware and JSON content type.

### POST /places/autocomplete

Flutter request:

```json
{
  "input": "123 Main",
  "sessionToken": "unique-uuid-for-this-search-session"
}
```

Backend calls:

```http
POST https://places.googleapis.com/v1/places:autocomplete
Content-Type: application/json
X-Goog-Api-Key: <server-key>
X-Goog-FieldMask: suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat
```

Forward `input` and `sessionToken`. Keep query predictions disabled, since this flow needs a selectable place ID. Optionally add `languageCode`, a location bias, or `includedRegionCodes` based on the app's actual service area. The current frontend has no country restriction; do not silently restrict the Flutter app to India. Do not send both `locationBias` and `locationRestriction`.

The backend normalizes the upstream response into this app contract:

```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "placeId": "google-place-id",
        "description": "123 Main Street, Example City",
        "mainText": "123 Main Street",
        "secondaryText": "Example City"
      }
    ]
  }
}
```

Map `placePrediction.text.text` to `description`; map `structuredFormat.mainText.text` and `structuredFormat.secondaryText.text` to the two display strings. Missing `suggestions` means an empty list. Ignore entries without a usable `placeId`.

### POST /places/details

Flutter sends `{"placeId":"google-place-id","sessionToken":"same-token-as-autocomplete"}`. Validate the place ID and encode it as a URL path segment. The backend calls:

```http
GET https://places.googleapis.com/v1/places/<encoded-place-id>?sessionToken=<encoded-token>
X-Goog-Api-Key: <server-key>
X-Goog-FieldMask: id,formattedAddress,addressComponents,location
```

Request only the fields needed by the form. Places API (New) uses `formattedAddress`, `addressComponents`, `longText`, and `location.latitude/longitude`, rather than the JavaScript widget's snake_case names. See [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details).

Normalize into:

```json
{
  "success": true,
  "data": {
    "address": "123 Main Street, Example City, Example State 12345",
    "addressLine": "123 Main Street",
    "city": "Example City",
    "state": "Example State",
    "zipcode": "12345",
    "lat": 28.6139,
    "lng": 77.209
  }
}
```

These are illustrative values. Reject details without valid coordinates and allow retry/manual entry. Autocomplete alone does not provide the coordinates needed by the booking form.

### POST /places/reverse-geocode — proposed, not implemented

Flutter sends `{"lat":28.6139,"lng":77.209}`. Validate finite numbers and latitude/longitude ranges. Backend calls the Geocoding API with `latlng` and its server key, checks both HTTP status and the API response `status`, and normalizes the chosen result to the same `data` shape as details. Return a controlled empty-result error for `ZERO_RESULTS`.

Geocoding uses `formatted_address`, `address_components`, and `long_name`; adapt these explicitly. Reverse geocoding does not use a Places autocomplete session token. On failure, preserve the previous committed address and show a retry/manual-entry message.

For all proxy endpoints, use controlled errors such as `{"success":false,"message":"Address search is temporarily unavailable"}`. Do not leak Google's request URL or credentials. Handle authentication expiry, request throttling, upstream errors, and timeouts separately in the app.

## Address component mapping

Find components by their `types`, never by array position. For city, try the following types in order; the web frontend accepts the same types but chooses the first matching component in its array.

| App field | Google component/value |
| --- | --- |
| `address` | `formattedAddress` |
| `addressLine` | Join `street_number` and `route`; fall back to formatted address when empty |
| `city` | `locality`, then `postal_town`, then `sublocality_level_1`, then `administrative_area_level_3` |
| `state` | `administrative_area_level_1` |
| `zipcode` | `postal_code`; retain as a string |
| `lat`, `lng` | `location.latitude`, `location.longitude` |
| `buildingFloor`, `street`, `label` | User-entered form values |

Missing components should produce empty strings and remain editable. Do not guess a postal code. Keep all Google-derived content within permitted use/storage limits; the existing schema's ability to store a value does not itself establish permission to retain Google content.

## Flutter state and request lifecycle

Keep this logic in an address-search controller/service shared by Profile and Checkout:

```text
query changes
  -> cancel debounce; increment request generation; clear stale selection
  -> if query shorter than 3: clear suggestions and stop
  -> after 300 ms: create session token if absent, request autocomplete
  -> apply response only if controller is alive and generation still matches

suggestion selected
  -> cancel debounce; increment generation; disable repeated selection
  -> fetch details using the current session token
  -> apply only if alive and generation still matches
  -> fill form, update marker, hide suggestions
  -> discard token when the details attempt ends; next search gets a new token

screen closed / search abandoned
  -> cancel timer, invalidate pending responses, discard session token
```

Generate tokens using `const Uuid().v4()` from `package:uuid/uuid.dart`. Use one token for all autocomplete requests in the same search and the selected Place Details call; credentials must belong to the same Cloud project. Do not reuse completed or abandoned tokens. A request generation counter should also guard against old details/reverse-geocode responses replacing newer selections. Dispose text controllers, timers, and listeners; check `mounted` before updating widget state. See [Google's session-token guide](https://developers.google.com/maps/documentation/places/web-service/using-session-tokens).

Render suggestions using `ListView`/`ListTile` beneath a `TextField` in a bounded-height container or overlay. Ensure the list stays above the map and visible when the keyboard opens. Programmatically filling the selected search text must not trigger another search or invalidate the selected coordinates.

For current location, check service availability and foreground permission, show a loading state, request a position with a timeout, then call reverse geocoding. If permission is denied or services are disabled, keep manual search usable. Request no location access for ordinary address suggestions.

## Save using the existing backend API

The existing endpoint is **PUT /api/auth/me**, with `Authorization: Bearer <login-token>` and `Content-Type: application/json`.

```json
{
  "addAddress": {
    "label": "Home",
    "buildingFloor": "Sunrise Apartments, 3rd floor",
    "street": "Main Street",
    "addressLine": "123 Main Street",
    "city": "Example City",
    "state": "Example State",
    "zipcode": "12345",
    "isDefault": true,
    "coordinates": { "lat": 28.6139, "lng": 77.209 }
  }
}
```

`addressLine` must be nonempty; `buildingFloor` and `street` have a 200-character schema limit. Coordinates are optional for manual entry. The first saved address becomes default automatically. Success is `{"success":true,"data":{"user":{...}}}`; refresh the local user/address list from `data.user` and use the saved address's `_id` for selection.

Existing operations on the same endpoint:

```json
{"updateAddress":{"id":"saved-address-id","addressLine":"Updated address"}}
```

```json
{"removeAddress":"saved-address-id"}
```

```json
{"setDefaultAddress":"saved-address-id"}
```

The schema contains an optional address `name`, but the current `addAddress` controller does not persist it. Do not promise saved nicknames without updating that controller. The current controller also checks coordinates using latitude truthiness, so latitude `0` is lost on add/update. Correct that backend check to validate both finite numbers before promising full global coordinate support; Flutter should accept valid zero latitude/longitude.

At checkout, copy the selected saved/new address into the booking's structured `address`, with nested `coordinates: {lat, lng}`. Require a contact phone as the frontend does. Map selection is optional; manual addresses remain supported. If the user changes the address identity manually, clear stale coordinates. Preserve the user's booking form if saving to their profile fails, and display that save failure separately.

## Attribution, retention, and verification

Show Google Maps attribution with the suggestion list following the current official guidelines, and do not obscure the map's attribution. Do not persist suggestion lists or raw Places responses. Review permitted retention for saved addresses and coordinates: the autocomplete end-user street-address exception is scoped to the user's specific transaction and does not cover all Google-derived data. See [Places policies and attribution](https://developers.google.com/maps/documentation/places/web-service/policies).

Verify before release:

- Typing quickly displays only suggestions for the latest query; clearing/closing prevents late updates.
- Selecting a suggestion fetches details once, fills the correct fields, and updates the map.
- New selections clear missing location fields and keep building/floor input.
- Missing postal codes, non-Latin addresses, and zero latitude/longitude behave correctly.
- Dragging the marker and current location update both form and coordinates; failed lookups preserve committed data.
- Denied location permission, offline mode, API errors, and rate limits allow retry/manual entry.
- Save, edit, default selection, and checkout use the existing nested coordinate format and returned saved `_id`.
- No server Places key is included in the Flutter build; attribution remains visible with the keyboard open.

Official API reference: [Autocomplete (New)](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places/autocomplete).
