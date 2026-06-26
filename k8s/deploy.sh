#!/usr/bin/env bash
# Despliega el juego en Kubernetes (clúster local con kubectl configurado).
# Uso:
#   ./k8s/deploy.sh              # construye imagen + carga en kind/minikube + aplica manifiestos
#   ./k8s/deploy.sh --no-build   # solo aplica manifiestos (imagen ya construida)
#   ./k8s/deploy.sh --port-forward  # además hace port-forward para probar local
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE="modern-warfare-react:latest"
NAMESPACE="modern-warfare"

BUILD=true
PORT_FORWARD=false
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=false ;;
    --port-forward) PORT_FORWARD=true ;;
    *) echo "Arg desconocido: $arg"; exit 1 ;;
  esac
done

echo "==> Namespace objetivo: $NAMESPACE"

if $BUILD; then
  echo "==> Construyendo imagen Docker..."
  docker build -t "$IMAGE" "$REPO_ROOT"
fi

# Cargar la imagen en el runtime del clúster (kind/minikube/desk
# corren Docker por debajo; si usas un clúster remoto, haz docker push
# a tu registry y actualiza kustomization.yaml con images:).
if command -v kind >/dev/null 2>&1; then
  echo "==> Cargando imagen en kind..."
  kind load docker-image "$IMAGE"
elif command -v minikube >/dev/null 2>&1; then
  echo "==> Cargando imagen en minikube..."
  minikube image load "$IMAGE"
else
  echo "==> No se detectó kind/minikube. Si usas un clúster remoto,"
  echo "    haz 'docker push' a tu registry y actualiza kustomization.yaml."
fi

echo "==> Aplicando manifiestos..."
if command -v kubectl >/dev/null 2>&1; then
  kubectl apply -k "$SCRIPT_DIR"
  echo "==> Esperando a que los pods estén listos..."
  kubectl -n "$NAMESPACE" rollout status deployment/modern-warfare --timeout=120s
  echo "==> Pods:"
  kubectl -n "$NAMESPACE" get pods -o wide
  echo "==> Service:"
  kubectl -n "$NAMESPACE" get svc
else
  echo "kubectl no encontrado. Instálalo y configura tu kubeconfig."
  exit 1
fi

if $PORT_FORWARD; then
  echo "==> Port-forward http://localhost:9432 (Ctrl+C para parar)..."
  kubectl -n "$NAMESPACE" port-forward svc/modern-warfare 9432:9432
fi
