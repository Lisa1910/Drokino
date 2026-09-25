// ==========================================================================
// 1. ИНИЦИАЛИЗАЦИЯ И СЕТАП 3D ПРОСТРАНСТВА WHITE LISA
// ==========================================================================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

// Камера с широким углом обзора и оптимизированной глубиной резкости
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(15, 12, 18);

// Рендерер со сглаживанием, прозрачностью и поддержкой мягких теней
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Защита от перегрузки GPU на 4K экранах
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Мягкие размытые тени оборудования
renderer.localClippingEnabled = true; // Глобальный переключатель для работы Section Box
container.appendChild(renderer.domElement);

// ==========================================================================
// 2. КИНЕМАТОГРАФИЧНОЕ УПРАВЛЕНИЕ КАМЕРОЙ (ЭФФЕКТ POLYCAM)
// ==========================================================================
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;          // Включаем масляную инерцию вращения
controls.dampingFactor = 0.05;          // Мягкость затухания скорости
controls.maxPolarAngle = Math.PI / 2 - 0.03; // Жесткий блок: запрет заглядывать под землю
controls.minDistance = 1.0;             // Максимальное приближение к вентилям и трубам
controls.maxDistance = 60;              // Максимальное удаление от осей здания

// ==========================================================================
// 3. СТУДИЙНОЕ ОСВЕЩЕНИЕ (ОПТИМИЗИРОВАНО ПОД СВЕТЛУЮ БУМАГУ)
// ==========================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Мягкое заполнение
scene.add(ambientLight);

const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6); // Направленный свет для теней
dirLight1.position.set(25, 45, 25);
dirLight1.castShadow = true;
dirLight1.shadow.mapSize.width = 2048; // Высокое разрешение карты теней
dirLight1.shadow.mapSize.height = 2048;
dirLight1.shadow.camera.near = 0.5;
dirLight1.shadow.camera.far = 120;
const shadowRange = 20;
dirLight1.shadow.camera.left = -shadowRange;
dirLight1.shadow.camera.right = shadowRange;
dirLight1.shadow.camera.top = shadowRange;
dirLight1.shadow.camera.bottom = -shadowRange;
dirLight1.shadow.bias = -0.0003;
scene.add(dirLight1);

const dirLight2 = new THREE.DirectionalLight(0xc2763e, 0.25); // Теплый карамельный контурный свет
dirLight2.position.set(-25, 15, -25);
scene.add(dirLight2);

// ==========================================================================
// 4. ПЕРЕМЕННЫЕ СОСТОЯНИЯ И ССЫЛКИ НА ИНТЕРФЕЙС
// ==========================================================================
let modelHeight = 5.0; // Базовая высота отсечения до вычисления габаритов кровли
const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), modelHeight); // Секущая плоскость (вниз)
let wallMaterials = []; // Массив ссылок на материалы стен для рентген-скрытия
let currentLoadedModel = null; // Ссылка на загруженную 3D-модель в сцене

// Элементы управления прелоадером
const preloader = document.getElementById('preloader-overlay');
const barFill = document.getElementById('progress-bar-fill');
const textStatus = document.getElementById('loader-text-status');
const pctStatus = document.getElementById('loader-pct-status');
const errorOverlay = document.getElementById('error-overlay');

