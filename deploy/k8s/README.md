# lumen on Kubernetes

The chart in `lumen/` runs lumen-next as five services (identity, project,
session, worker, billing), with PostgreSQL and RabbitMQ, on one node.
`docs/platform/contract.md` says what each service owns and why.

The same chart runs on local k3d and on the public k3s host in AWS. Local k3d
is where you develop and test.

## Local: k3d

You need Docker, `k3d`, `kubectl` and `helm`.

1. Create a cluster. Map port 80 of the load balancer to port 80 here:

   ```sh
   k3d cluster create lumen -p "80:80@loadbalancer"
   ```

2. Build the image from the repository root:

   ```sh
   docker build -t lumen-next:dev .
   ```

3. Import the image into the cluster. There is no registry, and the chart
   never pulls the image:

   ```sh
   k3d image import lumen-next:dev -c lumen
   ```

4. Install KEDA. The chart uses its CRDs to scale the worker:

   ```sh
   helm repo add kedacore https://kedacore.github.io/charts
   helm install keda kedacore/keda -n keda --create-namespace --wait
   ```

   To run without KEDA, add `--set keda.enabled=false` in step 5. The worker
   then has one fixed replica.

5. Install lumen:

   ```sh
   helm upgrade --install lumen deploy/k8s/lumen -n lumen --create-namespace \
     --set image.tag=dev
   ```

   To use a model, add the key. The worker then runs `steering` in place of
   `demo`:

   ```sh
   --set-string extraSecrets.OPENAI_API_KEY=<key> \
   --set-string extraSecrets.LUMEN_MODEL_PROVIDER=openai
   ```

6. Wait until every pod is ready, then open <http://lumen.localhost>:

   ```sh
   kubectl -n lumen get pods -w
   ```

After a rebuild, import the new image with a new tag and run step 5 with that
tag. The same tag does not restart the pods.

### What the chart makes

- Deployments and Services (port 4000, `http`): `identity`, `project`,
  `session`, `worker`, `billing`.
- HorizontalPodAutoscalers on CPU: `identity`, `project`, `billing`.
- `session` has exactly one replica. Its kernel holds running tasks in memory.
- KEDA `ScaledObject` `worker` on the queues `lumen.turns.0`, `.1` and `.2`.
- StatefulSets `postgres` and `rabbitmq`, each with a volume.
- Secret `lumen-core`: passwords and `LUMEN_INTERNAL_KEY`, generated on the
  first install and kept after that. Secret `lumen-extra`: the optional keys
  from `extraSecrets`. ConfigMap `lumen-config`: everything else.
- Traefik `IngressRoute` `lumen`: each path goes to the service that owns it.
  `/internal/*` is never routed.

### Useful commands

```sh
# The RabbitMQ management page, at http://localhost:15672 (user lumen).
kubectl -n lumen port-forward svc/rabbitmq 15672
kubectl -n lumen get secret lumen-core -o jsonpath='{.data.RABBITMQ_PASSWORD}' | base64 -d

# Watch the worker scale.
kubectl -n lumen get hpa,scaledobject -w
```

### Remove it

`helm uninstall` keeps Secret `lumen-core` and the volumes, so a new install
finds its data again. To remove everything:

```sh
helm uninstall lumen -n lumen
kubectl delete namespace lumen
k3d cluster delete lumen
```

## The literature watch (optional)

The CronJob `watch` runs the literature watch (`apps/watch`), a second app
that uses only the public API with an API key. It is off by default. It needs
a key, a published agent, and ConfigMap `watch-app`, which the chart does not
make: Helm reads only files inside the chart, and the program stays in
`apps/watch`. Make the ConfigMap and the key's Secret, then turn it on:

```sh
kubectl create configmap watch-app -n lumen --from-file=apps/watch/watch.mjs \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic watch-api-key -n lumen \
  --from-literal=LUMEN_API_KEY="$LUMEN_API_KEY"
helm upgrade --install lumen deploy/k8s/lumen -n lumen --reuse-values \
  --set watch.enabled=true
```

To make the key and publish the agent, see [apps/watch/README.md](../../apps/watch/README.md).
By default the job calls the public origin. On local k3d, `lumen.localhost`
does not reach Traefik from inside a pod, so set `watch.lumenUrl` to an
address that does.

## The public host: k3s on AWS

The demonstration runs the same chart on one EC2 instance with k3s, behind
HTTPS with a Let's Encrypt certificate. The values for that host are in
`aws/values-aws.yaml`. How the host was built, how to install KEDA and
cert-manager there, and how to stop and delete it: see
[aws/README.md](aws/README.md).
