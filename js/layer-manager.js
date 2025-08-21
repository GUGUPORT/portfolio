// Layer configuration
const LAYER_CONFIG = {
    LAYER_1: { zIndex: -200, name: "배경 레이어" },
    LAYER_2: { zIndex: -100, name: "중간 뒤" },
    LAYER_3: { zIndex: 0, name: "센터 레이어" },
    LAYER_4: { zIndex: 100, name: "중간 앞" },
    LAYER_5: { zIndex: 200, name: "전면 레이어" }
};

const SPACING_BETWEEN_LAYERS = 100; // px 단위

class LayerManager {
    constructor(container) {
        this.container = container;
        this.layers = [];
        this.indicators = [];
        this.activeLayer = null;
        this.focusedLayer = null;
        
        // Animation state
        this.isAnimating = false;
        this.animationQueue = [];
        
        // Event handling
        this.boundHandlers = {
            layerClick: this.handleLayerClick.bind(this),
            layerHover: this.handleLayerHover.bind(this),
            layerLeave: this.handleLayerLeave.bind(this),
            layerFocus: this.handleLayerFocus.bind(this),
            layerBlur: this.handleLayerBlur.bind(this),
            indicatorClick: this.handleIndicatorClick.bind(this),
            rotationUpdate: this.handleRotationUpdate.bind(this)
        };
        
        this.initializeLayers();
        this.initializeIndicators();
        this.initializeEventListeners();
        this.setActiveLayer(3); // Default to center layer
    }
    
    initializeLayers() {
        this.layers = Array.from(this.container.querySelectorAll('.layer'));
        
        this.layers.forEach((layer, index) => {
            const layerIndex = index + 1;
            
            // Set up layer properties
            layer.setAttribute('tabindex', '0');
            layer.setAttribute('role', 'button');
            layer.setAttribute('aria-label', `Layer ${layerIndex}: ${LAYER_CONFIG[`LAYER_${layerIndex}`].name}`);
            
            // Store layer data
            layer.layerIndex = layerIndex;
            layer.layerConfig = LAYER_CONFIG[`LAYER_${layerIndex}`];
        });
    }
    
    initializeIndicators() {
        this.indicators = Array.from(this.container.querySelectorAll('.indicator-dot'));
        
        this.indicators.forEach((indicator, index) => {
            const layerIndex = index + 1;
            indicator.setAttribute('tabindex', '0');
            indicator.setAttribute('role', 'button');
            indicator.setAttribute('aria-label', `Go to layer ${layerIndex}`);
            indicator.layerIndex = layerIndex;
        });
    }
    
