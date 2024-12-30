// משתנים גלובליים
let expenses = [];
let unrecognizedExpenses = [];
let fixedAssets = [];
let monthlyIncomes = {};
const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
let expensesChart = null;

// משתנים גלובליים לניהול קטגוריות
let currentCategory = '';
let currentCategoryData = null;

// הוספת סגנון CSS להוצאות כפולות
const style = document.createElement('style');
style.textContent = `
    .duplicate-expense {
        background-color: #ffebee !important;
    }
    .duplicate-expense td {
        color: #d32f2f !important;
    }
`;
document.head.appendChild(style);

// אתחול הדף
document.addEventListener('DOMContentLoaded', (event) => {
    try {
        // טעינת נתונים מהאחסון המקומי
        loadExpensesFromStorage();
        loadMonthlyIncomesFromStorage();
        
        // תיקון פורמט התאריכים
        fixExistingDates();
        
        // הוספת מאזינים לפילטרים
        const filters = {
            yearFilter: document.getElementById('yearFilter'),
            monthFilter: document.getElementById('monthFilter'),
            categoryFilter: document.getElementById('categoryFilter'),
            searchInput: document.getElementById('searchInput')
        };

        // Add event listeners to filters if they exist
        Object.entries(filters).forEach(([key, element]) => {
            if (element) {
                element.addEventListener(key === 'searchInput' ? 'input' : 'change', filterExpenses);
            }
        });

        // Get all required table bodies
        const tables = {
            regular: document.getElementById('regularExpensesTableBody'),
            unrecognized: document.getElementById('unrecognizedExpensesTableBody'),
            'fixed-assets': document.getElementById('fixed-assetsExpensesTableBody')
        };

        // Check if all required tables exist
        Object.entries(tables).forEach(([key, table]) => {
            if (!table) {
                throw new Error(`Table body not found: ${key}ExpensesTableBody`);
            }
        });

        // Initialize all data displays
        displayExpenses(expenses, 'regular');
        displayExpenses(unrecognizedExpenses, 'unrecognized');
        displayExpenses(fixedAssets, 'fixed-assets');
        
        // Update all UI components
        updateAll();
    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

// שמירת נתונים בזיכרון המקומי
function saveExpensesToStorage() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
    localStorage.setItem('unrecognizedExpenses', JSON.stringify(unrecognizedExpenses));
    localStorage.setItem('fixedAssets', JSON.stringify(fixedAssets));
}

// טעינת נתונים מהזיכרון המקומי
function loadExpensesFromStorage() {
    try {
        const savedExpenses = localStorage.getItem('expenses');
        const savedUnrecognizedExpenses = localStorage.getItem('unrecognizedExpenses');
        const savedFixedAssets = localStorage.getItem('fixedAssets');

        if (savedExpenses) {
            expenses = JSON.parse(savedExpenses).filter(expense => {
                return expense && expense.date && expense.amount;
            });
        } else {
            expenses = [];
        }

        if (savedUnrecognizedExpenses) {
            unrecognizedExpenses = JSON.parse(savedUnrecognizedExpenses).filter(expense => {
                return expense && expense.date && expense.amount;
            });
        } else {
            unrecognizedExpenses = [];
        }

        if (savedFixedAssets) {
            fixedAssets = JSON.parse(savedFixedAssets).filter(expense => {
                return expense && expense.date && expense.amount;
            });
        } else {
            fixedAssets = [];
        }
    } catch (error) {
        console.error('Error loading expenses from storage:', error);
        expenses = [];
        unrecognizedExpenses = [];
        fixedAssets = [];
    }
}

// שמירת הכנסות חודשיות ב-localStorage
function saveMonthlyIncomesToStorage() {
    localStorage.setItem('monthlyIncomes', JSON.stringify(monthlyIncomes));
}

// טעינת הכנסות חודשיות מ-localStorage
function loadMonthlyIncomesFromStorage() {
    const savedIncomes = localStorage.getItem('monthlyIncomes');
    if (savedIncomes) {
        monthlyIncomes = JSON.parse(savedIncomes);
    }
}

// החלפת כרטיסייה
function showTab(tabName) {
    // הסתרת כל הכרטיסיות
    document.querySelectorAll('.tab-pane').forEach(tab => {
        tab.classList.remove('show', 'active');
    });

    // הצגת הכרטיסייה הנבחרת
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.add('show', 'active');
    }

    // עדכון הכפתורים
    document.querySelectorAll('.nav-link').forEach(button => {
        button.classList.remove('active');
    });

    const activeButton = document.querySelector(`.nav-link[onclick="showTab('${tabName}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// הצגת הוצאות בטבלה
function displayExpenses(expenses, tabName) {
    if (!expenses) return;

    const tableBodyId = tabName === 'fixed-assets' ? 'fixed-assetsExpensesTableBody' : `${tabName}ExpensesTableBody`;
    const tableBody = document.getElementById(tableBodyId);
    
    if (!tableBody) {
        console.error(`Table body not found for tab: ${tabName}, ID: ${tableBodyId}`);
        return;
    }

    // ניקוי הטבלה
    tableBody.innerHTML = '';

    // מיון ההוצאות לפי תאריך
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    // קיבוץ הוצאות לפי חודש
    const expensesByMonth = {};
    let totalAmount = 0;
    let totalActualAmount = 0;

    expenses.forEach((expense, index) => {
        if (!shouldDisplayExpense(expense)) return;

        const date = new Date(expense.date);
        const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;

        if (!expensesByMonth[monthKey]) {
            expensesByMonth[monthKey] = {
                expenses: [],
                total: 0,
                actualTotal: 0
            };
        }

        expensesByMonth[monthKey].expenses.push({ ...expense, index });
        expensesByMonth[monthKey].total += expense.amount;
        const actualAmount = expense.amount * (expense.percentage || 100) / 100;
        expensesByMonth[monthKey].actualTotal += actualAmount;

        totalAmount += expense.amount;
        totalActualAmount += actualAmount;
    });

    // הצגת ההוצאות מקובצות לפי חודש
    Object.entries(expensesByMonth).forEach(([month, data]) => {
        // כותרת החודש
        const monthRow = document.createElement('tr');
        monthRow.className = 'table-secondary';
        monthRow.innerHTML = `
            <td colspan="7">
                <strong>${month}</strong> - 
                סה"כ: ₪${data.total.toFixed(2)} | 
                סה"כ בפועל: ₪${data.actualTotal.toFixed(2)}
            </td>
        `;
        tableBody.appendChild(monthRow);

        // הוצאות החודש
        data.expenses.forEach(expense => {
            const row = document.createElement('tr');
            const formattedDate = new Date(expense.date).toLocaleDateString('he-IL');
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${expense.description}</td>
                <td>${expense.category || 'לא מוגדר'}</td>
                <td>₪${expense.amount.toFixed(2)}</td>
                <td>${expense.percentage || 100}%</td>
                <td>₪${(expense.amount * (expense.percentage || 100) / 100).toFixed(2)}</td>
                <td>${getActionButtons(tabName, expense.index)}</td>
            `;
            tableBody.appendChild(row);
        });
    });

    // עדכון סיכום
    const summaryRow = document.createElement('tr');
    summaryRow.className = 'table-info';
    summaryRow.innerHTML = `
        <td colspan="7">
            <strong>סה"כ כללי:</strong> ₪${totalAmount.toFixed(2)} | 
            <strong>סה"כ בפועל:</strong> ₪${totalActualAmount.toFixed(2)}
        </td>
    `;
    tableBody.appendChild(summaryRow);
}

