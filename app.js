// app.js - cPanel / CloudLinux Passenger Entrypoint
require('dotenv').config();

try {
  require('./dist/observability/tracing/instrumentation.js');
} catch (err) {
  // Graceful fallback if tracing is disabled
}

require('./dist/index.js');
