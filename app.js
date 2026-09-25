// ==========================================================================
// ИНИЦИАЛИЗАЦИЯ И СЕТАП 3D СЦЕНЫ
// ==========================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(12, 10, 15);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true; 
container.appendChild(renderer.domElement);

// КИНЕМАТОГРАФИЧНОЕ ВРАЩЕНИЕ (ПОЛИКАМ)
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;         
controls.dampingFactor = 0.05;         
controls.maxPolarAngle = Math.PI / 2 - 0.03; 

// СВЕТ
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);
const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight1.position.set(15, 30, 15);
scene.add(dirLight1);

// ЛОГИКА СЕЧЕНИЯ
let modelHeight = 4.5; 
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), modelHeight);
let wallMaterials = []; 
let currentLoadedModel = null; // Ссылка на склеенную модель для кнопки сброса

// ==========================================================================
// СУПЕР-ЗАГРУЗЧИК: СКЛЕЙКА КУСОЧКОВ МОДЕЛИ НА ЛЕТУ
// ==========================================================================
async function initModelLoading() {
    const TOTAL_CHUNKS = 8; 
    const chunks = [];
    
    try {
        console.log('[WhiteLisa 3D] Сборка инженерных сетей котельной...');
        
        for (let i = 1; i <= TOTAL_CHUNKS; i++) {
            const chunkNum = String(i).padStart(3, '0'); 
            const response = await fetch(`./model.zip.${chunkNum}`);
            
            if (!response.ok) throw new Error(`Не удалось загрузить часть ${chunkNum}`);
            
            const buffer = await response.arrayBuffer();
            chunks.push(new Uint8Array(buffer));
        }
        
        const totalLength = chunks.reduce((acc, val) => acc + val.length, 0);
        const mergedBuffer = new Uint8Array(totalLength);
        
        let offset = 0;
        for (const chunk of chunks) {
            mergedBuffer.set(chunk, offset);
            offset += chunk.length;
        }
        
        const blob = new Blob([mergedBuffer], { type: 'model/gltf-binary' });
        const blobUrl = URL.createObjectURL(blob);
        
        const loader = new THREE.GLTFLoader();
        loader.load(blobUrl, function(gltf) {
            currentLoadedModel = gltf.scene;
            
            currentLoadedModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material.clippingPlanes = [ clipPlane ];
                    child.material.clipShadows = true;

                    const meshName = child.name.toLowerCase();
                    if (meshName.includes('wall') || meshName.includes('стена') || meshName.includes('основная стена')) {
                        child.material.transparent = true;
                        child.material.side = THREE.DoubleSide; 
                        if (!wallMaterials.includes(child.material)) {
                            wallMaterials.push(child.material);
                        }
                    }
                }
            });
            
            const box = new THREE.Box3().setFromObject(currentLoadedModel);
            const center = box.getCenter(new THREE.Vector3());
            currentLoadedModel.position.x -= center.x;
            currentLoadedModel.position.z -= center.z;
            
            modelHeight = box.max.y;
            clipPlane.constant = modelHeight;
            
            scene.add(currentLoadedModel);
            URL.revokeObjectURL(blobUrl); 
            console.log('[WhiteLisa 3D] Инженерные сети успешно развернуты!');
        });
        
    } catch (error) {
        console.error("Ошибка автосборки модели из кусков:", error);
    }
}

initModelLoading();

// ==========================================================================
// ИНТЕРФЕЙС, ПОЛЗУНКИ И КНОПКИ
// ==========================================================================
const clipSlider = document.getElementById('clip-slider');
const clipValText = document.getElementById('clip-val');

clipSlider.addEventListener('input', (e) => {
    let pct = e.target.value;
    clipValText.innerText = pct + '%';
    clipPlane.constant = (pct / 100) * modelHeight;
});

const opacitySlider = document.getElementById('opacity-slider');
const opacityValText = document.getElementById('opacity-val');

opacitySlider.addEventListener('input', (e) => {
    let val = e.target.value;
    opacityValText.innerText = val + '%';
    wallMaterials.forEach(mat => {
        mat.opacity = 1 - (val / 100);
    });
});

// Кнопка "Открыть проект" — ПОЛНЫЙ РАБОЧИЙ СБРОС СИСТЕМЫ
document.getElementById('btn-load-model').addEventListener('click', () => {
    controls.reset();
    camera.position.set(12, 10, 15);
    
    // Сброс ползунка высоты (Section Box)
    clipSlider.value = 100;
    clipPlane.constant = modelHeight;
    clipValText.innerText = '100%';
    
    // Сброс прозрачности стен в исходное состояние
    opacitySlider.value = 0;
    opacityValText.innerText = '0%';
    wallMaterials.forEach(mat => {
        mat.opacity = 1;
    });
    
    console.log('[WhiteLisa UI] Положение проекта успешно центрировано.');
});

// Кнопка просмотра PDF прямо на сайте без блокировок
const pdfOverlay = document.getElementById('pdf-overlay');
const pdfFrame = document.getElementById('pdf-frame');

document.getElementById('btn-view-pdf').addEventListener('click', () => {
    // Используем встроенный и безопасный просмотрщик от Google/Mozilla, чтобы PDF открылся намертво
    const currentDomainUrl = window.location.href.replace('index.html', '');
    pdfFrame.src = `https://google.com{currentDomainUrl}document.pdf&embedded=true`;
    pdfOverlay.style.display = 'flex';
});

document.getElementById('btn-close-pdf').addEventListener('click', () => {
    pdfOverlay.style.display = 'none';
    pdfFrame.src = ''; // Чистим фрейм при закрытии
});

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update(); 
    renderer.render(scene, camera);
}
animate();