// עדכון טבלת הוצאות
function updateExpensesTable(tabName) {
    let currentExpenses;
    switch (tabName) {
        case 'regular':
            currentExpenses = expenses;
            break;
        case 'unrecognized':
            currentExpenses = unrecognizedExpenses;
            break;
        case 'fixed-assets':
            currentExpenses = fixedAssets;
            break;
        default:
            console.error('Unknown tab:', tabName);
            return;
    }

    displayExpenses(currentExpenses, tabName);
}

// יצירת כפתורי פעולה בהתאם לכרטיסייה
function getActionButtons(currentTab, index) {
    const moveButtons = [];
    
    // הוספת כפתורי העברה בהתאם לטבלה הנוכחית
    if (currentTab !== 'regular') {
        moveButtons.push(`
            <button class="btn btn-sm btn-outline-primary" onclick="moveExpense('${currentTab}', 'regular', ${index})">
                <i class="fas fa-arrow-right"></i> להוצאות רגילות
            </button>
        `);
    }
    if (currentTab !== 'unrecognized') {
        moveButtons.push(`
            <button class="btn btn-sm btn-outline-warning" onclick="moveExpense('${currentTab}', 'unrecognized', ${index})">
                <i class="fas fa-arrow-right"></i> להוצאות לא מוכרות
            </button>
        `);
    }
    if (currentTab !== 'fixed-assets') {
        moveButtons.push(`
            <button class="btn btn-sm btn-outline-info" onclick="moveExpense('${currentTab}', 'fixed-assets', ${index})">
                <i class="fas fa-arrow-right"></i> לרכוש קבוע
            </button>
        `);
    }

    return `
        <div class="btn-group btn-group-sm">
            <input type="checkbox" class="btn-check" data-index="${index}" id="checkbox-${currentTab}-${index}">
            <label class="btn btn-outline-secondary" for="checkbox-${currentTab}-${index}">
                <i class="fas fa-check"></i>
            </label>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense('${currentTab}', ${index})">
                <i class="fas fa-trash"></i>
            </button>
            ${moveButtons.join('')}
        </div>
    `;
}

// פונקציה לתיקון תאריכים קיימים
function fixExistingDates() {
    const allExpenses = [...expenses, ...unrecognizedExpenses, ...fixedAssets];

    allExpenses.forEach(expense => {
        if (!expense.date) return;

        // אם התאריך הוא אובייקט Date, נמיר אותו לפורמט הרצוי
        if (expense.date instanceof Date) {
            expense.date = expense.date.toISOString().split('T')[0];
            return;
        }

        // אם התאריך הוא סטרינג
        if (typeof expense.date === 'string') {
            // בדיקה אם התאריך הוא בפורמט dd/mm/yyyy
            const dateMatch = expense.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (dateMatch) {
                // המרה לפורמט yyyy-mm-dd
                const [, day, month, year] = dateMatch;
                expense.date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            } else {
                // אם התאריך הוא בפורמט אחר, ננסה להמיר אותו
                try {
                    const date = new Date(expense.date);
                    if (!isNaN(date.getTime())) {
                        expense.date = date.toISOString().split('T')[0];
                    }
                } catch (e) {
                    console.warn('Failed to parse date:', expense.date);
                }
            }
        }
    });

    // שמירת השינויים
    saveExpensesToStorage();
}

// פונקציה להצגת הודעה למשתמש
function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '1050';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertDiv);

    // הסרת ההודעה אחרי 3 שניות
    setTimeout(() => {
        alertDiv.remove();
    }, 3000);
}

