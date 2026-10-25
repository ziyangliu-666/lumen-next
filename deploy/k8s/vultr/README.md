# Lumen ASS on Vultr

Run the existing five-service Helm chart on one Ubuntu VM with k3s. No AWS
SDK, ECR, RDS, EBS driver or managed Kubernetes service is needed. PostgreSQL,
RabbitMQ and worker files use k3s local-path storage on this VM.

## Provision a separate host

The live host (`lumen-ass`, 139.180.185.51) is Singapore (`sgp`), Ubuntu
24.04 x64 (`os_id` 2284), Cloud Compute `vc2-2c-4gb`: 2 vCPU, 4 GB RAM,
80 GB SSD, USD 20/month on 25 October 2026. This is the smallest plan that
works. `vc2-1c-2gb` (USD 10) was tried first: during the first install it
swapped about 500 MB, the one CPU stayed at 100%, the k3s API timed out and
Helm was left in `pending-install`. Vultr can resize up in place, keeping
the IP, but cannot resize down. Confirm the current price before creating a
host. A powered-off Vultr
VM still incurs charges; stopping it at night does not save the instance fee.

Create a dedicated SSH key entry using the public half of the existing
Lumen deploy key, and attach it at creation. Keep private keys outside this
repository. Configure a dedicated Vultr firewall group with inbound TCP 22,
80 and 443 only. The GitHub-hosted deploy runner needs SSH access; restricting
22 to a laptop IP alone prevents CI deployment. Never expose 6443, PostgreSQL
or RabbitMQ. Leave any existing FastMM instance unchanged.

After creating the VM, run from the repository root:

```sh
export LUMEN_HOST=<new-public-ip>
export LUMEN_SSH_KEY="$HOME/.ssh/lumen-platform"
ssh -i "$LUMEN_SSH_KEY" "root@$LUMEN_HOST" bash -s < deploy/k8s/vultr/bootstrap.sh
ssh -i "$LUMEN_SSH_KEY" "ubuntu@$LUMEN_HOST" \
  'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl get nodes'
```

The bootstrap script creates the workflow's `ubuntu` user with the installed
public key, adds 2 GB swap, and installs k3s, Helm 3, KEDA and cert-manager.
It grants that deployment user sudo access and cluster administration; use a
dedicated deployment key. Verify the SSH host key through the Vultr console
before accepting the first connection.

## First deployment

Build for the VM's x64 architecture, import the image and copy the chart:

```sh
export LUMEN_TAG=$(git rev-parse HEAD)
export LUMEN_NAME="lumen.${LUMEN_HOST//./-}.sslip.io"
docker build --platform linux/amd64 -f deploy/k8s/Dockerfile -t "lumen-next:$LUMEN_TAG" .
docker save "lumen-next:$LUMEN_TAG" | \
  ssh -i "$LUMEN_SSH_KEY" "ubuntu@$LUMEN_HOST" sudo k3s ctr images import -
scp -i "$LUMEN_SSH_KEY" -r deploy/k8s "ubuntu@$LUMEN_HOST:lumen-k8s"
ssh -i "$LUMEN_SSH_KEY" "ubuntu@$LUMEN_HOST" \
  'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl apply -f lumen-k8s/public/cluster-issuer.yaml'
ssh -i "$LUMEN_SSH_KEY" "ubuntu@$LUMEN_HOST" \
  "KUBECONFIG=/etc/rancher/k3s/k3s.yaml helm upgrade --install lumen lumen-k8s/lumen \
    -n lumen --create-namespace -f lumen-k8s/public/values.yaml \
    --set ingress.host=$LUMEN_NAME --set image.tag=$LUMEN_TAG --wait --timeout 10m"
```

This starts the demo worker. The deploy workflow can supply the existing
GitHub `OPENAI_API_KEY` secret for the real steering worker. Never put model
keys into committed values files or command logs.

Verify all pods, the certificate, HTTPS, sign-in and one complete task:

```sh
ssh -i "$LUMEN_SSH_KEY" "ubuntu@$LUMEN_HOST" \
  'KUBECONFIG=/etc/rancher/k3s/k3s.yaml kubectl -n lumen get pods,pvc,certificate'
curl --fail --retry 12 --retry-delay 10 --retry-all-errors "https://$LUMEN_NAME/api/health"
```

For local administration, copy the kubeconfig into a private file and tunnel
the API over SSH, as in the AWS runbook. If local port 6443 is busy, select a
different tunnel port and update the copied kubeconfig. Do not publish it.

## Data migration and CI cutover

A new cluster starts with empty data. If the suspended AWS account prevents
SSH or disk access, old accounts, projects and files cannot be recovered by
deploying to Vultr. Keep the old instance and volumes until access or a backup
is available; do not delete AWS resources as part of this deployment.

If the old host is accessible, stop new work and finish or drain pending turns
before taking a consistent PostgreSQL dump and worker-volume archive. Preserve
the `lumen-core` secret and optional encryption/model secrets in private
backups. Restore the database and files before allowing writes on Vultr, and
verify user/project data. Do not copy a live PostgreSQL data directory or
blindly replay pending RabbitMQ jobs. An approved fresh demo deployment can
skip the restore, but it does not contain old data.

Only after the new host passes the checks, update GitHub Actions secret
`PLATFORM_SSH_HOST` to the new IP. Keep `PLATFORM_SSH_KEY` if the same Lumen
key was installed; otherwise update it from the private key file. The workflow
uses `deploy/k8s/public/values.yaml` on either provider. Push the reviewed
changes to `ass/platform`, then verify the complete Platform deploy workflow.
Changing the host secret switches subsequent deployments; keep it pointed at
AWS until the new host is ready. Update OAuth callbacks, Stripe webhook URLs
and any links to the old sslip.io host if those integrations are enabled.

## Billing and backups

The VM's main IP stays with that instance. Recreating it may change the IP and
sslip.io name. All three volumes are on its local disk: take private off-host
backups of PostgreSQL, worker files and the required secrets. Deleting or
reinstalling the VM can lose all of them. Vultr bills stopped VMs until they
are destroyed; destruction needs a separate decision after backups are checked.

References: [Vultr plans API](https://api.vultr.com/v2/plans?type=vc2),
[stopped-instance billing](https://docs.vultr.com/support/platform/billing/are-stopped-instances-still-billed-on-vultr),
[k3s requirements](https://docs.k3s.io/installation/requirements).
