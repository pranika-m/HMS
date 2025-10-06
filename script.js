console.log("Script loaded");

// PatientManager class to handle patient data
class PatientManager {
    constructor() {
        this.patients = []; // Array to store patient data
        this.patientHistory = new Map(); // Map to store patient history
        this.nextId = 1; 
    }

    // to generate a unique patient ID 
    generatePatientId() {
        const id = `P${String(this.nextId).padStart(3, '0')}`;
        this.nextId++;
        return id;
    }

    // Binary search to find patient ID
    binarySearchById(id) {
        const sortedPatients = [...this.patients].sort((a, b) => a.id.localeCompare(b.id));
        let left = 0;
        let right = sortedPatients.length - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            if (sortedPatients[mid].id === id) {
                return this.patients.findIndex(p => p.id === id);
            } else if (sortedPatients[mid].id < id) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return -1;
    }

    // Quick sort to sort patients by a key (e.g., name, date)
    quickSort(arr, key, ascending = true) {
        if (arr.length <= 1) return arr;

        const pivot = arr[Math.floor(arr.length / 2)];
        const left = [];
        const right = [];
        const equal = [];

        for (let element of arr) {
            const comparison = this.compareValues(element[key], pivot[key]);
            if (comparison < 0) {
                ascending ? left.push(element) : right.push(element);
            } else if (comparison > 0) {
                ascending ? right.push(element) : left.push(element);
            } else {
                equal.push(element);
            }
        }

        return [
            ...this.quickSort(left, key, ascending),
            ...equal,
            ...this.quickSort(right, key, ascending)
        ];
    }

    // Compare values for sorting
    compareValues(a, b) {
        if (typeof a === 'string' && typeof b === 'string') {
            return a.localeCompare(b);
        }
        return a - b;
    }

    // Create a search index for fast lookup
    createSearchIndex() {
        const index = new Map();
        this.patients.forEach((patient, idx) => {
            const nameKey = patient.name.toLowerCase();
            if (!index.has(nameKey)) index.set(nameKey, []);
            index.get(nameKey).push(idx);

            if (!index.has(patient.id)) index.set(patient.id, []);
            index.get(patient.id).push(idx);
        });
        return index;
    }

    // Add a new patient
    addPatient(patientData) {
        const patient = {
            ...patientData,
            id: this.generatePatientId()
        };
        this.patients.push(patient);

        // Add to history
        if (!this.patientHistory.has(patient.id)) {
            this.patientHistory.set(patient.id, []);
        }
        this.patientHistory.get(patient.id).push({
            ...patient,
            timestamp: new Date().toISOString(),
            action: 'Created'
        });

        return patient;
    }

    // Update an existing patient
    updatePatient(index, updatedPatient, newHistoryEntry = '') {
        if (index >= 0 && index < this.patients.length) {
            const oldPatient = { ...this.patients[index] };
            this.patients[index] = updatedPatient;

            // Add to history
            this.patientHistory.get(updatedPatient.id).push({
                ...updatedPatient,
                timestamp: new Date().toISOString(),
                action: 'Updated',
                previousData: oldPatient,
                historyEntry: newHistoryEntry
            });

            return true;
        }
        return false;
    }

    // Delete a patient
    deletePatient(index) {
        if (index >= 0 && index < this.patients.length) {
            const deletedPatient = this.patients[index];
            this.patients.splice(index, 1);

            // Add to history
            this.patientHistory.get(deletedPatient.id).push({
                ...deletedPatient,
                timestamp: new Date().toISOString(),
                action: 'Deleted'
            });

            return true;
        }
        return false;
    }

    // Search patients by query and status
    searchPatients(query, statusFilter = '') {
        const searchIndex = this.createSearchIndex();
        let results = [];

        if (query) {
            const queryLower = query.toLowerCase();
            for (let [key, indices] of searchIndex) {
                if (key.includes(queryLower)) {
                    indices.forEach(idx => {
                        if (!results.includes(idx)) {
                            results.push(idx);
                        }
                    });
                }
            }
            this.patients.forEach((patient, idx) => {
                if (patient.diagnosis.toLowerCase().includes(queryLower) && !results.includes(idx)) {
                    results.push(idx);
                }
            });
        } else {
            results = this.patients.map((_, idx) => idx);
        }

        if (statusFilter) {
            results = results.filter(idx => this.patients[idx].status === statusFilter);
        }

        return results.map(idx => ({ ...this.patients[idx], index: idx }));
    }