// עדכון כרטיסי סיכום
function updateSummaryCards() {
    const currentDate = new Date();
    const monthYear = `${currentDate.getMonth()}-${currentDate.getFullYear()}`;

    // חישוב סכומים כוללים
    const totalRegular = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalUnrecognized = unrecognizedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalFixedAssets = fixedAssets.reduce((sum, exp) => sum + exp.amount, 0);
    const totalExpenses = totalRegular + totalUnrecognized + totalFixedAssets;

    // עדכון חודש נוכחי
    document.getElementById('current-month').textContent =
        `${currentDate.getMonth() + 1}/${currentDate.getFullYear()}`;

    // עדכון סכום הוצאות כולל
    document.getElementById('total-expenses').textContent = `₪ ${totalExpenses.toFixed(2)}`;

    // עדכון הכנסה
    const monthlyIncome = monthlyIncomes[monthYear] || 0;
    document.getElementById('income-amount').textContent = `₪ ${monthlyIncome.toFixed(2)}`;

    // חישוב והצגת הפסד/רווח
    const loss = monthlyIncome - totalExpenses;
    document.getElementById('loss-amount').textContent = `₪ ${Math.abs(loss).toFixed(2)}`;
}

// פונקציה לקבלת כל הקטגוריות הקיימות
function getAllCategories() {
    const categories = new Set();
    
    // הוספת קטגוריות מהוצאות רגילות
    expenses.forEach(expense => {
        if (expense.category) {
            categories.add(expense.category);
        }
    });

    // הוספת קטגוריות מהוצאות לא מוכרות
    unrecognizedExpenses.forEach(expense => {
        if (expense.category) {
            categories.add(expense.category);
        }
    });

    // הוספת קטגוריות מרכוש קבוע
    fixedAssets.forEach(expense => {
        if (expense.category) {
            categories.add(expense.category);
        }
    });

    // המרה למערך וסידור לפי א"ב
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'he'));
}

// פונקציה לקבלת כל הקטגוריות הייחודיות
function getAllUniqueCategories() {
    const categories = new Set();
    [expenses, unrecognizedExpenses, fixedAssets].forEach(array => {
        array.forEach(expense => {
            if (expense.category) {
                categories.add(expense.category);
            }
        });
    });
    return Array.from(categories);
}

// פונקציה לעדכון רשימת הקטגוריות בפילטר
function updateCategoryFilter(categories) {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    // שמירת הערך הנוכחי
    const currentValue = categoryFilter.value;

    // ניקוי אפשרויות קיימות
    categoryFilter.innerHTML = '';

    // הוספת אפשרות "הכל"
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'הכל';
    categoryFilter.appendChild(allOption);

    // הוספת כל הקטגוריות
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    // שחזור הערך הקודם אם הוא עדיין קיים
    if (categories.includes(currentValue)) {
        categoryFilter.value = currentValue;
    }
}

