// Configuration constants
const CONFIG = {
    // Layer spacing
    LAYER_SPACING: 100,
    
    // Rotation settings
    ROTATION_SENSITIVITY: 0.5,
    MAX_ROTATION_X: 90,
    MAX_ROTATION_Y: 360,
    
    // Animation
    TRANSITION_DURATION: 300,
    EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
    
    // Responsive breakpoints
    BREAKPOINTS: {
        MOBILE: 480,
        TABLET: 768,
        DESKTOP: 1024
    }
};

class RotationController {
    constructor(container, layersWrapper) {
        this.container = container;
        this.layersWrapper = layersWrapper;
        
        // Rotation state
        this.rotateX = 0;
        this.rotateY = 0;
        this.velocity = { x: 0, y: 0 };
        
        // Zoom state - 배경과 동일한 크기로 시작
        this.scale = 1; // 원본 크기로 시작 (배경과 매칭)
        this.minScale = 0.2;
        this.maxScale = 2; // 적당한 확대 허용
        this.zoomSensitivity = 0.1;
        
        // Mouse/Touch state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        
        // Multi-touch state
        this.isZooming = false;
        this.lastDistance = 0;
        this.touches = [];
        
        // Animation state
        this.animationId = null;
        this.dampening = 0.95;
        
        // Sensitivity adjustments
        this.sensitivity = CONFIG.ROTATION_SENSITIVITY;
        this.touchSensitivity = CONFIG.ROTATION_SENSITIVITY * 0.8; // Slightly less sensitive for touch
        
        // Performance state
        this.lastUpdateTime = 0;
        this.updateThrottle = 16; // ~60fps
        
        this.initializeEventListeners();
        this.startAnimationLoop();
        
        // 초기 스케일 적용
        this.applyTransform();
    }
    
    initializeEventListeners() {
        // Mouse events
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Mouse wheel events - only on images
        this.layersWrapper.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        
        // Touch events
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Prevent context menu on right click
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Window resize
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Disable drag on images and other elements
        this.container.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    // Mouse event handlers - 회전 비활성화
    handleMouseDown(e) {
        // 회전 기능 비활성화
        return;
    }
    
    handleMouseMove(e) {
        // 회전 기능 비활성화
        return;
    }
    
    handleMouseUp(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.container.classList.remove('dragging');
        document.body.style.cursor = '';
        
        e.preventDefault();
    }
    
    // Mouse wheel handler - 확대축소 활성화
    handleWheel(e) {
        e.preventDefault(); // 스크롤 방지
        
        const zoomDelta = e.deltaY * -0.001; // 휠 방향에 따른 확대축소
        this.updateZoom(zoomDelta);
    }
    
    // Touch event handlers - 회전 비활성화, 확대축소만 활성화
    handleTouchStart(e) {
        this.touches = Array.from(e.touches);
        
        if (e.touches.length === 2) {
            // Two touches - zoom만 활성화
            this.isDragging = false;
            this.isZooming = true;
            this.lastDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
        }
        
        e.preventDefault();
    }
    
    handleTouchMove(e) {
        const currentTime = performance.now();
        if (currentTime - this.lastUpdateTime < this.updateThrottle) return;
        this.lastUpdateTime = currentTime;
        
        if (e.touches.length === 2 && this.isZooming) {
            // Two touches - zoom만 활성화
            const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
            const deltaDistance = currentDistance - this.lastDistance;
            
            const zoomDelta = deltaDistance * 0.01; // Adjust sensitivity
            this.updateZoom(zoomDelta);
            
            this.lastDistance = currentDistance;
        }
        
        e.preventDefault();
    }
    
    handleTouchEnd(e) {
        if (e.touches.length === 0) {
            // All touches ended
            this.isDragging = false;
            this.isZooming = false;
            this.container.classList.remove('dragging');
        } else if (e.touches.length === 1) {
            // Went from multi-touch to single touch
            this.isZooming = false;
            this.isDragging = true;
            const touch = e.touches[0];
            this.lastTouchX = touch.clientX;
            this.lastTouchY = touch.clientY;
            this.container.classList.add('dragging');
        }
        
        e.preventDefault();
    }
    
    // Helper function to calculate distance between two touches
    getTouchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // Keyboard event handler
    handleKeyDown(e) {
        const keyActions = {
            'ArrowLeft': () => this.rotateWithAnimation(-15, 0),
            'ArrowRight': () => this.rotateWithAnimation(15, 0),
            'ArrowUp': () => this.rotateWithAnimation(0, -15),
            'ArrowDown': () => this.rotateWithAnimation(0, 15),
            'Space': () => this.resetRotation(),
            'KeyR': () => this.resetRotation(),
            'Home': () => this.resetRotation()
            // 줌 관련 키보드 단축키 제거
        };
        
        const action = keyActions[e.code];
        if (action) {
            action();
            e.preventDefault();
        }
    }
    
    // Window resize handler
    handleResize() {
        // Adjust sensitivity and scale based on screen size
        const width = window.innerWidth;
        const isMobile = width <= 768;
        
        // 스케일은 고정 (배경과 매칭)
        
        if (width <= CONFIG.BREAKPOINTS.MOBILE) {
            this.sensitivity = CONFIG.ROTATION_SENSITIVITY * 0.6;
            this.touchSensitivity = CONFIG.ROTATION_SENSITIVITY * 0.5;
        } else if (width <= CONFIG.BREAKPOINTS.TABLET) {
            this.sensitivity = CONFIG.ROTATION_SENSITIVITY * 0.8;
            this.touchSensitivity = CONFIG.ROTATION_SENSITIVITY * 0.6;
        } else {
            this.sensitivity = CONFIG.ROTATION_SENSITIVITY;
            this.touchSensitivity = CONFIG.ROTATION_SENSITIVITY * 0.8;
        }
    }
    
    // Core rotation update method
    updateRotation(deltaX, deltaY, sensitivity) {
        // Calculate new rotation values
        const newRotateY = this.rotateY + (deltaX * sensitivity);
        const newRotateX = this.rotateX - (deltaY * sensitivity);
        
        // Apply constraints
        this.rotateX = Math.max(-CONFIG.MAX_ROTATION_X, 
                       Math.min(CONFIG.MAX_ROTATION_X, newRotateX));
        this.rotateY = newRotateY; // No Y constraint for continuous rotation
        
        // Store velocity for momentum
        this.velocity.x = deltaY * sensitivity * 0.1;
        this.velocity.y = deltaX * sensitivity * 0.1;
        
        this.applyRotation();
    }
    
    // Animated rotation for keyboard controls
    rotateWithAnimation(deltaY, deltaX) {
        const targetX = Math.max(-CONFIG.MAX_ROTATION_X, 
                        Math.min(CONFIG.MAX_ROTATION_X, this.rotateX + deltaX));
        const targetY = this.rotateY + deltaY;
        
        this.animateToRotation(targetX, targetY);
    }
    
    // Smooth animation to target rotation
    animateToRotation(targetX, targetY) {
        const startX = this.rotateX;
        const startY = this.rotateY;
        const startTime = performance.now();
        const duration = CONFIG.TRANSITION_DURATION;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            this.rotateX = startX + (targetX - startX) * easeProgress;
            this.rotateY = startY + (targetY - startY) * easeProgress;
            
            this.applyRotation();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // Zoom functions
    updateZoom(delta) {
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta));
        
        if (newScale !== this.scale) {
            this.scale = newScale;
            this.applyTransform();
            
            // Dispatch zoom event
            this.container.dispatchEvent(new CustomEvent('zoomUpdate', {
                detail: {
                    scale: this.scale,
                    minScale: this.minScale,
                    maxScale: this.maxScale
                }
            }));
        }
    }
    
