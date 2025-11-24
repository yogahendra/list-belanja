// Data storage
let mealPlan = {};
let shoppingList = [];
let currentEditingMeal = null; // {day, meal}
let currentIngredients = []; // Temporary storage for modal
let editingIngredientId = null; // ID of ingredient being edited

// Capacitor imports (will be undefined in browser)
let App, Haptics, Keyboard, StatusBar;
try {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const capacitor = window.Capacitor;
        App = capacitor.Plugins?.App;
        Haptics = capacitor.Plugins?.Haptics;
        Keyboard = capacitor.Plugins?.Keyboard;
        StatusBar = capacitor.Plugins?.StatusBar;
    }
} catch (e) {
    // Running in browser mode - ignore
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
    updateShoppingListDisplay();
    initCapacitor();
    registerServiceWorker();
});

// Register Service Worker for PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration);
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        });
    }
}

// Initialize Capacitor plugins if available
function initCapacitor() {
    if (StatusBar) {
        StatusBar.setStyle({ style: 'light' });
        StatusBar.setBackgroundColor({ color: '#ff6b6b' });
    }
    
    if (App) {
        App.addListener('backButton', ({ canGoBack }) => {
            if (!canGoBack) {
                App.exitApp();
            } else {
                window.history.back();
            }
        });
    }
}

// Haptic feedback helper
function hapticFeedback(type = 'light') {
    if (Haptics) {
        Haptics.impact({ style: type });
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });

    // Meal input changes
    document.querySelectorAll('.meal-input').forEach(input => {
        input.addEventListener('input', () => {
            saveMealPlan();
        });
    });

    // Ingredient buttons
    document.querySelectorAll('.btn-ingredient').forEach(btn => {
        btn.addEventListener('click', (e) => {
            hapticFeedback('light');
            const day = btn.dataset.day;
            const meal = btn.dataset.meal;
            openIngredientModal(day, meal);
        });
    });

    // Generate shopping list button
    document.getElementById('generate-btn').addEventListener('click', () => {
        hapticFeedback('medium');
        generateShoppingList();
    });

    // Export button
    document.getElementById('export-btn').addEventListener('click', () => {
        hapticFeedback('light');
        exportMealPlan();
    });

    // Clear buttons
    document.getElementById('clear-meals-btn').addEventListener('click', clearMealPlan);
    document.getElementById('clear-shopping-btn').addEventListener('click', clearShoppingList);

    // Modal events (ingredient modal)
    const ingredientModalClose = document.querySelector('#ingredient-modal .modal-close');
    if (ingredientModalClose) {
        ingredientModalClose.addEventListener('click', closeIngredientModal);
    }
    document.getElementById('cancel-ingredients-btn').addEventListener('click', closeIngredientModal);
    document.getElementById('save-ingredients-btn').addEventListener('click', saveIngredients);
    document.getElementById('add-ingredient-btn').addEventListener('click', addIngredientToModal);
    
    // Enter key to add ingredient
    document.getElementById('ingredient-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addIngredientToModal();
        }
    });
    document.getElementById('ingredient-quantity').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addIngredientToModal();
        }
    });

    // Close modal when clicking outside
    document.getElementById('ingredient-modal').addEventListener('click', (e) => {
        if (e.target.id === 'ingredient-modal') {
            closeIngredientModal();
        }
    });

    // Help modal events
    document.getElementById('help-btn').addEventListener('click', openHelpModal);
    document.getElementById('close-help-btn').addEventListener('click', closeHelpModal);
    document.getElementById('close-help-btn-bottom').addEventListener('click', closeHelpModal);
    
    // Close help modal when clicking outside
    document.getElementById('help-modal').addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') {
            closeHelpModal();
        }
    });

    // Theme modal events
    document.getElementById('theme-btn').addEventListener('click', openThemeModal);
    document.getElementById('close-theme-btn').addEventListener('click', closeThemeModal);
    document.getElementById('close-theme-btn-bottom').addEventListener('click', closeThemeModal);
    
    // Close theme modal when clicking outside
    document.getElementById('theme-modal').addEventListener('click', (e) => {
        if (e.target.id === 'theme-modal') {
            closeThemeModal();
        }
    });

    // Theme selection
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            updateThemeSelection(theme);
        });
    });

    // Load saved theme
    loadTheme();
}

