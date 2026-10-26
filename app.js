// app.js - cPanel / CloudLinux Passenger Entrypoint
if (typeof PhusionPassenger !== 'undefined') {
  process.env.PASSENGER_MODE = 'true';
}

require('dotenv').config();

try {
  require('./dist/observability/tracing/instrumentation.js');
} catch (err) {
  // Graceful fallback if tracing is disabled
}

require('./dist/index.js');
