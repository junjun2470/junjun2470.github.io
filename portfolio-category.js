// 全局变量
let currentCategory = null;
let currentImages = [];
let filteredImages = [];
let currentImageIndex = 0;
let zoomLevel = 1;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };
let touchStart = { x: 0, y: 0 };
let isZoomed = false;

/**
 * 深浅模式切换功能
 */
function initThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;

    // 避免重复初始化
    if (window.themeToggleInitialized) {
        return;
    }
    window.themeToggleInitialized = true;

    // 从 localStorage 读取保存的模式，默认为深色模式
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);

    // 切换按钮点击事件
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // 监听 storage 事件实现页面间同步
    window.addEventListener('storage', (e) => {
        if (e.key === 'theme' && e.newValue) {
            applyTheme(e.newValue);
        }
    });
}

/**
 * 应用主题
 * @param {string} theme - 'dark' 或 'light'
 */
function applyTheme(theme) {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;

    if (theme === 'light') {
        document.body.classList.add('light-mode');
        themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
    } else {
        document.body.classList.remove('light-mode');
        themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
    }

    // 重新初始化 Lucide 图标
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 从URL获取分类参数
function getCategoryFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('category');
}

// 加载分类数据
async function loadCategoryData(category) {
    try {
        const response = await fetch('portfolio-data.json');
        const data = await response.json();
        
        if (data[category]) {
            currentCategory = category;
            currentImages = data[category].images;
            filteredImages = [...currentImages];
            
            // 更新页面内容
            updateCategoryHeader(data[category]);
            renderPortfolioGrid();
            
            // 等待GSAP加载完成后再初始化动画
            if (typeof gsap !== 'undefined') {
                initGSAPAnimations();
            } else {
                // 如果GSAP还没加载，等待加载完成
                window.addEventListener('load', initGSAPAnimations);
            }
        } else {
            showError('未找到该分类');
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        showError('加载数据失败，请稍后重试');
    }
}

// 更新分类头部
function updateCategoryHeader(categoryData) {
    document.title = `${categoryData.title} - JUNJUN摄影`;
    document.getElementById('category-title').textContent = categoryData.title;
    document.getElementById('category-description').textContent = categoryData.description;
    
    const headerBg = document.getElementById('header-bg');
    console.log('设置头部背景图片:', categoryData.headerImage);
    headerBg.style.backgroundImage = `url(${categoryData.headerImage})`;
    
    // 预加载背景图片
    const img = new Image();
    img.src = categoryData.headerImage;
    img.onload = () => {
        console.log('头部背景图片加载成功');
    };
    img.onerror = () => {
        console.error('头部背景图片加载失败:', categoryData.headerImage);
    };
}

// 渲染作品网格
function renderPortfolioGrid() {
    const grid = document.getElementById('portfolio-grid');
    const noResults = document.getElementById('no-results');
    
    grid.innerHTML = '';
    
    if (filteredImages.length === 0) {
        noResults.classList.remove('hidden');
        return;
    }
    
    noResults.classList.add('hidden');
    
    filteredImages.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'portfolio-item gsap-fade-in';
        item.dataset.index = index;
        
        item.innerHTML = `
            <img 
                src="${image.src}" 
                alt="${image.alt}" 
                loading="lazy"
                data-caption="${image.caption}"
            >
            <div class="overlay">
                <div class="title">${image.alt}</div>
                <div class="caption">${image.caption}</div>
            </div>
        `;
        
        item.addEventListener('click', () => openViewer(index));
        grid.appendChild(item);
    });
    
    // 初始化懒加载
    initLazyLoading();
    
    // 重新触发作品卡片动画
    initPortfolioItemAnimations();
}

// 初始化懒加载
function initLazyLoading() {
    const images = document.querySelectorAll('.portfolio-item img');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.01
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// 搜索功能
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');

const debouncedSearch = debounce((query) => {
    console.log('搜索查询:', query, '当前图片数量:', currentImages.length);
    
    if (!query.trim()) {
        filteredImages = [...currentImages];
        searchResults.style.opacity = '0';
        clearSearchBtn.classList.add('hidden');
    } else {
        const lowerQuery = query.toLowerCase();
        filteredImages = currentImages.filter(image => 
            image.alt.toLowerCase().includes(lowerQuery) ||
            image.caption.toLowerCase().includes(lowerQuery)
        );
        searchResults.textContent = `找到 ${filteredImages.length} 个结果`;
        searchResults.style.opacity = '1';
        clearSearchBtn.classList.remove('hidden');
    }
    
    console.log('过滤后图片数量:', filteredImages.length);
    renderPortfolioGrid();
}, 300);

searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
});