// Tab switching
function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// Open ingredient modal
function openIngredientModal(day, meal) {
    currentEditingMeal = { day, meal };
    const mealInput = document.querySelector(`[data-day="${day}"][data-meal="${meal}"]`);
    const mealName = mealInput.value.trim() || 'Makanan';
    
    document.getElementById('modal-meal-name').textContent = mealName;
    document.getElementById('ingredient-modal').classList.add('active');
    
    // Load existing ingredients
    const key = `${day}_${meal}`;
    currentIngredients = mealPlan[key]?.ingredients || [];
    updateIngredientsListDisplay();
    
    // Clear input fields and reset edit mode
    document.getElementById('ingredient-name').value = '';
    document.getElementById('ingredient-quantity').value = '';
    editingIngredientId = null;
    updateAddButtonText();
    document.getElementById('ingredient-name').focus();
}

// Close ingredient modal
function closeIngredientModal() {
    document.getElementById('ingredient-modal').classList.remove('active');
    currentEditingMeal = null;
    currentIngredients = [];
    editingIngredientId = null;
    document.getElementById('ingredient-name').value = '';
    document.getElementById('ingredient-quantity').value = '';
    updateAddButtonText();
}

// Add or update ingredient to modal list
function addIngredientToModal() {
    const name = document.getElementById('ingredient-name').value.trim();
    const quantity = document.getElementById('ingredient-quantity').value.trim();
    
    if (!name) {
        alert('Masukkan nama bahan terlebih dahulu!');
        return;
    }
    
    if (editingIngredientId) {
        // Update existing ingredient
        const index = currentIngredients.findIndex(ing => ing.id === editingIngredientId);
        if (index !== -1) {
            currentIngredients[index].name = name;
            currentIngredients[index].quantity = quantity || '1';
        }
        editingIngredientId = null;
        updateAddButtonText();
    } else {
        // Add new ingredient
        currentIngredients.push({
            id: Date.now() + Math.random(),
            name: name,
            quantity: quantity || '1'
        });
    }
    
    document.getElementById('ingredient-name').value = '';
    document.getElementById('ingredient-quantity').value = '';
    document.getElementById('ingredient-name').focus();
    updateIngredientsListDisplay();
}

// Update add button text based on edit mode
function updateAddButtonText() {
    const btn = document.getElementById('add-ingredient-btn');
    if (editingIngredientId) {
        btn.textContent = 'Update';
        btn.classList.add('btn-update');
    } else {
        btn.textContent = 'Tambah';
        btn.classList.remove('btn-update');
    }
}

// Remove ingredient from modal list
function removeIngredientFromModal(id) {
    currentIngredients = currentIngredients.filter(ing => ing.id !== id);
    if (editingIngredientId === id) {
        editingIngredientId = null;
        document.getElementById('ingredient-name').value = '';
        document.getElementById('ingredient-quantity').value = '';
        updateAddButtonText();
    }
    updateIngredientsListDisplay();
}

// Edit ingredient in modal
function editIngredientFromModal(id) {
    const ingredient = currentIngredients.find(ing => ing.id === id);
    if (ingredient) {
        document.getElementById('ingredient-name').value = ingredient.name;
        document.getElementById('ingredient-quantity').value = ingredient.quantity;
        editingIngredientId = id;
        updateAddButtonText();
        document.getElementById('ingredient-name').focus();
    }
}

// Make functions available globally
window.removeIngredientFromModal = removeIngredientFromModal;
window.editIngredientFromModal = editIngredientFromModal;

// Update ingredients list display in modal
function updateIngredientsListDisplay() {
    const container = document.getElementById('ingredients-list');
    
    if (currentIngredients.length === 0) {
        container.innerHTML = '<p class="empty-message-small">Belum ada bahan yang ditambahkan</p>';
        return;
    }
    
    container.innerHTML = currentIngredients.map(ing => `
        <div class="ingredient-item ${editingIngredientId === ing.id ? 'editing' : ''}">
            <div class="ingredient-info">
                <div class="ingredient-name">${ing.name}</div>
                <div class="ingredient-quantity">${ing.quantity}</div>
            </div>
            <div class="ingredient-actions">
                <button class="btn-edit" onclick="editIngredientFromModal(${ing.id})">Edit</button>
                <button class="btn-remove" onclick="removeIngredientFromModal(${ing.id})">Hapus</button>
            </div>
        </div>
    `).join('');
}

// Save ingredients to meal plan
function saveIngredients() {
    if (!currentEditingMeal) return;
    
    const { day, meal } = currentEditingMeal;
    const key = `${day}_${meal}`;
    
    if (!mealPlan[key]) {
        mealPlan[key] = {};
    }
    
    mealPlan[key].ingredients = [...currentIngredients];
    saveMealPlan();
    closeIngredientModal();
}

