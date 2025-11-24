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
    document.getElementById('export-menu-btn').addEventListener('click', () => {
        hapticFeedback('light');
        showExportOptions();
    });

    // Export modal events
    document.getElementById('close-export-btn').addEventListener('click', closeExportModal);
    document.getElementById('close-export-btn-bottom').addEventListener('click', closeExportModal);
    
    // Close export modal when clicking outside
    document.getElementById('export-modal').addEventListener('click', (e) => {
        if (e.target.id === 'export-modal') {
            closeExportModal();
        }
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

// Show export options modal
function showExportOptions() {
    document.getElementById('export-modal').classList.add('active');
}

// Close export modal
function closeExportModal() {
    document.getElementById('export-modal').classList.remove('active');
}

// Export as HTML (Mobile-friendly)
function exportAsHTML() {
    closeExportModal();
    hapticFeedback('medium');
    
    const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    const mealTypes = {
        sarapan: 'Sarapan',
        siang: 'Makan Siang',
        malam: 'Makan Malam'
    };
    
    let hasMeals = false;
    let htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daftar Menu Mingguan</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            padding: 15px;
            background: #f5f5f5;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #ff6b6b;
            text-align: center;
            margin-bottom: 10px;
            font-size: 1.8em;
        }
        .subtitle {
            text-align: center;
            color: #666;
            margin-bottom: 30px;
            font-size: 0.9em;
        }
        .day-section {
            margin-bottom: 30px;
            border-bottom: 2px solid #eee;
            padding-bottom: 20px;
        }
        .day-section:last-child {
            border-bottom: none;
        }
        .day-title {
            color: #ff6b6b;
            font-size: 1.4em;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #ff6b6b;
        }
        .meal-item {
            margin-bottom: 15px;
            padding: 12px;
            background: #f9f9f9;
            border-radius: 8px;
            border-left: 4px solid #ffa500;
        }
        .meal-type {
            font-weight: bold;
            color: #333;
            font-size: 1.1em;
            margin-bottom: 5px;
        }
        .meal-name {
            color: #555;
            font-size: 1em;
            margin-bottom: 8px;
        }
        .ingredients {
            margin-top: 8px;
            padding-left: 15px;
        }
        .ingredients-title {
            font-size: 0.9em;
            color: #888;
            margin-bottom: 5px;
        }
        .ingredient {
            font-size: 0.9em;
            color: #666;
            margin: 3px 0;
        }
        .shopping-summary {
            margin-top: 40px;
            padding: 20px;
            background: linear-gradient(135deg, #fff5f5, #ffe5e5);
            border-radius: 10px;
            border: 2px solid #ffd0d0;
        }
        .shopping-title {
            color: #ff6b6b;
            font-size: 1.5em;
            margin-bottom: 15px;
            text-align: center;
        }
        .shopping-item {
            padding: 8px;
            margin: 5px 0;
            background: white;
            border-radius: 5px;
            font-size: 1em;
        }
        .date {
            text-align: center;
            color: #999;
            font-size: 0.85em;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🛒 Daftar Menu Mingguan</h1>
        <div class="subtitle">${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
`;

    days.forEach(day => {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        let dayHtml = '';
        let dayHasMeals = false;
        
        Object.keys(mealTypes).forEach(mealType => {
            const key = `${day}_${mealType}`;
            const meal = mealPlan[key];
            
            if (meal && meal.name) {
                dayHasMeals = true;
                hasMeals = true;
                dayHtml += `
                    <div class="meal-item">
                        <div class="meal-type">${mealTypes[mealType]}</div>
                        <div class="meal-name">${escapeHtml(meal.name)}</div>`;
                
                if (meal.ingredients && meal.ingredients.length > 0) {
                    dayHtml += '<div class="ingredients">';
                    dayHtml += '<div class="ingredients-title">Bahan-bahan:</div>';
                    meal.ingredients.forEach(ing => {
                        dayHtml += `<div class="ingredient">• ${escapeHtml(ing.name)} (${escapeHtml(ing.quantity)})</div>`;
                    });
                    dayHtml += '</div>';
                }
                dayHtml += '</div>';
            }
        });
        
        if (dayHasMeals) {
            htmlContent += `
        <div class="day-section">
            <div class="day-title">${dayName.toUpperCase()}</div>
            ${dayHtml}
        </div>`;
        }
    });
    
    if (!hasMeals) {
        alert('Belum ada menu makanan yang diisi. Isi menu terlebih dahulu!');
        return;
    }
    
    // Add shopping list summary
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
    
    htmlContent += `
        <div class="shopping-summary">
            <div class="shopping-title">📋 Ringkasan Bahan Belanja</div>`;
    
    if (ingredients.size > 0) {
        Array.from(ingredients.values()).forEach(item => {
            htmlContent += `<div class="shopping-item">• ${escapeHtml(item.name)} - ${escapeHtml(item.quantity)}</div>`;
        });
    } else {
        htmlContent += '<div class="shopping-item" style="text-align:center;color:#999;">Belum ada bahan yang ditambahkan.</div>';
    }
    
    htmlContent += `
        </div>
        <div class="date">Dibuat: ${new Date().toLocaleDateString('id-ID')}</div>
    </div>
</body>
</html>`;
    
    // Download HTML file
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `Daftar_Menu_${date}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Menu berhasil diekspor ke format HTML! File bisa dibuka di browser HP.');
}

// Export as PDF (using print to PDF)
function exportAsPDF() {
    closeExportModal();
    hapticFeedback('medium');
    
    // Create temporary HTML for PDF
    const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    const mealTypes = {
        sarapan: 'Sarapan',
        siang: 'Makan Siang',
        malam: 'Makan Malam'
    };
    
    let hasMeals = false;
    let printContent = `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto;">
            <h1 style="color: #ff6b6b; text-align: center; margin-bottom: 10px;">🛒 Daftar Menu Mingguan</h1>
            <p style="text-align: center; color: #666; margin-bottom: 30px;">${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    `;
    
    days.forEach(day => {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        let dayHtml = '';
        let dayHasMeals = false;
        
        Object.keys(mealTypes).forEach(mealType => {
            const key = `${day}_${mealType}`;
            const meal = mealPlan[key];
            
            if (meal && meal.name) {
                dayHasMeals = true;
                hasMeals = true;
                dayHtml += `
                    <div style="margin-bottom: 15px; padding: 12px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #ffa500;">
                        <div style="font-weight: bold; color: #333; margin-bottom: 5px;">${mealTypes[mealType]}</div>
                        <div style="color: #555; margin-bottom: 8px;">${escapeHtml(meal.name)}</div>`;
                
                if (meal.ingredients && meal.ingredients.length > 0) {
                    dayHtml += '<div style="margin-top: 8px; padding-left: 15px;">';
                    dayHtml += '<div style="font-size: 0.9em; color: #888; margin-bottom: 5px;">Bahan-bahan:</div>';
                    meal.ingredients.forEach(ing => {
                        dayHtml += `<div style="font-size: 0.9em; color: #666; margin: 3px 0;">• ${escapeHtml(ing.name)} (${escapeHtml(ing.quantity)})</div>`;
                    });
                    dayHtml += '</div>';
                }
                dayHtml += '</div>';
            }
        });
        
        if (dayHasMeals) {
            printContent += `
            <div style="margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
                <h2 style="color: #ff6b6b; font-size: 1.4em; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #ff6b6b;">${dayName.toUpperCase()}</h2>
                ${dayHtml}
            </div>`;
        }
    });
    
    if (!hasMeals) {
        alert('Belum ada menu makanan yang diisi. Isi menu terlebih dahulu!');
        return;
    }
    
    // Add shopping list
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
    
    printContent += `
            <div style="margin-top: 40px; padding: 20px; background: #fff5f5; border-radius: 10px; border: 2px solid #ffd0d0;">
                <h2 style="color: #ff6b6b; font-size: 1.5em; margin-bottom: 15px; text-align: center;">📋 Ringkasan Bahan Belanja</h2>`;
    
    if (ingredients.size > 0) {
        Array.from(ingredients.values()).forEach(item => {
            printContent += `<div style="padding: 8px; margin: 5px 0; background: white; border-radius: 5px;">• ${escapeHtml(item.name)} - ${escapeHtml(item.quantity)}</div>`;
        });
    }
    
    printContent += `
            </div>
            <p style="text-align: center; color: #999; font-size: 0.85em; margin-top: 20px;">Dibuat: ${new Date().toLocaleDateString('id-ID')}</p>
        </div>
    `;
    
    // Open print dialog
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Daftar Menu Mingguan</title>
            <style>
                @media print {
                    @page { margin: 1cm; }
                    body { margin: 0; padding: 0; }
                }
            </style>
        </head>
        <body>${printContent}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
            alert('Gunakan "Save as PDF" untuk menyimpan sebagai PDF!');
        }, 250);
    };
}

// Export as Text (original)
function exportAsText() {
    closeExportModal();
    hapticFeedback('light');
    exportMealPlan();
}

// Share menu (mobile-friendly)
function shareMenu() {
    closeExportModal();
    hapticFeedback('medium');
    
    const days = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
    const mealTypes = {
        sarapan: 'Sarapan',
        siang: 'Makan Siang',
        malam: 'Makan Malam'
    };
    
    let shareText = '🛒 *DAFTAR MENU MINGGUAN*\n\n';
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
                dayContent += `${mealTypes[mealType]}: ${meal.name}\n`;
                
                if (meal.ingredients && meal.ingredients.length > 0) {
                    dayContent += 'Bahan: ';
                    const ingList = meal.ingredients.map(ing => `${ing.name} (${ing.quantity})`).join(', ');
                    dayContent += ingList + '\n';
                }
                dayContent += '\n';
            }
        });
        
        if (dayHasMeals) {
            shareText += `*${dayName.toUpperCase()}*\n${dayContent}`;
        }
    });
    
    if (!hasMeals) {
        alert('Belum ada menu makanan yang diisi. Isi menu terlebih dahulu!');
        return;
    }
    
    // Add shopping list
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
    
    shareText += '\n📋 *RINGKASAN BAHAN BELANJA*\n\n';
    
    if (ingredients.size > 0) {
        Array.from(ingredients.values()).forEach(item => {
            shareText += `• ${item.name} - ${item.quantity}\n`;
        });
    }
    
    // Use Web Share API if available
    if (navigator.share) {
        navigator.share({
            title: 'Daftar Menu Mingguan',
            text: shareText
        }).catch(() => {
            // Fallback to copy
            copyToClipboard(shareText);
        });
    } else {
        // Fallback: copy to clipboard
        copyToClipboard(shareText);
    }
}

// Copy to clipboard helper
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Menu berhasil disalin ke clipboard! Bisa paste di WhatsApp, Email, dll.');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

// Fallback copy method
function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert('Menu berhasil disalin! Bisa paste di WhatsApp, Email, dll.');
    } catch (err) {
        alert('Gagal menyalin. Silakan copy manual dari teks yang akan muncul.');
        prompt('Copy teks berikut:', text);
    }
    document.body.removeChild(textarea);
}

// Escape HTML helper
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions available globally
window.exportAsHTML = exportAsHTML;
window.exportAsPDF = exportAsPDF;
window.exportAsText = exportAsText;
window.shareMenu = shareMenu;

// Export meal plan and ingredients (Text format - original)
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
