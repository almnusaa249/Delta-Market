// Global variables
let isPasswordReset = false;
let pendingUserId = null;
let pendingOtp = null;
let pendingResetToken = null;

const API_URL = '/api';
let currentUser = null;
let currentStore = null;
let isEnglish = false;
let selectedChatUser = null;
let invoiceItems = [];

// Translations
const translations = {
    ar: {
        login: 'تسجيل الدخول',
        register: 'إنشاء حساب',
        logout: 'خروج',
        products: 'المنتجات',
        salesInvoices: 'فواتير البيع',
        purchaseInvoices: 'فواتير الشراء',
        marketplace: 'السوق',
        messages: 'الرسائل',
        inventory: 'المخزون',
        profile: 'الملف الشخصي',
        settings: 'الإعدادات',
        createStore: 'إنشاء متجر',
        storeName: 'اسم المتجر',
        addProduct: 'إضافة منتج',
        productName: 'اسم المنتج',
        price: 'السعر',
        quantity: 'الكمية',
        description: 'الوصف',
        save: 'حفظ',
        cancel: 'إلغاء',
        delete: 'حذف',
        edit: 'تعديل',
        buy: 'شراء',
        total: 'الإجمالي',
        send: 'إرسال',
        back: 'رجوع',
        noProducts: 'لا توجد منتجات',
        noInvoices: 'لا توجد فواتير',
        noMessages: 'لا توجد رسائل',
        loading: 'جاري التحميل...',
        error: 'حدث خطأ',
        success: 'نجاح',
        confirm: 'تأكيد',
        noStore: 'لم تقم بإنشاء متجر بعد',
        welcome: 'مرحباً',
        enterMessage: 'اكتب رسالتك...',
        selectProduct: 'اختر منتج',
        stock: 'المخزون',
        lowStock: 'مخزون منخفض',
        outOfStock: 'نفد المخزون',
        owner: 'المالك'
    },
    en: {
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        products: 'Products',
        salesInvoices: 'Sales Invoices',
        purchaseInvoices: 'Purchase Invoices',
        marketplace: 'Marketplace',
        messages: 'Messages',
        inventory: 'Inventory',
        profile: 'Profile',
        settings: 'Settings',
        createStore: 'Create Store',
        storeName: 'Store Name',
        addProduct: 'Add Product',
        productName: 'Product Name',
        price: 'Price',
        quantity: 'Quantity',
        description: 'Description',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        buy: 'Buy',
        total: 'Total',
        send: 'Send',
        back: 'Back',
        noProducts: 'No products found',
        noInvoices: 'No invoices found',
        noMessages: 'No messages found',
        loading: 'Loading...',
        error: 'An error occurred',
        success: 'Success',
        confirm: 'Confirm',
        noStore: 'You haven\'t created a store yet',
        welcome: 'Welcome',
        enterMessage: 'Type your message...',
        selectProduct: 'Select product',
        stock: 'Stock',
        lowStock: 'Low stock',
        outOfStock: 'Out of stock',
        owner: 'Owner'
    }
};

function t(key) {
    return translations[isEnglish ? 'en' : 'ar'][key] || key;
}

// Helper Functions
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
}

function getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

function removeUser() {
    localStorage.removeItem('user');
}

function getStore() {
    const store = localStorage.getItem('store');
    return store ? JSON.parse(store) : null;
}

function setStore(store) {
    localStorage.setItem('store', JSON.stringify(store));
}

function removeStore() {
    localStorage.removeItem('store');
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };

    const token = getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
        method,
        headers
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'حدث خطأ');
    }

    return data;
}

// Modal Functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showLogin() {
    closeModal('registerModal');
    closeModal('forgotPasswordModal');
    openModal('loginModal');
}

function showRegister() {
    closeModal('loginModal');
    openModal('registerModal');
}

function showForgotPassword() {
    closeModal('loginModal');
    openModal('forgotPasswordModal');
}