// ==========================================================================
// 5. ПОТОКОВЫЙ АСИНХРОННЫЙ ЗАГРУЗЧИК XHR С ДИНАМИЧЕСКИМ ТРЕКИНГОМ МЕГАБАЙТ
// ==========================================================================
function initModelLoading() {
    const url = 'https://clck.ru'; // Твоя прямая маскированная ссылка на целый GLB
    const manager = new THREE.LoadingManager();
    const loader = new THREE.GLTFLoader(manager);
    
    // Создаем классический нативный XMLHTTPRequest для точного побайтового контроля
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    
    // Отслеживание прогресса скачивания 189 МБ в реальном времени
    xhr.onprogress = function(event) {
        if (event.lengthComputable) {
            // Переводим байты в Мегабайты для вывода пользователю
            const loadedMb = (event.loaded / (1024 * 1024)).toFixed(1);
            const totalMb = (event.total / (1024 * 1024)).toFixed(1);
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            
            // Обновляем прелоадер
            barFill.style.width = percentComplete + '%';
            pctStatus.innerText = percentComplete + '%';
            textStatus.innerText = `Загрузка 3D-инженерки: ${loadedMb} МБ из ${totalMb} МБ`;
        } else {
            // Если сервер Яндекса скрыл точный размер файла, считаем по факту загрузки
            const loadedMb = (event.loaded / (1024 * 1024)).toFixed(1);
            textStatus.innerText = `Потоковое скачивание модели: ${loadedMb} МБ...`;
        }
    };
    
    // Успешное завершение сетевого скачивания
    xhr.onload = function() {
        if (xhr.status === 200) {
            textStatus.innerText = 'Развертывание 3D-пространства котельной...';
            
            // Превращаем скачанный буфер в виртуальный Blob-файл в памяти устройства
            const arrayBuffer = xhr.response;
            const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
            const blobUrl = URL.createObjectURL(blob);
            
            // Передаем Blob-ссылку парсеру GLTFLoader
            loader.load(blobUrl, function(gltf) {
                currentLoadedModel = gltf.scene;
                
                // Парсим всю иерархию объектов из Revit
                currentLoadedModel.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // Внедряем плоскость обрезки Section Box в каждый материал
                        if (child.material) {
                            child.material.clippingPlanes = [ clipPlane ];
                            child.material.clipShadows = true;
                            
                            // Защита: делаем внутренние грани стен видимыми при разрезе
                            child.material.side = THREE.DoubleSide; 
                            
                            // Фильтруем архитектурные стены для управления прозрачностью
                            const meshName = child.name.toLowerCase();
                            if (meshName.includes('wall') || meshName.includes('стена')) {
                                child.material.transparent = true;
                                if (!wallMaterials.includes(child.material)) {
                                    wallMaterials.push(child.material);
                                }
                            }
                        }
                    }
                });
                // Автоматическое центрирование и расчет высоты модели
                const box = new THREE.Box3().setFromObject(currentLoadedModel);
                const center = box.getCenter(new THREE.Vector3());
                
                // Сбрасываем плавающие координаты Revit в ноль сцены
                currentLoadedModel.position.x -= center.x;
                currentLoadedModel.position.z -= center.z;
                
                // Вычисляем истинную верхнюю точку кровли здания для ползунка высоты
                modelHeight = box.max.y - box.min.y;
                clipPlane.constant = modelHeight;
                
                // Добавляем готовую модель в сцену и плавно тушим прелоадер
                scene.add(currentLoadedModel);
                preloader.style.opacity = '0';
                setTimeout(() => { preloader.style.display = 'none'; }, 500);
                
                URL.revokeObjectURL(blobUrl); // Освобождаем ОЗУ устройства от Blob-копии
                console.log('[WhiteLisa] Проект успешно развернут в облаке.');
            }, undefined, function(error) {
                console.error("Критическая ошибка парсинга GLB:", error);
                showSystemError("Ошибка интерпретации 3D-геометрии. Переэкспортируйте файл.");
            });
        } else {
            showSystemError(`Сбой сервера хранения данных. Статус ответа: ${xhr.status}`);
        }
    };
    
    xhr.onerror = function() {
        showSystemError("Ошибка сети CORS. Доступ к Яндекс Диску заблокирован правилами безопасности браузера.");
    };
    
    xhr.send();
}

// Вывод системного окна ошибок на экран
function showSystemError(message) {
    document.getElementById('error-message-text').innerText = message;
    errorOverlay.style.display = 'flex';
    preloader.style.display = 'none';
}

// Запуск потока скачивания при загрузке страницы
initModelLoading();

// ==========================================================================
// 6. СИНХРОНИЗАЦИЯ ПОЛЗУНКОВ ИНТЕРФЕЙСА (ЗАЩИТА ОТ ПАДЕНИЙ)
// ==========================================================================
const clipSlider = document.getElementById('clip-slider');
const clipValText = document.getElementById('clip-val');

clipSlider.addEventListener('input', (e) => {
    let pct = e.target.value;
    clipValText.innerText = pct + '%';
    // Защита от NaN: проверка готовности вычисления высоты здания
    if (modelHeight) {
        clipPlane.constant = (pct / 100) * modelHeight;
    }
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

// ==========================================================================
// 7. ЛОГИКА ИНТЕРАКТИВНЫХ КНОПОК ПАНЕЛИ WHITE LISA
// ==========================================================================

// Кнопка «Открыть проект» — Полный аппаратный сброс параметров и камер
document.getElementById('btn-load-model').addEventListener('click', () => {
    controls.reset();
    camera.position.set(12, 10, 15);
    
    // Возвращаем секущую плоскость на 100% высоты
    clipSlider.value = 100;
    clipPlane.constant = modelHeight;
    clipValText.innerText = '100%';
    
    // Возвращаем стенам полную непрозрачность
    opacitySlider.value = 0;
    opacityValText.innerText = '0%';
    wallMaterials.forEach(mat => { mat.opacity = 1; });
    
    console.log('[WhiteLisa UI] Координаты сцены успешно сброшены к исходным.');
});

// Управление модальным окном PDF-чертежей
const pdfOverlay = document.getElementById('pdf-overlay');
document.getElementById('btn-view-pdf').addEventListener('click', () => {
    pdfOverlay.style.display = 'flex';
});

document.getElementById('btn-close-pdf').addEventListener('click', () => {
    pdfOverlay.style.display = 'none';
});

// ==========================================================================
// 8. СИСТЕМНЫЙ ЦИКЛ РЕНДЕРИНГА И АДАПТАЦИЯ ЭКРАНА
// ==========================================================================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Постоянный цикл обновления кадров (60 FPS)
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Плавное масляное затухание OrbitControls
    renderer.render(scene, camera);
}

animate();
