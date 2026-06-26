# Etapa 1: BUILD
# Usamos la imagen oficial de Node 20 (Alpine para que sea ligera).
# Aquí instalamos dependencias y compilamos la app React con Vite.
FROM node:20-alpine AS build

# Directorio de trabajo dentro del contenedor.
WORKDIR /app

# Copiamos primero SOLO los manifests de dependencias para aprovechar
# la caché de Docker: si no cambian package*.json, no reinstalamos.
COPY package.json package-lock.json* ./

# npm ci: instalación reproducible y determinista desde el lockfile
# (antes 'npm install' podía resolver versiones distintas y romper
# reproducibilidad de builds).
RUN npm ci --no-audit --no-fund

# Copiamos el resto del código fuente.
COPY . .

# Compilamos la app a estáticos en /app/dist
RUN npm run build

# Etapa 2: SERVE
# Servimos los estáticos con nginx-unprivileged (no corre como root,
# más seguro que nginx:alpine que arranca el master como root).
FROM nginxinc/nginx-unprivileged:alpine AS serve

# Copiamos la config de nginx que escucha en el puerto 9432.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los estáticos compilados desde la etapa anterior.
# --chown para que el usuario nginx (UID 101) pueda leerlos.
COPY --chown=101:101 --from=build /app/dist /usr/share/nginx/html

# nginx-unprivileged escucha por defecto en 8080; nuestra config usa 9432.
# El usuario sin privilegios puede enlazar puertos > 1024 sin problemas.
EXPOSE 9432

# Healthcheck: wget ligero para que el orquestador sepa si el contenedor
# sirve correctamente (antes no había healthcheck y restart lo ciegaba).
USER 101
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:9432/ || exit 1

# Arrancamos nginx en primer plano.
CMD ["nginx", "-g", "daemon off;"]