// 清空搜索功能
function clearSearch() {
    console.log('清空搜索，当前图片数量:', currentImages.length);
    searchInput.value = '';
    filteredImages = [...currentImages];
    searchResults.style.opacity = '0';
    clearSearchBtn.classList.add('hidden');
    console.log('清空后图片数量:', filteredImages.length);
    renderPortfolioGrid();
}

clearSearchBtn.addEventListener('click', clearSearch);

document.getElementById('reset-search').addEventListener('click', clearSearch);

// 全屏查看器
function openViewer(index) {
    currentImageIndex = index;
    zoomLevel = 1;
    isZoomed = false;
    
    const viewer = document.getElementById('fullscreen-viewer');
    const image = document.getElementById('viewer-image');
    const title = document.getElementById('viewer-title');
    const caption = document.getElementById('viewer-caption');
    const counter = document.getElementById('viewer-counter');
    
    const imageData = filteredImages[index];
    image.src = imageData.src;
    image.alt = imageData.alt;
    title.textContent = imageData.alt;
    caption.textContent = imageData.caption;
    counter.textContent = `${index + 1} / ${filteredImages.length}`;
    
    viewer.classList.remove('hidden');
    setTimeout(() => {
        viewer.classList.add('active');
    }, 10);
    
    // 预加载相邻图片
    preloadAdjacentImages(index);
    
    // 禁用页面滚动
    document.body.style.overflow = 'hidden';
}

function closeViewer() {
    const viewer = document.getElementById('fullscreen-viewer');
    viewer.classList.remove('active');
    
    setTimeout(() => {
        viewer.classList.add('hidden');
        resetZoom();
    }, 300);
    
    // 恢复页面滚动
    document.body.style.overflow = '';
}

function nextImage() {
    if (currentImageIndex < filteredImages.length - 1) {
        currentImageIndex++;
        updateViewerImage();
    }
}

function prevImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        updateViewerImage();
    }
}

function updateViewerImage() {
    const image = document.getElementById('viewer-image');
    const title = document.getElementById('viewer-title');
    const caption = document.getElementById('viewer-caption');
    const counter = document.getElementById('viewer-counter');
    
    const imageData = filteredImages[currentImageIndex];
    image.src = imageData.src;
    image.alt = imageData.alt;
    title.textContent = imageData.alt;
    caption.textContent = imageData.caption;
    counter.textContent = `${currentImageIndex + 1} / ${filteredImages.length}`;
    
    resetZoom();
    preloadAdjacentImages(currentImageIndex);
}

function preloadAdjacentImages(index) {
    // 预加载下一张
    if (index < filteredImages.length - 1) {
        const nextImg = new Image();
        nextImg.src = filteredImages[index + 1].src;
    }
    
    // 预加载上一张
    if (index > 0) {
        const prevImg = new Image();
        prevImg.src = filteredImages[index - 1].src;
    }
}

// 缩放功能
function zoomIn() {
    if (zoomLevel < 3) {
        zoomLevel = Math.min(zoomLevel + 0.5, 3);
        applyZoom();
    }
}

function zoomOut() {
    if (zoomLevel > 1) {
        zoomLevel = Math.max(zoomLevel - 0.5, 1);
        applyZoom();
    }
}

function resetZoom() {
    zoomLevel = 1;
    isZoomed = false;
    dragOffset = { x: 0, y: 0 };
    applyZoom();
}

function applyZoom() {
    const wrapper = document.getElementById('viewer-image-wrapper');
    wrapper.style.transform = `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(${zoomLevel})`;
    isZoomed = zoomLevel > 1;
}

// 拖拽功能
const viewerContainer = document.getElementById('viewer-container');

viewerContainer.addEventListener('mousedown', (e) => {
    if (!isZoomed) return;
    isDragging = true;
    dragStart = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
    viewerContainer.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging || !isZoomed) return;
    dragOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
    };
    applyZoom();
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    viewerContainer.style.cursor = isZoomed ? 'grab' : 'default';
});

// 触摸事件
viewerContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
        // 双指缩放
        const distance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        viewerContainer.dataset.pinchDistance = distance;
    }
});

viewerContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isZoomed) {
        // 单指拖拽
        const deltaX = e.touches[0].clientX - touchStart.x;
        const deltaY = e.touches[0].clientY - touchStart.y;
        dragOffset = {
            x: dragOffset.x + deltaX,
            y: dragOffset.y + deltaY
        };
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        applyZoom();
    } else if (e.touches.length === 2) {
        // 双指缩放
        const distance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const prevDistance = parseFloat(viewerContainer.dataset.pinchDistance);
        const scale = distance / prevDistance;
        zoomLevel = Math.min(Math.max(zoomLevel * scale, 1), 3);
        viewerContainer.dataset.pinchDistance = distance;
        isZoomed = zoomLevel > 1;
        applyZoom();
    }
});

