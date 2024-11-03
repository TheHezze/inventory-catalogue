document.addEventListener('DOMContentLoaded', () => {
    // Modal initialization
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

    // Fetch the configuration CSV
    fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vQFs1QTm7qtKV8JLHabFU6vJWNTv-m9OP8M2BkDqX0ooSWqdXALW-UJ2UZAN5NFrY6R_HEH6--SdVa7/pub?output=csv')
        .then(response => response.text())
        .then(configCsvData => {
            const configItems = parseCSV(configCsvData);
            const dynamicLink = configItems[1][1]; // Access row 2, column 2
            const title = configItems[0][1]; // Access row 1, column 2
            const logo1Url = configItems[2][1]; // Logo 1 URL (row 3, column 2)
            const logo2Url = configItems[3][1]; // Logo 2 URL (row 4, column 2)

            // Update title and logos
            document.title = title; // Set the title
            document.getElementById("logo1").src = logo1Url; // Update logo 1
            document.getElementById("logo2").src = logo2Url; // Update logo 2

            // Fetch the main CSV using the dynamic link
            return fetch(dynamicLink);
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(csvData => {
            items = parseCSV(csvData);
            if (items.length > 0) {
                headers = items[0]; // Assuming the main CSV has headers
                initializeIndices(['SKU', 'SKUVAR', 'SKUName', 'QuantityLimit', 'Quantity', 'Category', 'SubCategory', 'Thumbnails']);
                initializeGallery();
            } else {
                console.error('No data found in the CSV.');
            }
        })
        .catch(error => console.error('Error fetching CSV:', error));

    function parseCSV(csvData) {
        const rows = csvData.split('\n').filter(row => row.trim().length > 0);
        return rows.map(row => row.split(',').map(cell => cell.trim()));
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

        // Create search input
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.classList.add('search-input'); // Apply the class
searchInput.placeholder = 'Search...';
galleryContainer.prepend(searchInput);

let searchTimeout; // Variable to hold the timeout

searchInput.addEventListener('input', () => {
    displayGallery(searchInput.value);
    
    // Clear the previous timeout, if any
    clearTimeout(searchTimeout);
    
    // Set a new timeout to clear the input after 1500 milliseconds
    searchTimeout = setTimeout(() => {
        searchInput.value = ''; // Clear the input
    }, 1500);
});

        

        const categorySelect = createDropdown('categorySelect', categories);
        const subcategorySelect = createDropdown('subcategorySelect', new Set());

        categorySelect.addEventListener('change', () => {
            filterSubcategories(subcategorySelect, categorySelect.value);
            displayGallery(searchInput.value);
        });

        subcategorySelect.addEventListener('change', () => {
            displayGallery(searchInput.value);
        });

        searchInput.addEventListener('input', () => {
            displayGallery(searchInput.value);
        });

        galleryContainer.appendChild(createLabel('Category:', 'categorySelect'));
        galleryContainer.appendChild(categorySelect);
        galleryContainer.appendChild(createLabel('SubCategory:', 'subcategorySelect'));
        galleryContainer.appendChild(subcategorySelect);

        const resetButton = createResetButton(categorySelect, subcategorySelect);
        galleryContainer.appendChild(resetButton);

        filterSubcategories(subcategorySelect, categorySelect.value);
        displayGallery('');
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
            const quantity = parseInt(item[indices['Quantity']] || '0') || 0;
            const categoryMatch = selectedCategory === 'All' || item[indices['Category']] === selectedCategory;
            const subcategoryMatch = selectedSubcategory === 'All' || item[indices['SubCategory']] === selectedSubcategory;
            const searchMatch = skuName.toLowerCase().includes(searchTerm.toLowerCase()) || sku.toLowerCase().includes(searchTerm.toLowerCase());

            if (categoryMatch && subcategoryMatch && searchMatch) {
                const imageUrl = (item[indices['Thumbnails']] && item[indices['Thumbnails']].trim() !== '')
                    ? item[indices['Thumbnails']]
                    : defaultImageUrl;

                const key = `${sku}-${item[indices['SKUVAR']] || ''}`;
                if (!skuGroups.has(key)) {
                    skuGroups.set(key, {
                        count: 1,
                        skuName,
                        imageUrl,
                        quantityLimit,
                        quantity,
                        sku
                    });
                } else {
                    skuGroups.get(key).count++;
                }
            }
        });

        skuGroups.forEach(({ count, skuName, imageUrl, sku, quantityLimit, quantity }) => {
            const div = createCard(skuName, count, imageUrl, sku, quantityLimit, quantity);
            gallery.appendChild(div);
            itemCount++;
        });

        document.getElementById('countValue').textContent = itemCount; 
    }

    function createCard(skuName, skuCount, imageUrl, sku, quantityLimit, quantity) {
        const div = document.createElement('div');
        div.classList.add('card');

        div.addEventListener('click', () => {
            const modalImg = document.getElementById("img01");
            const captionText = document.getElementById("caption");

            modal.style.display = "block"; 
            modalImg.src = imageUrl;
            captionText.innerHTML = skuName;

            document.body.classList.add('modal-open');
        });

        const contentDiv = createContentDiv(skuName, skuCount, imageUrl, sku, quantityLimit, quantity);
        div.appendChild(contentDiv);

        return div;
    }

    function createContentDiv(skuName, skuCount, imageUrl, sku, quantityLimit, quantity) {
        const contentDiv = document.createElement('div');
        contentDiv.style.display = 'flex';
        contentDiv.style.flexDirection = 'column';

        const imageContainer = document.createElement('div');
        const img = createImage(imageUrl);
        imageContainer.appendChild(img);
        contentDiv.appendChild(imageContainer);

        contentDiv.appendChild(createParagraph(skuName, 'title'));

        const availableCountDiv = document.createElement('div');
        availableCountDiv.classList.add('available-count');

        if (quantityLimit) {
            availableCountDiv.innerHTML = `${skuCount} <br>Available`;
        } else if (!quantityLimit && quantity > 0) {
            availableCountDiv.innerHTML = `${quantity} <br>Left`;
        }
        
        contentDiv.appendChild(availableCountDiv);

        const skuDiv = document.createElement('div');
        skuDiv.classList.add('sku');
        skuDiv.innerHTML = sku; 
        contentDiv.appendChild(skuDiv);

        return contentDiv;
    }

    function createImage(src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Thumbnail';
        img.classList.add('thumbnail');
        return img;
    }

    function createParagraph(text, className) {
        const p = document.createElement('p');
        p.className = className;
        p.innerText = text;
        return p;
    }

    function createLabel(text, forId) {
        const label = document.createElement('label');
        label.innerText = text;
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
        const button = document.createElement('button');
        button.innerText = 'Reset';
        button.className = 'reset-button';
        button.addEventListener('click', () => {
            categorySelect.value = 'All';
            subcategorySelect.value = 'All';
            displayGallery('');
        });
        return button;
    }
});