// פונקציה להצגת/הסתרת פירוט הוצאות של קטגוריה
function showCategoryDetails(category, data, totalExpenses) {
    currentCategory = category;
    currentCategoryData = data;

    const modalElement = document.getElementById('categoryDetailsModal');
    if (!modalElement) return;

    const modal = new bootstrap.Modal(modalElement);
    const modalTitle = modalElement.querySelector('.modal-title');
    const totalAmountElement = modalElement.querySelector('.total-amount');
    const actualAmountElement = modalElement.querySelector('.actual-amount');
    const percentageElement = modalElement.querySelector('.percentage');
    const tableBody = modalElement.querySelector('#categoryDetailsBody');

    if (!tableBody) {
        console.error('Table body not found');
        return;
    }

    // ניקוי תוכן קודם
    tableBody.innerHTML = '';

    // עדכון כותרת וסיכומים
    modalTitle.innerHTML = `
        <span class="category-name" 
              ondblclick="startCategoryEdit(this, '${category}')"
              style="cursor: pointer;">
            ${category}
        </span>
        <button class="btn btn-outline-primary btn-sm ms-2" onclick="renameCategory('${category}')">
            <i class="fas fa-edit"></i>
        </button>
    `;
    totalAmountElement.textContent = `₪${data.amount.toFixed(2)}`;
    actualAmountElement.textContent = `₪${data.actualAmount.toFixed(2)}`;
    const percentage = (data.actualAmount / totalExpenses * 100).toFixed(1);
    percentageElement.textContent = `${percentage}%`;

    // הוספת שורות לטבלה
    data.expenses.forEach((expense, index) => {
        const row = document.createElement('tr');
        const date = new Date(expense.date);
        const formattedDate = date.toLocaleDateString('he-IL');
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${expense.description}</td>
            <td>₪${expense.amount.toFixed(2)}</td>
            <td>${expense.percentage || 100}%</td>
            <td>₪${(expense.amount * (expense.percentage || 100) / 100).toFixed(2)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-danger" onclick="deleteExpenseFromCategory(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn btn-outline-primary" onclick="moveExpenseFromCategory(${index})">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Set up modal event listeners
    modalElement.addEventListener('show.bs.modal', () => {
        // Remove inert from modal when showing
        modalElement.removeAttribute('inert');
        // Make rest of the page inert
        document.body.querySelectorAll(':not(#categoryDetailsModal)').forEach(el => {
            if (el !== modalElement && !modalElement.contains(el)) {
                el.setAttribute('inert', '');
            }
        });
    }, { once: true });

    modalElement.addEventListener('hidden.bs.modal', () => {
        // Remove inert from the rest of the page
        document.body.querySelectorAll('[inert]').forEach(el => {
            el.removeAttribute('inert');
        });
        // Make modal inert
        modalElement.setAttribute('inert', '');
        currentCategory = '';
        currentCategoryData = null;
    }, { once: true });

    // Show the modal
    modal.show();
}

// פונקציה למחיקת הוצאה מקטגוריה
function deleteExpenseFromCategory(index) {
    if (!confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
        return;
    }

    const expense = currentCategoryData.expenses[index];
    const expenseArray = getExpenseArrayByType(expense.type || 'regular');
    const expenseIndex = expenseArray.findIndex(e => 
        e.date === expense.date && 
        e.description === expense.description && 
        e.amount === expense.amount
    );

    if (expenseIndex !== -1) {
        expenseArray.splice(expenseIndex, 1);
        saveExpensesToStorage();
        updateAll();
        showAlert('ההוצאה נמחקה בהצלחה', 'success');
        // סגירת המודל הנוכחי
        const modal = bootstrap.Modal.getInstance(document.getElementById('categoryDetailsModal'));
        modal.hide();
    } else {
        showAlert('שגיאה במחיקת ההוצאה', 'error');
    }
}

// פונקציה להעברת הוצאה לקטגוריה אחרת
function moveExpenseFromCategory(index) {
    const expense = currentCategoryData.expenses[index];
    const expenseArray = getExpenseArrayByType(expense.type || 'regular');
    const expenseIndex = expenseArray.findIndex(e => 
        e.date === expense.date && 
        e.description === expense.description && 
        e.amount === expense.amount
    );

    if (expenseIndex !== -1) {
        const newCategory = prompt('הכנס שם קטגוריה חדשה:', expense.category);
        if (newCategory && newCategory !== expense.category) {
            expenseArray[expenseIndex].category = newCategory;
            saveExpensesToStorage();
            updateAll();
            showAlert('הקטגוריה עודכנה בהצלחה', 'success');
            // סגירת המודל הנוכחי
            const modal = bootstrap.Modal.getInstance(document.getElementById('categoryDetailsModal'));
            modal.hide();
        }
    } else {
        showAlert('שגיאה בעדכון הקטגוריה', 'error');
    }
}

// פונקציה להצגת מודל איחוד קטגוריות
function mergeCategoryModal() {
    const categoryModal = bootstrap.Modal.getInstance(document.getElementById('categoryDetailsModal'));
    const modalElement = document.getElementById('mergeCategoryModal');
    if (!modalElement) return;

    // סגירת המודל הראשי
    if (categoryModal) {
        categoryModal.hide();
    }

    const selectElement = document.getElementById('targetCategory');
    selectElement.innerHTML = '';

    // מילוי רשימת הקטגוריות (למעט הקטגוריה הנוכחית)
    const categories = getAllCategories();
    const availableCategories = categories.filter(cat => cat !== currentCategory);

    if (availableCategories.length === 0) {
        showAlert('אין קטגוריות זמינות לאיחוד', 'error');
        return;
    }

    availableCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        selectElement.appendChild(option);
    });

    // הסרת inert לפני פתיחת המודל
    modalElement.removeAttribute('inert');
    
    const modal = new bootstrap.Modal(modalElement);
    
    // הוספת מאזינים למודל
    modalElement.addEventListener('show.bs.modal', () => {
        modalElement.removeAttribute('inert');
        document.body.querySelectorAll(':not(#mergeCategoryModal)').forEach(el => {
            if (el !== modalElement && !modalElement.contains(el)) {
                el.setAttribute('inert', '');
            }
        });
    }, { once: true });

    modalElement.addEventListener('hidden.bs.modal', () => {
        document.body.querySelectorAll('[inert]').forEach(el => {
            el.removeAttribute('inert');
        });
        modalElement.setAttribute('inert', '');
    }, { once: true });

    modal.show();
}

// פונקציה לאיחוד קטגוריות
function mergeCategories() {
    const targetCategory = document.getElementById('targetCategory').value;
    
    // בדיקות תקינות
    if (!targetCategory) {
        showAlert('נא לבחור קטגוריית יעד', 'error');
        return;
    }
    
    if (!currentCategory) {
        showAlert('לא נבחרה קטגוריה למיזוג', 'error');
        return;
    }

    if (targetCategory === currentCategory) {
        showAlert('לא ניתן למזג קטגוריה עם עצמה', 'error');
        return;
    }

    // מעבר על כל סוגי ההוצאות ועדכון הקטגוריה
    let updatedCount = 0;
    ['regular', 'unrecognized', 'fixed-assets'].forEach(type => {
        const expenseArray = getExpenseArrayByType(type);
        if (!expenseArray) return;

        expenseArray.forEach(expense => {
            if (expense.category === currentCategory) {
                expense.category = targetCategory;
                updatedCount++;
            }
        });
    });

    if (updatedCount === 0) {
        showAlert('לא נמצאו הוצאות לעדכון', 'error');
        return;
    }

    // שמירה ועדכון
    saveExpensesToStorage();
    updateAll();
    
    // סגירת מודל האיחוד
    const mergeModal = bootstrap.Modal.getInstance(document.getElementById('mergeCategoryModal'));
    if (mergeModal) {
        mergeModal.hide();
    }

    // איפוס משתנים גלובליים
    currentCategory = '';
    currentCategoryData = null;

    showAlert(`הקטגוריות אוחדו בהצלחה. ${updatedCount} הוצאות עודכנו`, 'success');
}

// פונקציה עזר לקבלת מערך ההוצאות לפי סוג
function getExpenseArrayByType(type) {
    switch(type) {
        case 'regular':
            return expenses;
        case 'unrecognized':
            return unrecognizedExpenses;
        case 'fixed-assets':
            return fixedAssets;
        default:
            return expenses;
    }
}

// עדכון גרף
function updateExpensesChart() {
    const ctx = document.getElementById('expensesChart');
    if (!ctx) return; // אם אין אלמנט canvas, נצא

    // סינון הוצאות תקינות
    const validExpenses = expenses.filter(expense => {
        return expense && expense.date && !isNaN(new Date(expense.date).getTime());
    });

    // קיבוץ הוצאות לפי חודש
    const expensesByMonth = {};
    validExpenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;

        if (!expensesByMonth[monthKey]) {
            expensesByMonth[monthKey] = {
                total: 0,
                categories: {}
            };
        }

        expensesByMonth[monthKey].total += expense.amount;

        const actualAmount = expense.amount * (expense.percentage || 100) / 100;
        const category = expense.category || 'כללי';
        if (!expensesByMonth[monthKey].categories[category]) {
            expensesByMonth[monthKey].categories[category] = 0;
        }
        expensesByMonth[monthKey].categories[category] += actualAmount;
    });

    // מיון חודשים בסדר עולה
    const sortedMonths = Object.keys(expensesByMonth).sort((a, b) => {
        const [monthA, yearA] = a.split('/').map(Number);
        const [monthB, yearB] = b.split('/').map(Number);
        if (yearA !== yearB) return yearA - yearB;
        return monthA - monthB;
    });

    // יצירת מערכי נתונים לגרף
    const labels = sortedMonths;
    const datasets = [];

    // איסוף כל הקטגוריות הייחודיות
    const allCategories = new Set();
    Object.values(expensesByMonth).forEach(monthData => {
        Object.keys(monthData.categories).forEach(category => {
            allCategories.add(category);
        });
    });

    // יצירת סדרת נתונים לכל קטגוריה
    Array.from(allCategories).forEach((category, index) => {
        const data = sortedMonths.map(month => {
            return expensesByMonth[month].categories[category] || 0;
        });

        datasets.push({
            label: category,
            data: data,
            backgroundColor: getColorForIndex(index),
            borderColor: getColorForIndex(index),
            borderWidth: 1
        });
    });

    // הריסת הגרף הקיים אם יש
    if (window.expensesChart instanceof Chart) {
        window.expensesChart.destroy();
    }

    // יצירת גרף חדש
    window.expensesChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            label += '₪' + context.raw.toFixed(2);
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// פונקציה לקבלת צבע לפי אינדקס
function getColorForIndex(index) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF9F40'
    ];
    return colors[index % colors.length];
}

