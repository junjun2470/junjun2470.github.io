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

/**
 * 更新移动端菜单位置
 */
function updateMobileMenuPosition() {
    const nav = document.querySelector('nav');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (!nav || !mobileMenu) return;
    
    // 获取nav的位置和尺寸
    const navRect = nav.getBoundingClientRect();
    
    // 计算mobile-menu的位置：
    // 顶部：nav的底部
    // 右侧：紧贴视窗右边缘
    // 确保使用fixed定位
    
    // 设置位置 - 确保菜单在nav正下方且右边缘对齐视窗右边缘
    mobileMenu.style.position = 'fixed';
    mobileMenu.style.top = `${navRect.bottom}px`;
    mobileMenu.style.left = 'auto';
    mobileMenu.style.right = '0';
    // 移除固定宽度和最小宽度设置，让CSS样式生效
    mobileMenu.style.width = '';
    mobileMenu.style.minWidth = '';
}

/**
 * 初始化移动端菜单
 */
function initMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const nav = document.querySelector('nav');

    // 初始更新位置
    updateMobileMenuPosition();

    // 切换菜单显示/隐藏
    mobileMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle('hidden');
        
        // 显示菜单时更新位置
        if (!mobileMenu.classList.contains('hidden')) {
            updateMobileMenuPosition();
        }
    });

    // 点击菜单内部不关闭
    mobileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // 点击外部区域关闭菜单
    document.addEventListener('click', (e) => {
        if (!mobileMenu.classList.contains('hidden') && 
            !mobileMenu.contains(e.target) && 
            !mobileMenuButton.contains(e.target)) {
            mobileMenu.classList.add('hidden');
        }
    });

    // 窗口大小改变时重新计算位置
    window.addEventListener('resize', () => {
        updateMobileMenuPosition();
    });

    // 滚动时重新计算位置
    window.addEventListener('scroll', () => {
        updateMobileMenuPosition();
    });

    // 监听nav元素的变化
    const navObserver = new MutationObserver(() => {
        updateMobileMenuPosition();
    });
    
    if (nav) {
        navObserver.observe(nav, {
            attributes: true,
            attributeFilter: ['style', 'class'],
            subtree: true
        });
    }
}

/**
 * 初始化导航栏滚动效果
 */
function initNavbarScrollEffects() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    const nav = document.querySelector('nav');

    // 使用防抖优化滚动事件
    window.addEventListener('scroll', debounce(() => {
        let currentSection = '';

        // 确定当前视图中的部分
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;

            if (window.pageYOffset >= sectionTop - 200) {
                currentSection = section.getAttribute('id');
            }
        });

        // 更新活跃导航链接
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });

        // 在滚动时应用导航栏模糊效果
        if (window.scrollY > 50) {
            nav.classList.add('navbar-fixed');
        } else {
            nav.classList.remove('navbar-fixed');
        }
    }, 100));
}

/**
 * 初始化平滑滚动
 */
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            const nav = document.querySelector('nav');
            
            if (targetElement && nav) {
                // 动态获取导航栏高度作为偏移量
                const navHeight = nav.offsetHeight;
                
                window.scrollTo({
                    top: targetElement.offsetTop - navHeight, // 使用实际导航栏高度作为偏移量
                    behavior: 'smooth'
                });
                
                // 如果移动端菜单打开，则关闭它
                const mobileMenu = document.getElementById('mobile-menu');
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                }
            }
        });
    });
}

/**
 * 初始化通用轮播功能
 * @param {string} selector - 轮播元素的CSS选择器
 * @param {number} interval - 切换间隔（毫秒）
 */
function initSlider(selector, interval = 5000) {
    const slides = document.querySelectorAll(selector);
    if (slides.length === 0) return;
    
    let currentSlide = 0;

    /**
     * 显示指定索引的幻灯片
     * @param {number} index - 幻灯片索引
     */
    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.toggle('active', i === index);
        });
    }

    /**
     * 显示下一张幻灯片
     */
    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    // 为每个幻灯片添加点击事件监听器，点击时切换到下一张
    slides.forEach(slide => {
        slide.addEventListener('click', nextSlide);
    });

    // 每指定间隔切换一张幻灯片
    setInterval(nextSlide, interval);
}

