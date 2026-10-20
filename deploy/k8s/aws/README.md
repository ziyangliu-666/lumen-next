# The public host on AWS

One EC2 instance runs k3s, and k3s runs the chart in `deploy/k8s/lumen`.
`docs/platform/contract.md` ("Public deployment") gives the reasons for each
choice.

Do not write real IP addresses, keys or account ids into this repository. The
commands below use placeholders in angle brackets.

## The host

| Part | Value |
|---|---|
| Instance | `t3.medium` (2 vCPU, 4 GB), Ubuntu 24.04, region `ap-southeast-1` |
| Disk | 20 GB gp3 |
| Swap | 2 GB swap file |
| Address | An Elastic IP. Host name `lumen.<ip-with-dashes>.sslip.io` |
| Security group | 22 (SSH), 80 and 443 open. 6443 closed |

### 1. Create the instance

```sh
export AWS_REGION=ap-southeast-1

aws ec2 create-security-group --group-name lumen-host \
  --description "lumen public host"
aws ec2 authorize-security-group-ingress --group-name lumen-host \
  --protocol tcp --port 22 --cidr <your-ip>/32
aws ec2 authorize-security-group-ingress --group-name lumen-host \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-name lumen-host \
  --protocol tcp --port 443 --cidr 0.0.0.0/0

aws ec2 run-instances \
  --image-id <ubuntu-24.04-amd64-ami-id> \
  --instance-type t3.medium \
  --key-name <key-pair-name> \
  --security-groups lumen-host \
  --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3}' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=lumen-host}]'

aws ec2 allocate-address
aws ec2 associate-address --instance-id <instance-id> --allocation-id <allocation-id>
```

Find the current Ubuntu AMI id with:

```sh
aws ssm get-parameter --query Parameter.Value --output text \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id
```

### 2. Add swap

```sh
ssh ubuntu@<elastic-ip>
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Install k3s and Helm

k3s ships Traefik, local-path storage and metrics-server, the same as k3d.
`--write-kubeconfig-mode 644` lets the `ubuntu` user run `kubectl` and `helm`
without `sudo`.

```sh
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644
echo 'export KUBECONFIG=/etc/rancher/k3s/k3s.yaml' >> ~/.bashrc
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
kubectl get nodes

curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### 4. Reach the cluster from a laptop

The Kubernetes API is never public. Use an SSH tunnel:

```sh
scp ubuntu@<elastic-ip>:/etc/rancher/k3s/k3s.yaml ~/.kube/lumen-aws.yaml
ssh -N -L 6443:localhost:6443 ubuntu@<elastic-ip> &
KUBECONFIG=~/.kube/lumen-aws.yaml kubectl get nodes
```

The copied file already points at `https://127.0.0.1:6443`, which is the
tunnel.

## Install KEDA and cert-manager

Install both once, before the chart. The chart only uses their CRDs.

```sh
helm repo add kedacore https://kedacore.github.io/charts
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install keda kedacore/keda -n keda --create-namespace --wait

helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace \
  --set crds.enabled=true --wait
```

Then apply the ClusterIssuer. Replace the email in the file first:

```sh
kubectl apply -f deploy/k8s/aws/cluster-issuer.yaml
```

## Install lumen

Import the image into the k3s containerd. There is no registry pull in the
chart:

```sh
docker save lumen-next:<tag> | ssh ubuntu@<elastic-ip> sudo k3s ctr images import -
```

Then install. `ingress.host` is set here, never in the values file:

```sh
helm upgrade --install lumen deploy/k8s/lumen -n lumen --create-namespace \
  -f deploy/k8s/aws/values-aws.yaml \
  --set ingress.host=lumen.<ip-with-dashes>.sslip.io \
  --set image.tag=<tag> \
  --set-string extraSecrets.OPENAI_API_KEY=<low-limit-key> \
  --set-string extraSecrets.LUMEN_MODEL_PROVIDER=openai
```

Leave out the two `extraSecrets` lines to run the demo worker without a model.

Check the certificate. It becomes `Ready` within a minute or two:

```sh
kubectl -n lumen get certificate lumen-tls
```

Port 80 redirects to HTTPS, except `/.well-known/acme-challenge/`, which
cert-manager needs for the HTTP-01 challenge and for each renewal.

## Stop and start the instance

Stop it at night to save money. The Elastic IP stays, so the host name and the
certificate stay valid.

```sh
aws ec2 stop-instances --instance-ids <instance-id>
aws ec2 start-instances --instance-ids <instance-id>
aws ec2 describe-instances --instance-ids <instance-id> \
  --query 'Reservations[0].Instances[0].State.Name'
```

k3s starts again with the instance, and so do the pods.

## Delete everything

Do this after the grades are out. An Elastic IP that is not released still
costs money.

```sh
aws ec2 terminate-instances --instance-ids <instance-id>
aws ec2 wait instance-terminated --instance-ids <instance-id>
aws ec2 release-address --allocation-id <allocation-id>
aws ec2 delete-security-group --group-name lumen-host
```

The gp3 volume is deleted with the instance (the default for the root volume).
Check that nothing is left:

```sh
aws ec2 describe-volumes --filters Name=status,Values=available
aws ec2 describe-addresses
```