    // Get patient history by ID
    getPatientHistory(id) {
        return this.patientHistory.get(id) || [];
    }

    // Get statistics for dashboard
    getStatistics() {
        const total = this.patients.length;
        const active = this.patients.filter(p => p.status === 'Under Treatment').length;
        const appointments = this.patients.filter(p => p.status === 'Appointment Scheduled').length;
        const discharged = this.patients.filter(p => p.status === 'Discharged').length;

        return { total, active, appointments, discharged };
    }
}

// Initialize patient manager
const patientManager = new PatientManager();

// Load page content dynamically
async function showPage(pageId) {
    const pageContent = document.getElementById('pageContent');
    pageContent.innerHTML = ''; // Clear previous content

    // Update active navigation
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('active-nav');
    });
    document.getElementById(pageId + 'Btn').classList.add('active-nav');

    try {
        // Fetch the HTML file for the requested page
        const response = await fetch(`${pageId}.html`);
        if (!response.ok) throw new Error(`Failed to load ${pageId}.html`);
        pageContent.innerHTML = await response.text();

        // Initialize page-specific functionality
        if (pageId === 'patients') {
            displayPatients();
            // Reattach event listeners for search and filters
            document.getElementById('patientSearch')?.addEventListener('input', applyFilters);
            document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
            document.getElementById('sortBy')?.addEventListener('change', applyFilters);
        } else if (pageId === 'reports') {
            // Reattach event listeners for report buttons
            document.getElementById('reportPatientId')?.addEventListener('input', () => {
                document.getElementById('reportResult')?.classList.add('hidden');
                document.getElementById('printBtn')?.classList.add('hidden');
            });
        }

        updateStatistics();
    } catch (error) {
        console.error(error);
        pageContent.innerHTML = `<div class="text-center py-12">
            <h3 class="text-xl font-semibold text-red-600">Error loading page</h3>
            <p class="text-gray-500">Please check if ${pageId}.html exists.</p>
        </div>`;
    }
}

