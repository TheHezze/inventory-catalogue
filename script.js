document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById("myModal");
    const closeModalButton = modal.querySelector(".close");
    modal.style.display = "none";

    closeModalButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    function closeModal() {
        modal.style.display = "none";
        document.body.classList.remove('modal-open');
    }

    let items = [];
    let headers, indices = {};
    let cart = {};
    let isEditing = false; // New variable to track edit state

    // Fetch CSV configuration and data
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTrVrdiDeVrvNw6EZCdWXVG-ldJVDkvGJaRdH7mry14m-HXpr3GXNTWH4F8zWV50o79dVIpeYy4wkq3/pub?output=csv')
        .then(response => response.text())
        .then(configCsvData => {
            const configItems = parseCSV(configCsvData);
            initializePage(configItems);
            return fetch(configItems[1][1]); // Fetch dynamic link
        })
        .then(response => response.text())
        .then(csvData => {
            items = parseCSV(csvData);
            if (items.length > 0) {
                headers = items[0];
                initializeIndices(['Thumbnails', 'SKUName', 'QuantityLimit', 'Quantity', 'Category', 'SubCategory', 'SKU', 'SKUVAR', 'Description', 'Cost', 'Duration', 'Distance', 'Travel Time']);
                initializeGallery();
            }
        })
        .catch(error => console.error('Error fetching CSV:', error));

    function parseCSV(csvData) {
        return csvData.split('\n')
            .filter(row => row.trim())
            .map(row => row.split(',').map(cell => cell.trim()));
    }

    function initializePage(configItems) {
        const title = configItems[0][1];
        document.title = title;
        document.getElementById("logo1").src = configItems[2][1];
        document.getElementById("logo2").src = configItems[3][1];
    }

    function initializeIndices(requiredHeaders) {
        requiredHeaders.forEach(header => {
            indices[header] = headers.indexOf(header);
            if (indices[header] === -1) {
                console.error(`Header ${header} not found. Check your CSV format.`);
            }
        });
    }

    function initializeGallery() {
        const categories = new Set(items.slice(1).map(item => item[indices['Category']] || ''));
        const galleryContainer = document.getElementById('galleryContainer');

        const searchInput = createSearchInput();
        galleryContainer.prepend(searchInput);

        const categoryButtons = createCategoryButtons(categories);
        galleryContainer.appendChild(categoryButtons);

        const subcategorySelect = createDropdown('subcategorySelect', new Set());
        subcategorySelect.addEventListener('change', () => {
            displayGallery(searchInput.value);
        });

        galleryContainer.appendChild(createLabel('Tags:', 'subcategorySelect'));
        galleryContainer.appendChild(subcategorySelect);
        galleryContainer.appendChild(createResetButton(subcategorySelect));
        galleryContainer.appendChild(createEditButton());

        filterSubcategories(subcategorySelect, 'All');
        displayGallery('');
    }

    function createCategoryButtons(categories) {
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('category-buttons');

        categories.forEach(category => {
            const button = document.createElement('button');
            button.textContent = category;
            button.classList.add('category-button');
            button.addEventListener('click', () => {
                button.classList.toggle('selected');
                displayGallery(document.querySelector('.search-input').value);
            });
            buttonContainer.appendChild(button);
        });

        return buttonContainer;
    }

    function createEditButton() {
        const editDiv = document.createElement('div');
        editDiv.style.display = 'inline-block';

        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.id = 'editButton';

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save';
        saveButton.id = 'saveButton';
        saveButton.style.display = 'none';

        editButton.addEventListener('click', () => {
            isEditing = !isEditing; // Toggle editing state
            editButton.textContent = isEditing ? 'Cancel' : 'Edit';
            saveButton.style.display = isEditing ? 'inline-block' : 'none';
            toggleQuantityControls(isEditing);
        });

        saveButton.addEventListener('click', () => {
            if (isEditing) {
                // Save quantities logic
                items.forEach(item => {
                    const sku = item[indices['SKU']];
                    const quantityDisplay = document.querySelector(`.card .sku:contains(${sku}) + .quantity`);
                    const newQuantity = parseInt(quantityDisplay.textContent, 10);
                    updateCart(sku, newQuantity); // Save the quantities to the cart
                });
            }
        });

        editDiv.appendChild(editButton);
        editDiv.appendChild(saveButton);
        return editDiv;
    }

    function toggleQuantityControls(show) {
        const quantityControls = document.querySelectorAll('.quantity-controls');
        const quantityDisplays = document.querySelectorAll('.quantity');

        quantityControls.forEach(control => {
            control.style.display = show ? 'block' : 'none';
        });
        quantityDisplays.forEach(display => {
            display.style.display = show ? 'inline' : 'none';
        });
    }

    function createSearchInput() {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.classList.add('search-input');
        searchInput.placeholder = 'Search...';

        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            displayGallery(searchInput.value);
            searchTimeout = setTimeout(() => searchInput.value = '', 1500);
        });

        return searchInput;
    }

    function createDropdown(id, options) {
        const select = document.createElement('select');
        select.id = id;
        select.appendChild(createOption('All'));
        options.forEach(optionValue => {
            if (optionValue) {
                select.appendChild(createOption(optionValue));
            }
        });
        return select;
    }

    function filterSubcategories(subcategorySelect, selectedCategory) {
        subcategorySelect.innerHTML = '';
        subcategorySelect.appendChild(createOption('All'));

        const subcategories = new Set(items.slice(1)
            .filter(item => selectedCategory === 'All' || item[indices['Category']] === selectedCategory)
            .map(item => item[indices['SubCategory']] || '')
        );

        subcategories.forEach(optionValue => {
            if (optionValue) {
                subcategorySelect.appendChild(createOption(optionValue));
            }
        });
    }

    function displayGallery(searchTerm = '') {
        const selectedCategoryButtons = Array.from(document.querySelectorAll('.category-button.selected'));
        const selectedCategories = selectedCategoryButtons.map(button => button.textContent);
        const selectedSubcategory = document.getElementById('subcategorySelect').value;
        const gallery = document.getElementById('csvGallery');
        gallery.innerHTML = '';
        let itemCount = 0;

        const skuGroups = new Map();
        const defaultImageUrl = 'https://lh3.googleusercontent.com/d/1YkirFIDROJt26ULPsGz0Vcax7YjGrBZa';

        items.slice(1).forEach(item => {
            if (!item || item.length < headers.length) return;

            const skuName = item[indices['SKUName']] || '';
            const sku = item[indices['SKU']] || '';
            const quantityLimit = (item[indices['QuantityLimit']] || '').trim().toLowerCase() === 'true';
            const availableQuantity = parseInt(item[indices['Quantity']] || '0') || 0;

            const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(item[indices['Category']]);
            const subcategoryMatch = selectedSubcategory === 'All' || item[indices['SubCategory']] === selectedSubcategory;
            const searchMatch = skuName.toLowerCase().includes(searchTerm.toLowerCase()) || sku.toLowerCase().includes(searchTerm.toLowerCase());

            if (categoryMatch && subcategoryMatch && searchMatch) {
                const imageUrl = (item[indices['Thumbnails']] && item[indices['Thumbnails']].trim() !== '')
                    ? item[indices['Thumbnails']]
                    : defaultImageUrl;

                const key = `${sku}-${item[indices['SKUVAR']] || ''}`;
                if (!skuGroups.has(key)) {
                    skuGroups.set(key, { count: 1, skuName, imageUrl, quantityLimit, availableQuantity, sku });
                } else {
                    skuGroups.get(key).count++;
                }
            }
        });

        skuGroups.forEach(({ count, skuName, imageUrl, sku, availableQuantity }) => {
            const div = createCard(skuName, count, imageUrl, sku, availableQuantity);
            gallery.appendChild(div);
            itemCount++;
        });

        document.getElementById('countValue').textContent = itemCount;
        syncQuantityDisplays();
    }

    function createCard(skuName, skuCount, imageUrl, sku, availableQuantity) {
        const div = document.createElement('div');
        div.classList.add('card');

        const contentDiv = createContentDiv(skuName, skuCount, imageUrl, sku);
        div.appendChild(contentDiv);

        const infoButton = createInfoButton(imageUrl, skuName);
        contentDiv.insertBefore(infoButton, contentDiv.querySelector('.title'));

        const quantityControls = createQuantityControls(0, availableQuantity, sku);
        div.appendChild(quantityControls);
        quantityControls.style.display = 'none';

        return div;
    }

    function createContentDiv(skuName, skuCount, imageUrl, sku) {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = `
            <img src="${imageUrl}" class="thumbnail" alt="${skuName}">
            <div class="title">${skuName}</div>
            <div class="available-count">${skuCount} available</div>
            <div class="sku">${sku}</div>
        `;
        return contentDiv;
    }

    function createInfoButton(imageUrl, skuName) {
        const button = document.createElement('button');
        button.innerHTML = '<i class="fas fa-info-circle"></i>';
        button.className = 'info-button';
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            openModal(imageUrl, skuName);
        });
        return button;
    }

    function openModal(imageUrl, skuName) {
        document.getElementById("img01").src = imageUrl;
        document.getElementById("caption").textContent = skuName;
        const modalContent = document.querySelector('.modal-content');
        modalContent.style.display = "block";
        modal.style.display = "block";
        document.body.classList.add('modal-open');
    }

    function createQuantityControls(initialQuantity, availableCount, sku) {
        const controlsDiv = document.createElement('div');
        controlsDiv.classList.add('quantity-controls');

        const decrementButton = createQuantityButton('-', initialQuantity === 0, () => updateQuantity(-1));
        const quantityDisplay = createQuantityDisplay(initialQuantity);
        const incrementButton = createQuantityButton('+', initialQuantity >= availableCount, () => updateQuantity(1));

        controlsDiv.append(incrementButton, quantityDisplay, decrementButton);
        return controlsDiv;

        function createQuantityButton(label, isDisabled, onClick) {
            const button = document.createElement('button');
            button.textContent = label;
            button.disabled = isDisabled;
            button.addEventListener('click', onClick);
            return button;
        }

        function createQuantityDisplay(initialQuantity) {
            const span = document.createElement('span');
            span.className = 'quantity';
            span.textContent = initialQuantity;
            return span;
        }

        function updateQuantity(change) {
            let quantity = parseInt(quantityDisplay.textContent);
            quantity += change;

            if (quantity >= 0 && quantity <= availableCount) {
                quantityDisplay.textContent = quantity;
                updateCart(sku, quantity);
                incrementButton.disabled = quantity >= availableCount;
                decrementButton.disabled = quantity === 0;
            }
        }
    }

    function createLabel(text, forId) {
        const label = document.createElement('label');
        label.textContent = text;
        label.setAttribute('for', forId);
        return label;
    }

    function createOption(value) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        return option;
    }

    function createResetButton(subcategorySelect) {
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Filters';
        resetButton.addEventListener('click', () => {
            document.querySelectorAll('.category-button.selected').forEach(button => {
                button.classList.remove('selected');
            });
            subcategorySelect.value = 'All';
            displayGallery(document.querySelector('.search-input').value);
            syncQuantityDisplays();
        });
        return resetButton;
    }

    // Cart functionality
    const cartButton = document.getElementById('cartButton');
    const cartContainer = document.getElementById('floatingCart');
    cartContainer.style.display = 'none';

    cartButton.addEventListener('click', () => {
        cartContainer.style.display = cartContainer.style.display === 'none' ? 'block' : 'none';
        updateCartDisplay();
    });

    // Close cart when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target !== cartContainer && event.target !== cartButton && !cartContainer.contains(event.target)) {
            cartContainer.style.display = 'none';
        }
    });

    document.getElementById('clearCartButton').addEventListener('click', () => {
        cart = {};
        updateCartDisplay();
        updateCartCount();
        displayGallery(''); // Refresh the gallery to ensure controls are updated
        syncQuantityDisplays(); // Sync quantity displays after clearing the cart
    });

    function updateCartDisplay() {
        const cartItemsContainer = document.getElementById('cartItemsContainer');
        cartItemsContainer.innerHTML = '';

        for (const [sku, quantity] of Object.entries(cart)) {
            const item = items.find(item => item[indices['SKU']] === sku);
            if (!item) continue; // Ensure item exists

            const skuName = item[indices['SKUName']];
            const imageUrl = item[indices['Thumbnails']] || 'default-image-url.jpg';
            const cost = item[indices['Cost']];
            const id = item[indices['SKUVAR']] || 'N/A'; // Adjust if SKUVAR represents ID

            // Create a line item element for each item
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div class="item-content">
                    <img src="${imageUrl}" class="thumbnail" alt="${skuName}">
                    <div class="item-details">
                        <div><strong>SKU:</strong> ${sku}</div>
                        <div><strong>ID:</strong> ${id}</div>
                        <div><strong>Title:</strong> ${skuName}</div>
                        <div><strong>Cost:</strong> ${cost}</div>
                        <div><strong>Quantity:</strong> ${quantity}</div>
                    </div>
                </div>
            `;
            const quantityControls = createCartQuantityControls(sku, quantity, parseInt(item[indices['Quantity']] || '0'));
            itemDiv.appendChild(quantityControls);
            cartItemsContainer.appendChild(itemDiv);
        }
        updateCartCount();
    }

    function createCartQuantityControls(sku, currentQuantity, availableCount) {
        const controlsDiv = document.createElement('div');
        controlsDiv.classList.add('quantity-controls');

        const decrementButton = createQuantityButton('-', currentQuantity === 0, () => updateCartQuantity(-1));
        const incrementButton = createQuantityButton('+', currentQuantity >= availableCount, () => updateCartQuantity(1));
        const quantityDisplay = createQuantityDisplay(currentQuantity);

        controlsDiv.append(decrementButton, quantityDisplay, incrementButton);
        return controlsDiv;

        function createQuantityButton(label, isDisabled, onClick) {
            const button = document.createElement('button');
            button.textContent = label;
            button.disabled = isDisabled;
            button.addEventListener('click', onClick);
            return button;
        }

        function createQuantityDisplay(initialQuantity) {
            const span = document.createElement('span');
            span.className = 'quantity';
            span.textContent = initialQuantity;
            return span;
        }

        function updateCartQuantity(change) {
            let quantity = parseInt(quantityDisplay.textContent);
            quantity += change;

            if (quantity >= 0 && quantity <= availableCount) {
                quantityDisplay.textContent = quantity;
                updateCart(sku, quantity);
                incrementButton.disabled = quantity >= availableCount;
                decrementButton.disabled = quantity === 0;
            }
        }
    }

    function updateCartCount() {
        const totalItems = Object.values(cart).reduce((acc, curr) => acc + curr, 0);
        document.getElementById('cartCount').textContent = `Total items: ${totalItems}`;
        cartButton.classList.toggle('not-empty', totalItems > 0);
    }

    function updateCart(sku, quantity) {
        if (quantity > 0) {
            cart[sku] = quantity;
        } else {
            delete cart[sku];
        }
        updateCartDisplay();
        syncQuantityDisplays();
        updateCartCount();
    }

    function syncQuantityDisplays() {
        const cartItems = Object.entries(cart);
        const galleryCards = document.querySelectorAll('.card');

        galleryCards.forEach(card => {
            const sku = card.querySelector('.sku').textContent;
            const quantity = cartItems.find(([itemSku]) => itemSku === sku);
            card.querySelector('.quantity').textContent = quantity ? quantity[1] : '0';
        });
    }
document.getElementById('checkoutButton').addEventListener('click', () => {
    const cartData = Object.entries(cart).map(([sku, quantity]) => {
        const item = items.find(item => item[indices['SKU']] === sku);
        if (!item) return null;

        return {
            sku: sku,
            quantity: quantity,
            skuName: item[indices['SKUName']],
            cost: parseFloat(item[indices['Cost']]) || 0,
        };
    }).filter(item => item !== null); // Filter out any null values

    // Send cart data to Google Sheets
    fetch('https://script.google.com/macros/s/AKfycbw4rCHfT0Nr5Kdyfce4I-ZpwQb8XWV1At9vFxhn5He9f0njevZ_Yc8QPNC1eKpA-7nM/exec', { // Replace with your script's URL
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cart: cartData })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.text();
    })
    .then(data => {
        alert('Checkout successful! Your cart has been sent to Google Sheets.');
    })
    .catch(error => {
        console.error('Error sending cart data:', error);
        alert('There was an error during checkout: ' + error.message);
    });
});
});