viewerContainer.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1 && !isZoomed) {
        // 单指滑动切换图片
        const deltaX = e.changedTouches[0].clientX - touchStart.x;
        const threshold = 50;
        
        if (deltaX > threshold) {
            prevImage();
        } else if (deltaX < -threshold) {
            nextImage();
        }
    }
});

// 双击缩放
let lastTap = 0;
viewerContainer.addEventListener('click', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 300 && tapLength > 0) {
        // 双击
        if (isZoomed) {
            resetZoom();
        } else {
            zoomLevel = 2;
            isZoomed = true;
            applyZoom();
        }
        e.preventDefault();
    }
    lastTap = currentTime;
});

// 滚轮缩放
viewerContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
        zoomIn();
    } else {
        zoomOut();
    }
}, { passive: false });

// 键盘导航
document.addEventListener('keydown', (e) => {
    const viewer = document.getElementById('fullscreen-viewer');
    if (!viewer.classList.contains('active')) return;
    
    switch (e.key) {
        case 'ArrowLeft':
            prevImage();
            break;
        case 'ArrowRight':
            nextImage();
            break;
        case 'Escape':
            closeViewer();
            break;
        case '+':
        case '=':
            zoomIn();
            break;
        case '-':
            zoomOut();
            break;
        case '0':
            resetZoom();
            break;
    }
});

// 查看器事件绑定
document.getElementById('close-viewer').addEventListener('click', closeViewer);
document.getElementById('prev-image').addEventListener('click', prevImage);
document.getElementById('next-image').addEventListener('click', nextImage);
document.getElementById('zoom-in').addEventListener('click', zoomIn);
document.getElementById('zoom-out').addEventListener('click', zoomOut);
document.getElementById('zoom-reset').addEventListener('click', resetZoom);

// 导航栏滚动效果
function initNavbarScroll() {
    const navbar = document.querySelector('nav');
    let lastScroll = 0;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            navbar.classList.add('navbar-fixed');
        } else {
            navbar.classList.remove('navbar-fixed');
        }
        
        lastScroll = currentScroll;
    }, { passive: true });
}

// GSAP动画
function initGSAPAnimations() {
    // 分类标题动画
    const titleElement = document.getElementById('category-title');
    if (titleElement) {
        gsap.to('#category-title', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out'
        });
    }
    
    const descElement = document.getElementById('category-description');
    if (descElement) {
        gsap.to('#category-description', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay: 0.2,
            ease: 'power3.out'
        });
    }
    
    // 作品卡片动画
    initPortfolioItemAnimations();
}

// 作品卡片动画（可重复调用）
function initPortfolioItemAnimations() {
    const items = document.querySelectorAll('.portfolio-item');
    console.log('initPortfolioItemAnimations 调用，找到作品卡片数量:', items.length);
    
    if (items.length === 0) return;
    
    // 先重置所有卡片的动画状态
    items.forEach(item => {
        gsap.set(item, {
            opacity: 0,
            y: 50
        });
    });
    
    // 然后触发动画
    gsap.to(items, {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out'
    });
}

// 错误处理
function showError(message) {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = `
        <div class="col-span-full text-center py-20">
            <svg class="mx-auto mb-4 text-red-500" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="m9 12 2 2 4-4"/>
            </svg>
            <p class="text-xl text-gray-400">${message}</p>
            <a href="index.html" class="mt-4 inline-block text-blue-400 hover:text-blue-300 transition-colors">返回主页</a>
        </div>
    `;
}

// 性能优化：检测低端设备并降级动画
function checkDevicePerformance() {
    const isLowEndDevice = navigator.hardwareConcurrency <= 2 || 
                           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isLowEndDevice) {
        // 减少动画复杂度
        gsap.globalTimeline.timeScale(1.5);
    }
}

// 初始化
async function init() {
    const category = getCategoryFromURL();
    
    if (!category) {
        showError('未指定分类');
        return;
    }
    
    // 初始化Lucide图标
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // 初始化深浅模式切换
    initThemeToggle();
    
    // 检查设备性能
    checkDevicePerformance();
    
    // 初始化导航栏功能（从 script.js）
    if (typeof initMobileMenu === 'function') {
        initMobileMenu();
    }
    if (typeof initSmoothScrolling === 'function') {
        initSmoothScrolling();
    }
    
    // 加载数据
    await loadCategoryData(category);
    
    // 初始化导航栏滚动效果
    initNavbarScroll();
    
    // 等待GSAP加载
    if (typeof gsap === 'undefined') {
        window.addEventListener('load', initGSAPAnimations);
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}