// Save meal plan to localStorage
function saveMealPlan() {
    // Also save meal names
    document.querySelectorAll('.meal-input').forEach(input => {
        const day = input.dataset.day;
        const meal = input.dataset.meal;
        const key = `${day}_${meal}`;
        
        if (!mealPlan[key]) {
            mealPlan[key] = {};
        }
        mealPlan[key].name = input.value.trim();
    });
    
    localStorage.setItem('mealPlan', JSON.stringify(mealPlan));
}

// Load meal plan from localStorage
function loadMealPlan() {
    const saved = localStorage.getItem('mealPlan');
    if (saved) {
        mealPlan = JSON.parse(saved);
        document.querySelectorAll('.meal-input').forEach(input => {
            const day = input.dataset.day;
            const meal = input.dataset.meal;
            const key = `${day}_${meal}`;
            
            if (mealPlan[key] && mealPlan[key].name) {
                input.value = mealPlan[key].name;
            }
        });
    }
}

// Generate shopping list from meal plan
function generateShoppingList() {
    const ingredients = new Map();
    
    // Collect all ingredients from all meals
    Object.keys(mealPlan).forEach(key => {
        const meal = mealPlan[key];
        if (meal.ingredients && meal.ingredients.length > 0) {
            meal.ingredients.forEach(ing => {
                const normalized = normalizeIngredient(ing.name);
                const existing = ingredients.get(normalized);
                
                if (existing) {
                    // Combine quantities if same ingredient
                    existing.quantity = combineQuantities(existing.quantity, ing.quantity);
                    existing.count += 1;
                } else {
                    ingredients.set(normalized, {
                        name: ing.name,
                        quantity: ing.quantity || '1',
                        count: 1
                    });
                }
            });
        }
    });
    
    if (ingredients.size === 0) {
        alert('Belum ada bahan yang ditambahkan. Silakan tambahkan bahan untuk setiap makanan terlebih dahulu!');
        return;
    }
    
    // Convert to shopping list array
    shoppingList = Array.from(ingredients.values()).map(item => ({
        id: Date.now() + Math.random(),
        name: item.name,
        quantity: item.quantity,
        checked: false
    }));
    
    // Merge with existing shopping list (preserve checked items)
    const existingList = JSON.parse(localStorage.getItem('shoppingList') || '[]');
    const existingMap = new Map(existingList.map(item => [item.name.toLowerCase(), item]));
    
    shoppingList = shoppingList.map(item => {
        const existing = existingMap.get(item.name.toLowerCase());
        if (existing) {
            return { ...item, checked: existing.checked, id: existing.id };
        }
        return item;
    });
    
    // Add any existing items not in new list
    existingList.forEach(item => {
        if (!shoppingList.find(si => si.name.toLowerCase() === item.name.toLowerCase())) {
            shoppingList.push(item);
        }
    });
    
    saveShoppingList();
    updateShoppingListDisplay();
    switchTab('shopping-list');
    
    // Show notification
    alert(`Daftar belanja berhasil dibuat! Total ${shoppingList.length} item yang perlu dibeli.`);
}

// Normalize ingredient name
function normalizeIngredient(ingredient) {
    return ingredient.trim().toLowerCase();
}

// Combine quantities (simple version - just append)
function combineQuantities(qty1, qty2) {
    if (!qty1 || qty1 === '1') return qty2 || '1';
    if (!qty2 || qty2 === '1') return qty1;
    return `${qty1} + ${qty2}`;
}

// Update shopping list display
function updateShoppingListDisplay() {
    const container = document.getElementById('shopping-items');
    
    if (shoppingList.length === 0) {
        container.innerHTML = '<p class="empty-message">Belum ada item belanja. Generate daftar belanja dari daftar makanan terlebih dahulu.</p>';
        updateStats();
        return;
    }
    
    container.innerHTML = shoppingList.map(item => `
        <div class="shopping-item ${item.checked ? 'checked' : ''}">
            <input type="checkbox" id="item-${item.id}" ${item.checked ? 'checked' : ''} 
                   onchange="toggleItem(${item.id})">
            <label for="item-${item.id}">${item.name}</label>
            <span class="quantity">${item.quantity}</span>
        </div>
    `).join('');
    
    updateStats();
}

// Toggle item checked status
function toggleItem(id) {
    const item = shoppingList.find(i => i.id === id);
    if (item) {
        item.checked = !item.checked;
        saveShoppingList();
        updateShoppingListDisplay();
    }
}

// Make toggleItem available globally
window.toggleItem = toggleItem;

// Update statistics
function updateStats() {
    const total = shoppingList.length;
    const checked = shoppingList.filter(item => item.checked).length;
    const remaining = total - checked;
    
    document.getElementById('total-items').textContent = total;
    document.getElementById('checked-items').textContent = checked;
    document.getElementById('remaining-items').textContent = remaining;
}

