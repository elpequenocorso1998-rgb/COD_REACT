# Etapa 1: BUILD
# Usamos la imagen oficial de Node 20 (Alpine para que sea ligera).
# Aquí instalamos dependencias y compilamos la app React con Vite.
FROM node:20-alpine AS build

# Directorio de trabajo dentro del contenedor.
WORKDIR /app

# Copiamos primero SOLO los manifests de dependencias para aprovechar
# la caché de Docker: si no cambian package*.json, no reinstalamos.
COPY package.json package-lock.json* ./

# Instalamos todas las dependencias (incluidas las de desarrollo,
# porque necesitamos Vite para compilar).
RUN npm install --no-audit --no-fund

# Copiamos el resto del código fuente.
COPY . .

# Compilamos la app a estáticos en /app/dist
RUN npm run build

# Etapa 2: SERVE
# Servimos los estáticos con nginx:alpine (imagen final muy ligera).
# En desarrollo también podríamos usar 'npm run dev', pero servir
# estáticos con nginx es más realista y rápido para producción.
FROM nginx:alpine AS serve

# Copiamos la config de nginx que escucha en el puerto 9432.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiamos los estáticos compilados desde la etapa anterior.
COPY --from=build /app/dist /usr/share/nginx/html

# Exponemos el puerto solicitado por el usuario.
EXPOSE 9432

# Arrancamos nginx en primer plano.
CMD ["nginx", "-g", "daemon off;"]
