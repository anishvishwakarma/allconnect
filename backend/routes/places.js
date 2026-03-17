const express = require('express');

const router = express.Router();

// GET /api/places/search?q=
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) {
      return res.status(400).json({ error: 'q is required' });
    }
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_PLACES_API_KEY not set');
      return res.status(503).json({ error: 'Places search unavailable' });
    }

    // Use Places API (New): https://places.googleapis.com/v1/places:searchText
    const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: q,
      }),
    });
    if (!resp.ok) {
      console.error('places/search http', resp.status, await resp.text().catch(() => ''));
      return res.status(502).json({ error: 'Places search failed' });
    }
    const json = await resp.json();
    if (!json || !Array.isArray(json.places)) {
      console.error('places/search bad payload', json);
      return res.status(502).json({ error: 'Places search failed' });
    }

    const suggestions = json.places
      .slice(0, 8)
      .map((p) => {
        const loc = p.location || {};
        return {
          id: p.id || p.name || '',
          title: (p.displayName && p.displayName.text) || '',
          address: p.formattedAddress || '',
          lat: typeof loc.latitude === 'number' ? loc.latitude : null,
          lng: typeof loc.longitude === 'number' ? loc.longitude : null,
        };
      })
      .filter((s) => s.lat != null && s.lng != null && s.title);

    return res.json(suggestions);
  } catch (err) {
    console.error('places/search', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

