// 性能优化：实现超高性能拖动系统
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

// 缓存DOM元素引用，避免重复查询
let imageWrapper = null;
let viewerContainer = null;

// 事件监听器绑定标志，防止重复绑定
let eventListenersBound = false;

// 高性能渲染管道
let rafId = null;
let lastTransform = null;

function getImageWrapper() {
    if (!imageWrapper) {
        imageWrapper = document.getElementById('viewer-image-wrapper');
        // 强制启用硬件加速和合成层
        imageWrapper.style.willChange = 'transform';
        imageWrapper.style.backfaceVisibility = 'hidden';
        imageWrapper.style.perspective = '1000px';
        imageWrapper.style.transform = 'translateZ(0)';
        // 创建合成层
        imageWrapper.style.transformStyle = 'preserve-3d';
    }
    return imageWrapper;
}

function getViewerContainer() {
    if (!viewerContainer) {
        viewerContainer = document.getElementById('viewer-container');
    }
    return viewerContainer;
}

// 优化的变换更新，使用requestAnimationFrame直接渲染，避免队列开销
function updateTransformImmediate(transform) {
    if (!transform) {
        transform = {
            x: dragOffset.x,
            y: dragOffset.y,
            scale: zoomLevel
        };
    }
    
    // 避免不必要的渲染
    if (lastTransform && 
        lastTransform.x === transform.x && 
        lastTransform.y === transform.y && 
        lastTransform.scale === transform.scale) {
        return;
    }
    
    lastTransform = transform;
    
    // 直接使用requestAnimationFrame渲染，避免队列开销
    if (!rafId) {
        rafId = requestAnimationFrame(() => {
            const wrapper = getImageWrapper();
            if (wrapper) {
                // 使用transform3d和scale3d确保硬件加速
                wrapper.style.transform = `translate3d(${transform.x}px, ${transform.y}px, 0) scale3d(${transform.scale}, ${transform.scale}, 1)`;
                isZoomed = transform.scale > 1;
            }
            rafId = null;
        });
    }
}

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

    // 使用 requestAnimationFrame 确保 DOM 更新是同步的
    requestAnimationFrame(() => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
        } else {
            document.body.classList.remove('light-mode');
            themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
        }

        // 更新全屏查看器的样式
        updateFullscreenViewerTheme(theme);

        // 重新初始化 Lucide 图标
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    });
}

/**
 * 更新全屏查看器的主题样式
 * @param {string} theme - 'dark' 或 'light'
 */
function updateFullscreenViewerTheme(theme) {
    const fullscreenViewer = document.getElementById('fullscreen-viewer');
    if (!fullscreenViewer) return;

    // 如果全屏查看器处于活动状态，强制更新其样式
    if (fullscreenViewer.classList.contains('active')) {
        // 触发重排以应用新的CSS变量
        fullscreenViewer.style.display = 'none';
        fullscreenViewer.offsetHeight; // 强制重排
        
        // 更新所有使用CSS变量的元素
        const viewerElements = fullscreenViewer.querySelectorAll('*');
        viewerElements.forEach(element => {
            // 强制重新计算样式
            element.style.display = 'none';
            element.offsetHeight;
            element.style.display = '';
        });
        
        fullscreenViewer.style.display = '';
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
    // 保存当前滚动位置
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    document.body.dataset.scrollPosition = scrollPosition;
    
    currentImageIndex = index;
    zoomLevel = 1;
    isZoomed = false;
    dragOffset = { x: 0, y: 0 };
    touchStart = { x: 0, y: 0 };
    isDragging = false;
    lastFrameTime = 0;
    
    // 重置缓存的DOM引用
    imageWrapper = null;
    viewerContainer = null;
    

    
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
    
    // 应用当前主题到全屏查看器
    const currentTheme = localStorage.getItem('theme') || 'dark';
    updateFullscreenViewerTheme(currentTheme);
    
    // 设置初始状态为透明和隐藏
    viewer.style.opacity = '0';
    viewer.style.visibility = 'hidden';
    viewer.classList.remove('hidden');
    
    // 使用requestAnimationFrame确保DOM更新后再添加active类
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            viewer.classList.add('active');
            // 平滑过渡到不透明和可见
            viewer.style.opacity = '1';
            viewer.style.visibility = 'visible';
        });
    });
    
    // 预加载相邻图片
    preloadAdjacentImages(index);
    
    // 禁用页面滚动，使用更强制的方法
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    
    // 保持页面在当前位置，不滚动到顶部
    document.body.style.top = `-${scrollPosition}px`;
    
    // 只绑定一次事件监听器
    if (!eventListenersBound) {
        bindViewerEventListeners();
        eventListenersBound = true;
    }
}

