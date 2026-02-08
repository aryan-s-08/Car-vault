
window.addEventListener('load', () => {
    setTimeout(() => {
        initializeApp();
    }, 100);
});

let allCarsGlobal = [];
let currentFilter = 'All';

function initializeApp() {
    if (!window.db || !window.firebaseModules) {
        console.error('Firebase not ready yet, retrying...');
        setTimeout(initializeApp, 100);
        return;
    }

    const { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } = window.firebaseModules;
    const db = window.db;

    console.log('✅ App initialized with Firebase');

    fetchCars();
    setupFilters();
    setupSearch();
    setupEditModal();

    document.getElementById('carForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const carData = {
            make: document.getElementById('make').value.trim(),
            model: document.getElementById('model').value.trim(),
            chassis: document.getElementById('chassis').value.toUpperCase().trim(),
            category: document.getElementById('category').value,
            year: parseInt(document.getElementById('year').value),
            price: parseFloat(document.getElementById('price').value),
            createdAt: new Date().toISOString()
        };

        try {
            const q = query(collection(db, 'cars'), where('chassis', '==', carData.chassis));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                alert("Error: Chassis number already exists in the vault!");
                return;
            }

            await addDoc(collection(db, 'cars'), carData);
            
            alert("✅ Vehicle added to Vault!");
            document.getElementById('carForm').reset();
            fetchCars();
            
        } catch (error) {
            console.error("Error adding vehicle:", error);
            alert("❌ Failed to add vehicle. Check console for details.");
        }
    });

    async function fetchCars() {
        try {
            const querySnapshot = await getDocs(collection(db, 'cars'));
            const cars = [];
            
            querySnapshot.forEach((docSnap) => {
                cars.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });
            
            allCarsGlobal = cars;
            updateStatistics(cars);
            applyCurrentFilters();
            
        } catch (error) {
            console.error("Error fetching cars:", error);
            document.getElementById('carGrid').innerHTML = '<p style="color: #ff4444;">⚠️ Error loading vehicles</p>';
        }
    }

    function updateStatistics(cars) {
        const total = cars.length;
        const totalValue = cars.reduce((sum, car) => sum + (parseFloat(car.price) || 0), 0);
        
        const suvCount = cars.filter(car => car.category === 'SUV').length;
        const sedanCount = cars.filter(car => car.category === 'Sedan').length;
        const hatchbackCount = cars.filter(car => car.category === 'Hatchback').length;
        const sub4mCount = cars.filter(car => car.category === 'Sub4m').length;
        
        document.getElementById('totalCars').textContent = total;
        document.getElementById('totalValue').textContent = '₹' + totalValue.toLocaleString('en-IN');
        document.getElementById('suvCount').textContent = suvCount;
        document.getElementById('sedanCount').textContent = sedanCount;
        document.getElementById('hatchbackCount').textContent = hatchbackCount;
        document.getElementById('sub4mCount').textContent = sub4mCount;
    }

    function renderCars(cars) {
        const grid = document.getElementById('carGrid');
        grid.innerHTML = '';
        
        if (cars.length === 0) {
            grid.innerHTML = '<p style="color: #666; grid-column: 1/-1; text-align: center; padding: 60px;">No vehicles found matching your criteria.</p>';
            document.getElementById('carCount').innerText = '0 VEHICLES AVAILABLE';
            return;
        }
        
        cars.forEach(car => {
            grid.innerHTML += `
                <div class="car-card">
                    <div class="card-content">
                        <span class="chassis-no">VIN: ${car.chassis}</span>
                        <h3>${car.make} ${car.model}</h3>
                        <p>${car.year} | ${car.category}</p>
                        <p style="color: white; font-weight: bold;">₹${Number(car.price).toLocaleString('en-IN')}</p>
                        <div class="card-actions">
                            <button class="btn-edit" onclick="openEditModal('${car.id}')">EDIT</button>
                            <button class="btn-remove" onclick="deleteCar('${car.id}')">REMOVE</button>
                        </div>
                    </div>
                </div>`;
        });
        
        document.getElementById('carCount').innerText = `${cars.length} VEHICLE${cars.length !== 1 ? 'S' : ''} AVAILABLE`;
    }

    function setupFilters() {
        const filterButtons = document.querySelectorAll('.filter-btn');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.getAttribute('data-filter');
                applyCurrentFilters();
            });
        });
    }

    function setupSearch() {
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            applyCurrentFilters();
        });
    }

    function applyCurrentFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        
        let filtered = allCarsGlobal;
        
        if (currentFilter !== 'All') {
            filtered = filtered.filter(car => car.category === currentFilter);
        }
        
        if (searchTerm) {
            filtered = filtered.filter(car => 
                car.make.toLowerCase().includes(searchTerm) ||
                car.model.toLowerCase().includes(searchTerm) ||
                car.chassis.toLowerCase().includes(searchTerm)
            );
        }
        
        renderCars(filtered);
    }

    function setupEditModal() {
        const modal = document.getElementById('editModal');
        const closeBtn = document.querySelector('.close-modal');
        
        closeBtn.onclick = function() {
            modal.style.display = 'none';
        };
        
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        };
        
        document.getElementById('editForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await updateCar();
        });
    }

    window.openEditModal = function(carId) {
        const car = allCarsGlobal.find(c => c.id === carId);
        if (!car) return;
        
        document.getElementById('editCarId').value = car.id;
        document.getElementById('editMake').value = car.make;
        document.getElementById('editModel').value = car.model;
        document.getElementById('editChassis').value = car.chassis;
        document.getElementById('editCategory').value = car.category;
        document.getElementById('editYear').value = car.year;
        document.getElementById('editPrice').value = car.price;
        
        document.getElementById('editModal').style.display = 'block';
    };

    window.closeEditModal = function() {
        document.getElementById('editModal').style.display = 'none';
    };

    async function updateCar() {
        const carId = document.getElementById('editCarId').value;
        
        const updatedData = {
            make: document.getElementById('editMake').value.trim(),
            model: document.getElementById('editModel').value.trim(),
            category: document.getElementById('editCategory').value,
            year: parseInt(document.getElementById('editYear').value),
            price: parseFloat(document.getElementById('editPrice').value),
            updatedAt: new Date().toISOString()
        };

        try {
            await updateDoc(doc(db, 'cars', carId), updatedData);
            alert("✅ Vehicle updated successfully!");
            closeEditModal();
            fetchCars();
        } catch (error) {
            console.error("Error updating vehicle:", error);
            alert("❌ Failed to update vehicle");
        }
    }

    window.deleteCar = async function(id) {
        if(confirm("🗑️ Remove this vehicle from vault?")) {
            try {
                await deleteDoc(doc(db, 'cars', id));
                alert("✅ Vehicle removed successfully!");
                fetchCars();
            } catch (error) {
                console.error("Error deleting vehicle:", error);
                alert("❌ Failed to remove vehicle");
            }
        }
    };
}
