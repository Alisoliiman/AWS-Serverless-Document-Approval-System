// ==========================================
// AWS CONFIGURATION & API GATEWAY ENDPOINT
// ==========================================
const poolData = {
    UserPoolId: '',
    ClientId: ''
};

AWS.config.region = 'region';
const api_base_url = "https://xxxxxxx.execute-api.region.amazonaws.com/prod";

const loginForm = document.getElementById('login-form');
const authSection = document.getElementById('auth-section');
const dashboardSection = document.getElementById('dashboard-section');
const employeeView = document.getElementById('employee-view');
const adminView = document.getElementById('admin-view');
const welcomeUser = document.getElementById('welcome-user');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');

const submitForm = document.getElementById('submit-form');
const historyTbody = document.getElementById('history-tbody');
const adminTbody = document.getElementById('admin-tbody');
const submissionTypeSelect = document.getElementById('submission-type');
const dynamicInputContainer = document.getElementById('dynamic-input-container');
const contentLabel = document.getElementById('content-label');

if (submissionTypeSelect) {
    submissionTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'pdf') {
            contentLabel.textContent = "Upload PDF File";
            dynamicInputContainer.innerHTML = `<input type="file" id="doc-file" accept="application/pdf" required>`;
        } else {
            contentLabel.textContent = "Message Content";
            dynamicInputContainer.innerHTML = `<textarea id="doc-content" rows="4" placeholder="Type your message or details here..." required></textarea>`;
        }
    });
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return {};
    }
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authError.textContent = "";

    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;

    if (!email || !password) {
        authError.textContent = "Please enter both email and password.";
        return;
    }

    const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider({
        region: 'eu-west-3'
    });

    const params = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: poolData.ClientId,
        AuthParameters: {
            USERNAME: email,
            PASSWORD: password
        }
    };

    cognitoidentityserviceprovider.initiateAuth(params, (err, data) => {
        if (err) {
            console.error("Cognito Authentication Error:", err);
            authError.textContent = "Error: Invalid email or password.";
        } else {
            const idToken = data.AuthenticationResult.IdToken;
            const decodedToken = parseJwt(idToken);
            const groups = decodedToken['cognito:groups'] || [];
            const isAdmin = groups.includes('Admins');

            localStorage.setItem('user_email', email);
            localStorage.setItem('is_admin', isAdmin);
            localStorage.setItem('id_token', idToken);

            loadDashboard(email, isAdmin);
        }
    });
});

function loadDashboard(email, isAdmin) {
    authSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    welcomeUser.textContent = `Welcome, ${email} (${isAdmin ? 'Admin' : 'Employee'})`;

    if (isAdmin) {
        adminView.classList.remove('hidden');
        employeeView.classList.add('hidden');
        fetchAdminDocuments();
    } else {
        employeeView.classList.remove('hidden');
        adminView.classList.add('hidden');
        fetchEmployeeHistory(email);
    }
}

logoutBtn.addEventListener('click', () => {
    localStorage.clear();
    dashboardSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    loginForm.reset();
});

// Helper function to convert file to Base64
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}

submitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = localStorage.getItem('user_email');
    const title = document.getElementById('doc-title').value;
    const submission_type = document.getElementById('submission-type').value;
    
    let content = "";
    let fileBase64 = "";
    let fileName = "";

    try {
        if (submission_type === 'pdf') {
            const fileInput = document.getElementById('doc-file');
            if (fileInput && fileInput.files[0]) {
                const file = fileInput.files[0];
                fileName = file.name;
                console.log("Reading file:", fileName, "Size:", file.size);
                fileBase64 = await readFileAsBase64(file);
                console.log("File successfully converted to Base64 length:", fileBase64.length);
            } else {
                alert('Please select a PDF file.');
                return;
            }
        } else {
            content = document.getElementById('doc-content').value;
        }

        const payload = {
            employee_id: email,
            title: title,
            submission_type: submission_type,
            content: content,
            file_base64: fileBase64,
            file_name: fileName
        };

        console.log("Sending payload to API Gateway:", api_base_url + "/documents");

        const response = await fetch(`${api_base_url}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log("Response status:", response.status);
        const responseData = await response.json();
        console.log("Response body:", responseData);

        if (response.ok) {
            alert('Request submitted successfully!');
            submitForm.reset();
            contentLabel.textContent = "Message Content";
            dynamicInputContainer.innerHTML = `<textarea id="doc-content" rows="4" placeholder="Type your message or details here..." required></textarea>`;
            fetchEmployeeHistory(email);
        } else {
            alert('Failed to submit request: ' + JSON.stringify(responseData));
        }
    } catch (err) {
        console.error('Error during submission process:', err);
        alert('An error occurred during submission. Check console for details.');
    }
});

async function fetchEmployeeHistory(employeeId) {
    try {
        const response = await fetch(`${api_base_url}/documents?employee_id=${encodeURIComponent(employeeId)}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) throw new Error('Failed to fetch history');
        const items = await response.json();
        
        historyTbody.innerHTML = '';
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.title}</td>
                <td>${item.submission_type.toUpperCase()}</td>
                <td class="status-${item.status}">${item.status.toUpperCase()}</td>
                <td>${new Date(item.created_at).toLocaleDateString()}</td>
            `;
            historyTbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error fetching employee history:', err);
    }
}

async function fetchAdminDocuments() {
    try {
        const response = await fetch(`${api_base_url}/documents`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to fetch admin documents');
        const items = await response.json();
        
        adminTbody.innerHTML = '';
        items.forEach(item => {
            let contentDisplay = item.content;
            if (item.submission_type === 'pdf' && item.file_url) {
                contentDisplay = `<a href="${item.file_url}" target="_blank" class="btn secondary-btn" style="padding: 5px 10px; font-size: 12px; text-decoration: none; display: inline-block; background-color: #007bff; color: white; border-radius: 4px;">📄 Open PDF File</a>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.employee_id}</td>
                <td>${item.title}</td>
                <td><strong>[${item.submission_type.toUpperCase()}]</strong><br>${contentDisplay}</td>
                <td class="status-${item.status}">${item.status.toUpperCase()}</td>
                <td>
                    ${item.status === 'pending' ? `
                        <div class="action-btns">
                            <button class="approve-btn" onclick="updateStatus('${item.document_id}', 'approved')">Approve</button>
                            <button class="reject-btn" onclick="updateStatus('${item.document_id}', 'rejected')">Reject</button>
                        </div>
                    ` : 'Completed'}
                </td>
            `;
            adminTbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error fetching admin documents:', err);
    }
}

async function updateStatus(documentId, status) {
    const adminEmail = localStorage.getItem('user_email');
    try {
        const response = await fetch(`${api_base_url}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                document_id: documentId,
                status: status,
                approver_email: adminEmail
            })
        });

        if (response.ok) {
            alert(`Document successfully ${status}!`);
            fetchAdminDocuments();
        } else {
            alert('Failed to update status.');
        }
    } catch (err) {
        console.error('Error updating document status:', err);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const savedEmail = localStorage.getItem('user_email');
    const isAdmin = localStorage.getItem('is_admin') === 'true';
    if (savedEmail) {
        loadDashboard(savedEmail, isAdmin);
    }
});