// Page Navigation
function showPage(pageId) {
    const pages = ['landingPage', 'dashboard', 'productsPage', 'marketplacePage', 'storeProductsPage', 
                   'salesInvoicesPage', 'purchaseInvoicesPage', 'messagesPage', 'inventoryPage'];
    
    pages.forEach(page => {
        document.getElementById(page).classList.add('hidden');
    });
    
    document.getElementById(pageId).classList.remove('hidden');
}

function goBack() {
    if (currentStore) {
        showPage('dashboard');
    } else {
        showPage('landingPage');
    }
}

// Auth Functions
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        const result = await apiRequest('/auth/login', 'POST', data);
        setToken(result.data.token);
        setUser(result.data.user);
        setStore(result.data.store);
        
        closeModal('loginModal');
        e.target.reset();
        
        if (result.data.store) {
            currentStore = result.data.store;
            showDashboard();
        } else {
            showDashboardNoStore();
        }
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        full_name: formData.get('full_name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        password: formData.get('password')
    };

    try {
        const result = await apiRequest('/auth/register', 'POST', data);
        alert('تم إنشاء الحساب بنجاح. الرمز: ' + result.data.otp);
        
        document.getElementById('otpUserId').value = result.data.user_id;
        closeModal('registerModal');
        openModal('otpModal');
        e.target.reset();
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('otpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        user_id: formData.get('user_id'),
        otp: formData.get('otp')
    };

    try {
        let result;
        if (isPasswordReset) {
            // Use verify-reset-otp for password reset
            result = await apiRequest('/auth/verify-reset-otp', 'POST', data);
            pendingResetToken = result.data.reset_token;
        } else {
            // Use verify-otp for registration
            result = await apiRequest('/auth/verify-otp', 'POST', data);
        }
        
        if (isPasswordReset) {
            // Show reset password modal
            document.getElementById('resetUserId').value = data.user_id;
            document.getElementById('resetToken').value = pendingResetToken;
            closeModal('otpModal');
            openModal('resetPasswordModal');
        } else {
            closeModal('otpModal');
            alert('تم التحقق بنجاح. يرجى تسجيل الدخول.');
        }
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        email: formData.get('email')
    };

    try {
        const result = await apiRequest('/auth/forgot-password', 'POST', data);
        alert('تم إرسال رمز التحقق. الرمز: ' + result.data.otp);
        
        isPasswordReset = true;
        pendingUserId = result.data.user_id;
        document.getElementById('otpUserId').value = result.data.user_id;
        closeModal('forgotPasswordModal');
        openModal('otpModal');
        e.target.reset();
    } catch (error) {
        alert(error.message);
    }
});

function logout() {
    removeToken();
    removeUser();
    removeStore();
    currentUser = null;
    currentStore = null;
    showPage('landingPage');
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.toggle('hidden');
}

// Dashboard Functions
async function showDashboard() {
    currentUser = getUser();
    currentStore = getStore();
    
    if (!currentUser) {
        showPage('landingPage');
        return;
    }

    document.getElementById('userName').textContent = currentUser.full_name;
    
    if (currentStore) {
        document.getElementById('storeName').textContent = currentStore.store_name;
        document.getElementById('storeDescription').textContent = currentStore.description || '';
        document.getElementById('createStoreBtn').classList.add('hidden');
    } else {
        document.getElementById('storeName').textContent = 'متجري';
        document.getElementById('storeDescription').textContent = '';
        document.getElementById('createStoreBtn').classList.remove('hidden');
    }

    // Get unread messages count
    try {
        const result = await apiRequest('/messages/unread/count');
        const count = result.data.count;
        document.getElementById('messagesCount').textContent = count > 0 ? `(${count}) رسائل جديدة` : 'الرسائل';
    } catch (error) {
        console.error(error);
    }

    showPage('dashboard');
}

async function showDashboardNoStore() {
    currentUser = getUser();
    document.getElementById('userName').textContent = currentUser.full_name;
    document.getElementById('storeName').textContent = 'متجري';
    document.getElementById('storeDescription').textContent = '';
    document.getElementById('createStoreBtn').classList.remove('hidden');
    showPage('dashboard');
}