// פונקציה לחישוב סיכומים לפי קטגוריות וסוג
function calculateCategorySummary() {
    const allExpenses = [
        ...expenses.map(e => ({ ...e, type: 'regular' })),
        ...unrecognizedExpenses.map(e => ({ ...e, type: 'unrecognized' })),
        ...fixedAssets.map(e => ({ ...e, type: 'fixed-assets' }))
    ];

    const categories = {};
    let totalAmount = 0;
    let totalActualAmount = 0;

    // מיון הוצאות לפי קטגוריות
    allExpenses.forEach(expense => {
        const category = expense.category || 'ללא קטגוריה';
        if (!categories[category]) {
            categories[category] = {
                amount: 0,
                actualAmount: 0,
                expenses: []
            };
        }

        const actualAmount = expense.amount * (expense.percentage || 100) / 100;
        categories[category].amount += expense.amount;
        categories[category].actualAmount += actualAmount;
        categories[category].expenses.push(expense);

        totalAmount += expense.amount;
        totalActualAmount += actualAmount;
    });

    return {
        categories,
        totalAmount,
        totalActualAmount
    };
}

// פונקציה לעדכון טבלת רווח והפסד
function updateProfitLossTable() {
    const tableBody = document.getElementById('profitLossTableBody');
    const totalAmountElement = document.getElementById('total-amount-all');
    const totalActualAmountElement = document.getElementById('total-actual-amount-all');

    if (!tableBody) return;

    const summary = calculateCategorySummary();
    tableBody.innerHTML = '';

    // מיון קטגוריות לפי סכום בפועל (מהגבוה לנמוך)
    const sortedCategories = Object.entries(summary.categories)
        .sort(([, a], [, b]) => b.actualAmount - a.actualAmount);

    // הצגת הקטגוריות בטבלה
    sortedCategories.forEach(([category, data]) => {
        const percentage = (data.actualAmount / summary.totalActualAmount * 100).toFixed(1);
        const row = document.createElement('tr');
        row.className = 'category-row';
        row.style.cursor = 'pointer';
        row.onclick = () => showCategoryDetails(category, data, summary.totalActualAmount);
        row.innerHTML = `
            <td>${category}</td>
            <td>₪${data.amount.toFixed(2)}</td>
            <td>₪${data.actualAmount.toFixed(2)}</td>
            <td>${percentage}%</td>
        `;
        tableBody.appendChild(row);
    });

    // עדכון סיכומים
    if (totalAmountElement) {
        totalAmountElement.textContent = `₪${summary.totalAmount.toFixed(2)}`;
    }
    if (totalActualAmountElement) {
        totalActualAmountElement.textContent = `₪${summary.totalActualAmount.toFixed(2)}`;
    }
}

