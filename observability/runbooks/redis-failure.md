# Redis Failure

1. Check `GET /health/ready` and the Redis exporter target.
2. Run `docker compose logs --since=15m redis` and inspect memory, evictions, and connected clients.
3. Determine whether the affected path is cache-only, Socket.IO adapter, or BullMQ.
4. Restore Redis or restart only the failed container; avoid deleting data without an approved recovery step.
5. Confirm queue workers, Socket.IO connections, and API error rate recover.
