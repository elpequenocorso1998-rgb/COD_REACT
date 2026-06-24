import * as THREE from 'three'

/* =========================================================================
   Generación de environment map procedural.
   --------------------------------------------------------------------------
   Sin un environment map, los materiales PBR (metalness > 0) se ven negros
   o planos porque no tienen nada que reflejar. Generamos un cubemap
   procedural a partir del cielo + sol y lo convertimos a PMREM
   (Prefiltered Mipmap Radiance Environment Map) para que los materiales
   MeshStandardMaterial lo usen automáticamente como `scene.environment`.
   ========================================================================= */
export function createEnvironment(scene, renderer) {
  // --- 1. Creamos una escena miniatura con el cielo y el sol ---
  const skyScene = new THREE.Scene()

  // Cielo con shader (mismo que el mundo).
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top:    { value: new THREE.Color(0x2a4a7a) },
      middle: { value: new THREE.Color(0xc88a5a) },
      bottom: { value: new THREE.Color(0x2a1a1a) }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 middle;
      uniform vec3 bottom;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float t = clamp(h, -1.0, 1.0);
        vec3 col;
        if (t > 0.0) col = mix(middle, top, pow(t, 0.6));
        else col = mix(middle, bottom, pow(-t, 0.5));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
  skyScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat))

  // Sol emisivo dentro de la escena del env map.
  // Misma dirección que la luz direccional y el mesh del mundo.
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(8, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0 })
  )
  sun.position.set(80, 120, 60)
  skyScene.add(sun)
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(16, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffaa50, transparent: true, opacity: 0.5 })
  )
  sunGlow.position.copy(sun.position)
  skyScene.add(sunGlow)

  // Luz direccional fake para que el env map tenga brillos definidos.
  const dl = new THREE.DirectionalLight(0xffd9a8, 2)
  dl.position.set(80, 120, 60)
  skyScene.add(dl)
  skyScene.add(new THREE.AmbientLight(0x8899aa, 0.5))

  // --- 2. Generamos el PMREM a partir de la escena del cielo ---
  const pmrem = new THREE.PMREMGenerator(renderer)
  pmrem.compileEquirectangularShader()

  // Renderizamos la escena del cielo a un target efímero.
  const cubeCam = new THREE.CubeCamera(0.1, 1000, new THREE.WebGLCubeRenderTarget(256))
  cubeCam.update(renderer, skyScene)

  // Convertimos el cubemap a PMREM (prefiltered para PBR).
  const envMap = pmrem.fromCubemap(cubeCam.renderTarget.texture).texture

  // Lo asignamos al scene.environment: TODOS los MeshStandardMaterial lo
  // usarán automáticamente para calcular reflexiones.
  scene.environment = envMap

  // Limpieza.
  pmrem.dispose()
  cubeCam.renderTarget.dispose()

  return envMap
}
