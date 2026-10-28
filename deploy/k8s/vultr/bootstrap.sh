#!/usr/bin/env bash
# Run as root on a NEW Ubuntu 24.04 VM with an SSH public key installed.
# Configure the Vultr firewall first: allow 22, 80, 443; do not expose 6443.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this script as root on the new Vultr VM.' >&2
  exit 1
fi
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo 'Install an SSH public key for root before bootstrapping.' >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl sudo

# Keep the existing workflow's ubuntu SSH user and deployment directory.
if ! id ubuntu >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash ubuntu
fi
install -d -m 700 -o ubuntu -g ubuntu /home/ubuntu/.ssh
if [ ! -s /home/ubuntu/.ssh/authorized_keys ]; then
  install -m 600 -o ubuntu -g ubuntu /root/.ssh/authorized_keys /home/ubuntu/.ssh/authorized_keys
fi
printf 'ubuntu ALL=(ALL) NOPASSWD:ALL\n' > /etc/sudoers.d/lumen-ubuntu
chmod 440 /etc/sudoers.d/lumen-ubuntu
visudo -cf /etc/sudoers.d/lumen-ubuntu

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
fi
if ! swapon --show=NAME --noheadings | grep -qx /swapfile; then
  swapon /swapfile
fi
if ! grep -q '^/swapfile ' /etc/fstab; then
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi

# k3s needs pod/service traffic when the image already enables UFW.
if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow from 10.42.0.0/16 to any
  ufw allow from 10.43.0.0/16 to any
fi

curl -fsSL https://get.k3s.io -o /tmp/lumen-install-k3s.sh
sh /tmp/lumen-install-k3s.sh --write-kubeconfig-mode 640 --write-kubeconfig-group ubuntu
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
# The node registers a few seconds after k3s starts; wait finds nothing before.
for _ in $(seq 1 60); do
  kubectl get nodes --no-headers 2>/dev/null | grep -q . && break
  sleep 3
done
kubectl wait --for=condition=Ready node --all --timeout=180s

curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 -o /tmp/lumen-install-helm.sh
bash /tmp/lumen-install-helm.sh
helm repo add kedacore https://kedacore.github.io/charts
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm upgrade --install keda kedacore/keda -n keda --create-namespace --wait --timeout 5m
helm upgrade --install cert-manager jetstack/cert-manager -n cert-manager --create-namespace \
  --set crds.enabled=true --wait --timeout 5m

echo 'Cluster ready. Apply deploy/k8s/public/cluster-issuer.yaml, then install the Lumen chart.'
