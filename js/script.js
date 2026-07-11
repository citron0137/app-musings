// Digital Business Card - Interactive Features
// 디지털 명함 - 인터랙티브 기능들

document.addEventListener('DOMContentLoaded', function() {
    // Wait for i18n to be available (optional: projects page does not load i18n)
    setTimeout(() => {
        if (window.i18n) {
            console.log(window.i18n.translate('console.loaded'));
            console.log(window.i18n.translate('console.mobile'));
            console.log(window.i18n.translate('console.darkmode'));
            console.log(window.i18n.translate('console.vcard'));
            console.log(window.i18n.translate('console.email'));
        }
    }, 100);

    // Dark Mode Toggle Functionality
    const darkModeToggle = document.getElementById('darkModeToggle');
    const html = document.documentElement;
    
    // 다크모드 상태는 이미 head에서 설정됨 - 아이콘만 업데이트
    const isDarkMode = html.classList.contains('dark');
    if (darkModeToggle) updateDarkModeIcon(isDarkMode);
    
    // Language Toggle Functionality (projects 페이지에는 언어 토글 없음)
    const languageToggle = document.getElementById('languageToggle');
    const currentLangDisplay = document.getElementById('currentLang');
    
    if (languageToggle && currentLangDisplay) {
        function updateLanguageDisplay() {
            const currentLang = window.i18n?.getCurrentLanguage() || 'ko';
            currentLangDisplay.textContent = currentLang.toUpperCase();
        }
        
        languageToggle.addEventListener('click', function() {
            const currentLang = window.i18n?.getCurrentLanguage() || 'ko';
            const newLang = currentLang === 'ko' ? 'en' : 'ko';
            document.body.classList.add('language-switching');
            window.i18n?.setLanguage(newLang);
            updateLanguageDisplay();
            setTimeout(() => document.body.classList.remove('language-switching'), 300);
        });
        
        updateLanguageDisplay();
    }

    // Dark mode toggle click handler
    if (darkModeToggle) darkModeToggle.addEventListener('click', function() {
        const isDark = html.classList.contains('dark');
        
        if (isDark) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            updateDarkModeIcon(false);
            console.log(window.i18n?.translate('console.darkmode.light') || '🌞 라이트 모드로 전환되었습니다.');
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            updateDarkModeIcon(true);
            console.log(window.i18n?.translate('console.darkmode.dark') || '🌙 다크 모드로 전환되었습니다.');
        }
    });
    
    // Update dark mode icon
    function updateDarkModeIcon(isDark) {
        if (!darkModeToggle) return;
        const icon = darkModeToggle.querySelector('svg path');
        if (isDark) {
            // Sun icon for light mode toggle
            icon.setAttribute('d', 'M12 17.5a5.5 5.5 0 100-11 5.5 5.5 0 000 11zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42');
        } else {
            // Moon icon for dark mode toggle
            icon.setAttribute('d', 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z');
        }
    }
    
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerOffset = 80; // Account for fixed header
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                console.log(window.i18n?.translate('console.scroll', { section: targetId }) || `📍 ${targetId} 섹션으로 스크롤됩니다.`);
            }
        });
    });
    
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                // Optional: Unobserve after animation
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe sections for scroll animations
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        observer.observe(section);
    });
    
    // Active navigation link highlighting
    const sections_for_nav = document.querySelectorAll('section[id]');
    const navItems = document.querySelectorAll('nav a[href^="#"]');
    
    function highlightActiveNavItem() {
        let current = '';
        
        sections_for_nav.forEach(section => {
            const sectionTop = section.getBoundingClientRect().top;
            if (sectionTop <= 100) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(item => {
            const href = item.getAttribute('href').substring(1);
            if (href === current) {
                item.classList.add('text-blue-500', 'font-semibold');
                item.classList.remove('text-gray-600', 'dark:text-gray-300');
            } else {
                item.classList.remove('text-blue-500', 'font-semibold');
                item.classList.add('text-gray-600', 'dark:text-gray-300');
            }
        });
    }
    
    // Throttled scroll event listener
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(highlightActiveNavItem, 10);
    });
    
    // Experience project card interactions
    const projectCards = document.querySelectorAll('#experience .group');
    projectCards.forEach((card, index) => {
        // Add hover effects
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Contact buttons tracking
    const contactButtons = document.querySelectorAll('#contact a');
    contactButtons.forEach(button => {
        button.addEventListener('click', function() {
            const buttonText = this.querySelector('span').textContent;
            console.log(window.i18n?.translate('console.button.click', { button: buttonText }) || `📞 ${buttonText} 버튼이 클릭되었습니다.`);
        });
    });
    
    // vCard download tracking
    const vCardButton = document.querySelector('a[href="./public/contact.vcf"]');
    if (vCardButton) {
        vCardButton.addEventListener('click', function() {
            console.log(window.i18n?.translate('console.vcard.download') || '📇 vCard가 다운로드되었습니다.');
            
            // Optional: Track download event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'download', {
                    'event_category': 'contact',
                    'event_label': 'vcard'
                });
            }
        });
    }
    
    // Image lazy loading fallback
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('load', function() {
            this.classList.remove('img-loading');
        });
        
        img.addEventListener('error', function() {
            this.classList.remove('img-loading');
            console.warn(window.i18n?.translate('console.image.error') || '⚠️ 이미지 로드에 실패했습니다:', this.src);
        });
    });
    
    // Keyboard navigation support
    document.addEventListener('keydown', function(e) {
        // Toggle dark mode with Ctrl/Cmd + D
        if (darkModeToggle && (e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            darkModeToggle.click();
        }
        
        // Toggle language with Ctrl/Cmd + L
        if (languageToggle && (e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            languageToggle.click();
        }
        
        // Navigate sections with arrow keys when focus is on nav
        const focusedElement = document.activeElement;
        if (focusedElement && focusedElement.closest('nav')) {
            let currentIndex = Array.from(navItems).indexOf(focusedElement);
            
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                currentIndex = (currentIndex + 1) % navItems.length;
                navItems[currentIndex].focus();
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                currentIndex = currentIndex <= 0 ? navItems.length - 1 : currentIndex - 1;
                navItems[currentIndex].focus();
            }
        }
    });
    
    // Performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', function() {
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                const loadTime = perfData.loadEventEnd - perfData.loadEventStart;
                console.log(window.i18n?.translate('console.loadtime', { time: loadTime.toFixed(2) }) || `⚡ 페이지 로드 시간: ${loadTime.toFixed(2)}ms`);
            }, 100);
        });
    }
    
    // Device and browser detection
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const isTablet = window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;
    const isDesktop = window.matchMedia('(min-width: 1025px)').matches;
    
    console.log(window.i18n?.translate('console.device') || '📱 디바이스 정보:', {
        mobile: isMobile,
        tablet: isTablet,
        desktop: isDesktop,
        userAgent: navigator.userAgent
    });
    
    // Online/offline status
    function updateOnlineStatus() {
        const statusKey = navigator.onLine ? 'console.connection.online' : 'console.connection.offline';
        console.log(window.i18n?.translate(statusKey) || `🌐 연결 상태: ${navigator.onLine ? '온라인' : '오프라인'}`);
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
    
    // Initialize complete message
    setTimeout(() => {
        console.log(window.i18n?.translate('console.initialized') || '✅ 모든 기능이 초기화되었습니다!');
        console.log(window.i18n?.translate('console.tip') || '💡 팁: Ctrl+D (또는 Cmd+D)로 다크모드를 토글할 수 있습니다.');
        console.log('🌍 언어 전환: Ctrl+L (또는 Cmd+L) 또는 우상단 버튼 클릭');
    }, 200);
});

// Utility functions
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            textArea.remove();
            return Promise.resolve();
        } catch (err) {
            textArea.remove();
            return Promise.reject(err);
        }
    }
}

// CSS-based tooltips are now used instead of JavaScript tooltips
// No JavaScript tooltip functionality needed anymore!

// Export for global access if needed
window.BusinessCard = {
    copyToClipboard,
    version: '1.0.0',
    i18n: window.i18n
}; 