/**
 * 初始化英雄区轮播
 */
function initHeroSlider() {
    // 分别初始化横向和纵向轮播
    initSlider('.landscape-carousel .hero-slide', 5000);
    initSlider('.portrait-carousel .hero-slide', 5000);
}

/**
 * 初始化自拍轮播
 */
function initSelfieSlider() {
    initSlider('.selfie-slide', 5000);
}

/**
 * 初始化GSAP动画
 */
function initGSAPAnimations() {
    // 英雄区内容动画
    gsap.to('.hero-content h1', {
        opacity: 1,
        y: 0,
        duration: 1,
        delay: 0.5
    });
    gsap.to('.hero-content p', {
        opacity: 1,
        y: 0,
        duration: 1,
        delay: 0.8
    });
    gsap.to('.hero-content a', {
        opacity: 1,
        y: 0,
        duration: 1,
        delay: 1.1
    });

    // 作品集项目动画
    gsap.utils.toArray('.portfolio-item').forEach((item, i) => {
        gsap.fromTo(item, 
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                scrollTrigger: {
                    trigger: item,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                },
                delay: i * 0.1
            }
        );
    });

    // About部分动画
    gsap.fromTo('#about .max-w-3xl', 
        { opacity: 0, y: 50 },
        {
            opacity: 1,
            y: 0,
            duration: 1,
            scrollTrigger: {
                trigger: '#about',
                start: 'top 70%',
                toggleActions: 'play none none none'
            }
        }
    );
    // 联系部分动画
    gsap.fromTo('#contact h2', 
        { opacity: 0, y: 30 },
        {
            opacity: 1,
            y: 0,
            duration: 1,
            scrollTrigger: {
                trigger: '#contact',
                start: 'top 80%',
                toggleActions: 'play none none none'
            }
        }
    );
    gsap.fromTo('#contact p', 
        { opacity: 0, y: 30 },
        {
            opacity: 1,
            y: 0,
            duration: 1,
            scrollTrigger: {
                trigger: '#contact',
                start: 'top 80%',
                toggleActions: 'play none none none'
            },
            delay: 0.2
        }
    );
    gsap.fromTo('#contact .flex.flex-col', 
        { opacity: 0, y: 30 },
        {
            opacity: 1,
            y: 0,
            duration: 1,
            scrollTrigger: {
                trigger: '#contact',
                start: 'top 80%',
                toggleActions: 'play none none none'
            },
            delay: 0.4
        }
    );
}

/**
 * 初始化作品集筛选
 */
function initPortfolioFilter() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 更新活跃按钮状态
            filterBtns.forEach(b => b.classList.remove('active', 'bg-gray-700'));
            btn.classList.add('active', 'bg-gray-700');

            const filter = btn.getAttribute('data-filter');

            // 使用动画筛选作品集项目
            portfolioItems.forEach(item => {
                if (filter === 'all' || item.getAttribute('data-category') === filter) {
                    gsap.to(item, {
                        opacity: 1,
                        scale: 1,
                        duration: 0.5,
                        display: 'block'
                    });
                } else {
                    gsap.to(item, {
                        opacity: 0,
                        scale: 0.8,
                        duration: 0.5,
                        onComplete: () => {
                            item.style.display = 'none';
                        }
                    });
                }
            });
        });
    });
}

/**
 * 初始化社交媒体模态框
 */
