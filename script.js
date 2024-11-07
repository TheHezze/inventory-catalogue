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

        const categorySelect = createDropdown('categorySelect', categories);
        const subcategorySelect = createDropdown('subcategorySelect', new Set());

        categorySelect.addEventListener('change', () => {
            filterSubcategories(subcategorySelect, categorySelect.value);
            displayGallery(searchInput.value);
        });

        subcategorySelect.addEventListener('change', () => {
            displayGallery(searchInput.value);
        });

        galleryContainer.appendChild(createLabel('Category:', 'categorySelect'));
        galleryContainer.appendChild(categorySelect);
        galleryContainer.appendChild(createLabel('SubCategory:', 'subcategorySelect'));
        galleryContainer.appendChild(subcategorySelect);
        galleryContainer.appendChild(createResetButton(categorySelect, subcategorySelect));

        filterSubcategories(subcategorySelect, categorySelect.value);
        displayGallery('');
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
        const selectedCategory = document.getElementById('categorySelect').value;
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

            const categoryMatch = selectedCategory === 'All' || item[indices['Category']] === selectedCategory;
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

        // Sync the quantities with the cart after displaying the gallery
        syncQuantityDisplays();
    }

    function createCard(skuName, skuCount, imageUrl, sku, availableQuantity) {
        const div = document.createElement('div');
        div.classList.add('card');

        const contentDiv = createContentDiv(skuName, skuCount, imageUrl, sku);
        div.appendChild(contentDiv);

        const infoButton = createInfoButton(skuName, imageUrl);
        contentDiv.insertBefore(infoButton, contentDiv.querySelector('.title'));

        const quantityControls = createQuantityControls(0, availableQuantity, sku);
        div.appendChild(quantityControls);

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

    function createInfoButton(skuName, imageUrl) {
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

    function createResetButton(categorySelect, subcategorySelect) {
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Filters';
        resetButton.addEventListener('click', () => {
            categorySelect.value = 'All';
            subcategorySelect.value = 'All';
            displayGallery(document.querySelector('.search-input').value); // Use current search input
            syncQuantityDisplays(); // Ensure quantities are synced after resetting
        });
        return resetButton;
    }
    
    // Cart functionality
    const cartButton = document.getElementById('cartButton');
    const cartContainer = document.getElementById('floatingCart');
    cartContainer.style.display = 'none'; // Initially hide the cart

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
    
        // Update cart button styling
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
        updateCartCount(); // Ensure the cart count updates after modifying the cart
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
});