// Show Add Patient modal
async function showAddPatientForm() {
    const modalContainer = document.getElementById('modalContainer');
    try {
        const response = await fetch('add-patient-modal.html');
        if (!response.ok) throw new Error('Failed to load add-patient-modal.html');
        modalContainer.innerHTML = await response.text();
        modalContainer.classList.remove('hidden');

        // Set default date and next ID
        document.getElementById('patientDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('autoGeneratedId').textContent = `P${String(patientManager.nextId).padStart(4, '0')}`;

        // Attach form submission handler
        document.getElementById('addPatientForm').addEventListener('submit', handleAddPatient);
    } catch (error) {
        console.error(error);
        showNotification('Failed to load Add Patient form', 'error');
    }
}

// Close Add Patient modal
function closeAddPatientForm() {
    document.getElementById('modalContainer').classList.add('hidden');
    document.getElementById('modalContainer').innerHTML = '';
}

// Show Edit Patient modal
async function showEditPatientForm(index) {
    const patient = patientManager.patients[index];
    const modalContainer = document.getElementById('modalContainer');

    try {
        const response = await fetch('edit-patient-modal.html');
        if (!response.ok) throw new Error('Failed to load edit-patient-modal.html');
        modalContainer.innerHTML = await response.text();
        modalContainer.classList.remove('hidden');

        // Populate form fields
        document.getElementById('editPatientIndex').value = index;
        document.getElementById('editPatientId').value = patient.id;
        document.getElementById('editPatientName').value = patient.name;
        document.getElementById('editPatientAge').value = patient.age;
        document.getElementById('editPatientGender').value = patient.gender;
        document.getElementById('editPatientDate').value = patient.date;
        document.getElementById('editPatientStatus').value = patient.status;
        document.getElementById('editPatientDiagnosis').value = patient.diagnosis;

        // Load patient history
        const history = patientManager.getPatientHistory(patient.id);
        const historyList = document.getElementById('historyList');
        if (history.length > 1) {
            historyList.innerHTML = history.slice(1).reverse().map(entry => `
                <div class="text-sm p-2 bg-white rounded border">
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-medium text-gray-700">${entry.action}</span>
                        <span class="text-xs text-gray-500">${new Date(entry.timestamp).toLocaleDateString()}</span>
                    </div>
                    ${entry.historyEntry ? `<p class="text-gray-600">${entry.historyEntry}</p>` : ''}
                    ${entry.previousData ? `<p class="text-xs text-gray-500">Previous: ${entry.previousData.diagnosis}</p>` : ''}
                </div>
            `).join('');
        } else {
            historyList.innerHTML = '<p class="text-sm text-gray-500">No previous history entries</p>';
        }

        // Attach form submission handler
        document.getElementById('editPatientForm').addEventListener('submit', handleEditPatient);
    } catch (error) {
        console.error(error);
        showNotification('Failed to load Edit Patient form', 'error');
    }
}

// Close Edit Patient modal
function closeEditPatientForm() {
    document.getElementById('modalContainer').classList.add('hidden');
    document.getElementById('modalContainer').innerHTML = '';
}

// Handle Add Patient form submission
function handleAddPatient(e) {
    e.preventDefault();
    const patientData = {
        name: document.getElementById('patientName').value,
        age: parseInt(document.getElementById('patientAge').value),
        gender: document.getElementById('patientGender').value,
        diagnosis: document.getElementById('patientDiagnosis').value,
        date: document.getElementById('patientDate').value,
        status: document.getElementById('patientStatus').value
    };

    try {
        const newPatient = patientManager.addPatient(patientData);
        closeAddPatientForm();
        if (document.getElementById('pageContent').innerHTML.includes('patientList')) {
            displayPatients();
        }
        updateStatistics();
        showNotification(`Patient added successfully! ID: ${newPatient.id}`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Handle Edit Patient form submission
function handleEditPatient(e) {
    e.preventDefault();
    const index = parseInt(document.getElementById('editPatientIndex').value);
    const patient = {
        id: document.getElementById('editPatientId').value,
        name: document.getElementById('editPatientName').value,
        age: parseInt(document.getElementById('editPatientAge').value),
        gender: document.getElementById('editPatientGender').value,
        diagnosis: document.getElementById('editPatientDiagnosis').value,
        date: document.getElementById('editPatientDate').value,
        status: document.getElementById('editPatientStatus').value
    };
    const newHistoryEntry = document.getElementById('editPatientHistory').value;

    if (patientManager.updatePatient(index, patient, newHistoryEntry)) {
        closeEditPatientForm();
        if (document.getElementById('pageContent').innerHTML.includes('patientList')) {
            displayPatients();
        }
        updateStatistics();
        showNotification('Patient updated successfully!', 'success');
    } else {
        showNotification('Failed to update patient', 'error');
    }
}

// Display patients on the Patients page
function displayPatients() {
    const patientList = document.getElementById('patientList');
    if (!patientList) return; // Exit if not on Patients page

    const patients = patientManager.patients;
    if (patients.length === 0) {
        patientList.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">👥</div>
                <h3 class="text-xl font-semibold text-gray-600 mb-2">No patients found</h3>
                <p class="text-gray-500">Add your first patient to get started</p>
            </div>
        `;
        return;
    }

    patientList.innerHTML = patients.map((patient, index) => `
        <div class="bg-white rounded-xl p-6 card-shadow scale-hover">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center space-x-4 mb-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="text-xl">${patient.gender === 'Male' ? '👨' : patient.gender === 'Female' ? '👩' : '👤'}</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${patient.name}</h3>
                            <p class="text-gray-600">ID: ${patient.id}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <p class="text-sm text-gray-500">Age</p>
                            <p class="font-semibold">${patient.age} years</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Gender</p>
                            <p class="font-semibold">${patient.gender}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Date</p>
                            <p class="font-semibold">${new Date(patient.date).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Status</p>
                            <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(patient.status)}">
                                ${patient.status}
                            </span>
                        </div>
                    </div>
                    <div class="mb-4">
                        <p class="text-sm text-gray-500 mb-1">Diagnosis</p>
                        <p class="text-gray-800">${patient.diagnosis}</p>
                    </div>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="showEditPatientForm(${index})" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm">
                        ✏️ Edit
                    </button>
                    <button onclick="deletePatient(${index})" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-300 text-sm">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Delete a patient
function deletePatient(index) {
    if (confirm('Are you sure you want to delete this patient?')) {
        const patient = patientManager.patients[index];
        if (patientManager.deletePatient(index)) {
            displayPatients();
            updateStatistics();
            showNotification(`Patient ${patient.name} deleted successfully!`, 'success');
        } else {
            showNotification('Failed to delete patient', 'error');
        }
    }
}

// Apply search and filter on Patients page
function applyFilters() {
    const patientList = document.getElementById('patientList');
    if (!patientList) return; // Exit if not on Patients page

    const query = document.getElementById('patientSearch').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    let results = patientManager.searchPatients(query, statusFilter);
    results = patientManager.quickSort(results, sortBy);
    displayFilteredPatients(results);
}

// Display filtered patients
function displayFilteredPatients(patients) {
    const patientList = document.getElementById('patientList');
    if (!patientList) return;

    if (patients.length === 0) {
        patientList.innerHTML = `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">🔍</div>
                <h3 class="text-xl font-semibold text-gray-600 mb-2">No patients found</h3>
                <p class="text-gray-500">Try adjusting your search criteria</p>
            </div>
        `;
        return;
    }

    patientList.innerHTML = patients.map((patient) => `
        <div class="bg-white rounded-xl p-6 card-shadow scale-hover">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <div class="flex items-center space-x-4 mb-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span class="text-xl">${patient.gender === 'Male' ? '👨' : patient.gender === 'Female' ? '👩' : '👤'}</span>
                        </div>
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${patient.name}</h3>
                            <p class="text-gray-600">ID: ${patient.id}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <p class="text-sm text-gray-500">Age</p>
                            <p class="font-semibold">${patient.age} years</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Gender</p>
                            <p class="font-semibold">${patient.gender}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Date</p>
                            <p class="font-semibold">${new Date(patient.date).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <p class="text-sm text-gray-500">Status</p>
                            <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(patient.status)}">
                                ${patient.status}
                            </span>
                        </div>
                    </div>
                    <div class="mb-4">
                        <p class="text-sm text-gray-500 mb-1">Diagnosis</p>
                        <p class="text-gray-800">${patient.diagnosis}</p>
                    </div>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="showEditPatientForm(${patient.index})" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-sm">
                        ✏️ Edit
                    </button>
                    <button onclick="deletePatient(${patient.index})" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors duration-300 text-sm">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// Generate patient report on Reports page
function generateReport() {
    const patientId = document.getElementById('reportPatientId')?.value;
    if (!patientId) {
        showNotification('Please enter a Patient ID', 'error');
        return;
    }

    const patientIndex = patientManager.binarySearchById(patientId);
    if (patientIndex === -1) {
        showNotification('Patient not found', 'error');
        document.getElementById('reportResult')?.classList.add('hidden');
        return;
    }

    const patient = patientManager.patients[patientIndex];
    const history = patientManager.getPatientHistory(patientId);
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;

    reportContent.innerHTML = `
        <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 mb-6">
            <h4 class="text-2xl font-bold text-gray-800 mb-4">Patient Information</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <p class="text-sm text-gray-600">Patient ID</p>
                    <p class="text-lg font-semibold text-gray-800">${patient.id}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Full Name</p>
                    <p class="text-lg font-semibold text-gray-800">${patient.name}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Age</p>
                    <p class="text-lg font-semibold text-gray-800">${patient.age} years</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Gender</p>
                    <p class="text-lg font-semibold text-gray-800">${patient.gender}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Current Status</p>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(patient.status)}">
                        ${patient.status}
                    </span>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Last Visit</p>
                    <p class="text-lg font-semibold text-gray-800">${new Date(patient.date).toLocaleDateString()}</p>
                </div>
            </div>
            <div class="mt-4">
                <p class="text-sm text-gray-600">Current Diagnosis</p>
                <p class="text-gray-800 mt-1">${patient.diagnosis}</p>
            </div>
        </div>
        <div class="bg-white rounded-xl p-6 border border-gray-200">
            <h4 class="text-xl font-bold text-gray-800 mb-4">Medical History</h4>
            <div class="space-y-4">
                ${history.map(record => `
                    <div class="border-l-4 border-blue-500 pl-4 py-2">
                        <div class="flex justify-between items-start mb-2">
                            <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                                ${record.action}
                            </span>
                            <span class="text-sm text-gray-500">
                                ${new Date(record.timestamp).toLocaleString()}
                            </span>
                        </div>
                        <p class="text-gray-700 mb-1"><strong>Diagnosis:</strong> ${record.diagnosis}</p>
                        <p class="text-gray-700"><strong>Status:</strong> ${record.status}</p>
                        ${record.previousData ? `
                            <details class="mt-2">
                                <summary class="text-sm text-blue-600 cursor-pointer">View Previous Data</summary>
                                <div class="mt-2 p-2 bg-gray-50 rounded text-sm">
                                    <p><strong>Previous Diagnosis:</strong> ${record.previousData.diagnosis}</p>
                                    <p><strong>Previous Status:</strong> ${record.previousData.status}</p>
                                </div>
                            </details>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('reportResult').classList.remove('hidden');
    document.getElementById('printBtn').classList.remove('hidden');
}

// Print patient report
function printReport() {
    const reportContent = document.getElementById('reportContent')?.innerHTML;
    if (!reportContent) {
        showNotification('No report to print', 'error');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showNotification('Pop-up blocked. Please allow pop-ups for this site.', 'error');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Patient Medical Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
                .patient-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                .history-section { margin-top: 30px; }
                .history-entry { border-left: 4px solid #007bff; padding-left: 15px; margin-bottom: 20px; }
                .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
                .status-treatment { background: #d4edda; color: #155724; }
                .status-appointment { background: #fff3cd; color: #856404; }
                .status-discharged { background: #e2e3e5; color: #383d41; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏥 MediCare Hospital Management System</h1>
                <h2>Patient Medical Report</h2>
                <p>Generated on: ${new Date().toLocaleString()}</p>
            </div>
            ${reportContent}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

// Get status color for patient status badges
function getStatusColor(status) {
    switch (status) {
        case 'Under Treatment':
            return 'bg-green-100 text-green-800';
        case 'Appointment Scheduled':
            return 'bg-orange-100 text-orange-800';
        case 'Discharged':
            return 'bg-purple-100 text-purple-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// Update dashboard statistics
function updateStatistics() {
    const stats = patientManager.getStatistics();
    if (document.getElementById('totalPatients')) {
        document.getElementById('totalPatients').textContent = stats.total;
        document.getElementById('activePatients').textContent = stats.active;
        document.getElementById('appointments').textContent = stats.appointments;
        document.getElementById('discharged').textContent = stats.discharged;
    }
}

// Show notification messages
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-20 right-6 z-50 px-6 py-4 rounded-lg shadow-lg transition-all duration-300 ${
        type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Update date and time display
function updateDateTime() {
    const now = new Date();
    const formatted = now.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    const dateTimeEl = document.getElementById('currentDateTime');
    if (dateTimeEl) dateTimeEl.textContent = formatted;
}
updateDateTime();
setInterval(updateDateTime, 1000);

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded");
    // Update date/time every second
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Add sample patients if none exist
    if (patientManager.patients.length === 0) {
        const samplePatients = [
            {
                name: 'John Smith',
                age: 45,
                gender: 'Male',
                diagnosis: 'Hypertension and diabetes management',
                date: '2025-07-15',
                status: 'Under Treatment'
            },
            {
                name: 'Sarah Johnson',
                age: 32,
                gender: 'Female',
                diagnosis: 'Routine checkup and vaccination',
                date: '2025-06-20',
                status: 'Discharged'
            },
            {
                name: 'Michael Brown',
                age: 28,
                gender: 'Male',
                diagnosis: 'Follow-up consultation for knee injury',
                date: '2024-08-25',
                status: 'Appointment Scheduled'
            }
        ];
        samplePatients.forEach(patient => patientManager.addPatient(patient));
    }

    // Load dashboard by default
    showPage('dashboard');
    document.getElementById('dashboardBtn').classList.add('active-nav');
});