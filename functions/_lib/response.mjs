export const jsonResponse = (payload, status = 200, meta = {}) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json; charset=utf-8',
            'X-Tech-Status': meta.status || 'live',
            'X-Tech-Updated-At': meta.updatedAt || '',
            'X-Tech-Cache': meta.cache || 'miss',
            // Provenance travels with the response so the client can badge
            // demo/sample/fallback content without re-deriving it per panel.
            'X-Tech-Source': meta.source || ''
        }
    });

export const optionsResponse = () =>
    new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