    resetZoom() {
        this.animateToScale(1);
    }
    
    animateToScale(targetScale) {
        const startScale = this.scale;
        const startTime = performance.now();
        const duration = CONFIG.TRANSITION_DURATION;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            this.scale = startScale + (targetScale - startScale) * easeProgress;
            this.applyTransform();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // Reset rotation to initial state
    resetRotation() {
        this.animateToRotation(0, 0);
        this.velocity = { x: 0, y: 0 };
    }
    
    // Reset both rotation and zoom
    resetAll() {
        this.animateToRotation(0, 0);
        this.animateToScale(1);
        this.velocity = { x: 0, y: 0 };
    }
    
    // Apply rotation and scale to the layers wrapper
    applyTransform() {
        const transform = `rotateX(${this.rotateX}deg) rotateY(${this.rotateY}deg) scale(${this.scale})`;
        this.layersWrapper.style.transform = transform;
        
        // Dispatch custom event for layer manager
        this.container.dispatchEvent(new CustomEvent('rotationUpdate', {
            detail: {
                rotateX: this.rotateX,
                rotateY: this.rotateY,
                scale: this.scale
            }
        }));
    }
    
    // Keep the old function name for backward compatibility
    applyRotation() {
        this.applyTransform();
    }
    
    // Animation loop for momentum and smooth transitions
    startAnimationLoop() {
        const animate = () => {
            if (!this.isDragging && (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.y) > 0.1)) {
                // Apply momentum
                this.rotateX += this.velocity.x;
                this.rotateY += this.velocity.y;
                
                // Apply constraints
                this.rotateX = Math.max(-CONFIG.MAX_ROTATION_X, 
                               Math.min(CONFIG.MAX_ROTATION_X, this.rotateX));
                
                // Apply damping
                this.velocity.x *= this.dampening;
                this.velocity.y *= this.dampening;
                
                this.applyRotation();
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    // Get current rotation and scale values
    getRotation() {
        return {
            x: this.rotateX,
            y: this.rotateY,
            scale: this.scale
        };
    }
    
    // Set rotation programmatically
    setRotation(x, y, animate = true) {
        if (animate) {
            this.animateToRotation(x, y);
        } else {
            this.rotateX = Math.max(-CONFIG.MAX_ROTATION_X, 
                          Math.min(CONFIG.MAX_ROTATION_X, x));
            this.rotateY = y;
            this.applyTransform();
        }
    }
    
    // Get current scale
    getScale() {
        return this.scale;
    }
    
    // Set scale programmatically
    setScale(scale, animate = true) {
        const clampedScale = Math.max(this.minScale, Math.min(this.maxScale, scale));
        if (animate) {
            this.animateToScale(clampedScale);
        } else {
            this.scale = clampedScale;
            this.applyTransform();
        }
    }
    
    // Enable/disable rotation controller
    setEnabled(enabled) {
        if (enabled) {
            this.container.style.pointerEvents = 'auto';
        } else {
            this.container.style.pointerEvents = 'none';
            this.isDragging = false;
            this.container.classList.remove('dragging');
        }
    }
    
    // Cleanup method
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Remove event listeners
        this.container.removeEventListener('mousedown', this.handleMouseDown);
        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        
        this.container.removeEventListener('touchstart', this.handleTouchStart);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
        
        document.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('resize', this.handleResize);
    }
}