// Save shopping list to localStorage
function saveShoppingList() {
    localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
}

// Load shopping list from localStorage
function loadShoppingList() {
    const saved = localStorage.getItem('shoppingList');
    if (saved) {
        shoppingList = JSON.parse(saved);
    }
}

// Clear meal plan
function clearMealPlan() {
    if (confirm('Apakah Anda yakin ingin menghapus semua daftar makanan dan bahan-bahannya?')) {
        document.querySelectorAll('.meal-input').forEach(input => {
            input.value = '';
        });
        mealPlan = {};
        localStorage.removeItem('mealPlan');
    }
}

// Clear shopping list
function clearShoppingList() {
    if (confirm('Apakah Anda yakin ingin menghapus semua item dari daftar belanja?')) {
        shoppingList = [];
        saveShoppingList();
        updateShoppingListDisplay();
    }
}

// Load all data
function loadData() {
    loadMealPlan();
    loadShoppingList();
}

// Open help modal
function openHelpModal() {
    document.getElementById('help-modal').classList.add('active');
}

// Close help modal
function closeHelpModal() {
    document.getElementById('help-modal').classList.remove('active');
}

// Open theme modal
function openThemeModal() {
    document.getElementById('theme-modal').classList.add('active');
    const currentTheme = localStorage.getItem('theme') || 'default';
    updateThemeSelection(currentTheme);
}

// Close theme modal
function closeThemeModal() {
    document.getElementById('theme-modal').classList.remove('active');
}

// Update theme selection visual
function updateThemeSelection(theme) {
    document.querySelectorAll('.theme-option').forEach(option => {
        option.classList.remove('active');
        if (option.dataset.theme === theme) {
            option.classList.add('active');
        }
    });
}

// Apply theme
function applyTheme(themeName) {
    const root = document.documentElement;
    
    const themes = {
        default: {
            '--theme-primary': '#ff6b6b',
            '--theme-secondary': '#ffa500',
            '--theme-accent': '#ffd700',
            '--theme-bg-start': '#ff9a9e',
            '--theme-bg-end': '#fecfef',
            '--theme-header': 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 50%, #ffd700 100%)',
            '--theme-day-senin': '#ff6b6b',
            '--theme-day-selasa': '#ffa500',
            '--theme-day-rabu': '#ffd700',
            '--theme-day-kamis': '#98d8c8',
            '--theme-day-jumat': '#6c5ce7',
            '--theme-day-sabtu': '#a29bfe',
            '--theme-day-minggu': '#fd79a8'
        },
        green: {
            '--theme-primary': '#11998e',
            '--theme-secondary': '#38ef7d',
            '--theme-accent': '#a8e063',
            '--theme-bg-start': '#a8e063',
            '--theme-bg-end': '#d4fc79',
            '--theme-header': 'linear-gradient(135deg, #11998e 0%, #38ef7d 50%, #a8e063 100%)',
            '--theme-day-senin': '#11998e',
            '--theme-day-selasa': '#38ef7d',
            '--theme-day-rabu': '#a8e063',
            '--theme-day-kamis': '#00b894',
            '--theme-day-jumat': '#00cec9',
            '--theme-day-sabtu': '#55efc4',
            '--theme-day-minggu': '#81ecec'
        },
        blue: {
            '--theme-primary': '#667eea',
            '--theme-secondary': '#764ba2',
            '--theme-accent': '#a29bfe',
            '--theme-bg-start': '#a8c0ff',
            '--theme-bg-end': '#d4e4ff',
            '--theme-header': 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #a29bfe 100%)',
            '--theme-day-senin': '#667eea',
            '--theme-day-selasa': '#764ba2',
            '--theme-day-rabu': '#a29bfe',
            '--theme-day-kamis': '#6c5ce7',
            '--theme-day-jumat': '#5f4fcf',
            '--theme-day-sabtu': '#8e7fff',
            '--theme-day-minggu': '#b8b3ff'
        },
        purple: {
            '--theme-primary': '#6c5ce7',
            '--theme-secondary': '#a29bfe',
            '--theme-accent': '#fd79a8',
            '--theme-bg-start': '#d4b3ff',
            '--theme-bg-end': '#f0d4ff',
            '--theme-header': 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 50%, #fd79a8 100%)',
            '--theme-day-senin': '#6c5ce7',
            '--theme-day-selasa': '#a29bfe',
            '--theme-day-rabu': '#fd79a8',
            '--theme-day-kamis': '#5f4fcf',
            '--theme-day-jumat': '#8e7fff',
            '--theme-day-sabtu': '#b8b3ff',
            '--theme-day-minggu': '#ffb8d9'
        },
        orange: {
            '--theme-primary': '#ff7675',
            '--theme-secondary': '#fdcb6e',
            '--theme-accent': '#e17055',
            '--theme-bg-start': '#ffb8b8',
            '--theme-bg-end': '#ffe5b8',
            '--theme-header': 'linear-gradient(135deg, #ff7675 0%, #fdcb6e 50%, #e17055 100%)',
            '--theme-day-senin': '#ff7675',
            '--theme-day-selasa': '#fdcb6e',
            '--theme-day-rabu': '#e17055',
            '--theme-day-kamis': '#ff6b6b',
            '--theme-day-jumat': '#ffa500',
            '--theme-day-sabtu': '#ff8c00',
            '--theme-day-minggu': '#ff6348'
        },
        ocean: {
            '--theme-primary': '#0984e3',
            '--theme-secondary': '#74b9ff',
            '--theme-accent': '#00b894',
            '--theme-bg-start': '#81ecec',
            '--theme-bg-end': '#b8e6e6',
            '--theme-header': 'linear-gradient(135deg, #0984e3 0%, #74b9ff 50%, #00b894 100%)',
            '--theme-day-senin': '#0984e3',
            '--theme-day-selasa': '#74b9ff',
            '--theme-day-rabu': '#00b894',
            '--theme-day-kamis': '#00cec9',
            '--theme-day-jumat': '#55efc4',
            '--theme-day-sabtu': '#81ecec',
            '--theme-day-minggu': '#a8e6cf'
        }
    };

    const theme = themes[themeName] || themes.default;
    
    Object.keys(theme).forEach(key => {
        root.style.setProperty(key, theme[key]);
    });

    localStorage.setItem('theme', themeName);
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'default';
    applyTheme(savedTheme);
}