// 绑定全屏查看器事件监听器（只绑定一次）
function bindViewerEventListeners() {
    const container = getViewerContainer();
    if (!container) return;
    
    // 全局滚轮事件处理 - 确保全屏模式下阻止页面滚动
    const globalWheelHandler = (e) => {
        const viewer = document.getElementById('fullscreen-viewer');
        if (viewer && viewer.classList.contains('active')) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    };
    
    // 添加到文档和窗口，确保所有滚轮事件都被拦截
    document.addEventListener('wheel', globalWheelHandler, { passive: false, capture: true });
    window.addEventListener('wheel', globalWheelHandler, { passive: false, capture: true });
    
    // 保存引用以便清理
    window._viewerWheelHandler = globalWheelHandler;
    
    container.addEventListener('mousedown', (e) => {
        if (!isZoomed) return;
        isDragging = true;
        dragStart.x = e.clientX - dragOffset.x;
        dragStart.y = e.clientY - dragOffset.y;
        container.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !isZoomed) return;
        
        dragOffset.x = e.clientX - dragStart.x;
        dragOffset.y = e.clientY - dragStart.y;
        
        updateTransformImmediate();
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        const container = getViewerContainer();
        if (container) {
            container.style.cursor = isZoomed ? 'grab' : 'default';
        }
    });

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            // 只有在缩放状态下才记录触摸位置，防止未缩放时发生位移
            if (isZoomed) {
                touchStart.x = e.touches[0].clientX;
                touchStart.y = e.touches[0].clientY;
            }
        } else if (e.touches.length === 2) {
            // 计算双指距离
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            // 保存初始距离和缩放级别
            container.dataset.pinchDistance = distance;
            container.dataset.initialZoom = zoomLevel;
            
            // 计算双指中心点
            const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            container.dataset.pinchCenterX = centerX;
            container.dataset.pinchCenterY = centerY;
        }
        e.preventDefault();
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && isZoomed) {
            // 单指拖动
            const deltaX = e.touches[0].clientX - touchStart.x;
            const deltaY = e.touches[0].clientY - touchStart.y;
            
            dragOffset.x += deltaX;
            dragOffset.y += deltaY;
            
            touchStart.x = e.touches[0].clientX;
            touchStart.y = e.touches[0].clientY;
            
            updateTransformImmediate();
        } else if (e.touches.length === 2) {
            // 双指缩放 - 优化版本，保持中心点
            const distance = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            
            const prevDistance = parseFloat(container.dataset.pinchDistance);
            const initialZoom = parseFloat(container.dataset.initialZoom);
            const prevZoom = zoomLevel;
            
            // 计算当前双指中心点（相对于屏幕）
            const currentCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const currentCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            
            // 获取容器和图片包装器元素
            const containerRect = container.getBoundingClientRect();
            const wrapper = getImageWrapper();
            const wrapperRect = wrapper.getBoundingClientRect();
            
            // 计算双指中心点相对于容器的坐标
            const pinchX = currentCenterX - containerRect.left;
            const pinchY = currentCenterY - containerRect.top;
            
            // 计算中心点相对于图片内容的坐标（考虑当前偏移和缩放）
            const contentX = (pinchX - dragOffset.x - (containerRect.width - wrapperRect.width) / 2) / prevZoom;
            const contentY = (pinchY - dragOffset.y - (containerRect.height - wrapperRect.height) / 2) / prevZoom;
            
            // 计算缩放比例
            const scale = distance / prevDistance;
            const newZoomLevel = Math.min(Math.max(initialZoom * scale, 1), 2); // 最大200%
            
            // 应用新的缩放级别
            zoomLevel = newZoomLevel;
            isZoomed = zoomLevel > 1;
            
            // 计算新的包装器尺寸
            const newWrapperRect = {
                width: wrapperRect.width * (newZoomLevel / prevZoom),
                height: wrapperRect.height * (newZoomLevel / prevZoom)
            };
            
            // 计算新的偏移量，使双指中心点对应的内容保持不变
            dragOffset.x = pinchX - (containerRect.width - newWrapperRect.width) / 2 - contentX * newZoomLevel;
            dragOffset.y = pinchY - (containerRect.height - newWrapperRect.height) / 2 - contentY * newZoomLevel;
            
            // 更新数据
            container.dataset.pinchDistance = distance;
            container.dataset.pinchCenterX = currentCenterX;
            container.dataset.pinchCenterY = currentCenterY;
            
            updateTransformImmediate();
        }
        e.preventDefault();
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
        // 只有在未缩放状态下才处理滑动切换图片
        if (e.changedTouches.length === 1 && !isZoomed) {
            // 确保touchStart已初始化
            if (touchStart.x !== undefined && touchStart.y !== undefined) {
                const deltaX = e.changedTouches[0].clientX - touchStart.x;
                const threshold = 50;
                
                if (deltaX > threshold) {
                    prevImage();
                } else if (deltaX < -threshold) {
                    nextImage();
                }
            }
        }
        e.preventDefault();
    }, { passive: false });

    let lastTap = 0;
    let tapTimeout = null;
    
    // 防抖动处理的双击事件
    container.addEventListener('click', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        // 清除之前的超时
        if (tapTimeout) {
            clearTimeout(tapTimeout);
            tapTimeout = null;
        }
        
        // 如果是快速双击（300毫秒内）
        if (tapLength < 300 && tapLength > 0) {
            // 设置超时以处理双击
            tapTimeout = setTimeout(() => {
                if (isZoomed) {
                    // 还原到100%
                    zoomLevel = 1;
                    isZoomed = false;
                    dragOffset = { x: 0, y: 0 };
                } else {
                    // 双击放大到200%，以点击位置为中心
                    const containerRect = container.getBoundingClientRect();
                    const wrapper = getImageWrapper();
                    const wrapperRect = wrapper.getBoundingClientRect();
                    
                    // 计算点击位置相对于容器的坐标
                    const clickX = e.clientX - containerRect.left;
                    const clickY = e.clientY - containerRect.top;
                    
                    // 计算点击位置相对于图片内容的坐标（当前缩放为1）
                    const contentX = (clickX - (containerRect.width - wrapperRect.width) / 2);
                    const contentY = (clickY - (containerRect.height - wrapperRect.height) / 2);
                    
                    // 放大到200%
                    zoomLevel = 2;
                    isZoomed = true;
                    
                    // 计算新的包装器尺寸
                    const newWrapperRect = {
                        width: wrapperRect.width * 2,
                        height: wrapperRect.height * 2
                    };
                    
                    // 计算新的偏移量，使点击位置对应的内容保持不变
                    dragOffset.x = clickX - (containerRect.width - newWrapperRect.width) / 2 - contentX * 2;
                    dragOffset.y = clickY - (containerRect.height - newWrapperRect.height) / 2 - contentY * 2;
                }
                
                updateTransformImmediate();
            }, 50); // 50毫秒延迟确保是双击而非两次单击
        }
        
        lastTap = currentTime;
    });

    // 滚轮缩放功能 - 确保阻止页面滚动
    container.addEventListener('wheel', (e) => {
        // 阻止默认滚动行为和事件冒泡
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // 计算缩放方向，步进为20%
        const delta = e.deltaY;
        const step = 0.2;
        
        // 获取容器和图片包装器元素
        const containerRect = container.getBoundingClientRect();
        const wrapper = getImageWrapper();
        const wrapperRect = wrapper.getBoundingClientRect();
        
        // 计算鼠标位置相对于容器的坐标
        const mouseX = e.clientX - containerRect.left;
        const mouseY = e.clientY - containerRect.top;
        
        // 计算鼠标位置相对于图片内容的坐标（考虑当前偏移和缩放）
        const contentX = (mouseX - dragOffset.x - (containerRect.width - wrapperRect.width) / 2) / zoomLevel;
        const contentY = (mouseY - dragOffset.y - (containerRect.height - wrapperRect.height) / 2) / zoomLevel;
        
        // 保存当前缩放级别
        const prevZoom = zoomLevel;
        
        // 计算新的缩放级别
        let newZoom = zoomLevel;
        if (delta < 0) {
            // 放大
            newZoom = Math.min(zoomLevel + step, 2); // 最大200%
        } else {
            // 缩小
            newZoom = Math.max(zoomLevel - step, 1); // 最小100%
        }
        
        // 应用新的缩放级别
        zoomLevel = newZoom;
        isZoomed = zoomLevel > 1;
        
        // 计算新的偏移量，确保鼠标位置对应的图片内容保持不变
        const newWrapperRect = {
            width: wrapperRect.width * (newZoom / prevZoom),
            height: wrapperRect.height * (newZoom / prevZoom)
        };
        
        // 计算新的偏移量，使鼠标位置对应的内容保持不变
        dragOffset.x = mouseX - (containerRect.width - newWrapperRect.width) / 2 - contentX * newZoom;
        dragOffset.y = mouseY - (containerRect.height - newWrapperRect.height) / 2 - contentY * newZoom;
        
        // 如果缩放到1，重置位置
        if (zoomLevel === 1) {
            dragOffset = { x: 0, y: 0 };
        }
        
        updateTransformImmediate();
    }, { passive: false, capture: true });
}

