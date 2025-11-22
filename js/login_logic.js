/**
 * Módulo para gestionar el login de choferes.
 * Maneja la apertura del modal, validación de legajo y persistencia en localStorage.
 */
const LoginLogic = (function() {

    const STORAGE_KEY = 'driver_login_data';

    const els = {
        modal: null,
        closeBtn: null,
        openBtn: null,
        driverIdInput: null,
        scheduleTypeInput: null,
        btnLogin: null,
        btnLogout: null,
        displayLabel: null
    };

    /**
     * Inicializa el módulo de login.
     * Busca los elementos del DOM y configura los event listeners.
     */
    function init() {
        // Referencias DOM
        els.modal = document.getElementById('login-modal');
        els.closeBtn = document.getElementById('close-login-modal');
        els.openBtn = document.getElementById('btn-driver-login');
        els.driverIdInput = document.getElementById('driver-id-input');
        els.scheduleTypeInput = document.getElementById('schedule-type-input');
        els.btnLogin = document.getElementById('btn-confirm-login');
        els.btnLogout = document.getElementById('btn-logout');
        els.displayLabel = document.getElementById('schedule-type-display');

        // Event Listeners
        if (els.openBtn) els.openBtn.addEventListener('click', openModal);
        if (els.closeBtn) els.closeBtn.addEventListener('click', closeModal);
        if (els.btnLogin) els.btnLogin.addEventListener('click', handleLogin);
        if (els.btnLogout) els.btnLogout.addEventListener('click', handleLogout);

        // Clic fuera del modal para cerrar
        window.addEventListener('click', (e) => {
            if (e.target === els.modal) {
                closeModal();
            }
        });

        // Restaurar sesión al iniciar
        restoreSession();
    }

    /**
     * Abre el modal de login.
     * Si ya hay datos guardados, rellena los campos o muestra estado logueado.
     */
    function openModal() {
        const data = getStoredData();
        if (data) {
            els.driverIdInput.value = data.legajo;
            els.driverIdInput.disabled = true;
            els.scheduleTypeInput.value = data.tipoHorario;
            els.scheduleTypeInput.disabled = true;
            els.btnLogin.classList.add('hidden');
            els.btnLogout.classList.remove('hidden');
        } else {
            resetForm();
        }
        els.modal.classList.remove('hidden');
    }

    /**
     * Cierra el modal.
     */
    function closeModal() {
        els.modal.classList.add('hidden');
    }

    /**
     * Resetea el formulario a su estado inicial (para nuevo login).
     */
    function resetForm() {
        els.driverIdInput.value = '';
        els.driverIdInput.disabled = false;
        els.scheduleTypeInput.value = '';
        els.scheduleTypeInput.disabled = false;
        els.btnLogin.classList.remove('hidden');
        els.btnLogout.classList.add('hidden');
    }

    /**
     * Maneja el evento de login.
     * Valida los inputs y guarda en localStorage.
     */
    function handleLogin() {
        const legajo = els.driverIdInput.value.trim();
        const tipoHorario = els.scheduleTypeInput.value.trim();

        // Validación: Legajo debe ser 5 dígitos exactos
        if (!/^\d{5}$/.test(legajo)) {
            alert("El legajo debe ser un número de exactamente 5 dígitos.");
            return;
        }

        // Validación: Tipo Horario no vacío
        if (tipoHorario.length === 0) {
            alert("Debe ingresar el tipo de horario.");
            return;
        }

        // Guardar datos
        const data = {
            legajo: legajo,
            tipoHorario: tipoHorario
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // Actualizar UI
        updateUI(data);
        closeModal();
        // alert("Ingreso exitoso."); // REMOVED ALERT TO FIX PLAYWRIGHT TIMING
    }

    /**
     * Maneja el evento de logout.
     * Borra los datos de localStorage y resetea la UI.
     */
    function handleLogout() {
        if (confirm("¿Está seguro que desea cerrar sesión?")) {
            localStorage.removeItem(STORAGE_KEY);
            updateUI(null);
            resetForm();
            // closeModal(); // Mantener abierto o cerrar? Mejor cerrar.
             // Actualizar estado visual dentro del modal también
             els.btnLogin.classList.remove('hidden');
             els.btnLogout.classList.add('hidden');
             els.driverIdInput.disabled = false;
             els.scheduleTypeInput.disabled = false;
        }
    }

    /**
     * Restaura la sesión desde localStorage al cargar la página.
     */
    function restoreSession() {
        const data = getStoredData();
        updateUI(data);
    }

    /**
     * Obtiene los datos guardados.
     * @returns {Object|null} Datos de login o null.
     */
    function getStoredData() {
        const raw = localStorage.getItem(STORAGE_KEY);
        try {
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Actualiza la interfaz principal (Modo Conducción) según el estado del login.
     * @param {Object|null} data - Datos del usuario logueado.
     */
    function updateUI(data) {
        if (data) {
            els.displayLabel.textContent = `H Tipo: ${data.tipoHorario}`;
            els.openBtn.classList.add('active-login'); // Opcional: Estilo para indicar login
            els.openBtn.title = `Chofer: ${data.legajo}`;
        } else {
            els.displayLabel.textContent = "H Tipo: ----";
            els.openBtn.classList.remove('active-login');
            els.openBtn.title = "Login Chofer";
        }
    }

    return {
        init: init
    };
})();