// Export meal plan and ingredients
function exportMealPlan() {
    const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    const mealTypes = {
        sarapan: 'Sarapan',
        siang: 'Makan Siang',
        malam: 'Makan Malam'
    };
    
    let exportText = '='.repeat(60) + '\n';
    exportText += 'DAFTAR MENU MAKANAN MINGGUAN\n';
    exportText += '='.repeat(60) + '\n\n';
    
    let hasMeals = false;
    
    days.forEach(day => {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        let dayContent = '';
        let dayHasMeals = false;
        
        Object.keys(mealTypes).forEach(mealType => {
            const key = `${day}_${mealType}`;
            const meal = mealPlan[key];
            
            if (meal && meal.name) {
                dayHasMeals = true;
                hasMeals = true;
                dayContent += `  ${mealTypes[mealType]}: ${meal.name}\n`;
                
                if (meal.ingredients && meal.ingredients.length > 0) {
                    dayContent += '    Bahan-bahan:\n';
                    meal.ingredients.forEach(ing => {
                        dayContent += `      - ${ing.name} (${ing.quantity})\n`;
                    });
                }
                dayContent += '\n';
            }
        });
        
        if (dayHasMeals) {
            exportText += `${dayName.toUpperCase()}\n`;
            exportText += '-'.repeat(60) + '\n';
            exportText += dayContent;
        }
    });
    
    if (!hasMeals) {
        alert('Belum ada menu makanan yang diisi. Isi menu terlebih dahulu!');
        return;
    }
    
    // Add shopping list summary
    exportText += '\n' + '='.repeat(60) + '\n';
    exportText += 'RINGKASAN BAHAN BELANJA\n';
    exportText += '='.repeat(60) + '\n\n';
    
    const ingredients = new Map();
    Object.keys(mealPlan).forEach(key => {
        const meal = mealPlan[key];
        if (meal.ingredients && meal.ingredients.length > 0) {
            meal.ingredients.forEach(ing => {
                const normalized = normalizeIngredient(ing.name);
                const existing = ingredients.get(normalized);
                
                if (existing) {
                    existing.quantity = combineQuantities(existing.quantity, ing.quantity);
                } else {
                    ingredients.set(normalized, {
                        name: ing.name,
                        quantity: ing.quantity || '1'
                    });
                }
            });
        }
    });
    
    if (ingredients.size > 0) {
        Array.from(ingredients.values()).forEach(item => {
            exportText += `- ${item.name} (${item.quantity})\n`;
        });
    } else {
        exportText += 'Belum ada bahan yang ditambahkan.\n';
    }
    
    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `Daftar_Menu_${date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Menu berhasil diekspor!');
}