function initSocialModal() {
    const socialModal = document.getElementById('socialModal');
    const socialModalContent = document.getElementById('socialModalContent');

    /**
     * 显示有关特定社交媒体平台信息的模态框。
     * @param {string} platform - 社交媒体平台（例如：'xiaohongshu', 'douyin'）。
     */
    window.showSocialModal = function(platform) {
        const socialData = {
            xiaohongshu: {
                name: '小红书',
                description: '在小红书上，我分享我的摄影作品、拍摄心得和后期技巧。欢迎关注我，一起交流摄影的乐趣！',
                handle: '@慢慢拍'
            },
            douyin: {
                name: '抖音',
                description: '抖音是我分享作品的地方，记录拍摄。快来抖音找我吧！',
                handle: '@虾饺饺'
            }
        };

        const data = socialData[platform];
        socialModalContent.innerHTML = `
                <h3 class="text-2xl font-bold mb-4">${data.name}</h3>
                <p class="mb-4">${data.description}</p>
                <p class="text-lg font-semibold">${data.handle}</p>
            `;
        socialModal.classList.add('active');
    }

    window.addEventListener('click', (e) => {
        if (e.target === socialModal) {
            socialModal.classList.remove('active');
        }
    });
}

/**
 * 优化性能，特别是在低端设备上
 * 本函数会检测设备性能并根据性能水平调整页面动画效果
 */
function optimizePerformance() {
    // 检测设备性能
    const isLowEndDevice = (function() {
        // 简单的性能检测 - 使用WebGL能力作为判断依据
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
            return true; // 不支持WebGL，可能是低端设备
        }
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) {
            return false;
        }
        
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        // 检测常见的低端设备GPU型号
        const lowEndGPUs = ['intel hd graphics 3000', 'intel hd graphics 4000', 'radeon hd 6000', 'geforce 9400m'];
        
        return lowEndGPUs.some(gpu => renderer.includes(gpu));
    })();
    
    // 如果是低端设备，禁用或简化一些动画效果以提高性能
    if (isLowEndDevice) {
        document.body.classList.add('low-end-device');
        
        // 动态添加简化CSS动画的样式
        const style = document.createElement('style');
        style.textContent = `
            /* 简化所有动画和过渡效果 */
            .low-end-device * {
                animation-duration: 0.1s !important;
                transition-duration: 0.1s !important;
            }
            
            /* 简化作品集项目的悬停效果 */
            .low-end-device .portfolio-overlay {
                transform: translateY(0) !important;
                background: rgba(0,0,0,0.6) !important;
            }
            
            /* 禁用视差滚动效果，改用普通滚动以提高性能 */
            .low-end-device .hero-slide {
                background-attachment: scroll !important;
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * 初始化视窗比例检测和轮播切换
 */
function initViewportDetection() {
    const landscapeCarousel = document.querySelector('.landscape-carousel');
    const portraitCarousel = document.querySelector('.portrait-carousel');
    
    /**
     * 检测视窗比例并切换轮播
     */
    function checkViewportRatio() {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isLandscape = viewportWidth > viewportHeight;
        
        if (isLandscape) {
            // 宽屏模式：显示横向轮播，隐藏纵向轮播
            landscapeCarousel.classList.remove('hidden');
            portraitCarousel.classList.add('hidden');
        } else {
            // 窄屏模式：显示纵向轮播，隐藏横向轮播
            landscapeCarousel.classList.add('hidden');
            portraitCarousel.classList.remove('hidden');
        }
    }
    
    // 初始化时检查一次
    checkViewportRatio();
    
    // 监听窗口大小变化事件
    window.addEventListener('resize', debounce(checkViewportRatio, 200));
}

/**
 * 初始化图片懒加载
 */
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        lazyImages.forEach(img => {
            imageObserver.observe(img);
        });
    }
}

/**
 * 初始化页面
 */
function initPage() {
    // 初始化Lucide图标
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // 初始化深浅模式切换（所有页面都需要）
    initThemeToggle();
    
    // 只在 index.html 页面上初始化其他功能
    if (!document.querySelector('.hero-section')) {
        return;
    }
    
    // 启用图片懒加载
    initLazyLoading();
    
    // 调用所有初始化函数
    initMobileMenu();
    initHeroSlider();
    initSelfieSlider();
    initGSAPAnimations();
    initPortfolioFilter();
    initSocialModal();
    initSmoothScrolling();
    initNavbarScrollEffects();
    initViewportDetection();
    optimizePerformance();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage);
