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

    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', q);
    url.searchParams.set('key', apiKey);

    const resp = await fetch(url.toString());
    if (!resp.ok) {
      console.error('places/search http', resp.status, await resp.text().catch(() => ''));
      return res.status(502).json({ error: 'Places search failed' });
    }
    const json = await resp.json();
    if (!json || !Array.isArray(json.results)) {
      console.error('places/search bad payload', json);
      return res.status(502).json({ error: 'Places search failed' });
    }

    const suggestions = json.results.slice(0, 8).map((r) => {
      const loc = r.geometry && r.geometry.location;
      return {
        id: r.place_id || r.id || r.reference || String(r.name || ''),
        title: r.name || '',
        address: r.formatted_address || '',
        lat: loc && typeof loc.lat === 'number' ? loc.lat : null,
        lng: loc && typeof loc.lng === 'number' ? loc.lng : null,
      };
    }).filter((s) => s.lat != null && s.lng != null && s.title);

    return res.json(suggestions);
  } catch (err) {
    console.error('places/search', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

