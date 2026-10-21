# Load test and autoscaling on the public host, 20 October 2026

Target: the public HTTPS address (one t3.medium, k3s). Workers in demo mode (LUMEN_DEMO_PACE_MS=1500), so no model was called.

## k6, PROFILE=short (1 to 10 users over 30 s, hold 1 min, down over 20 s)

```
profile short, target https://lumen.54-179-112-87.sslip.io
questions 135, at rest 135, waiting over cap 0, timed out 0
time_to_rest median 6.1 s, p95 9.3 s, max 10.9 s
http requests 1040, failed 0.00 %
```

## Worker replicas and queue depth, every 10 s

Columns: time (UTC), ready/desired worker pods, then per queue name:messages in the queue (ready and unacknowledged together):of those, unacknowledged.

```
14:19:13 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:19:25 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:19:37 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:3:3 lumen.turns.0:2:2 
14:19:48 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:7:4 lumen.turns.0:5:4 
14:20:00 workers=2/2 queues=lumen.turns.2:0:0 lumen.turns.1:15:8 lumen.turns.0:9:8 
14:20:14 workers=3/3 queues=lumen.turns.2:0:0 lumen.turns.1:17:12 lumen.turns.0:10:10 
14:20:26 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:13:13 lumen.turns.0:9:9 
14:20:38 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:19:16 lumen.turns.0:10:10 
14:20:50 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:17:16 lumen.turns.0:9:9 
14:21:02 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:14:14 lumen.turns.0:9:9 
14:21:14 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:11:11 lumen.turns.0:5:5 
14:21:26 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:21:38 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:21:49 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:22:00 workers=4/4 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:22:13 workers=2/2 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:22:24 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:22:36 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:22:47 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:22:58 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:23:11 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:23:22 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:23:33 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:23:44 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:23:56 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
14:24:07 workers=1/1 queues=lumen.turns.2:0:0 lumen.turns.1:0:0 lumen.turns.0:0:0 
```

## Resources after the run

```
NAME              REFERENCE             TARGETS                            MINPODS   MAXPODS   REPLICAS   AGE
billing           Deployment/billing    cpu: 4%/70%                        1         3         1          9m32s
identity          Deployment/identity   cpu: 2%/70%                        1         3         3          9m32s
keda-hpa-worker   Deployment/worker     0/5 (avg), 0/5 (avg) + 1 more...   1         4         1          9m30s
project           Deployment/project    cpu: 2%/70%                        1         3         1          9m32s
NAME                        CPU(cores)   MEMORY(bytes)   
billing-6785c58ccf-4h26g    2m           44Mi            
identity-5cdc9cdddb-4wxkj   1m           43Mi            
identity-5cdc9cdddb-dzxqg   1m           46Mi            
identity-5cdc9cdddb-kh4md   1m           39Mi            
postgres-0                  8m           29Mi            
project-6bc8c4554f-tcghd    1m           50Mi            
rabbitmq-0                  324m         135Mi           
session-7999469c48-jxnf8    1m           55Mi            
worker-5b98d8fc94-q2cts     1m           47Mi            
Mem:           3.7Gi       2.0Gi       476Mi        54Mi       1.6Gi       1.7Gi
```