    initializeEventListeners() {
        // Layer events
        this.layers.forEach(layer => {
            layer.addEventListener('click', this.boundHandlers.layerClick);
            layer.addEventListener('mouseenter', this.boundHandlers.layerHover);
            layer.addEventListener('mouseleave', this.boundHandlers.layerLeave);
            layer.addEventListener('focus', this.boundHandlers.layerFocus);
            layer.addEventListener('blur', this.boundHandlers.layerBlur);
        });
        
        // Indicator events
        this.indicators.forEach(indicator => {
            indicator.addEventListener('click', this.boundHandlers.indicatorClick);
            indicator.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.boundHandlers.indicatorClick(e);
                }
            });
        });
        
        // Rotation updates
        this.container.addEventListener('rotationUpdate', this.boundHandlers.rotationUpdate);
        
        // Keyboard navigation
        document.addEventListener('keydown', this.handleKeyNavigation.bind(this));
    }
    
    // Layer event handlers
    handleLayerClick(e) {
        const layer = e.currentTarget;
        const layerIndex = layer.layerIndex;
        
        e.stopPropagation();
        
        if (this.activeLayer === layerIndex) {
            this.showLayerDetails(layerIndex);
        } else {
            this.setActiveLayer(layerIndex);
        }
        
        // Dispatch custom event
        this.dispatchLayerEvent('layerSelected', layerIndex);
    }
    
    handleLayerHover(e) {
        const layer = e.currentTarget;
        const layerIndex = layer.layerIndex;
        
        if (!this.isAnimating) {
            this.highlightLayer(layerIndex);
        }
        
        this.dispatchLayerEvent('layerHover', layerIndex);
    }
    
    handleLayerLeave(e) {
        const layer = e.currentTarget;
        const layerIndex = layer.layerIndex;
        
        if (!this.isAnimating && this.activeLayer !== layerIndex) {
            this.unhighlightLayer(layerIndex);
        }
        
        this.dispatchLayerEvent('layerLeave', layerIndex);
    }
    
    handleLayerFocus(e) {
        const layer = e.currentTarget;
        const layerIndex = layer.layerIndex;
        
        this.focusedLayer = layerIndex;
        this.highlightLayer(layerIndex);
        
        this.dispatchLayerEvent('layerFocus', layerIndex);
    }
    
    handleLayerBlur(e) {
        const layer = e.currentTarget;
        const layerIndex = layer.layerIndex;
        
        if (this.focusedLayer === layerIndex) {
            this.focusedLayer = null;
            if (this.activeLayer !== layerIndex) {
                this.unhighlightLayer(layerIndex);
            }
        }
        
        this.dispatchLayerEvent('layerBlur', layerIndex);
    }
    
    // Indicator event handlers
    handleIndicatorClick(e) {
        const indicator = e.currentTarget;
        const layerIndex = indicator.layerIndex;
        
        e.stopPropagation();
        this.setActiveLayer(layerIndex);
        this.focusOnLayer(layerIndex);
    }
    
    // Rotation update handler
    handleRotationUpdate(e) {
        const { rotateX, rotateY } = e.detail;
        
        // Adjust layer opacity based on rotation
        this.updateLayerVisibility(rotateX, rotateY);
        
        // Update active layer based on current view angle
        this.updateActiveLayerFromRotation(rotateX, rotateY);
    }
    
    // Keyboard navigation
    handleKeyNavigation(e) {
        if (!this.focusedLayer && !this.activeLayer) return;
        
        const currentLayer = this.focusedLayer || this.activeLayer;
        
        const keyActions = {
            'Tab': () => this.cycleLayers(e.shiftKey ? -1 : 1),
            'ArrowLeft': () => this.navigateLayer(-1),
            'ArrowRight': () => this.navigateLayer(1),
            'ArrowUp': () => this.navigateLayer(-1),
            'ArrowDown': () => this.navigateLayer(1),
            'Enter': () => this.showLayerDetails(currentLayer),
            'Space': () => this.showLayerDetails(currentLayer),
            'Escape': () => this.hideLayerDetails(),
            'Home': () => this.setActiveLayer(1),
            'End': () => this.setActiveLayer(5)
        };
        
        const action = keyActions[e.key];
        if (action) {
            e.preventDefault();
            action();
        }
    }
    
    // Layer management methods
    setActiveLayer(layerIndex) {
        if (this.activeLayer === layerIndex) return;
        
        // Remove active state from previous layer
        if (this.activeLayer) {
            const prevLayer = this.getLayer(this.activeLayer);
            const prevIndicator = this.getIndicator(this.activeLayer);
            
            if (prevLayer) prevLayer.classList.remove('active');
            if (prevIndicator) prevIndicator.classList.remove('active');
        }
        
        // Set new active layer
        this.activeLayer = layerIndex;
        const newLayer = this.getLayer(layerIndex);
        const newIndicator = this.getIndicator(layerIndex);
        
        if (newLayer) newLayer.classList.add('active');
        if (newIndicator) newIndicator.classList.add('active');
        
        this.dispatchLayerEvent('layerActivated', layerIndex);
    }
    
    highlightLayer(layerIndex) {
        const layer = this.getLayer(layerIndex);
        if (layer) {
            layer.style.transform = `scale(1.02) translateZ(${LAYER_CONFIG[`LAYER_${layerIndex}`].zIndex}px)`;
            layer.style.boxShadow = '0 12px 48px rgba(100, 255, 218, 0.4)';
        }
    }
    
    unhighlightLayer(layerIndex) {
        const layer = this.getLayer(layerIndex);
        if (layer && !layer.classList.contains('active')) {
            layer.style.transform = `translateZ(${LAYER_CONFIG[`LAYER_${layerIndex}`].zIndex}px)`;
            layer.style.boxShadow = '';
        }
    }
    
    navigateLayer(direction) {
        const currentLayer = this.focusedLayer || this.activeLayer || 3;
        const newLayer = Math.max(1, Math.min(5, currentLayer + direction));
        
        if (newLayer !== currentLayer) {
            this.setActiveLayer(newLayer);
            this.focusOnLayer(newLayer);
        }
    }
    
    cycleLayers(direction) {
        const currentLayer = this.focusedLayer || this.activeLayer || 3;
        let newLayer = currentLayer + direction;
        
        if (newLayer > 5) newLayer = 1;
        if (newLayer < 1) newLayer = 5;
        
        this.focusOnLayer(newLayer);
    }
    
    focusOnLayer(layerIndex) {
        const layer = this.getLayer(layerIndex);
        if (layer) {
            layer.focus();
        }
    }
    
    // Layer details modal/popup
    showLayerDetails(layerIndex) {
        if (this.isAnimating) return;
        
        const layer = this.getLayer(layerIndex);
        if (!layer) return;
        
        this.isAnimating = true;
        
        // Create detail overlay
        this.createDetailOverlay(layerIndex);
        
        // Animate layer to front
        this.bringToFront(layerIndex);
        
        setTimeout(() => {
            this.isAnimating = false;
        }, 500);
        
        this.dispatchLayerEvent('layerDetailsShown', layerIndex);
    }
    
    hideLayerDetails() {
        const overlay = document.querySelector('.layer-detail-overlay');
        if (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
        
        // Reset layer positions
        this.resetLayerPositions();
        
        this.dispatchLayerEvent('layerDetailsHidden');
    }
    
    createDetailOverlay(layerIndex) {
        // Remove existing overlay
        const existingOverlay = document.querySelector('.layer-detail-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        const layer = this.getLayer(layerIndex);
        const layerContent = layer.querySelector('.layer-content').cloneNode(true);
        
        const overlay = document.createElement('div');
        overlay.className = 'layer-detail-overlay';
        overlay.innerHTML = `
            <div class="detail-content">
                <button class="close-button" aria-label="Close details">&times;</button>
                <div class="detail-header">
                    <h2>Layer ${layerIndex}: ${LAYER_CONFIG[`LAYER_${layerIndex}`].name}</h2>
                </div>
                <div class="detail-body">
                    ${layerContent.innerHTML}
                </div>
            </div>
        `;
        
        // Add styles
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        const detailContent = overlay.querySelector('.detail-content');
        detailContent.style.cssText = `
            background: linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(22, 33, 62, 0.95));
            border: 1px solid rgba(100, 255, 218, 0.3);
            border-radius: 16px;
            padding: 30px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
            transform: scale(0.8);
            transition: transform 0.3s ease;
        `;
        
        const closeButton = overlay.querySelector('.close-button');
        closeButton.style.cssText = `
            position: absolute;
            top: 15px;
            right: 20px;
            background: none;
            border: none;
            color: #64ffda;
            font-size: 24px;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        document.body.appendChild(overlay);
        
        // Animate in
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            detailContent.style.transform = 'scale(1)';
        });
        
        // Event listeners
        closeButton.addEventListener('click', () => this.hideLayerDetails());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this.hideLayerDetails();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideLayerDetails();
            }
        });
    }
    
    bringToFront(layerIndex) {
        const layer = this.getLayer(layerIndex);
        if (layer) {
            layer.style.transform = `translateZ(300px) scale(1.1)`;
            layer.style.zIndex = '1000';
        }
    }
    
    resetLayerPositions() {
        this.layers.forEach((layer, index) => {
            const layerIndex = index + 1;
            layer.style.transform = `translateZ(${LAYER_CONFIG[`LAYER_${layerIndex}`].zIndex}px)`;
            layer.style.zIndex = '';
        });
    }
    
    // Utility methods
    getLayer(layerIndex) {
        return this.layers[layerIndex - 1];
    }
    
    getIndicator(layerIndex) {
        return this.indicators[layerIndex - 1];
    }
    
    updateLayerVisibility(rotateX, rotateY) {
        this.layers.forEach((layer, index) => {
            const layerIndex = index + 1;
            const distance = Math.abs(LAYER_CONFIG[`LAYER_${layerIndex}`].zIndex);
            const maxDistance = 200;
            
            // Calculate opacity based on rotation and distance
            const rotationFactor = Math.abs(rotateX) / 90;
            const baseOpacity = layer.layerIndex === 3 ? 1 : 0.7 + (0.3 * (1 - distance / maxDistance));
            const adjustedOpacity = baseOpacity * (1 - rotationFactor * 0.3);
            
            layer.style.opacity = Math.max(0.3, adjustedOpacity);
        });
    }
    
    updateActiveLayerFromRotation(rotateX, rotateY) {
        // Determine which layer should be active based on rotation
        const absRotateX = Math.abs(rotateX);
        
        if (absRotateX < 15) {
            // Center view - focus on middle layer
            if (this.activeLayer !== 3) {
                this.setActiveLayer(3);
            }
        } else if (rotateX > 30) {
            // Looking up - focus on back layers
            if (this.activeLayer > 2) {
                this.setActiveLayer(Math.max(1, this.activeLayer - 1));
            }
        } else if (rotateX < -30) {
            // Looking down - focus on front layers
            if (this.activeLayer < 4) {
                this.setActiveLayer(Math.min(5, this.activeLayer + 1));
            }
        }
    }
    
    dispatchLayerEvent(eventName, layerIndex = null, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: {
                layerIndex,
                activeLayer: this.activeLayer,
                focusedLayer: this.focusedLayer,
                ...detail
            }
        });
        
        this.container.dispatchEvent(event);
    }
    
    // Public API methods
    getActiveLayer() {
        return this.activeLayer;
    }
    
    getFocusedLayer() {
        return this.focusedLayer;
    }
    
    getAllLayers() {
        return this.layers.map((layer, index) => ({
            index: index + 1,
            element: layer,
            config: LAYER_CONFIG[`LAYER_${index + 1}`],
            isActive: this.activeLayer === index + 1,
            isFocused: this.focusedLayer === index + 1
        }));
    }
    
    // Cleanup method
    destroy() {
        // Remove event listeners
        this.layers.forEach(layer => {
            layer.removeEventListener('click', this.boundHandlers.layerClick);
            layer.removeEventListener('mouseenter', this.boundHandlers.layerHover);
            layer.removeEventListener('mouseleave', this.boundHandlers.layerLeave);
            layer.removeEventListener('focus', this.boundHandlers.layerFocus);
            layer.removeEventListener('blur', this.boundHandlers.layerBlur);
        });
        
        this.indicators.forEach(indicator => {
            indicator.removeEventListener('click', this.boundHandlers.indicatorClick);
        });
        
        this.container.removeEventListener('rotationUpdate', this.boundHandlers.rotationUpdate);
        
        // Remove detail overlay if exists
        this.hideLayerDetails();
        
        // Clear references
        this.layers = [];
        this.indicators = [];
        this.activeLayer = null;
        this.focusedLayer = null;
    }
}