// פונקציה לסינון הוצאות
function filterExpenses() {
    const yearFilter = document.getElementById('yearFilter')?.value;
    const monthFilter = document.getElementById('monthFilter')?.value;
    const categoryFilter = document.getElementById('categoryFilter')?.value;
    const currentTab = document.querySelector('.nav-link.active')?.getAttribute('data-tab') || 'regular';

    // קבלת מערך ההוצאות הרלוונטי לפי הכרטיסייה
    let filteredExpenses;
    switch (currentTab) {
        case 'regular':
            filteredExpenses = expenses;
            break;
        case 'unrecognized':
            filteredExpenses = unrecognizedExpenses;
            break;
        case 'fixed-assets':
            filteredExpenses = fixedAssets;
            break;
        default:
            filteredExpenses = expenses;
    }

    // סינון לפי שנה
    if (yearFilter) {
        filteredExpenses = filteredExpenses.filter(expense => {
            const expenseYear = new Date(expense.date).getFullYear().toString();
            return expenseYear === yearFilter;
        });
    }

    // סינון לפי חודש
    if (monthFilter) {
        filteredExpenses = filteredExpenses.filter(expense => {
            const expenseMonth = (new Date(expense.date).getMonth() + 1).toString();
            return expenseMonth === monthFilter;
        });
    }

    // סינון לפי קטגוריה
    if (categoryFilter) {
        filteredExpenses = filteredExpenses.filter(expense => {
            return expense.category === categoryFilter;
        });
    }

    // הצגת ההוצאות המסוננות
    displayExpenses(filteredExpenses, currentTab);
}

// עדכון הכל
function updateAll() {
    // עדכון הטבלאות
    updateExpensesTable('regular');
    updateExpensesTable('unrecognized');
    updateExpensesTable('fixed-assets');
    
    // עדכון סיכומים וגרפים
    updateSummaryCards();
    updateExpensesChart();
    updateProfitLossTable();
    
    // עדכון פילטרים
    updateCategoryFilter(getAllCategories());
}

// פונקציה לבדיקה האם להציג הוצאה
function shouldDisplayExpense(expense) {
    if (!expense) return false;

    const selectedYear = document.getElementById('yearFilter')?.value;
    const selectedMonth = document.getElementById('monthFilter')?.value;
    const selectedCategory = document.getElementById('categoryFilter')?.value;
    const searchText = document.getElementById('searchInput')?.value?.toLowerCase();

    const expenseDate = new Date(expense.date);
    const expenseYear = expenseDate.getFullYear().toString();
    const expenseMonth = (expenseDate.getMonth() + 1).toString();

    // בדיקת שנה
    if (selectedYear && expenseYear !== selectedYear) return false;

    // בדיקת חודש
    if (selectedMonth && expenseMonth !== selectedMonth) return false;

    // בדיקת קטגוריה
    if (selectedCategory && expense.category !== selectedCategory) return false;

    // בדיקת טקסט חיפוש
    if (searchText) {
        const description = expense.description?.toLowerCase() || '';
        const category = expense.category?.toLowerCase() || '';
        if (!description.includes(searchText) && !category.includes(searchText)) return false;
    }

    return true;
}

