import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { handleGuideRequest } from './guideService'
import { handleGetPosition, handleUpdatePosition, handleGetGridSquare } from './positionService'
import { handleApiGuide } from './apiGuide'
import { SERVER_CONFIG } from "./utils/config";
import { getLocalIpAddress } from './utils/url'
import { cors } from 'hono/cors'
import { handleGetFingerprints } from './fingerprintService'

const app = new Hono()
const port = SERVER_CONFIG.PORT

// CORS middleware
app.use('*', cors({
  origin: (origin) => {
    // Allow any origin in development
    if (SERVER_CONFIG.IS_LOCAL_NETWORK) return origin;

    // In production, allow specific origins
    const allowedOrigins = [
      '*'
    ];

    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Accept'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600,
  credentials: false,
}))

app.use('*', async (c, next) => {
  await next();

  // If there's a redirect
  const location = c.res.headers.get('location');
  if (location && location.startsWith('http://')) {
    // Force HTTPS for redirects
    c.res.headers.set('location', location.replace('http://', 'https://'));
  }
});

app.get('/health/', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: SERVER_CONFIG.IS_LOCAL_NETWORK ? 'development' : 'production'
  })
})

// Root route - API Guide
app.get('/', handleApiGuide)

// Serve static files
app.use('/maps/*', serveStatic({
  root: 'static/',
  onNotFound: (path, c) => {
    console.log(`${path} is not found, you access ${c.req.path}`)
  }
}));

app.use('/waypoints/*', serveStatic({
  root: 'static',
  onNotFound: (path, c) => {
    console.log(`${path} not found when accessing ${c.req.path}. Full path: ${c.req.url}`)
  }
}));

// routes from external files
app.get('/guide/', handleGuideRequest)

// simulatedPosition routes
app.get('/simulatedPosition', handleGetPosition);
app.get('/simulatedPosition/', handleGetPosition);
app.post('/simulatedPosition', handleUpdatePosition);
app.post('/simulatedPosition/', handleUpdatePosition);

// GridSquare route
app.get('/simulatedPosition/gridSquare', handleGetGridSquare);
app.get('/simulatedPosition/gridSquare/', handleGetGridSquare);

// Fingerprint data route
app.get('/fingerprints', handleGetFingerprints)
app.get('/fingerprints/', handleGetFingerprints)

app.onError((err, c) => {
  console.error(`Error handling request to ${c.req.url}:`, err);
  return c.json({
    error: {
      message: 'Internal Server Error',
      status: 500
    }
  }, 500)
})

serve({
  fetch: app.fetch,
  port,
  hostname: '::',  // This enables IPv6 support
})

// Log startup information
if (SERVER_CONFIG.IS_LOCAL_NETWORK) {
  const localIp = getLocalIpAddress()
  console.log('Server is running on:')
  console.log(`- Local: http://localhost:${SERVER_CONFIG.PORT}`)
  console.log(`- Network: http://${localIp}:${SERVER_CONFIG.PORT}`)
  console.log(`- IPv6: http://[::]:${SERVER_CONFIG.PORT}`)
} else {
  console.log(`Server is running on port ${port} with IPv6 support`)
  console.log(`Service should be available at: http://${process.env.RAILWAY_SERVICE_NAME}.railway.internal:${port}`)
}