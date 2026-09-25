// ==========================================================================
// ИНИЦИАЛИЗАЦИЯ И СЕТАП 3D СЦЕНЫ
// ==========================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Камера с широким углом обзора
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(12, 10, 15);

// Рендерер со сглаживанием, прозрачностью и поддержкой отсечения плоскостей
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.localClippingEnabled = true; // Важно для работы Section Box
container.appendChild(renderer.domElement);

// ==========================================================================
// КИНЕМАТОГРАФИЧНОЕ УПРАВЛЕНИЕ (ЭФФЕКТ POLYCAM)
// ==========================================================================
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;         // Включаем масляную инерцию
controls.dampingFactor = 0.05;         // Коэффициент плавности затухания
controls.maxPolarAngle = Math.PI / 2 - 0.03; // Запрет заглядывать под пол (отмостку)
controls.minDistance = 2;              // Максимальное приближение
controls.maxDistance = 50;             // Максимальное удаление

// ==========================================================================
// СТУДИЙНОЕ ОСВЕЩЕНИЕ
// ==========================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambientLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight1.position.set(15, 30, 15);
dirLight1.castShadow = true;
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0xd4c7b6, 0.3); // Мягкий карамельный подсвет сзади
dirLight2.position.set(-15, 10, -15);
scene.add(dirLight2);

// ==========================================================================
// ЛОГИКА ГРАНИЦЫ 3Д-ВИДА (SECTION BOX) И МАТЕРИАЛОВ
// ==========================================================================
let modelHeight = 4.5; // Базовая начальная высота модели (подстраивается под проект)
// Создаем инвертированную горизонтальную плоскость отсечения (смотрит вниз)
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), modelHeight);

let wallMaterials = []; // Сюда соберем все материалы стен для управления прозрачностью

// Инициализация загрузчика GLB моделей
const loader = new THREE.GLTFLoader();

function initModelLoading() {
    loader.load('model.glb', function(gltf) {
        const model = gltf.scene;
        
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Привязываем плоскость обрезки к каждому элементу
                child.material.clippingPlanes = [ clipPlane ];
                child.material.clipShadows = true;

                // Фильтруем материалы архитектурных стен по их имени из Revit
                const meshName = child.name.toLowerCase();
                if (meshName.includes('wall') || meshName.includes('стена') || meshName.includes('основная стена')) {
                    child.material.transparent = true;
                    child.material.side = THREE.DoubleSide; // Двухстороннее отображение при резе
                    
                    if (!wallMaterials.includes(child.material)) {
                        wallMaterials.push(child.material);
                    }
                }
            }
        });
        
        // Центрируем модель в пространстве сцены
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.x -= center.x;
        model.position.z -= center.z;
        
        // Корректируем глобальную высоту подрезки по реальным габаритам модели
        modelHeight = box.max.y;
        clipPlane.constant = modelHeight;
        
        scene.add(model);
    }, undefined, function(error) {
        console.error("Критическая ошибка загрузки 3D-модели:", error);
    });
}

// Запускаем автоматический импорт
initModelLoading();

// ==========================================================================
// ИНТЕРАКТИВНЫЕ ПОЛЗУНКИ И ИНТЕРФЕЙС
// ==========================================================================

// 1. Управление кубом разрезки (Section Box)
const clipSlider = document.getElementById('clip-slider');
const clipValText = document.getElementById('clip-val');

clipSlider.addEventListener('input', (e) => {
    let pct = e.target.value;
    clipValText.innerText = pct + '%';
    // Динамически сдвигаем константу плоскости по высоте Y
    clipPlane.constant = (pct / 100) * modelHeight;
});

// 2. Управление прозрачностью стен
const opacitySlider = document.getElementById('opacity-slider');
const opacityValText = document.getElementById('opacity-val');

opacitySlider.addEventListener('input', (e) => {
    let val = e.target.value;
    opacityValText.innerText = val + '%';
    // Плавно меняем альфа-канал у всех отфильтрованных материалов стен
    wallMaterials.forEach(mat => {
        mat.opacity = 1 - (val / 100);
    });
});

// 3. Кнопка "Открыть проект" (Сброс камеры на исходную точку)
document.getElementById('btn-load-model').addEventListener('click', () => {
    controls.reset();
    camera.position.set(12, 10, 15);
    clipSlider.value = 100;
    clipPlane.constant = modelHeight;
    clipValText.innerText = '100%';
    opacitySlider.value = 0;
    opacityValText.innerText = '0%';
    wallMaterials.forEach(mat => mat.opacity = 1);
});

// 4. Логика выплывающего окна просмотра PDF чертежей
const pdfOverlay = document.getElementById('pdf-overlay');
document.getElementById('btn-view-pdf').addEventListener('click', () => {
    pdfOverlay.style.display = 'flex';
});
document.getElementById('btn-close-pdf').addEventListener('click', () => {
    pdfOverlay.style.display = 'none';
});

// ==========================================================================
// СИСТЕМНЫЙ ЦИКЛ И АДАПТАЦИЯ ЭКРАНА
// ==========================================================================
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Постоянный цикл рендеринга (Анимация кадров)
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Важно для отработки плавного затухания OrbitControls
    renderer.render(scene, camera);
}

animate();