// Store Functions
document.getElementById('createStoreForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        store_name: formData.get('store_name'),
        description: formData.get('description')
    };

    try {
        const result = await apiRequest('/stores', 'POST', data);
        currentStore = result.data;
        setStore(currentStore);
        closeModal('createStoreModal');
        showDashboard();
        alert('تم إنشاء المتجر بنجاح');
    } catch (error) {
        alert(error.message);
    }
});

function showCreateStore() {
    openModal('createStoreModal');
}

// Products Functions
async function showProducts() {
    if (!currentStore) {
        alert('يرجى إنشاء متجر أولاً');
        return;
    }

    try {
        const result = await apiRequest('/products/my-products');
        const products = result.data;
        
        const productsList = document.getElementById('productsList');
        
        if (products.length === 0) {
            productsList.innerHTML = '<p class="text-center">لا توجد منتجات</p>';
        } else {
            productsList.innerHTML = products.map(product => `
                <div class="product-card">
                    <div class="product-image">
                        ${product.image_url ? `<img src="${product.image_url}" alt="${product.product_name}">` : '<i class="fas fa-box"></i>'}
                    </div>
                    <div class="product-info">
                        <h3>${product.product_name}</h3>
                        <div class="product-price">${product.price} $</div>
                        <div class="product-stock">المخزون: ${product.stock_quantity}</div>
                        <div class="product-actions">
                            <button class="btn-primary" onclick="editProduct(${product.id}, '${product.product_name}', ${product.price}, ${product.stock_quantity}, '${product.description}', '${product.image_url}')">
                                <i class="fas fa-edit"></i> تعديل
                            </button>
                            <button class="btn-secondary" style="border-color: #f44336; color: #f44336;" onclick="deleteProduct(${product.id})">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
        
        showPage('productsPage');
    } catch (error) {
        alert(error.message);
    }
}

function showAddProduct() {
    document.getElementById('productId').value = '';
    document.getElementById('addProductForm').reset();
    openModal('addProductModal');
}

function editProduct(id, name, price, stock, description, image) {
    document.getElementById('productId').value = id;
    document.querySelector('#addProductForm input[name="product_name"]').value = name;
    document.querySelector('#addProductForm input[name="price"]').value = price;
    document.querySelector('#addProductForm input[name="stock_quantity"]').value = stock;
    document.querySelector('#addProductForm textarea[name="description"]').value = description || '';
    document.querySelector('#addProductForm input[name="image_url"]').value = image || '';
    openModal('addProductModal');
}

document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const productId = formData.get('product_id');
    const data = {
        product_name: formData.get('product_name'),
        price: parseFloat(formData.get('price')),
        stock_quantity: parseInt(formData.get('stock_quantity')) || 0,
        description: formData.get('description'),
        image_url: formData.get('image_url')
    };

    try {
        if (productId) {
            await apiRequest(`/products/${productId}`, 'PUT', data);
            alert('تم تحديث المنتج بنجاح');
        } else {
            await apiRequest('/products', 'POST', data);
            alert('تمت إضافة المنتج بنجاح');
        }
        closeModal('addProductModal');
        showProducts();
    } catch (error) {
        alert(error.message);
    }
});

async function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

    try {
        await apiRequest(`/products/${id}`, 'DELETE');
        showProducts();
        alert('تم حذف المنتج بنجاح');
    } catch (error) {
        alert(error.message);
    }
}

// Marketplace Functions
async function showMarketplace() {
    try {
        const result = await apiRequest('/stores/all');
        const stores = result.data;
        
        const storesList = document.getElementById('storesList');
        
        if (stores.length === 0) {
            storesList.innerHTML = '<p class="text-center">لا توجد متاجر أخرى</p>';
        } else {
            storesList.innerHTML = stores.map(store => `
                <div class="store-card" onclick="showStoreProducts(${store.id}, '${store.store_name}')">
                    <h3>${store.store_name}</h3>
                    <p>${store.description || ''}</p>
                    <p>المالك: ${store.owner_name}</p>
                    <button class="btn-primary" onclick="event.stopPropagation(); contactStoreOwner(${store.owner_id}, '${store.owner_name}')">
                        <i class="fas fa-envelope"></i> تواصل
                    </button>
                </div>
            `).join('');
        }
        
        showPage('marketplacePage');
    } catch (error) {
        alert(error.message);
    }
}

async function showStoreProducts(storeId, storeName) {
    try {
        const result = await apiRequest(`/products/store/${storeId}`);
        const products = result.data;
        
        document.getElementById('storeProductsTitle').textContent = `منتجات ${storeName}`;
        
        const productsList = document.getElementById('storeProductsList');
        
        if (products.length === 0) {
            productsList.innerHTML = '<p class="text-center">لا توجد منتجات</p>';
        } else {
            productsList.innerHTML = products.map(product => `
                <div class="product-card">
                    <div class="product-image">
                        ${product.image_url ? `<img src="${product.image_url}" alt="${product.product_name}">` : '<i class="fas fa-box"></i>'}
                    </div>
                    <div class="product-info">
                        <h3>${product.product_name}</h3>
                        <div class="product-price">${product.price} $</div>
                        <div class="product-stock">المخزون: ${product.stock_quantity}</div>
                        ${product.stock_quantity > 0 ? `
                        <div class="product-actions">
                            <button class="btn-primary" onclick="buyProduct(${product.id}, '${product.product_name}', ${product.price})">
                                <i class="fas fa-shopping-cart"></i> شراء
                            </button>
                        </div>
                        ` : '<p style="color: red;">نفد المخزون</p>'}
                    </div>
                </div>
            `).join('');
        }
        
        showPage('storeProductsPage');
    } catch (error) {
        alert(error.message);
    }
}

function contactStoreOwner(userId, userName) {
    document.getElementById('messageReceiverId').value = userId;
    openModal('messageModal');
}

function buyProduct(productId, productName, price) {
    // For now, just send a message to the store owner
    alert(`سيتم إضافة منتج ${productName} للشراء. يرجى التواصل مع التاجر.`);
}

// Invoice Functions
async function showSalesInvoices() {
    if (!currentStore) {
        alert('يرجى إنشاء متجر أولاً');
        return;
    }

    try {
        const result = await apiRequest('/invoices/sales');
        const invoices = result.data;
        
        const invoicesList = document.getElementById('salesInvoicesList');
        
        if (invoices.length === 0) {
            invoicesList.innerHTML = '<p class="text-center">لا توجد فواتير</p>';
        } else {
            invoicesList.innerHTML = invoices.map(invoice => `
                <div class="invoice-item">
                    <div class="invoice-info">
                        <h3>فاتورة رقم ${invoice.id}</h3>
                        <p>العميل: ${invoice.client_name || 'غير محدد'}</p>
                        <p>التاريخ: ${new Date(invoice.created_at).toLocaleDateString('ar')}</p>
                    </div>
                    <div class="invoice-amount">${invoice.total_amount} $</div>
                </div>
            `).join('');
        }
        
        showPage('salesInvoicesPage');
    } catch (error) {
        alert(error.message);
    }
}

async function showPurchaseInvoices() {
    if (!currentStore) {
        alert('يرجى إنشاء متجر أولاً');
        return;
    }

    try {
        const result = await apiRequest('/invoices/purchases');
        const invoices = result.data;
        
        const invoicesList = document.getElementById('purchaseInvoicesList');
        
        if (invoices.length === 0) {
            invoicesList.innerHTML = '<p class="text-center">لا توجد فواتير</p>';
        } else {
            invoicesList.innerHTML = invoices.map(invoice => `
                <div class="invoice-item">
                    <div class="invoice-info">
                        <h3>فاتورة رقم ${invoice.id}</h3>
                        <p>المورد: ${invoice.supplier_name || 'غير محدد'}</p>
                        <p>التاريخ: ${new Date(invoice.created_at).toLocaleDateString('ar')}</p>
                    </div>
                    <div class="invoice-amount">${invoice.total_amount} $</div>
                </div>
            `).join('');
        }
        
        showPage('purchaseInvoicesPage');
    } catch (error) {
        alert(error.message);
    }
}

async function showCreateInvoice(type) {
    if (!currentStore) {
        alert('يرجى إنشاء متجر أولاً');
        return;
    }

    document.getElementById('invoiceType').value = type;
    document.getElementById('invoiceModalTitle').textContent = type === 'sales' ? 'إنشاء فاتورة بيع' : 'إنشاء فاتورة شراء';
    document.getElementById('clientLabel').textContent = type === 'sales' ? 'اسم العميل' : 'اسم المورد';
    document.getElementById('phoneLabel').textContent = 'رقم الهاتف';

    try {
        const result = await apiRequest('/products/my-products');
        const products = result.data;
        
        const productsContainer = document.getElementById('invoiceProducts');
        invoiceItems = [];
        
        if (products.length === 0) {
            productsContainer.innerHTML = '<p>لا توجد منتجات</p>';
        } else {
            productsContainer.innerHTML = products.map(product => `
                <div class="invoice-product-item">
                    <input type="checkbox" id="product-${product.id}" data-id="${product.id}" data-price="${product.price}" data-name="${product.product_name}" onchange="toggleInvoiceProduct(this)">
                    <div class="product-details">
                        <strong>${product.product_name}</strong>
                        <span>${product.price} $</span>
                        <span style="color: #888;">(المخزون: ${product.stock_quantity})</span>
                    </div>
                    <input type="number" id="qty-${product.id}" min="1" value="1" disabled onchange="updateInvoiceTotal()">
                </div>
            `).join('');
        }
        
        document.getElementById('invoiceTotal').textContent = '0';
        openModal('invoiceModal');
    } catch (error) {
        alert(error.message);
    }
}

function toggleInvoiceProduct(checkbox) {
    const productId = checkbox.dataset.id;
    const qtyInput = document.getElementById(`qty-${productId}`);
    qtyInput.disabled = !checkbox.checked;
    
    if (checkbox.checked) {
        invoiceItems.push({
            product_id: parseInt(productId),
            price: parseFloat(checkbox.dataset.price),
            quantity: parseInt(qtyInput.value)
        });
    } else {
        invoiceItems = invoiceItems.filter(item => item.product_id !== parseInt(productId));
    }
    
    updateInvoiceTotal();
}

function updateInvoiceTotal() {
    let total = 0;
    invoiceItems.forEach((item, index) => {
        const checkbox = document.getElementById(`product-${item.product_id}`);
        const qtyInput = document.getElementById(`qty-${item.product_id}`);
        item.quantity = parseInt(qtyInput.value);
        total += item.price * item.quantity;
    });
    document.getElementById('invoiceTotal').textContent = total.toFixed(2);
}

document.getElementById('invoiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (invoiceItems.length === 0) {
        alert('يرجى اختيار منتج واحد على الأقل');
        return;
    }

    const type = document.getElementById('invoiceType').value;
    const formData = new FormData(e.target);
    
    const data = {
        client_name: formData.get('client_name'),
        client_phone: formData.get('client_phone'),
        items: invoiceItems
    };

    try {
        await apiRequest(`/invoices/${type}`, 'POST', data);
        closeModal('invoiceModal');
        alert('تم إنشاء الفاتورة بنجاح');
        
        if (type === 'sales') {
            showSalesInvoices();
        } else {
            showPurchaseInvoices();
        }
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById('messageForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        receiver_id: parseInt(formData.get('receiver_id')),
        content: formData.get('content')
    };

    try {
        await apiRequest('/messages', 'POST', data);
        closeModal('messageModal');
        alert('تم إرسال الرسالة بنجاح');
        e.target.reset();
    } catch (error) {
        alert(error.message);
    }
});

// Messages Functions
async function showMessages() {
    try {
        const result = await apiRequest('/messages/conversations');
        const conversations = result.data;
        
        const conversationsList = document.getElementById('conversationsList');
        
        if (conversations.length === 0) {
            conversationsList.innerHTML = '<p style="padding: 20px; text-align: center;">لا توجد محادثات</p>';
        } else {
            conversationsList.innerHTML = conversations.map(conv => `
                <div class="conversation-item" onclick="openChat(${conv.other_user_id}, '${conv.other_user_name}')">
                    <div class="conversation-name">${conv.other_user_name}</div>
                    <div class="conversation-preview">${conv.last_message || ''}</div>
                    ${conv.unread_count > 0 ? `<span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${conv.unread_count}</span>` : ''}
                </div>
            `).join('');
        }
        
        showPage('messagesPage');
    } catch (error) {
        alert(error.message);
    }
}

async function openChat(userId, userName) {
    selectedChatUser = { id: userId, name: userName };
    document.getElementById('chatUserName').textContent = userName;
    document.getElementById('chatArea').classList.remove('hidden');
    
    // Highlight selected conversation
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.closest('.conversation-item').classList.add('active');
    
    try {
        const result = await apiRequest(`/messages/${userId}`);
        const messages = result.data;
        
        const chatMessages = document.getElementById('chatMessages');
        
        chatMessages.innerHTML = messages.map(msg => `
            <div class="message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}">
                ${msg.content}
            </div>
        `).join('');
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        alert(error.message);
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !selectedChatUser) return;
    
    try {
        await apiRequest('/messages', 'POST', {
            receiver_id: selectedChatUser.id,
            content: content
        });
        
        input.value = '';
        openChat(selectedChatUser.id, selectedChatUser.name);
    } catch (error) {
        alert(error.message);
    }
}

// Inventory Functions
async function showInventory() {
    if (!currentStore) {
        alert('يرجى إنشاء متجر أولاً');
        return;
    }

    try {
        const result = await apiRequest('/products/my-products');
        const products = result.data;
        
        const inventoryList = document.getElementById('inventoryList');
        
        if (products.length === 0) {
            inventoryList.innerHTML = '<p class="text-center">لا توجد منتجات</p>';
        } else {
            inventoryList.innerHTML = products.map(product => {
                let stockClass = '';
                let stockText = product.stock_quantity;
                
                if (product.stock_quantity === 0) {
                    stockClass = 'out';
                    stockText = 'نفد';
                } else if (product.stock_quantity < 10) {
                    stockClass = 'low';
                    stockText = 'منخفض';
                }
                
                return `
                    <div class="inventory-item">
                        <h3>${product.product_name}</h3>
                        <div class="inventory-stock ${stockClass}">${product.stock_quantity}</div>
                        <p>${stockText}</p>
                    </div>
                `;
            }).join('');
        }
        
        showPage('inventoryPage');
    } catch (error) {
        alert(error.message);
    }
}

// Language Toggle
function toggleLanguage() {
    isEnglish = !isEnglish;
    document.getElementById('langText').textContent = isEnglish ? 'العربية' : 'English';
    
    // Update page direction
    document.documentElement.lang = isEnglish ? 'en' : 'ar';
    document.documentElement.dir = isEnglish ? 'ltr' : 'rtl';
    
    // Refresh current page
    if (!getToken()) {
        showPage('landingPage');
    } else if (document.getElementById('dashboard').classList.contains('hidden') === false) {
        showDashboard();
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    const token = getToken();
    if (token) {
        showDashboard();
    } else {
        showPage('landingPage');
    }
});

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};

// Reset Password Form Handler
document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    if (newPassword !== confirmPassword) {
        alert('كلمات المرور غير متطابقة');
        return;
    }
    
    const data = {
        user_id: formData.get('user_id'),
        reset_token: formData.get('reset_token'),
        new_password: newPassword
    };

    try {
        await apiRequest('/auth/reset-password', 'POST', data);
        alert('تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول.');
        closeModal('resetPasswordModal');
        isPasswordReset = false;
        pendingResetToken = null;
        e.target.reset();
        showLogin();
    } catch (error) {
        alert(error.message);
    }
});