// פונקציה לטיפול בקלט נתונים מה-CSV
function handleDataInput() {
    const csvData = document.getElementById('csvData').value.trim();
    if (!csvData) {
        showAlert('אנא הכנס נתונים', 'error');
        return;
    }

    try {
        // פיצול השורות
        const rows = csvData.split('\n');
        
        // עיבוד כל שורה
        rows.forEach((row, index) => {
            if (!row.trim()) return; // דילוג על שורות ריקות
            
            // הסרת גרשיים והפרדה לפי פסיקים
            const columns = row.split(',').map(col => col.replace(/^"|"$/g, '').trim());
            
            if (columns.length < 3) {
                throw new Error(`שורה ${index + 1} אינה בפורמט הנכון`);
            }

            const [date, description, amount, category, comment] = columns;
            const parsedAmount = parseFloat(amount.replace(/[^\d.-]/g, ''));

            // המרת התאריך לפורמט הנכון
            const [day, month, year] = date.split('/');
            const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

            // בדיקה אם זה זיכוי
            const isCredit = comment?.includes('זיכוי') || description.includes('זיכוי') || parsedAmount < 0;
            
            const expense = {
                date: formattedDate,
                description: description,
                category: category || 'שונות',
                amount: Math.abs(parsedAmount), // תמיד חיובי
                percentage: 100,
                effectiveAmount: isCredit ? -Math.abs(parsedAmount) : Math.abs(parsedAmount) // שלילי אם זיכוי
            };

            // הוספה למערך המתאים לפי קטגוריה
            if (category?.toLowerCase().includes('רכוש קבוע')) {
                fixedAssets.push(expense);
            } else if (category?.toLowerCase().includes('לא מוכר')) {
                unrecognizedExpenses.push(expense);
            } else {
                expenses.push(expense);
            }
        });

        // שמירה ועדכון התצוגה
        saveExpensesToStorage();
        updateAll();
        showAlert('הנתונים נטענו בהצלחה');
        document.getElementById('csvData').value = ''; // ניקוי שדה הקלט
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// פונקציה למחיקת הוצאות מסומנות
function removeSelectedExpenses(tabType) {
    // מציאת כל התיבות המסומנות בטבלה הרלוונטית
    const tableId = tabType + 'ExpensesTableBody';
    const checkboxes = document.querySelectorAll(`#${tableId} input[type="checkbox"]:checked`);
    
    if (checkboxes.length === 0) {
        showAlert('לא נבחרו פריטים למחיקה', 'error');
        return;
    }

    // מערך לשמירת האינדקסים למחיקה
    const indicesToRemove = Array.from(checkboxes).map(checkbox => 
        parseInt(checkbox.getAttribute('data-index'))
    ).sort((a, b) => b - a); // מיון בסדר יורד כדי למנוע בעיות אינדקס

    // מחיקת ההוצאות מהמערך המתאים
    let targetArray;
    switch(tabType) {
        case 'regular':
            targetArray = expenses;
            break;
        case 'unrecognized':
            targetArray = unrecognizedExpenses;
            break;
        case 'fixed-assets':
            targetArray = fixedAssets;
            break;
        default:
            showAlert('סוג טבלה לא חוקי', 'error');
            return;
    }

    // מחיקת הפריטים מהמערך
    indicesToRemove.forEach(index => {
        if (index >= 0 && index < targetArray.length) {
            targetArray.splice(index, 1);
        }
    });

    // שמירה ועדכון התצוגה
    saveExpensesToStorage();
    updateAll();
    showAlert('הפריטים המסומנים נמחקו בהצלחה', 'success');
}

// פונקציה לזיהוי הוצאות כפולות
function findDuplicateExpenses(action = 'mark') {
    // מערך שיכיל את כל ההוצאות מכל הטבלאות
    const allExpenses = [];
    
    // נאסוף את כל ההוצאות עם המידע על המיקום שלהן
    expenses.forEach((expense, index) => {
        allExpenses.push({ expense, type: 'regular', index });
    });
    unrecognizedExpenses.forEach((expense, index) => {
        allExpenses.push({ expense, type: 'unrecognized', index });
    });
    fixedAssets.forEach((expense, index) => {
        allExpenses.push({ expense, type: 'fixed-assets', index });
    });
    
    // מפה שתכיל את ההוצאות לפי מפתח ייחודי
    const expenseMap = new Map();
    // מערך שיכיל את ההוצאות הכפולות
    const duplicates = [];

    allExpenses.forEach((expenseData) => {
        const expense = expenseData.expense;
        // יצירת מפתח ייחודי מהתאריך, התיאור והסכום
        const key = `${expense.date}-${expense.description}-${expense.amount}`;
        
        if (expenseMap.has(key)) {
            // אם כבר יש הוצאה כזאת, נוסיף את שתיהן למערך הכפילויות
            const existingExpenseData = expenseMap.get(key);
            if (!duplicates.find(d => d.key === key)) {
                duplicates.push({ 
                    key,
                    items: [existingExpenseData, expenseData]
                });
            } else {
                // הוספת הוצאה נוספת לקבוצת הכפילויות הקיימת
                const duplicate = duplicates.find(d => d.key === key);
                duplicate.items.push(expenseData);
            }
        } else {
            // אם זו הוצאה חדשה, נוסיף אותה למפה
            expenseMap.set(key, expenseData);
        }
    });

    if (duplicates.length === 0) {
        showAlert('לא נמצאו הוצאות כפולות', 'info');
        return;
    }

    if (action === 'keepFirst' || action === 'deleteAll') {
        // מערך לשמירת האינדקסים למחיקה לפי סוג
        const toDelete = {
            regular: new Set(),
            unrecognized: new Set(),
            'fixed-assets': new Set()
        };

        duplicates.forEach(duplicate => {
            const itemsToDelete = action === 'keepFirst' ? 
                duplicate.items.slice(1) : // מחיקת כל ההוצאות חוץ מהראשונה
                duplicate.items; // מחיקת כל ההוצאות

            itemsToDelete.forEach(item => {
                toDelete[item.type].add(item.index);
            });
        });

        // מחיקת ההוצאות מהסוף להתחלה כדי לא לפגוע באינדקסים
        ['regular', 'unrecognized', 'fixed-assets'].forEach(type => {
            const indices = Array.from(toDelete[type]).sort((a, b) => b - a);
            const array = type === 'regular' ? expenses :
                         type === 'unrecognized' ? unrecognizedExpenses :
                         fixedAssets;
            
            indices.forEach(index => {
                array.splice(index, 1);
            });
        });
        
        // שמירה ועדכון
        saveExpensesToStorage();
        updateAll();
        showAlert(`נמחקו ${action === 'keepFirst' ? 'כל הכפילויות (חוץ מהראשונה בכל קבוצה)' : 'כל ההוצאות הכפולות'}`, 'success');
        return;
    }

    // סימון ההוצאות הכפולות בטבלאות
    const tables = ['regular', 'unrecognized', 'fixed-assets'];
    tables.forEach(tabName => {
        const tableBody = document.getElementById(`${tabName}ExpensesTableBody`);
        if (!tableBody) return;

        const rows = tableBody.getElementsByTagName('tr');
        for (let row of rows) {
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                const expenseIndex = parseInt(checkbox.getAttribute('data-index'));
                
                // בדיקה אם ההוצאה הנוכחית היא חלק מקבוצת כפילויות
                const isDuplicate = duplicates.some(duplicate => 
                    duplicate.items.some(item => 
                        item.type === tabName && item.index === expenseIndex
                    )
                );

                if (isDuplicate) {
                    row.style.backgroundColor = '#fff3cd';
                    checkbox.checked = true;
                } else {
                    row.style.backgroundColor = '';
                    checkbox.checked = false;
                }
            }
        }
    });

    const totalDuplicateItems = duplicates.reduce((sum, group) => sum + group.items.length, 0);
    showAlert(`נמצאו ${duplicates.length} קבוצות של הוצאות כפולות (סה"כ ${totalDuplicateItems} הוצאות). ההוצאות הכפולות סומנו בצהוב.`, 'warning');
}

// פונקציה להעברת הוצאה בין טבלאות
function moveExpense(fromTab, toTab, index) {
    let sourceArray, targetArray;
    
    // קביעת המערכים המקור והיעד
    switch(fromTab) {
        case 'regular':
            sourceArray = expenses;
            break;
        case 'unrecognized':
            sourceArray = unrecognizedExpenses;
            break;
        case 'fixed-assets':
            sourceArray = fixedAssets;
            break;
    }

    switch(toTab) {
        case 'regular':
            targetArray = expenses;
            break;
        case 'unrecognized':
            targetArray = unrecognizedExpenses;
            break;
        case 'fixed-assets':
            targetArray = fixedAssets;
            break;
    }

    if (!sourceArray || !targetArray) {
        showAlert('שגיאה בהעברת ההוצאה', 'error');
        return;
    }

    // העברת ההוצאה
    const expense = sourceArray[index];
    if (expense) {
        // הסרה מהמקור
        sourceArray.splice(index, 1);
        // הוספה ליעד
        targetArray.push(expense);
        
        // שמירה ועדכון
        saveExpensesToStorage();
        updateAll();
        showAlert('ההוצאה הועברה בהצלחה', 'success');
    } else {
        showAlert('לא נמצאה הוצאה להעברה', 'error');
    }
}

// פונקציה למחיקת הוצאה בודדת
function deleteExpense(tabName, index) {
    if (!confirm('האם אתה בטוח שברצונך למחוק הוצאה זו?')) {
        return;
    }

    let expenseArray;
    switch(tabName) {
        case 'regular':
            expenseArray = expenses;
            break;
        case 'unrecognized':
            expenseArray = unrecognizedExpenses;
            break;
        case 'fixed-assets':
            expenseArray = fixedAssets;
            break;
        default:
            showAlert('סוג טבלה לא חוקי', 'error');
            return;
    }

    if (index >= 0 && index < expenseArray.length) {
        expenseArray.splice(index, 1);
        saveExpensesToStorage();
        updateAll();
        showAlert('ההוצאה נמחקה בהצלחה', 'success');
    } else {
        showAlert('שגיאה במחיקת ההוצאה', 'error');
    }
}

// פונקציה לשינוי שם קטגוריה
function renameCategory(oldName, newName) {
    if (!newName || newName === oldName) return;

    // עדכון בכל המערכים
    [expenses, unrecognizedExpenses, fixedAssets].forEach(array => {
        array.forEach(expense => {
            if (expense.category === oldName) {
                expense.category = newName;
            }
        });
    });

    // שמירה ועדכון
    saveExpensesToStorage();
    updateAll();
    showAlert('שם הקטגוריה עודכן בהצלחה', 'success');

    // סגירת המודל
    const categoryDetailsModal = bootstrap.Modal.getInstance(document.getElementById('categoryDetailsModal'));
    if (categoryDetailsModal) categoryDetailsModal.hide();
}

// פונקציה להפעלת עריכת שם קטגוריה
function startCategoryEdit(element, currentCategory) {
    // יצירת רשימת הצעות
    const datalist = document.createElement('datalist');
    datalist.id = 'categorysuggestions';
    const categories = getAllUniqueCategories();
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        datalist.appendChild(option);
    });
    document.body.appendChild(datalist);

    // יצירת שדה קלט
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentCategory;
    input.className = 'form-control form-control-sm d-inline-block';
    input.style.width = 'auto';
    input.style.minWidth = '150px';
    input.setAttribute('list', 'categorysuggestions');

    // החלפת הטקסט בשדה קלט
    const span = element.parentElement;
    span.innerHTML = '';
    span.appendChild(input);
    input.focus();
    input.select();

    // טיפול באירועים
    function finishEdit() {
        const newName = input.value.trim();
        if (newName && newName !== currentCategory) {
            renameCategory(currentCategory, newName);
        }
        datalist.remove();
        span.innerHTML = currentCategory;
    }

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            finishEdit();
        }
    });
}