function closeViewer() {
    const viewer = document.getElementById('fullscreen-viewer');
    
    // 平滑淡出动画
    viewer.style.opacity = '0';
    viewer.style.visibility = 'hidden';
    
    setTimeout(() => {
        viewer.classList.remove('active');
        
        setTimeout(() => {
            viewer.classList.add('hidden');
            resetZoom();
            
            // 恢复页面滚动
            const scrollPosition = document.body.dataset.scrollPosition || 0;
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            document.body.style.height = '';
            document.documentElement.style.overflow = '';
            document.body.style.top = '';
            
            // 恢复滚动位置
            window.scrollTo(0, parseInt(scrollPosition));
        }, 200);
    }, 50);
    
    // 清理全局滚轮事件监听器
    if (window._viewerWheelHandler) {
        document.removeEventListener('wheel', window._viewerWheelHandler, { capture: true });
        window.removeEventListener('wheel', window._viewerWheelHandler, { capture: true });
        window._viewerWheelHandler = null;
    }
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
    
    // 添加淡出效果
    image.style.opacity = '0';
    title.style.opacity = '0';
    caption.style.opacity = '0';
    counter.style.opacity = '0';
    
    // 短暂延迟后更新内容并淡入
    setTimeout(() => {
        const imageData = filteredImages[currentImageIndex];
        image.src = imageData.src;
        image.alt = imageData.alt;
        title.textContent = imageData.alt;
        caption.textContent = imageData.caption;
        counter.textContent = `${currentImageIndex + 1} / ${filteredImages.length}`;
        
        // 图片加载完成后淡入
        image.onload = () => {
            image.style.opacity = '1';
            title.style.opacity = '1';
            caption.style.opacity = '1';
            counter.style.opacity = '1';
        };
        
        // 如果图片已缓存，立即淡入
        if (image.complete) {
            image.style.opacity = '1';
            title.style.opacity = '1';
            caption.style.opacity = '1';
            counter.style.opacity = '1';
        }
    }, 100);
    
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
    const viewer = document.getElementById('fullscreen-viewer');
    if (!viewer || !viewer.classList.contains('active')) return;
    
    zoomLevel = Math.min(zoomLevel + 0.2, 2); // 步进20%，最大200%
    isZoomed = zoomLevel > 1;
    updateTransformImmediate();
}

function zoomOut() {
    const viewer = document.getElementById('fullscreen-viewer');
    if (!viewer || !viewer.classList.contains('active')) return;
    
    zoomLevel = Math.max(zoomLevel - 0.2, 1); // 步进20%，最小100%
    isZoomed = zoomLevel > 1;
    
    // 如果缩放到1，重置位置
    if (zoomLevel === 1) {
        dragOffset = { x: 0, y: 0 };
    }
    
    updateTransformImmediate();
}

function resetZoom() {
    zoomLevel = 1;
    isZoomed = false;
    dragOffset = { x: 0, y: 0 };
    updateTransformImmediate();
}

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







