// Кодовое имя кэша для твоего бренда
const CACHE_NAME = 'whitelisa-interface-v1';

// Список тяжелых файлов интерфейса, которые нужно закешировать намертво
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './paper.png',
    './red.png'
];

// 1. Установка: скачиваем и сохраняем картинки фона и стили в кэш
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[WhiteLisa Optimizer] Кэширование элементов интерфейса...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

// 2. Активация: чистим старый кэш, если ты решишь обновить дизайн сайта
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[WhiteLisa Optimizer] Удаление старого кэша...');
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Перехват запросов: моментально отдаем бумагу и кнопки из кэша, не дергая сеть
self.addEventListener('fetch', (event) => {
    // Тяжелую 3D модель (model.glb) по ссылке Яндекса кэшировать в браузере не нужно, 
    // пускай она идет мимо этого скрипта, иначе забьет всю память телефона.
    if (event.request.url.includes('clck.ru') || event.request.url.includes('yandex')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Файл найден в памяти — отдаем его со скоростью света
                return cachedResponse;
            }
            
            // Если файла нет в списке (например, новые скрипты), качаем из сети
            return fetch(event.request);
        })
    );
});