// פונקציה להצגת מודל הוספת קטגוריה
function showAddCategoryModal() {
    const modalElement = document.getElementById('addCategoryModal');
    if (!modalElement) return;

    // ניקוי שדה הקלט
    document.getElementById('newCategoryName').value = '';

    // הסרת inert לפני פתיחת המודל
    modalElement.removeAttribute('inert');
    
    const modal = new bootstrap.Modal(modalElement);
    
    // הוספת מאזינים למודל
    modalElement.addEventListener('show.bs.modal', () => {
        modalElement.removeAttribute('inert');
        document.body.querySelectorAll(':not(#addCategoryModal)').forEach(el => {
            if (el !== modalElement && !modalElement.contains(el)) {
                el.setAttribute('inert', '');
            }
        });
    }, { once: true });

    modalElement.addEventListener('hidden.bs.modal', () => {
        document.body.querySelectorAll('[inert]').forEach(el => {
            el.removeAttribute('inert');
        });
        modalElement.setAttribute('inert', '');
    }, { once: true });

    modal.show();
}

// פונקציה להוספת קטגוריה חדשה
function addNewCategory() {
    const newCategoryName = document.getElementById('newCategoryName').value.trim();
    
    // בדיקת תקינות
    if (!newCategoryName) {
        showAlert('נא להזין שם קטגוריה', 'error');
        return;
    }

    // בדיקה אם הקטגוריה כבר קיימת
    const existingCategories = getAllCategories();
    if (existingCategories.includes(newCategoryName)) {
        showAlert('קטגוריה זו כבר קיימת', 'error');
        return;
    }

    // יצירת הוצאה ריקה עם הקטגוריה החדשה
    const dummyExpense = {
        date: new Date().toISOString(),
        description: 'קטגוריה חדשה',
        amount: 0,
        category: newCategoryName,
        percentage: 100
    };

    // הוספת ההוצאה למערך ההוצאות הרגילות
    expenses.push(dummyExpense);

    // שמירה ועדכון
    saveExpensesToStorage();
    updateAll();

    // סגירת המודל
    const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
    if (modal) {
        modal.hide();
    }

    showAlert('הקטגוריה נוספה בהצלחה', 'success');
}
